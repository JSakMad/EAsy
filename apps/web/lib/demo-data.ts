import type { Department, Offering } from "./types";

export const demoDepartments: Department[] = [
  { id: "computer-science", name: "Computer Science", offeringCount: 5 },
  { id: "economics", name: "Economics", offeringCount: 4 },
  { id: "history", name: "History", offeringCount: 3 },
];

export const demoOfferings: Offering[] = [
  { id:"demo-1",courseCode:"CS 0007",courseTitle:"Introduction to Computer Programming",professorName:"Jordan Lee",department:"Computer Science",score:88.6,gradeAPct:94,gradeResponseCount:17,avgDifficulty:1.7,tagBonus:.6,reviewCount:21,gradeComponent:47,difficultyComponent:28.9,tagComponent:9,tags:["online_exams","notecard_allowed","attendance_not_required","easy_a_explicit_mention"] },
  { id:"demo-2",courseCode:"CS 0441",courseTitle:"Discrete Structures",professorName:"Taylor Brooks",department:"Computer Science",score:79.1,gradeAPct:86,gradeResponseCount:28,avgDifficulty:2.2,tagBonus:.45,reviewCount:34,gradeComponent:43,difficultyComponent:24.5,tagComponent:6.8,tags:["open_book_exam","curve_applied","attendance_not_required"] },
  { id:"demo-3",courseCode:"CS 0445",courseTitle:"Data Structures",professorName:"Morgan Patel",department:"Computer Science",score:72.8,gradeAPct:78,gradeResponseCount:49,avgDifficulty:2.5,tagBonus:.3,reviewCount:61,gradeComponent:39,difficultyComponent:21.9,tagComponent:4.5,tags:["notecard_allowed","curve_applied"] },
  { id:"demo-4",courseCode:"CS 0447",courseTitle:"Computer Organization & Assembly",professorName:"Casey Nguyen",department:"Computer Science",score:65.4,gradeAPct:67,gradeResponseCount:13,avgDifficulty:2.4,tagBonus:.6,reviewCount:18,gradeComponent:33.5,difficultyComponent:22.9,tagComponent:9,tags:["online_exams","no_cumulative_final","curve_applied","group_project_heavy"] },
  { id:"demo-5",courseCode:"CS 1501",courseTitle:"Algorithm Implementation",professorName:"Riley Thompson",department:"Computer Science",score:null,gradeAPct:100,gradeResponseCount:3,avgDifficulty:2.3,tagBonus:.15,reviewCount:3,gradeComponent:50,difficultyComponent:23.6,tagComponent:2.3,tags:["open_book_exam"] },
];
