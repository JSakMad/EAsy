import type { ClassPreference, TagType } from '@easy-a/core';

export const SYLLABUS_MAX_BYTES = 2 * 1024 * 1024;
export type SyllabusResult = { preferences: ClassPreference[]; tags: TagType[] };
export type SyllabusState = { error?: string; mismatch?: boolean; success?: string };
export class SyllabusError extends Error {
  constructor(message: string, public mismatch = false) { super(message); }
}
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const phrase = (text: string, value: string) => (` ${text} `).includes(` ${normalize(value)} `);

export function matchesSyllabus(text: string, target: { courseCode: string; courseTitle: string | null; professorName: string }) {
  // Identity belongs in the syllabus header, not in citations or assignments later in the file.
  const header = normalize(text.slice(0, 6000));
  const primaryCodes = [...text.slice(0, 1800).matchAll(/^(?:course(?: code| number)?[ \t]*[:\-][ \t]*)?([a-z]{2,10})[ \t-]*(\d{3,5}[a-z]{0,3})\b/gim)].filter(match => !['fall','spring','summer','winter','room','office'].includes(match[1]!.toLowerCase()));
  if (primaryCodes[0] && normalize(primaryCodes[0][1]!+primaryCodes[0][2]!) !== normalize(target.courseCode).replace(/ /g, '')) return false;
  const code = target.courseCode.match(/^([a-z]+)\s*(\d+[a-z]*)$/i);
  const codeMatches = code && new RegExp(`(?:^| )${code[1]!.toLowerCase()} ?${code[2]!.toLowerCase()}(?: |$)`).test(header);
  const name = normalize(target.professorName).replace(/^(?:(?:dr|professor|prof) )+/, '');
  const instructor = header.match(/(?:^| )(?:course instructor|instructor|professor|lecturer) (?:(?:dr|professor|prof) )?(.*)/)?.[1];
  const professorMatches = name.length >= 4 && instructor && (`${instructor} `).startsWith(`${name} `);
  return Boolean(codeMatches && target.courseTitle && phrase(header, target.courseTitle) && professorMatches);
}

type Rule = { preference: ClassPreference; tag?: TagType; topic: RegExp; positive: RegExp[] };
// Deliberately explicit declarations: uncertain or qualified language gets no check mark.
const rules: Rule[] = [
  { preference:'online_quizzes',tag:'online_quizzes',topic:/\bquiz(?:zes)?\b/,positive:[/^(?:all |weekly )?quizzes (?:are|will be) (?:administered |conducted |completed |taken )?online(?: (?:on|through|via) (?:canvas|moodle|blackboard))?$/,/^quizzes (?:are|will be) (?:administered|completed|taken) (?:on|through|via) (?:canvas|moodle|blackboard)$/] },
  { preference:'online_exams',tag:'online_exams',topic:/\b(?:exams?|tests?)\b/,positive:[/^(?:all )?(?:exams|tests) (?:are|will be) (?:administered |conducted |completed |taken )?online$/] },
  { preference:'online_classes',topic:/\b(?:class|course|lectures?|meetings?)\b/,positive:[/^(?:this |the )?(?:class|course) (?:is|will be) (?:fully |entirely |100 percent )?online$/,/^(?:all )?(?:lectures|class meetings) (?:are|will be) (?:held|conducted) online$/] },
  { preference:'open_book_exams',tag:'open_book_exam',topic:/\b(?:exams?|tests?|books?)\b/,positive:[/^(?:all )?(?:exams|tests) (?:are|will be) open book$/] },
  { preference:'optional_attendance',tag:'attendance_not_required',topic:/\battendance\b/,positive:[/^(?:class )?attendance is (?:optional|not required)$/,/^(?:class )?attendance (?:optional|not required)$/] },
  { preference:'flexible_deadlines',tag:'no_late_penalty',topic:/\b(?:late|deadlines?|penalt(?:y|ies))\b/,positive:[/^late (?:work|assignments|submissions) (?:is|are) accepted without (?:a )?penalt(?:y|ies)$/,/^there (?:is|are) no (?:late penalties|penalty for late (?:work|assignments))$/] },
  { preference:'flexible_deadlines',tag:'flexible_deadlines',topic:/\b(?:late|deadlines?|extensions?)\b/,positive:[/^(?:assignment )?deadlines are flexible$/] },
  { preference:'group_projects',topic:/\b(?:group|projects?)\b/,positive:[/^(?:the |a )?(?:final )?project (?:is|will be) (?:completed|done) in groups$/,/^(?:this |the )?course includes (?:a group project|group projects)$/] },
  { preference:'study_resources',tag:'provides_study_guide',topic:/\bstudy guides?\b/,positive:[/^(?:a )?study guides? (?:is|are|will be) provided(?: before (?:each exam|exams))?$/] },
  { preference:'study_resources',tag:'posts_slides_or_notes',topic:/\b(?:slides|lecture notes)\b/,positive:[/^(?:lecture )?(?:slides|notes|slides and notes) (?:are|will be) posted (?:online|on canvas|on blackboard|on moodle)$/] },
  { preference:'study_resources',tag:'practice_exam_provided',topic:/\bpractice exams?\b/,positive:[/^(?:a )?practice exams? (?:is|are|will be) provided$/] },
  { preference:'lighter_homework',tag:'no_homework',topic:/\bhomework\b/,positive:[/^there is no homework$/,/^no homework (?:is|will be) assigned$/] },
  { preference:'quiz_retakes',topic:/\bquiz(?:zes)?\b/,positive:[/^quiz retakes are allowed$/,/^students (?:can|may) retake quizzes$/] },
  { preference:'quiz_retakes',tag:'unlimited_quiz_attempts',topic:/\bquiz(?:zes)?\b/,positive:[/^(?:unlimited quiz attempts are allowed|quizzes have unlimited attempts)$/] },
  { preference:'extra_credit',tag:'extra_credit_offered',topic:/\bextra credit\b/,positive:[/^extra credit (?:is|will be) (?:offered|available)$/] },
  { preference:'no_cumulative_final',tag:'no_cumulative_final',topic:/\b(?:final|cumulative)\b/,positive:[/^(?:the )?final (?:exam )?is (?:not cumulative|non cumulative)$/,/^there is no (?:cumulative final|final exam)$/] },
];

export function checkSyllabus(text: string, reported: readonly ClassPreference[]): SyllabusResult {
  const sentences = text.split(/[\n.!?;]+/).map(line => normalize(line)).filter(Boolean);
  const preferences = new Set<ClassPreference>();
  const tags = new Set<TagType>();
  for (const rule of rules) {
    if (!reported.includes(rule.preference)) continue;
    const positive = sentences.filter(line => rule.positive.some(pattern => pattern.test(line)));
    if (!positive.length) continue;
    // Any contrary/conditional declaration on this topic blocks automatic verification.
    const uncertain = sentences.some(line => rule.topic.test(line) && !positive.includes(line) && /\b(?:not|no|never|cannot|can t|isn t|aren t|won t|don t|doesn t|prohibited|forbidden|except|only|unless|if|may|might|required|mandatory|in person|closed book|penalty|penalties|subject to)\b/.test(line));
    if (uncertain) continue;
    preferences.add(rule.preference);
    if (rule.tag) tags.add(rule.tag);
  }
  return { preferences: [...preferences], tags: [...tags] };
}
