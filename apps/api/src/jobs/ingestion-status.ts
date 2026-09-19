import { closeDatabase,pool } from '../db/client.js';
try {
  const control=(await pool.query(`SELECT discovery_complete,reported_professor_count,request_day::text,requests_today,next_request_at,blocked_reason
    FROM ingestion_control WHERE source='rmp'`)).rows[0];
  const counts=(await pool.query(`SELECT
    (SELECT count(*)::int FROM ingestion_queue) AS discovered_professors,
    (SELECT count(*)::int FROM ingestion_queue WHERE last_completed_at IS NOT NULL) AS imported_professors,
    (SELECT count(*)::int FROM ingestion_queue WHERE last_completed_at IS NULL) AS never_imported,
    (SELECT count(*)::int FROM ingestion_queue WHERE last_completed_at IS NULL OR last_completed_at < now()-interval '7 days') AS due_professors,
    (SELECT count(*)::int FROM ingestion_page_cache) AS saved_pages,
    (SELECT count(*)::int FROM ingestion_quarantine) AS unresolved_reviews,
    (SELECT count(*)::int FROM reviews r JOIN professor_course_offerings o ON o.id=r.offering_id JOIN professors p ON p.id=o.professor_id WHERE NOT p.is_demo) AS real_reviews,
    (SELECT count(DISTINCT o.course_id)::int FROM professor_course_offerings o JOIN professors p ON p.id=o.professor_id JOIN reviews r ON r.offering_id=o.id WHERE NOT p.is_demo) AS courses_with_imports`)).rows[0];
  console.log(JSON.stringify({scope:'Pitt RMP reviews; not a current-term course catalog',...control,...counts},null,2));
  console.table((await pool.query('SELECT started_at,status,requests,professors_completed,message FROM ingestion_runs ORDER BY started_at DESC LIMIT 5')).rows);
  console.table((await pool.query(`SELECT p.name,q.review_id,q.raw_course,q.reason,q.candidates FROM ingestion_quarantine q
    JOIN professors p ON p.id=q.professor_id ORDER BY q.updated_at DESC LIMIT 20`)).rows);
} finally {await closeDatabase();}
