// Positive allowlists keep private fields private even if repository queries later grow.
export function publicOffering(row: Record<string, unknown>) {
  const fields = ['id','courseCode','courseTitle','professorName','department','score','gradeAPct',
    'gradeResponseCount','avgDifficulty','tagBonus','reviewCount','gradeComponent','difficultyComponent',
    'tagComponent','computedAt','tags','overallQuality','overallDifficulty','wouldTakeAgainPct'];
  const result = Object.fromEntries(fields.filter(k=>k in row).map(k=>[k,row[k]]));
  const id=Number(row.rmpLegacyId);
  return {...result,rmpUrl:!row.isDemo && Number.isSafeInteger(id) && id>0 ? `https://www.ratemyprofessors.com/professor/${id}` : null};
}
export function publicTag(row: Record<string,unknown>) {
  return {tagType:row.tagType,mentionCount:row.mentionCount,confidence:row.confidence};
}
