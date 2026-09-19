import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { closeDatabase } from '../db/client.js';
import { config } from '../config.js';
import { ingestProfessor } from '../ingestion/ingest-professor.js';
import { RmpGraphQlSource, professorRelayId } from '../ingestion/rmp-source.js';
import { withIngestionLock } from '../ingestion/control.js';
import { BudgetReached, SourcePaused } from '../ingestion/http-client.js';

export interface ImportOptions { professor?: string; limit?: number; maxRequests?: number; discoverOnly?: boolean; discoverPages?: number; rediscover?: boolean }
export async function runImport(options: ImportOptions = {}) {
  return withIngestionLock(async client => {
    const source = new RmpGraphQlSource(client,options.maxRequests);
    const run = (await client.query('INSERT INTO ingestion_runs DEFAULT VALUES RETURNING id')).rows[0].id;
    let completed = 0;
    let status = 'complete';
    let message: string | null = null;
    let currentId: string | undefined;
    const results = [];
    try {
      // Rediscovery is manual, preserves the queue, and does not reset rate limits or access blocks.
      if (options.rediscover) await client.query("UPDATE ingestion_control SET discovery_cursor=NULL,discovery_complete=false WHERE source='rmp'");
      if (!options.professor) await source.discover(options.discoverPages ?? 1);
      if (!options.discoverOnly) {
        const professors = options.professor ? [{sourceId:professorRelayId(options.professor)}] : await source.listProfessors();
        for (const professor of professors.slice(0,options.limit ?? config.RMP_MAX_PROFESSORS_PER_RUN)) {
          currentId=professor.sourceId;
          const result=await ingestProfessor(source,currentId);
          results.push(result);
          completed++;
          console.log(`Saved ${result.professor}: ${result.reviews-result.quarantined} classified reviews, ${result.quarantined} awaiting course verification.`);
        }
      }
    } catch (error) {
      status = error instanceof BudgetReached ? 'budget_reached' : error instanceof SourcePaused ? 'paused' : 'failed';
      // Never log raw response bodies or review text.
      message = error instanceof BudgetReached || error instanceof SourcePaused ? error.message : 'Import or source validation failed. Saved pages were retained; inspect the schema and local diagnostics before retrying.';
      if (currentId) await client.query('UPDATE ingestion_queue SET last_error=$2 WHERE source_id=$1',[currentId,message]);
      console.error(message);
    } finally {
      await client.query('UPDATE ingestion_runs SET finished_at=now(),status=$2,requests=$3,professors_completed=$4,message=$5 WHERE id=$1',
        [run,status,source.http.requests,completed,message]);
    }
    console.log(`Run ${status}: ${source.http.requests} network requests, ${completed} complete professors. Use npm run ingest:status to see remaining work.`);
    return {status,requests:source.http.requests,completed,results,message};
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const {values} = parseArgs({options:{
      professor:{type:'string'},limit:{type:'string'},'max-requests':{type:'string'},
      'discover-only':{type:'boolean'},'discover-pages':{type:'string'},rediscover:{type:'boolean'},
    }});
    const integer = (value:string|undefined,fallback:number,max:number) => {
      const n=value===undefined?fallback:Number(value);
      if (!Number.isInteger(n)||n<1||n>max) throw new Error(`Expected an integer from 1 through ${max}.`);
      return n;
    };
    const result = await runImport({professor:values.professor,discoverOnly:values['discover-only'],rediscover:values.rediscover,
      limit:integer(values.limit,config.RMP_MAX_PROFESSORS_PER_RUN,config.RMP_MAX_PROFESSORS_PER_RUN),
      maxRequests:integer(values['max-requests'],config.RMP_MAX_REQUESTS_PER_RUN,config.RMP_MAX_REQUESTS_PER_RUN),
      discoverPages:integer(values['discover-pages'],1,10)});
    if (result.status==='paused'||result.status==='failed') process.exitCode=1;
  } catch (error) { console.error(error instanceof Error?error.message:'Import failed.');process.exitCode=1; }
  finally {await closeDatabase();}
}
