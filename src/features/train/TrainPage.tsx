import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDatabase, SetRecord } from '../../domain/model';
import { MODE_PRESENTATION } from '../../domain/presentation';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import { getTrackingPresentation, isSetComplete } from '../../domain/tracking';
import { SetEntryRow } from '../../components/SetEntryRow';
import type { RestTimerStart } from '../timer/useRestTimer';
import { ExerciseDetailsOverlay } from './ExerciseDetailsOverlay';

interface Props {
  database: AppDatabase;
  onUpdateSet: (sessionId: string, sessionExerciseId: string, setId: string, patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>) => Promise<void>;
  onAddSet: (sessionId: string, sessionExerciseId: string) => Promise<void>;
  onRemoveSet: (sessionId: string, sessionExerciseId: string, setId: string) => Promise<void>;
  onCompleteExercise: (sessionId: string, sessionExerciseId: string) => Promise<void>;
  onCompleteSession: (sessionId: string) => Promise<void>;
  onGoBrief: () => void;
  onProgressState: (progress: number, condensed: boolean) => void;
  onStartRest: (input: RestTimerStart) => void;
}

interface UndoRecord {
  sessionId: string; exerciseId: string; setId: string;
  previous: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres'>>;
}

function statusLabel(status: string, expanded: boolean) {
  if (status === 'completed') return 'Done';
  if (expanded) return 'Active';
  return 'Up next';
}
function targetSuffix(metric: string) { return metric === 'duration' ? 'sec' : metric === 'distance' ? 'm' : 'reps'; }

export function TrainPage({ database, onUpdateSet, onAddSet, onRemoveSet, onCompleteExercise, onCompleteSession, onGoBrief, onProgressState, onStartRest }: Props) {
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [detailsExerciseId, setDetailsExerciseId] = useState<string | null>(null);
  const [undoRecord, setUndoRecord] = useState<UndoRecord | null>(null);
  const progressAnchorRef = useRef<HTMLDivElement | null>(null);
  const session = database.sessions.find((candidate) => candidate.id === database.activeSessionId);
  const exerciseStatusKey = session?.exercises.map((exercise) => `${exercise.id}:${exercise.status}`).join('|') ?? '';

  useEffect(() => {
    if (!session) { setExpandedExerciseId(null); setDetailsExerciseId(null); setUndoRecord(null); return; }
    const expanded = session.exercises.find((exercise) => exercise.id === expandedExerciseId);
    if (!expanded || expanded.status === 'completed') {
      const next = session.exercises.find((exercise) => exercise.status !== 'completed') ?? session.exercises.at(-1);
      setExpandedExerciseId(next?.id ?? null);
    }
  }, [session?.id, exerciseStatusKey, expandedExerciseId]);

  useEffect(() => { if (!undoRecord) return; const timeout = window.setTimeout(() => setUndoRecord(null), 5000); return () => window.clearTimeout(timeout); }, [undoRecord]);
  const completed = session?.exercises.filter((exercise) => exercise.status === 'completed').length ?? 0;
  const progress = session ? completed / Math.max(session.exercises.length, 1) : 0;

  useEffect(() => {
    if (!session) { onProgressState(0, false); return; }
    onProgressState(progress, false);
    const target = progressAnchorRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry) onProgressState(progress, !entry.isIntersecting); }, { threshold: 0.08 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [session?.id, progress, onProgressState]);

  const performanceByExercise = useMemo(() => {
    if (!session) return new Map<string, ReturnType<typeof calculateExercisePerformance>>();
    return new Map(session.exercises.map((exercise) => [exercise.id, calculateExercisePerformance(exercise)]));
  }, [session]);

  if (!session) return <main className="page empty-page"><p className="eyebrow">Train</p><h1>Nothing active.</h1><p>Pick a day in Brief.</p><button className="primary-action" onClick={onGoBrief}>Open Brief</button></main>;

  async function updateSetWithUndo(exerciseId: string, set: SetRecord, patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>) {
    const exercise = session?.exercises.find((candidate) => candidate.id === exerciseId);
    if (!session || !exercise) return;
    const previous: UndoRecord['previous'] = {};
    if ('load' in patch) previous.load = set.load;
    if ('reps' in patch) previous.reps = set.reps;
    if ('durationSeconds' in patch) previous.durationSeconds = set.durationSeconds;
    if ('distanceMetres' in patch) previous.distanceMetres = set.distanceMetres;
    const wasComplete = isSetComplete(set, exercise.trackingSnapshot);
    const willComplete = isSetComplete({ ...set, ...patch }, exercise.trackingSnapshot);
    setUndoRecord({ sessionId: session.id, exerciseId, setId: set.id, previous });
    await onUpdateSet(session.id, exerciseId, set.id, patch);
    if (!wasComplete && willComplete) onStartRest({ exerciseId, exerciseName: exercise.exerciseNameSnapshot, seconds: exercise.prescription.restSeconds });
  }

  async function undoLastSetEdit() {
    if (!undoRecord) return;
    const record = undoRecord; setUndoRecord(null);
    await onUpdateSet(record.sessionId, record.exerciseId, record.setId, record.previous);
  }

  async function completeExercise(exerciseId: string) {
    if (!session) return;
    setUndoRecord(null);
    await onCompleteExercise(session.id, exerciseId);
  }

  const detailsExercise = session.exercises.find((exercise) => exercise.id === detailsExerciseId) ?? null;
  return <main className="page train-page">
    <header className="session-header" ref={progressAnchorRef}><div><p className="eyebrow">Active session</p><h1>{session.day} · {MODE_PRESENTATION[session.mode].name}</h1>{session.bodyweightSnapshotKg !== null && <small className="session-snapshot">Bodyweight snapshot {session.bodyweightSnapshotKg.toFixed(1)} kg</small>}</div><div className="session-progress"><span>{completed}/{session.exercises.length}</span><div><i style={{ width: `${progress * 100}%` }} /></div></div></header>
    <section className="exercise-stack">{session.exercises.map((exercise, index) => {
      const performance = performanceByExercise.get(exercise.id) ?? calculateExercisePerformance(exercise);
      const cue = database.exercises.find((item) => item.id === exercise.exerciseId)?.essentialCue;
      const isExpanded = expandedExerciseId === exercise.id;
      const isComplete = exercise.status === 'completed';
      const presentation = getTrackingPresentation(exercise.trackingSnapshot, exercise.sets[0]?.unit ?? database.profile.units);
      const targetUnit = targetSuffix(exercise.trackingSnapshot.metric);
      return <article className={`exercise-card ${isExpanded ? 'is-expanded' : 'is-compact'} ${isComplete ? 'is-complete' : ''}`} key={exercise.id} style={{ zIndex: session.exercises.length - index }}>
        <button className="exercise-card-toggle" type="button" aria-expanded={isExpanded} onClick={() => setExpandedExerciseId(exercise.id)}><div><p className="eyebrow">{index + 1} · {exercise.importanceSnapshot}</p><h2>{exercise.exerciseNameSnapshot}</h2></div><span className="status-chip">{statusLabel(exercise.status, isExpanded)}</span></button>
        {!isExpanded && <div className="compact-prescription"><strong>{exercise.prescription.sets} × {exercise.prescription.repMin}–{exercise.prescription.repMax} {targetUnit}</strong>{presentation.requiresStartingValue && <span>{presentation.valueLabel} {exercise.plannedLoad} {presentation.valueSuffix}</span>}<span>{exercise.prescription.restSeconds}s rest</span></div>}
        {isExpanded && <div className="exercise-card-body"><div className="prescription-row"><strong>{exercise.prescription.sets} × {exercise.prescription.repMin}–{exercise.prescription.repMax} {targetUnit}</strong><span>{exercise.prescription.restSeconds}s rest</span>{presentation.requiresStartingValue && <span>{presentation.valueLabel} {exercise.plannedLoad} {presentation.valueSuffix}</span>}</div>{exercise.movementReason === 'active_experiment' && <p className="experiment-notice">Lab test · temporary value.</p>}{cue && <p className="setup-cue">{cue}</p>}<div className="set-table">{exercise.sets.map((set) => <SetEntryRow key={set.id} set={set} tracking={exercise.trackingSnapshot} bodyweightKg={exercise.bodyweightSnapshotKg} onChange={(patch) => { void updateSetWithUndo(exercise.id, set, patch); }} onRemove={set.kind === 'additional' ? () => { void onRemoveSet(session.id, exercise.id, set.id); } : undefined} />)}</div><button className="add-set-button" type="button" onClick={() => { void onAddSet(session.id, exercise.id); }}>＋ Add set</button>{performance.repDropWarning && <p className="warning-card">Reps dropped by more than three at the same load. Rest longer; if it repeats, reduce load by 5–10%.</p>}<footer><span>{Math.round(performance.primaryTotal)} {performance.primaryUnit} logged</span><div className="exercise-footer-actions"><button className="text-button details-button" type="button" onClick={() => setDetailsExerciseId(exercise.id)}>Details</button><button className="secondary-action" disabled={exercise.status === 'completed'} onClick={() => { void completeExercise(exercise.id); }}>{exercise.status === 'completed' ? 'Completed' : 'Complete exercise'}</button></div></footer></div>}
      </article>;
    })}</section>
    <button className="completion-action" onClick={() => onCompleteSession(session.id)}>Complete session</button>
    {undoRecord && <div className="undo-toast"><span>Set updated</span><button type="button" onClick={() => { void undoLastSetEdit(); }}>Undo</button></div>}
    <ExerciseDetailsOverlay database={database} exercise={detailsExercise} onClose={() => setDetailsExerciseId(null)} />
  </main>;
}
