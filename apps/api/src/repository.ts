import { pool } from "./db/client.js";
import {PITT_SUBJECT_CODES,isCanonicalCourseCode} from '@easy-a/core';

export interface Repository {
  courses(schoolId: string): Promise<any[]>;
  departments(schoolId: string): Promise<unknown[]>;
  offerings(departmentId: string | null, courseCode?: string): Promise<any[]>;
  offering(id: string): Promise<any | null>;
  offeringTags(id: string): Promise<unknown[]>;
}

const LATEST_SCORE = `LEFT JOIN LATERAL (
  SELECT * FROM easy_a_score_snapshots s WHERE s.offering_id=o.id ORDER BY computed_at DESC LIMIT 1
) s ON true`;

function slugSql(column: string) { return `trim(both '-' from lower(regexp_replace(${column}, '[^a-zA-Z0-9]+', '-', 'g')))`; }

export const repository: Repository = {
  async courses(schoolId) {
    const result = await pool.query(`SELECT c.course_code,c.course_title,count(DISTINCT p.id)::int AS professor_count,
      count(r.id)::int AS review_count FROM courses c JOIN schools sc ON sc.id=c.school_id
      JOIN professor_course_offerings o ON o.course_id=c.id JOIN professors p ON p.id=o.professor_id
      JOIN reviews r ON r.offering_id=o.id
      WHERE sc.rmp_school_id=$1 AND NOT p.is_demo AND split_part(c.course_code,' ',1)=ANY($2::text[])
      GROUP BY c.id ORDER BY review_count DESC,c.course_code`, [schoolId,PITT_SUBJECT_CODES]);
    return result.rows.filter(r=>isCanonicalCourseCode(r.course_code)).map(camelize);
  },
  async departments(schoolId) {
    const result = await pool.query(
      `SELECT ${slugSql("p.department")} AS id,p.department AS name,count(DISTINCT o.id)::int AS offering_count
       FROM schools sc JOIN professors p ON p.school_id=sc.id
       JOIN professor_course_offerings o ON o.professor_id=p.id
       JOIN courses c ON c.id=o.course_id
       WHERE (sc.id::text=$1 OR sc.rmp_school_id=$1) AND NOT p.is_demo
       AND split_part(c.course_code,' ',1)=ANY($2::text[])
       AND EXISTS (SELECT 1 FROM reviews r WHERE r.offering_id=o.id)
       GROUP BY p.department ORDER BY p.department`, [schoolId,PITT_SUBJECT_CODES],
    );
    return result.rows.map(camelize);
  },
  async offerings(departmentId, courseCode) {
    const result = await pool.query(
      `SELECT o.id,c.course_code,c.course_title,p.name AS professor_name,p.department,p.rmp_legacy_id,
       s.score,s.grade_a_pct,s.grade_response_count,s.avg_difficulty,s.tag_bonus,s.review_count,
       s.grade_component,s.difficulty_component,s.tag_component,s.computed_at,
       coalesce(array_remove(array_agg(DISTINCT t.tag_type),NULL),'{}') AS tags
       FROM professor_course_offerings o
       JOIN professors p ON p.id=o.professor_id JOIN courses c ON c.id=o.course_id
       ${LATEST_SCORE}
       LEFT JOIN reviews r ON r.offering_id=o.id LEFT JOIN tags t ON t.review_id=r.id
       WHERE ($1::text IS NULL OR ${slugSql("p.department")}=$1) AND NOT p.is_demo
       AND ($2::text IS NULL OR c.course_code=$2)
       AND split_part(c.course_code,' ',1)=ANY($3::text[])
       AND c.school_id IN (SELECT id FROM schools WHERE rmp_school_id='1247')
       AND EXISTS (SELECT 1 FROM reviews actual WHERE actual.offering_id=o.id)
       GROUP BY o.id,c.course_code,c.course_title,p.name,p.department,p.rmp_legacy_id,
       s.score,s.grade_a_pct,s.grade_response_count,s.avg_difficulty,s.tag_bonus,s.review_count,
       s.grade_component,s.difficulty_component,s.tag_component,s.computed_at
       ORDER BY s.score DESC NULLS LAST,s.review_count DESC NULLS LAST,c.course_code,p.name`, [departmentId,courseCode ?? null,PITT_SUBJECT_CODES],
    );
    return result.rows.map(camelize);
  },
  async offering(id) {
    const result = await pool.query(
      `SELECT o.id,c.course_code,c.course_title,p.name AS professor_name,p.department,p.rmp_legacy_id,
       p.overall_quality,p.overall_difficulty,p.would_take_again_pct,
       s.score,s.grade_a_pct,s.grade_response_count,s.avg_difficulty,s.tag_bonus,s.review_count,
       s.grade_component,s.difficulty_component,s.tag_component,s.computed_at,
       coalesce(array_remove(array_agg(DISTINCT t.tag_type),NULL),'{}') AS tags
       FROM professor_course_offerings o
       JOIN professors p ON p.id=o.professor_id JOIN courses c ON c.id=o.course_id
       ${LATEST_SCORE}
       LEFT JOIN reviews r ON r.offering_id=o.id LEFT JOIN tags t ON t.review_id=r.id
       WHERE o.id=$1 AND NOT p.is_demo
       AND split_part(c.course_code,' ',1)=ANY($2::text[])
       AND EXISTS (SELECT 1 FROM reviews actual WHERE actual.offering_id=o.id)
       GROUP BY o.id,c.course_code,c.course_title,p.name,p.department,p.rmp_legacy_id,
       p.overall_quality,p.overall_difficulty,p.would_take_again_pct,
       s.score,s.grade_a_pct,s.grade_response_count,s.avg_difficulty,s.tag_bonus,s.review_count,
       s.grade_component,s.difficulty_component,s.tag_component,s.computed_at`, [id,PITT_SUBJECT_CODES],
    );
    return result.rows[0] ? camelize(result.rows[0]) : null;
  },
  async offeringTags(id) {
    const result = await pool.query(
      `SELECT t.tag_type,count(*)::int AS mention_count,max(t.confidence)::float AS confidence
       FROM tags t JOIN reviews r ON r.id=t.review_id WHERE r.offering_id=$1
       GROUP BY t.tag_type ORDER BY mention_count DESC,t.tag_type`, [id],
    );
    return result.rows.map(camelize);
  },
};

function camelize(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
}
