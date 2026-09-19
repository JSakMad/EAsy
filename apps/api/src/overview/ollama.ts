import {z} from 'zod';
import {LOCAL_URL,MODEL,messages,reviewChunks,summarySchema,validateSummary,type Review,type Summary} from './policy.js';
export class LocalSummarizer {
  constructor(private fetcher:typeof fetch=fetch){}
  private async request(path:string,body?:unknown) {
    const response=await this.fetcher(LOCAL_URL+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(240000),
      headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw new Error('Local model unavailable');
    return response.json();
  }
  async verify() {
    const tags=await this.request('/api/tags');
    if(!tags.models?.some((m:{name:string;size:number})=>m.name===MODEL&&m.size>1000000000))throw new Error('Required local model is not installed');
    const info=await this.request('/api/show',{model:MODEL});
    if(info.remote_host||info.remote_model)throw new Error('Cloud model is not permitted');
  }
  private async chat(stage:string,input:unknown,reviews:Review[],ids:number[]) {
    for(let attempt=0;attempt<2;attempt++) {
      const task=stage+(attempt?' A previous attempt failed output checks. Rewrite in your own words, under 200 words total. Use only supplied numeric evidence IDs. No copied sentences, names, contact details, links, percentages, or grade guarantees.':'');
      const result=await this.request('/api/chat',{model:MODEL,stream:false,think:false,keep_alive:'2m',
        format:z.toJSONSchema(summarySchema),options:{temperature:0,seed:7,num_ctx:8192,num_predict:1500},messages:messages(task,input)});
      if(!result.done||result.done_reason==='length')throw new Error('Incomplete model response');
      try {return validateSummary(JSON.parse(result.message.content),reviews,ids);}
      catch {if(attempt===1)throw new Error('Model output failed safety or schema checks after two attempts');}
    }
    throw new Error('No validated model output');
  }
  async summarize(reviews:Review[]):Promise<Summary> {
    await this.verify();
    const chunks=reviewChunks(reviews);
    if(chunks.length>100)throw new Error('Offering exceeds this job size limit; no partial summary saved');
    let notes:Summary[]=[];
    for(const [i,chunk] of chunks.entries()) {
      console.log(`Summarizing review batch ${i+1}/${chunks.length} locally.`);
      notes.push(await this.chat(chunks.length===1?'Summarize all supplied reviews for this pairing. Preserve disagreements and qualify isolated anecdotes.':'Summarize this batch. It is a subset: preserve disagreements and do not claim whole-course consensus.',chunk,reviews,[...new Set(chunk.map(r=>r.reviewId))]));
    }
    while(notes.length>1) {
      const merged:Summary[]=[];
      for(let i=0;i<notes.length;i+=3) {
        const group=notes.slice(i,i+3);
        merged.push(group.length===1?group[0]!:await this.chat('Combine these batch summaries into one balanced overview. Evidence IDs may overlap across batches; do not treat fragments as additional students. Preserve contradictions and supported temporal differences.',group,reviews,[...new Set(group.flatMap(n=>n.evidenceIds))]));
      }
      notes=merged;
    }
    if(!notes[0])throw new Error('No review content');
    return notes[0];
  }
}
