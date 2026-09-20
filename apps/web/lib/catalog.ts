import catalogData from '../../../config/course-catalog.json';

export type CatalogCourse = { code: string; title: string; fieldsOfStudy: string[]; alternateTitles: string[] };
export const CATALOG_COURSES: readonly CatalogCourse[] = catalogData.courses;
export const CATALOG_FIELDS = [...new Set(CATALOG_COURSES.flatMap(course => course.fieldsOfStudy))].sort();
export const CATALOG_PAGE_SIZE = 24;
const compact = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const byCode = new Map(CATALOG_COURSES.map(course => [compact(course.code), course]));
const indexed = CATALOG_COURSES.map(course => ({ course,
  code: compact(course.code), text: [course.code, course.title, ...course.alternateTitles, ...course.fieldsOfStudy].join(' ').toLowerCase(),
}));

export function getCatalogCourse(code: string) {
  try { return byCode.get(compact(decodeURIComponent(code))) ?? null; }
  catch { return null; }
}

export function searchCatalog(query = '', field = '', page = 1) {
  const q = query.trim().slice(0, 100);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const code = compact(q);
  const matches = indexed.filter(item => (!field || item.course.fieldsOfStudy.includes(field)) &&
    (!q || item.code.includes(code) || words.every(word => item.text.includes(word))));
  matches.sort((a,b) => Number(b.code === code) - Number(a.code === code) || a.course.code.localeCompare(b.course.code));
  const pages = Math.max(1, Math.ceil(matches.length / CATALOG_PAGE_SIZE));
  const currentPage = Math.min(pages, Math.max(1, Math.trunc(Number.isFinite(page) ? page : 1)));
  return { courses: matches.slice((currentPage-1)*CATALOG_PAGE_SIZE, currentPage*CATALOG_PAGE_SIZE).map(item => item.course),
    total: matches.length, pages, page: currentPage };
}
