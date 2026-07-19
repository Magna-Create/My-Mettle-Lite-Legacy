import type { AppDatabase, SetRecord } from '../../domain/model';
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
}

export function TrainPage({
  database,
  onUpdateSet,
  onCompleteExercise,
  onCompleteSession,
  onGoBrief,
}: Props) {
  const session = database.sessions.find((candidate) => candidate.id === database.activeSessionId);

  if (!session) {
    return (
      <main className="page empty-page">
        <p className="eyebrow">Train</p>
        <h1>No active session.</h1>
        <p>Begin from Brief so the day and mode are recorded deliberately.</p>
        <button className="primary-action" onClick={onGoBrief}>Open Brief</button>
      </main>
    );
  }

  const completed = session.exercises.filter((exercise) => exercise.status === 'completed').length;

  return (
    <main className="page train-page">
      <header className="session-header">
        <div>
          <p className="eyebrow">Active session</p>
          <h1>{session.day} · Mode {session.mode}</h1>
        </div>
        <div className="session-progress" aria-label={`${completed} of ${session.exercises.length} exercises complete`}>
          <span>{completed}/{session.exercises.length}</span>
          <div><i style={{ width: `${(completed / Math.max(session.exercises.length, 1)) * 100}%` }} /></div>
        </div>
      </header>

      <section className="exercise-stack">
        {session.exercises.map((exercise, index) => {
          const performance = calculateExercisePerformance(exercise);
          const cue = database.exercises.find((item) => item.id === exercise.exerciseId)?.essentialCue;
          return (
            <article
              className={`exercise-card ${exercise.status === 'completed' ? 'is-complete' : ''}`}
              key={exercise.id}
            >
              <header>
                <div>
                  <p className="eyebrow">{index + 1} · {exercise.importanceSnapshot}</p>
                  <h2>{exercise.exerciseNameSnapshot}</h2>
                </div>
                <span className="status-chip">{exercise.status}</span>
              </header>
              <div className="prescription-row">
                <strong>{exercise.prescription.sets} × {exercise.prescription.repMin}–{exercise.prescription.repMax}</strong>
                <span>{exercise.prescription.restSeconds}s rest</span>
                <span>{exercise.plannedLoad} kg planned</span>
              </div>
              {exercise.movementReason === 'active_experiment' && (
                <p className="experiment-notice">Lab test active: this load is temporary until evidence is reviewed.</p>
              )}
              {cue && <p className="setup-cue">{cue}</p>}
              <div className="set-table">
                {exercise.sets.map((set) => (
                  <SetEntryRow
                    key={set.id}
                    set={set}
                    onChange={(patch) => onUpdateSet(session.id, exercise.id, set.id, patch)}
                  />
                ))}
              </div>
              {performance.repDropWarning && (
                <p className="warning-card">
                  Repetitions dropped by more than three at the same load. Take longer rest; if it repeats, reduce load by 5–10%.
                </p>
              )}
              <footer>
                <span>{Math.round(performance.workVolume)} kg work volume logged</span>
                <button
                  className="secondary-action"
                  disabled={exercise.status === 'completed'}
                  onClick={() => onCompleteExercise(session.id, exercise.id)}
                >
                  {exercise.status === 'completed' ? 'Completed' : 'Complete exercise'}
                </button>
              </footer>
            </article>
          );
        })}
      </section>

      <button className="completion-action" onClick={() => onCompleteSession(session.id)}>
        Complete session
      </button>
    </main>
  );
}
