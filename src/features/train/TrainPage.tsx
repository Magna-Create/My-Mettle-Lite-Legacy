import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDatabase, SetRecord } from '../../domain/model';
import { MODE_PRESENTATION } from '../../domain/presentation';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import { SetEntryRow } from '../../components/SetEntryRow';

interface Props {
  database: AppDatabase;
  onUpdateSet: (
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
    patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'note'>>,
  ) => Promise<void>;
  onCompleteExercise: (sessionId: string, sessionExerciseId: string) => Promise<void>;
  onCompleteSession: (sessionId: string) => Promise<void>;
  onGoBrief: () => void;
  onProgressState: (progress: number, condensed: boolean) => void;
}

interface RestTimerState {
  exerciseId: string;
  total: number;
  remaining: number;
}

interface UndoRecord {
  sessionId: string;
  exerciseId: string;
  setId: string;
  previous: Partial<Pick<SetRecord, 'load' | 'reps'>>;
}

function statusLabel(status: string, expanded: boolean) {
  if (status === 'completed') return 'Done';
  if (expanded) return 'Active';
  return 'Up next';
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function TrainPage({
  database,
  onUpdateSet,
  onCompleteExercise,
  onCompleteSession,
  onGoBrief,
  onProgressState,
}: Props) {
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [undoRecord, setUndoRecord] = useState<UndoRecord | null>(null);
  const progressAnchorRef = useRef<HTMLDivElement | null>(null);
  const restDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = database.sessions.find((candidate) => candidate.id === database.activeSessionId);
  const exerciseStatusKey = session?.exercises.map((exercise) => `${exercise.id}:${exercise.status}`).join('|') ?? '';

  useEffect(() => {
    if (!session) {
      setExpandedExerciseId(null);
      setRestTimer(null);
      setUndoRecord(null);
      return;
    }

    const expanded = session.exercises.find((exercise) => exercise.id === expandedExerciseId);
    if (!expanded || expanded.status === 'completed') {
      const next = session.exercises.find((exercise) => exercise.status !== 'completed')
        ?? session.exercises.at(-1);
      setExpandedExerciseId(next?.id ?? null);
    }
  }, [session?.id, exerciseStatusKey, expandedExerciseId]);

  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.remaining <= 0) {
      const completeDelay = window.setTimeout(() => setRestTimer(null), 1200);
      return () => window.clearTimeout(completeDelay);
    }

    const interval = window.setInterval(() => {
      setRestTimer((current) => current
        ? { ...current, remaining: Math.max(0, current.remaining - 1) }
        : null);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [restTimer?.remaining]);

  useEffect(() => () => {
    if (restDelayRef.current) clearTimeout(restDelayRef.current);
  }, []);

  const completed = session?.exercises.filter((exercise) => exercise.status === 'completed').length ?? 0;
  const progress = session ? completed / Math.max(session.exercises.length, 1) : 0;

  useEffect(() => {
    if (!session) {
      onProgressState(0, false);
      return;
    }

    onProgressState(progress, false);
    const target = progressAnchorRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) onProgressState(progress, !entry.isIntersecting);
      },
      { threshold: 0.08 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [session?.id, progress, onProgressState]);

  const performanceByExercise = useMemo(() => {
    if (!session) return new Map<string, ReturnType<typeof calculateExercisePerformance>>();
    return new Map(session.exercises.map((exercise) => [exercise.id, calculateExercisePerformance(exercise)]));
  }, [session]);

  if (!session) {
    return (
      <main className="page empty-page">
        <p className="eyebrow">Train</p>
        <h1>Nothing active.</h1>
        <p>Pick a day in Brief.</p>
        <button className="primary-action" onClick={onGoBrief}>Open Brief</button>
      </main>
    );
  }

  async function updateSetWithUndo(
    exerciseId: string,
    set: SetRecord,
    restSeconds: number,
    patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'note'>>,
  ) {
    if (!session) return;

    const previous: Partial<Pick<SetRecord, 'load' | 'reps'>> = {};
    if ('load' in patch) previous.load = set.load;
    if ('reps' in patch) previous.reps = set.reps;

    setUndoRecord({ sessionId: session.id, exerciseId, setId: set.id, previous });
    await onUpdateSet(session.id, exerciseId, set.id, patch);

    if ('reps' in patch) {
      if (restDelayRef.current) clearTimeout(restDelayRef.current);
      if (patch.reps === null) {
        if (restTimer?.exerciseId === exerciseId) setRestTimer(null);
      } else {
        restDelayRef.current = setTimeout(() => {
          setRestTimer({ exerciseId, total: restSeconds, remaining: restSeconds });
        }, 650);
      }
    }
  }

  async function undoLastSetEdit() {
    if (!undoRecord) return;
    const record = undoRecord;
    setUndoRecord(null);
    await onUpdateSet(record.sessionId, record.exerciseId, record.setId, record.previous);
  }

  async function completeExercise(exerciseId: string) {
    if (!session) return;
    if (restDelayRef.current) clearTimeout(restDelayRef.current);
    if (restTimer?.exerciseId === exerciseId) setRestTimer(null);
    await onCompleteExercise(session.id, exerciseId);
  }

  return (
    <main className="page train-page">
      <header className="session-header" ref={progressAnchorRef}>
        <div>
          <p className="eyebrow">Active session</p>
          <h1>{session.day} · {MODE_PRESENTATION[session.mode].name}</h1>
        </div>
        <div className="session-progress" aria-label={`${completed} of ${session.exercises.length} exercises complete`}>
          <span>{completed}/{session.exercises.length}</span>
          <div><i style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </header>

      <section className="exercise-stack" aria-label="Workout exercise deck">
        {session.exercises.map((exercise, index) => {
          const performance = performanceByExercise.get(exercise.id) ?? calculateExercisePerformance(exercise);
          const cue = database.exercises.find((item) => item.id === exercise.exerciseId)?.essentialCue;
          const isExpanded = expandedExerciseId === exercise.id;
          const isComplete = exercise.status === 'completed';
          const timer = restTimer?.exerciseId === exercise.id ? restTimer : null;

          return (
            <article
              className={`exercise-card ${isExpanded ? 'is-expanded' : 'is-compact'} ${isComplete ? 'is-complete' : ''}`}
              key={exercise.id}
              style={{ zIndex: session.exercises.length - index }}
            >
              <button
                className="exercise-card-toggle"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedExerciseId(exercise.id)}
              >
                <div>
                  <p className="eyebrow">{index + 1} · {exercise.importanceSnapshot}</p>
                  <h2>{exercise.exerciseNameSnapshot}</h2>
                </div>
                <span className="status-chip">{statusLabel(exercise.status, isExpanded)}</span>
              </button>

              {!isExpanded && (
                <div className="compact-prescription">
                  <strong>{exercise.prescription.sets} × {exercise.prescription.repMin}–{exercise.prescription.repMax}</strong>
                  <span>{exercise.plannedLoad} kg</span>
                  <span>{exercise.prescription.restSeconds}s</span>
                  {timer && <span className="compact-timer">Rest {formatTime(timer.remaining)}</span>}
                </div>
              )}

              {isExpanded && (
                <div className="exercise-card-body">
                  <div className="prescription-row">
                    <strong>{exercise.prescription.sets} × {exercise.prescription.repMin}–{exercise.prescription.repMax}</strong>
                    <span>{exercise.prescription.restSeconds}s rest</span>
                    <span>{exercise.plannedLoad} kg planned</span>
                  </div>
                  {exercise.movementReason === 'active_experiment' && (
                    <p className="experiment-notice">Lab test · temporary load.</p>
                  )}
                  {cue && <p className="setup-cue">{cue}</p>}
                  <div className="set-table">
                    {exercise.sets.map((set) => (
                      <SetEntryRow
                        key={set.id}
                        set={set}
                        onChange={(patch) => { void updateSetWithUndo(exercise.id, set, exercise.prescription.restSeconds, patch); }}
                      />
                    ))}
                  </div>

                  {timer && (
                    <aside className="rest-timer" aria-live="polite">
                      <div className="rest-timer-copy">
                        <span>{timer.remaining === 0 ? 'Go' : 'Rest'}</span>
                        <strong>{formatTime(timer.remaining)}</strong>
                      </div>
                      <div className="rest-timer-track"><i style={{ width: `${(timer.remaining / timer.total) * 100}%` }} /></div>
                      <div className="rest-timer-actions">
                        <button type="button" onClick={() => setRestTimer((current) => current ? { ...current, total: current.total + 30, remaining: current.remaining + 30 } : null)}>+30</button>
                        <button type="button" onClick={() => setRestTimer(null)}>Skip</button>
                      </div>
                    </aside>
                  )}

                  {performance.repDropWarning && (
                    <p className="warning-card">
                      Reps dropped by more than three at the same load. Rest longer; if it repeats, reduce load by 5–10%.
                    </p>
                  )}
                  <footer>
                    <span>{Math.round(performance.workVolume)} kg logged</span>
                    <button
                      className="secondary-action"
                      disabled={exercise.status === 'completed'}
                      onClick={() => { void completeExercise(exercise.id); }}
                    >
                      {exercise.status === 'completed' ? 'Completed' : 'Complete exercise'}
                    </button>
                  </footer>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <button className="completion-action" onClick={() => onCompleteSession(session.id)}>
        Complete session
      </button>

      {undoRecord && (
        <div className="undo-toast" role="status">
          <span>Set updated</span>
          <button type="button" onClick={() => { void undoLastSetEdit(); }}>Undo</button>
        </div>
      )}
    </main>
  );
}
