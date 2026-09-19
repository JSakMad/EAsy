import { getCourses } from "@/lib/api";
import { BrowseExperience } from "@/components/browse-experience";
import { checkStudentSetup } from "@/lib/profile-access";

export default async function Home({searchParams}:{searchParams:Promise<{course?:string}>}) {
  await checkStudentSetup();
  const courses=await getCourses();
  const params=await searchParams;
  return <BrowseExperience courses={courses.data} demo={courses.demo} initialCode={params.course} />;
}
