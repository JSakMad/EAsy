import { getCourses } from "@/lib/api";
import { BrowseExperience } from "@/components/browse-experience";
import { checkStudentSetup } from "@/lib/profile-access";

import { CATALOG_COURSES } from '@/lib/catalog';

export default async function Home({searchParams}:{searchParams:Promise<{course?:string}>}) {
  const profile = await checkStudentSetup();
  const courses=await getCourses();
  const params=await searchParams;
  const byCode = new Map(courses.data.map(course => [course.courseCode, course]));
  if (!courses.demo) for (const course of CATALOG_COURSES) {
    const existing = byCode.get(course.code);
    byCode.set(course.code, {courseCode:course.code,professorCount:0,reviewCount:0,...existing,courseTitle:course.title,fieldsOfStudy:course.fieldsOfStudy,alternateTitles:course.alternateTitles});
  }
  return <BrowseExperience courses={[...byCode.values()]} demo={courses.demo} initialCode={params.course} preferences={profile?.preferences ?? null} />;
}
