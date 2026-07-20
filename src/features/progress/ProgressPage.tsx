import type { AppDatabase } from '../../domain/model';
import { calculateExercisePerformance } from '../../domain/rules/performance';

interface Props { database: AppDatabase; }

export function ProgressPage({ database }: Props) {
  const completedSessions = database.sessions.filter((session) => session.status === 'completed' && !session.excludedFromInsights);
  const excludedCount = database.sessions.filter((session) => session.status === 'completed' && session.excludedFromInsights).length;
  const latest = completedSessions.at(-1);
  const latestVolume = latest?.exercises.reduce((sum, exercise) => sum + calculateExercisePerformance(exercise).workVolume, 0) ?? 0;
  const exposures = new Map<string, number>();
  for (const session of completedSessions) for (const exercise of session.exercises) exposures.set(exercise.exerciseId, (exposures.get(exercise.exerciseId) ?? 0) + 1);
  const calibratedExercises = [...exposures.values()].filter((count) => count >= 3).length;
  return <main className="page progress-page"><section className="page-heading"><p className="eyebrow">Progress</p><h1>What appears to be happening?</h1><p>Evidence is visible now; claims remain deliberately cautious until comparable exposures accumulate.</p></section><section className="body-evidence-card"><div className="body-prototype" aria-label="Prototype body evidence surface"><svg viewBox="0 0 180 420" role="img" aria-label="Abstract body placeholder for the future personalised asset"><circle cx="90" cy="42" r="25" /><path d="M62 76 C42 110 44 174 58 210 L48 326 M118 76 C138 110 136 174 122 210 L132 326 M65 92 C72 138 72 212 61 276 L75 388 M115 92 C108 138 108 212 119 276 L105 388 M65 92 C79 82 101 82 115 92" />{Array.from({ length: 34 }, (_, index) => <circle key={index} cx={70 + ((index * 23) % 41)} cy={105 + ((index * 37) % 230)} r="2.4" className="body-dot" />)}</svg></div><div><p className="eyebrow">Body evidence surface · contract prototype</p><h2>{completedSessions.length < 3 ? 'Collecting evidence' : 'Early evidence available'}</h2><p>The final body asset will be personalised and muscle-addressable. This surface proves that evidence can attach to a stable body-view contract without pretending the placeholder is final artwork.</p><dl className="metric-list"><div><dt>Included sessions</dt><dd>{completedSessions.length}</dd></div><div><dt>Excluded sessions</dt><dd>{excludedCount}</dd></div><div><dt>Latest work volume</dt><dd>{Math.round(latestVolume)} kg</dd></div><div><dt>Exercises with 3+ exposures</dt><dd>{calibratedExercises}</dd></div></dl></div></section><section className="paper-card evidence-card"><p className="eyebrow">Metric method</p><h2>Work volume</h2><p>For this slice, the deterministic metric is load × repetitions across completed work sets. It is reproducible and intentionally avoids choosing an unresolved estimated-strength formula.</p></section></main>;
}
