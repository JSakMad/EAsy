import { demoDepartments, demoOfferings } from "./demo-data";
import type { Course, Department, Offering, Overview } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return (await response.json() as { data: T }).data;
  } catch { return null; }
}

export async function getDepartments(): Promise<{ data: Department[]; demo: boolean }> {
  const data = await get<Department[]>("/schools/1247/departments");
  return data !== null ? { data, demo: false } : { data: demoDepartments, demo: true };
}

export async function getCourses(): Promise<{data:Course[];demo:boolean}> {
  const data=await get<Course[]>('/schools/1247/courses');
  if(data!==null) return {data,demo:false};
  const codes=[...new Set(demoOfferings.map(o=>o.courseCode))];
  return {demo:true,data:codes.map(courseCode=>{
    const rows=demoOfferings.filter(o=>o.courseCode===courseCode);
    return {courseCode,courseTitle:rows[0]?.courseTitle??null,professorCount:rows.length,reviewCount:rows.reduce((n,r)=>n+r.reviewCount,0)};
  })};
}

export async function getOfferings(departmentId: string, demo = false): Promise<{ data: Offering[]; demo: boolean }> {
  if (demo) return { data: departmentId === 'computer-science' ? demoOfferings : [], demo: true };
  const data = await get<Offering[]>(`/departments/${encodeURIComponent(departmentId)}/offerings?sort=easy_a_score`);
  return { data: data ?? [], demo: false };
}

export async function getOffering(id: string): Promise<{ data: Offering | null; demo: boolean }> {
  if (id.startsWith("demo-")) return { data: demoOfferings.find((item) => item.id === id) ?? null, demo: true };
  const data = await get<Offering>(`/offerings/${encodeURIComponent(id)}`);
  return { data, demo: false };
}
export async function getOverview(id:string):Promise<Overview|null> {
  return id.startsWith('demo-')?null:get<Overview>(`/offerings/${encodeURIComponent(id)}/overview`);
}
