import type { AppDatabase } from '../../domain/model';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import type { MaisBelief, MaisBeliefEvidenceLink, MaisUnresolvedQuestion } from '../../mais/beliefGraph';
import type { MaisSystemSnapshot } from '../../mais/systemState';

interface Props {
  database: AppDatabase;
  maisSnapshot: MaisSystemSnapshot | null;
}

function beliefPriority(belief: MaisBelief): number {
  const status = belief.status === 'contested' ? 3 : belief.status === 'supported' ? 2 : belief.status === 'active' ? 1 : 0;
  return status * 10 + belief.supportWeight + belief.counterWeight;
}

function EvidenceList({
  title,
  links,
  empty,
}: {
  title: string;
  links: MaisBeliefEvidenceLink[];
  empty: string;
}) {
  return <section className="progress-evidence-column"><h3>{title}</h3>{links.length ? <ul>{links.map((link) => <li key={link.id}><p>{link.summary}</p><small>Weight {link.weight.toFixed(2)} · {link.provenanceRefs.length} source ref{link.provenanceRefs.length === 1 ? '' : 's'}</small></li>)}</ul> : <p className="muted-copy">{empty}</p>}</section>;
}

function QuestionList({ questions }: { questions: MaisUnresolvedQuestion[] }) {
  if (!questions.length) return null;
  return <section className="paper-card progress-question-card"><p className="eyebrow">Still unresolved</p><h2>What would change the conclusion?</h2><ul>{questions.slice(0, 8).map((question) => <li key={question.id}><strong>{question.question}</strong>{question.requiredEvidence.length > 0 && <span>{question.requiredEvidence.join(' · ')}</span>}</li>)}</ul></section>;
}

export function ProgressPage({ database, maisSnapshot }: Props) {
  const completedSessions = database.sessions.filter((session) => session.status === 'completed' && !session.excludedFromInsights);
  const excludedCount = database.sessions.filter((session) => session.status === 'completed' && session.excludedFromInsights).length;
  const latest = completedSessions.at(-1);
  const latestVolume = latest?.exercises.reduce((sum, exercise) => sum + calculateExercisePerformance(exercise).workVolume, 0) ?? 0;
  const exposures = new Map<string, number>();
  for (const session of completedSessions) for (const exercise of session.exercises) exposures.set(exercise.exerciseId, (exposures.get(exercise.exerciseId) ?? 0) + 1);
  const calibratedExercises = [...exposures.values()].filter((count) => count >= 3).length;

  const beliefs = [...(maisSnapshot?.beliefs.beliefs ?? [])]
    .filter((belief) => !['superseded', 'archived'].includes(belief.status))
    .sort((left, right) => beliefPriority(right) - beliefPriority(left) || right.updatedAt.localeCompare(left.updatedAt));
  const questions = (maisSnapshot?.beliefs.unresolvedQuestions ?? [])
    .filter((question) => ['open', 'research_requested'].includes(question.status))
    .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt));
  const recentAnalyses = [...(maisSnapshot?.analysisRuns ?? [])]
    .filter((run) => run.status === 'completed')
    .sort((left, right) => (right.completedAt ?? right.startedAt).localeCompare(left.completedAt ?? left.startedAt))
    .slice(0, 5);

  return <main className="page progress-page">
    <section className="page-heading"><p className="eyebrow">Progress</p><h1>What appears to be happening?</h1><p>Deterministic measurements, model interpretations and counter-evidence remain separate and inspectable.</p></section>

    <section className="body-evidence-card"><div className="body-prototype" aria-label="Prototype body evidence surface"><svg viewBox="0 0 180 420" role="img" aria-label="Abstract body placeholder for the future personalised asset"><circle cx="90" cy="42" r="25" /><path d="M62 76 C42 110 44 174 58 210 L48 326 M118 76 C138 110 136 174 122 210 L132 326 M65 92 C72 138 72 212 61 276 L75 388 M115 92 C108 138 108 212 119 276 L105 388 M65 92 C79 82 101 82 115 92" />{Array.from({ length: 34 }, (_, index) => <circle key={index} cx={70 + ((index * 23) % 41)} cy={105 + ((index * 37) % 230)} r="2.4" className="body-dot" />)}</svg></div><div><p className="eyebrow">Evidence coverage</p><h2>{completedSessions.length < 3 ? 'Collecting evidence' : 'Comparable history available'}</h2><p>The final body view will attach these records to stable muscle IDs. The current surface keeps the data contract visible without pretending the placeholder is the final visual.</p><dl className="metric-list"><div><dt>Included sessions</dt><dd>{completedSessions.length}</dd></div><div><dt>Excluded sessions</dt><dd>{excludedCount}</dd></div><div><dt>Latest work volume</dt><dd>{Math.round(latestVolume)} kg</dd></div><div><dt>Exercises with 3+ exposures</dt><dd>{calibratedExercises}</dd></div><div><dt>Active beliefs</dt><dd>{beliefs.length}</dd></div><div><dt>Reproducible analyses</dt><dd>{recentAnalyses.length}</dd></div></dl></div></section>

    {beliefs.length === 0 ? <section className="paper-card empty-card"><p className="eyebrow">Belief graph</p><h2>No interpretation yet.</h2><p>MAIS will add bounded claims only after a session event has been analysed. The raw training history remains available meanwhile.</p></section> : <section className="progress-belief-list" aria-label="MAIS beliefs">{beliefs.map((belief) => {
      const links = maisSnapshot?.beliefs.evidenceLinks.filter((link) => link.beliefId === belief.id) ?? [];
      const support = links.filter((link) => link.polarity === 'support');
      const counter = links.filter((link) => link.polarity === 'counter');
      return <article className="paper-card progress-belief-card" key={belief.id}>
        <header><div><p className="eyebrow">{belief.domain.replaceAll('_', ' ')}</p><h2>{belief.claim}</h2></div><span className="status-chip">{belief.status}</span></header>
        <dl className="metric-list compact-metrics"><div><dt>Confidence</dt><dd>{belief.confidence}</dd></div><div><dt>Current estimate</dt><dd>{Math.round(belief.probability * 100)}%</dd></div><div><dt>Support</dt><dd>{belief.supportWeight.toFixed(2)}</dd></div><div><dt>Counter</dt><dd>{belief.counterWeight.toFixed(2)}</dd></div></dl>
        <div className="progress-evidence-grid"><EvidenceList title="Supporting evidence" links={support} empty="No supporting evidence has been accepted yet." /><EvidenceList title="Counter-evidence" links={counter} empty="No counter-evidence has been attached yet." /></div>
        <small className="provenance-line">Belief {belief.id} · revision {belief.revision} · updated {new Date(belief.updatedAt).toLocaleString('en-GB')}</small>
      </article>;
    })}</section>}

    <QuestionList questions={questions} />

    <section className="paper-card progress-analysis-card"><p className="eyebrow">Reproducible analysis</p><h2>{recentAnalyses.length ? 'Recent completed runs' : 'No completed run yet'}</h2>{recentAnalyses.length ? <ul>{recentAnalyses.map((run) => <li key={run.id}><strong>{String(run.output.schema ?? 'Analysis result')}</strong><span>{String(run.output.recordCount ?? 0)} records · {run.executionMs.toFixed(1)} ms · {run.diagnostics[0] ?? 'No diagnostic'}</span></li>)}</ul> : <p>Qwen may generate a bounded analysis recipe only after the Governor routes a recognised complex question. My Mettle executes the recipe deterministically against an immutable snapshot.</p>}</section>

    <section className="paper-card evidence-card"><p className="eyebrow">Metric method</p><h2>Work volume</h2><p>The visible volume baseline is load × repetitions across completed work sets. Other tracking types use their own provenance-labelled comparable metrics rather than being coerced into kilograms.</p></section>
  </main>;
}
