import {parseArgs} from 'node:util';
import {pool,closeDatabase} from '../db/client.js';
import {generateOverview,getOverview} from '../overview/service.js';
try {
  const {values}=parseArgs({options:{offering:{type:'string'},limit:{type:'string',default:'5'},force:{type:'boolean'},status:{type:'boolean'}}});
  const limit=Number(values.limit);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Limit must be 1–100.');
  const rows=values.offering?[{id:values.offering}]:
    (await pool.query(`SELECT o.id FROM professor_course_offerings o JOIN professors p ON p.id=o.professor_id
      JOIN reviews r ON r.offering_id=o.id WHERE NOT p.is_demo GROUP BY o.id HAVING count(*)>=3 ORDER BY count(*) DESC,o.id`)).rows;
  let generated=0;let failed=false;
  for(const row of rows) {
    const current=await getOverview(row.id);
    if(values.status){console.log(`${row.id}: ${current?.status??'not_found'} (${current?.stats.reviewCount??0} reviews)`);continue;}
    if(!values.force&&current?.status==='ready')continue;
    if(generated>=limit)break;
    generated++;
    try {console.log(`${row.id}: ${await generateOverview(row.id,values.force)}.`);}
    catch(error) {
      const safeErrors=['Another overview generation job is running','Reviews changed during generation; result discarded','Model output failed safety or schema checks after two attempts','Incomplete model response','Required local model is not installed','Cloud model is not permitted','Local model unavailable','Offering exceeds this job size limit; no partial summary saved'];
      const reason=error instanceof Error&&safeErrors.includes(error.message)?error.message:'Local model access or output validation failed';
      console.error(`${row.id}: ${reason}. No new overview published; source reviews unchanged. Rerun this offering when ready.`);failed=true;
      if(reason!=='Model output failed safety or schema checks after two attempts'&&reason!=='Incomplete model response')break;
    }
  }
  if(failed)process.exitCode=1;
} finally {await closeDatabase();}
