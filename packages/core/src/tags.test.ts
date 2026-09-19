import {describe,it,expect} from 'vitest';
import rules from '../../../config/tags.json';
import {extractTags,TAG_TYPES,TAG_LABELS,TAG_GROUPS,type TagRule,type TagType} from './index.js';
const typedRules=rules as Record<TagType,TagRule>;
const examples:[TagType,string][]=[["online_quizzes","online quizzes"],["online_quizzes","quizzes on Canvas"],["online_quizzes","took the quiz at home"],["unlimited_quiz_attempts","unlimited attempts"],["unlimited_quiz_attempts","can retake the quiz"],["unlimited_quiz_attempts","highest score counts"],["take_home_exam","take-home exam"],["take_home_exam","take the test home"],["take_home_exam","exam was take-home"],["unproctored_exam","unproctored"],["unproctored_exam","no proctoring"],["unproctored_exam","didn't watch us during the test"],["multiple_choice_only","all multiple choice"],["multiple_choice_only","no free response"],["multiple_choice_only","just Scantron"],["predictable_exam_format","exam is basically the homework"],["predictable_exam_format","test mirrors the practice problems"],["predictable_exam_format","exam felt exactly like the study guide"],["exam_reuses_old_questions","uses questions from old exams"],["exam_reuses_old_questions","recycled test questions"],["provides_study_guide","gives a study guide"],["provides_study_guide","study guide covers everything on the test"],["provides_study_guide","study guide is basically the exam"],["posts_slides_or_notes","posts the slides"],["posts_slides_or_notes","notes are online"],["posts_slides_or_notes","uploads lecture notes"],["practice_exam_provided","practice exam"],["practice_exam_provided","gives you a practice test"],["review_session_before_exam","review session"],["review_session_before_exam","goes over what's on the test beforehand"],["allows_past_exams","lets you use old exams to study"],["allows_past_exams","old tests are basically the same"],["drops_lowest_score","drops your lowest quiz"],["drops_lowest_score","drops the lowest homework grade"],["drops_lowest_score","drops two exams"],["extra_credit_offered","extra credit"],["extra_credit_offered","bonus points available"],["generous_curve","curves generously"],["generous_curve","everyone gets bumped up"],["generous_curve","curve saved my grade"],["participation_based_grading","easy points for participation"],["participation_based_grading","graded just for showing up"],["effort_based_grading","graded on completion, not correctness"],["effort_based_grading","full credit for trying"],["no_late_penalty","no penalty for late work"],["no_late_penalty","late submissions accepted with no deduction"],["light_homework_load","barely any homework"],["light_homework_load","homework takes 10 minutes"],["no_homework","no homework at all"],["flexible_deadlines","flexible due dates"],["flexible_deadlines","self-paced"],["few_graded_assignments","only 3 grades all semester"],["few_graded_assignments","grade is just two exams"],["gpa_booster_mention","GPA booster"],["gpa_booster_mention","joke class"],["gpa_booster_mention","blow-off class"],["gpa_booster_mention","took it for an easy grade"]];
describe('expanded tag vocabulary',()=>{
  it.each(examples)('extracts %s from %s',(tag,text)=>{
    expect(extractTags(text,typedRules).map(t=>t.type)).toContain(tag);
  });
  it('has one label, rule and filter group for every supported tag',()=>{
    expect(Object.keys(rules).sort()).toEqual([...TAG_TYPES].sort());
    expect(Object.keys(TAG_LABELS).sort()).toEqual([...TAG_TYPES].sort());
    expect(TAG_GROUPS.flatMap(g=>g.tags).sort()).toEqual([...TAG_TYPES].sort());
  });
  it.each(['No extra credit.','Extra credit was not offered.','There was never a practice exam.','There is not an easy A here.'])('rejects negation: %s',text=>{
    expect(extractTags(text,typedRules)).toEqual([]);
  });
  it('checks later matches and does not carry negation across sentences',()=>{
    expect(extractTags('No extra credit on the first test. Extra credit on the final.',typedRules).map(t=>t.type)).toContain('extra_credit_offered');
    expect(extractTags('No homework at all. Practice exam provided.',typedRules).map(t=>t.type)).toEqual(expect.arrayContaining(['no_homework','practice_exam_provided']));
  });
  it('separates online quizzes from online exams',()=>{
    expect(extractTags('online quizzes',typedRules).map(t=>t.type)).toEqual(['online_quizzes']);
  });
});
