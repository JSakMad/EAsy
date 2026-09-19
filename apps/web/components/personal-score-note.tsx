import { calculatePersonalScore, type ClassPreference } from '@easy-a/core';
import type { Offering } from '@/lib/types';

export function PersonalScoreNote({ offering, preferences, detailed = false }: {
  offering: Offering; preferences: readonly ClassPreference[]; detailed?: boolean;
}) {
  const result = calculatePersonalScore(offering, preferences);
  return <div className="personal-score-note">
    {result.score === null ? <p>More reviews are needed before preferences can affect this score.</p>
      : preferences.length === 0 ? <p>No preferences selected. Your score uses the review-based calculation.</p>
      : result.matches.length > 0 ? <>
        <p><strong>Matches your preferences:</strong> {result.matches.map(m => m.label).join(', ')}.</p>
        <p>Preference boost: +{result.bonus.toFixed(1)} points. {result.matches.some(m => m.mentions < 3) && 'Some matches have fewer than three review mentions.'}</p>
      </> : <p>No matching preferences reported yet. Your score uses the review-based calculation.</p>}
    {result.unavailable.length > 0 && <p>{result.unavailable.join(', ')}: saved, but not scored until class-format data is available.</p>}
    {detailed && <>
      {result.matches.length > 0 && <ul>{result.matches.map(m => <li key={m.id}>{m.label}: {m.mentions} review{m.mentions === 1 ? '' : 's'} supporting the strongest related signal.</li>)}</ul>}
      {result.unknown.length > 0 && <p>Not reported: {result.unknown.join(', ')}. Missing reports mean unknown, not that a feature is absent.</p>}
    </>}
  </div>;
}
