import { useMemo, useState } from 'react';
import { DAY_LABELS } from '../../data/seed';
import type { AppDatabase, DaySymbol, Mode } from '../../domain/model';
import { getCycleSnapshot } from '../../domain/rules/cycle';
import { ModeSelectionModal } from '../../components/ModeSelectionModal';
import type { MaisBelief } from '../../mais/beliefGraph';
import type { MaisSystemSnapshot } from '../../mais/systemState';

interface Props {
  database: AppDatabase;
  maisSnapshot: MaisSystemSnapshot | null;
  onBeginSession: (day: DaySymbol, mode: Mode) => Promise<void>;
}
interface BriefSuggestion { label: string; value: string; }

function buildSuggestions(hour: number, firstMovement?: string): BriefSuggestion[] {
  const carbohydrate = hour < 11 ? '30–60 g carbohydrate with breakfast or a light pre-workout meal.' : hour < 18 ? '30–60 g carbohydrate 1–3 hours before training; use the lower end if eating close to the session.' : '30–45 g easy carbohydrate if dinner is not already covering the session.';
  return [{ label: 'Carbohydrate', value: carbohydrate }, { label: 'Protein', value: '25–40 g protein in the 1–3 hours before training.' }, { label: 'Water', value: '500–750 ml across the hour before training.' }, { label: 'Warm-up', value: firstMovement ? `Two lighter sets before ${firstMovement}.` : 'Two lighter sets before the first working movement.' }];
}

function beliefScore(belief: MaisBelief): number {
  const status = belief.status === 'contested' ? 4 : belief.status === 'supported' ? 3 : belief.status === 'active' ? 2 : 0;
  const recency = Date.parse(belief.updatedAt) / 1e13;
  return status + belief.supportWeight + belief.counterWeight + recency;
}

export function BriefPage({ database, maisSnapshot, onBeginSession }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentCycle = database.cycles.find((item) => item.id === database.currentCycleId);
  if (!currentCycle) throw new Error('Current cycle missing.');
  const cycle = getCycleSnapshot(currentCycle);
  const [selectedDay, setSelectedDay] = useState<DaySymbol>(cycle.nextRecommendedDay);
  const completedCount = database.sessions.filter((session) => session.status === 'completed').length;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date());
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  const recommendedDay = routine?.days.find((day) => day.symbol === cycle.nextRecommendedDay);
  const recommendedExerciseCount = recommendedDay?.slots.length ?? 0;
  const firstExerciseId = recommendedDay?.slots[0]?.exerciseId;
  const firstMovement = database.exercises.find((exercise) => exercise.id === firstExerciseId)?.name;
  const suggestions = useMemo(() => buildSuggestions(new Date().getHours(), firstMovement), [firstMovement]);
  const openExperimentCount = database.experiments.filter((item) => ['active', 'ready_for_decision'].includes(item.status)).length;
  const currentBelief = [...(maisSnapshot?.beliefs.beliefs ?? [])]
    .filter((belief) => !['superseded', 'archived', 'rejected'].includes(belief.status))
    .sort((left, right) => beliefScore(right) - beliefScore(left))[0];
  const currentExperiment = [...database.experiments]
    .filter((experiment) => ['active', 'ready_for_decision'].includes(experiment.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const pendingResearch = maisSnapshot?.research.requests.find((request) => ['awaiting_user_export', 'exported'].includes(request.status));
  const queuedDeepTask = maisSnapshot?.heart.tasks.find((task) => ['queued', 'running', 'checkpointed'].includes(task.status) && task.requiredTier === 'deep');

  return <main className="page brief-page">
    <section className="hero-panel"><div className="hero-atmosphere" aria-hidden="true" /><div className="particle-field" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div><div className="brief-intro"><p className="eyebrow">{weekday} · {cycle.nextRecommendedDay}</p><h1>{DAY_LABELS[cycle.nextRecommendedDay]}.</h1><div className="brief-snapshot"><span>{recommendedExerciseCount} exercise{recommendedExerciseCount === 1 ? '' : 's'}</span><span>{cycle.completedCoreDays.length}/3 core days</span><span>{openExperimentCount} live test{openExperimentCount === 1 ? '' : 's'}</span></div></div><section className="brief-suggestions">{suggestions.map((suggestion) => <article key={suggestion.label}><span>{suggestion.label}</span><p>{suggestion.value}</p></article>)}</section><div className="brief-action-zone"><button className="primary-action brief-begin" onClick={() => { setSelectedDay(cycle.nextRecommendedDay); setModalOpen(true); }} disabled={Boolean(database.activeSessionId)}>{database.activeSessionId ? 'Session active' : `Begin ${cycle.nextRecommendedDay}`}</button><div className="day-override"><span>Or choose</span>{(['ψ', 'φ', 'π', '&'] as DaySymbol[]).map((day) => <button key={day} disabled={Boolean(database.activeSessionId) || (day === '&' && !cycle.andEligible)} onClick={() => { setSelectedDay(day); setModalOpen(true); }}>{day}</button>)}</div></div></section>

    {(currentBelief || currentExperiment || pendingResearch || queuedDeepTask) && <section className="brief-intelligence-grid" aria-label="Current intelligence">
      {currentBelief && <article className="paper-card brief-intelligence-card"><p className="eyebrow">Current finding · {currentBelief.status}</p><h2>{currentBelief.claim}</h2><p>{currentBelief.confidence} confidence · {Math.round(currentBelief.probability * 100)}% current estimate · {currentBelief.supportWeight.toFixed(2)} support / {currentBelief.counterWeight.toFixed(2)} counter.</p></article>}
      {currentExperiment && <article className="paper-card brief-intelligence-card"><p className="eyebrow">Active intervention</p><h2>{currentExperiment.exerciseName}</h2><p>{currentExperiment.baselineLoad} → {currentExperiment.proposedLoad} kg. {currentExperiment.status === 'ready_for_decision' ? 'The test is ready for your decision in Lab.' : 'The next matching exposure will run the temporary condition.'}</p></article>}
      {queuedDeepTask && <article className="paper-card brief-intelligence-card"><p className="eyebrow">Deep analysis queued</p><h2>{queuedDeepTask.goal}</h2><p>The current Qwen stand-in will run only when resources permit. All intermediate artefacts survive model unload.</p></article>}
      {pendingResearch && <article className="paper-card brief-intelligence-card"><p className="eyebrow">Manual research</p><h2>{pendingResearch.topic}</h2><p>{pendingResearch.status === 'awaiting_user_export' ? 'A focused request is ready to export from Settings.' : 'The request was exported and is awaiting a cited report.'}</p></article>}
    </section>}

    <section className="card-grid"><article className="paper-card featured-card"><p className="eyebrow">Next</p><h2>{cycle.nextRecommendedDay}</h2><p>{recommendedExerciseCount} movements in the current routine.</p></article><article className="paper-card"><p className="eyebrow">Cycle</p><h2>{cycle.completedCoreDays.length}/3</h2><p>& {cycle.andEligible ? 'open' : 'locked'}.</p></article><article className="paper-card"><p className="eyebrow">Evidence</p><h2>{completedCount}</h2><p>Completed session{completedCount === 1 ? '' : 's'}.</p></article><article className="paper-card"><p className="eyebrow">Lab</p><h2>{openExperimentCount}</h2><p>Active or ready for review.</p></article></section>
    {modalOpen && <ModeSelectionModal day={selectedDay} onClose={() => setModalOpen(false)} onSelect={async (mode) => { await onBeginSession(selectedDay, mode); setModalOpen(false); }} />}
  </main>;
}
