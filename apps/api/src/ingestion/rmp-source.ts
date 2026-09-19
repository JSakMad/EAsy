import type { PoolClient } from 'pg';
import { assertIngestionAllowed, config } from '../config.js';
import { RmpHttpClient } from './http-client.js';
import { PostgresRequestGate } from './control.js';
import { mapReview, nextCursor, searchSchema, teacherSchema, type TeacherPage } from './rmp-schema.js';
import type { IngestedProfessor, IngestedReview, IngestionSource, ProfessorSummary } from './types.js';
const PROFESSOR_QUERY = `query PittTeachers($query: TeacherSearchQuery!, $first: Int!, $after: String) {
  newSearch { teachers(query: $query, first: $first, after: $after) {
    resultCount edges { node { id legacyId firstName lastName school { legacyId } } }
    pageInfo { hasNextPage endCursor }
  } }
}`;
const RATINGS_QUERY = `query ProfessorRatings($id: ID!, $count: Int!, $cursor: String) {
  node(id: $id) { ... on Teacher {
    id legacyId firstName lastName department avgRating avgDifficulty wouldTakeAgainPercent school { legacyId }
    ratings(first: $count, after: $cursor) {
      edges { node { id legacyId class date grade difficultyRating helpfulRating clarityRating attendanceMandatory comment } }
      pageInfo { hasNextPage endCursor }
    }
  } }
}`;
export class RmpGraphQlSource implements IngestionSource {
  readonly name = 'rmp_graphql';
  readonly http: RmpHttpClient;
  constructor(private client: PoolClient, maxRequests = config.RMP_MAX_REQUESTS_PER_RUN) {
    assertIngestionAllowed();
    this.http = new RmpHttpClient(new PostgresRequestGate(client), maxRequests);
  }
  async discover(pages = 1) {
    const row = (await this.client.query("SELECT * FROM ingestion_control WHERE source='rmp'")).rows[0];
    if (row.discovery_complete) return;
    let cursor: string | null = row.discovery_cursor;
    const seen = new Set<string>(cursor ? [cursor] : []);
    for (let page=0; page<pages; page++) {
      const result = searchSchema.parse(await this.http.request(PROFESSOR_QUERY, {
        query: { text: '', schoolID: config.RMP_SCHOOL_RELAY_ID, fallback: false }, first: 20, after: cursor,
      })).newSearch.teachers;
      if (result.edges.length === 0 && !cursor) throw new Error('Pitt directory unexpectedly empty; discovery was not marked complete.');
      const next = nextCursor(result.pageInfo, seen);
      for (const { node } of result.edges) if (node.school.legacyId !== 1247) throw new Error('Search returned a non-Pitt professor; import stopped.');
      await this.client.query('BEGIN');
      try {
        for (const { node } of result.edges) await this.client.query(`INSERT INTO ingestion_queue(source_id,legacy_id,name) VALUES ($1,$2,$3)
          ON CONFLICT(source_id) DO UPDATE SET name=EXCLUDED.name,legacy_id=EXCLUDED.legacy_id`,
          [node.id,node.legacyId,`${node.firstName} ${node.lastName}`.trim()]);
        await this.client.query(`UPDATE ingestion_control SET discovery_cursor=$1,discovery_complete=$2,
          discovery_completed_at=CASE WHEN $2 THEN now() ELSE NULL END,reported_professor_count=$3 WHERE source='rmp'`,
          [next,!result.pageInfo.hasNextPage,result.resultCount]);
        await this.client.query('COMMIT');
      } catch (error) { await this.client.query('ROLLBACK'); throw error; }
      cursor=next;
      console.log(`Saved directory page: ${result.edges.length} Pitt professors; RMP reports ${result.resultCount} total.`);
      if (!cursor) break;
    }
  }
  async listProfessors(): Promise<ProfessorSummary[]> {
    const result = await this.client.query(`SELECT source_id,legacy_id,name FROM ingestion_queue
      WHERE last_completed_at IS NULL OR last_completed_at < now()-interval '7 days'
      ORDER BY last_completed_at NULLS FIRST, discovered_at, legacy_id LIMIT $1`, [config.RMP_MAX_PROFESSORS_PER_RUN]);
    return result.rows.map(r => ({sourceId:r.source_id,legacyId:r.legacy_id,name:r.name}));
  }
  async getProfessor(sourceId: string): Promise<IngestedProfessor> {
    let cursor: string | null = null;
    let teacher: TeacherPage | undefined;
    const reviews = new Map<string,IngestedReview>();
    const seen = new Set<string>();
    do {
      const cached = (await this.client.query('SELECT payload FROM ingestion_page_cache WHERE professor_id=$1 AND cursor=$2', [sourceId,cursor ?? ''])).rows[0];
      const payload = cached?.payload ?? await this.http.request<{node:unknown}>(RATINGS_QUERY, {id:sourceId,count:20,cursor});
      teacher = teacherSchema.parse(payload.node);
      if (teacher.id !== sourceId || teacher.school.legacyId !== 1247) throw new Error('Professor identity or Pitt school check failed.');
      const mapped = teacher.ratings.edges.map(({node}) => mapReview(node));
      const next = nextCursor(teacher.ratings.pageInfo, seen);
      if (!cached) await this.client.query(`INSERT INTO ingestion_page_cache(professor_id,cursor,payload) VALUES ($1,$2,$3)
        ON CONFLICT(professor_id,cursor) DO NOTHING`, [sourceId,cursor ?? '',JSON.stringify({node:teacher})]);
      for (const review of mapped) reviews.set(review.sourceId,review);
      cursor=next;
    } while (cursor);
    return {
      sourceId:teacher.id,legacyId:teacher.legacyId,name:`${teacher.firstName} ${teacher.lastName}`.trim(),
      department:teacher.department.trim() || 'Unknown', overallQuality:teacher.avgRating, overallDifficulty:teacher.avgDifficulty,
      wouldTakeAgainPct:teacher.wouldTakeAgainPercent !== null && teacher.wouldTakeAgainPercent >= 0 ? teacher.wouldTakeAgainPercent : null,
      reviews:[...reviews.values()],
    };
  }
}
export function professorRelayId(value: string): string {
  return /^\d+$/.test(value) ? Buffer.from(`Teacher-${value}`).toString('base64') : value;
}
