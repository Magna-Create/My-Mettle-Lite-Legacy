import type { AppDatabase, SessionExercise } from '../../domain/model';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import { entryBasisLabel, getTrackingPresentation, relationshipLabel } from '../../domain/tracking';

interface Props {
  database: AppDatabase;
  exercise: SessionExercise | null;
  onClose: () => void;
}

export function ExerciseDetailsOverlay({ database, exercise, onClose }: Props) {
  if (!exercise) return null;
  const record = database.exercises.find((candidate) => candidate.id === exercise.exerciseId);
  const presentation = getTrackingPresentation(
    exercise.trackingSnapshot,
    record?.defaultUnit ?? database.profile.units,
  );
  const recent = database.sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => session.exercises.map((candidate) => ({ session, exercise: candidate })))
    .filter((candidate) => candidate.exercise.exerciseId === exercise.exerciseId)
    .sort((left, right) => (right.session.completedAt ?? '').localeCompare(left.session.completedAt ?? ''))
    .slice(0, 4);

  return (
    <div className="modal-backdrop details-backdrop" onMouseDown={onClose}>
      <section className="exercise-details" role="dialog" aria-modal="true" aria-labelledby="exercise-details-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Exercise details</p>
            <h2 id="exercise-details-title">{exercise.exerciseNameSnapshot}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close exercise details">×</button>
        </header>

        <section className="details-grid">
          <article>
            <span>Tracking</span>
            <strong>{relationshipLabel(exercise.trackingSnapshot.loadRelationship)}</strong>
            <small>{entryBasisLabel(exercise.trackingSnapshot.entryBasis)} · {exercise.trackingSnapshot.metric.replace('_', ' ')}</small>
          </article>
          <article>
            <span>{presentation.progressionLabel}</span>
            <strong>{record?.progressionStep ?? '—'} {record ? presentation.progressionSuffix : ''}</strong>
            <small>{exercise.trackingSnapshot.loadRelationship === 'assistance' ? 'Reduce assistance when promoted.' : 'Applied through Lab.'}</small>
          </article>
          <article>
            <span>Session bodyweight</span>
            <strong>{exercise.bodyweightSnapshotKg === null ? 'Not logged' : `${exercise.bodyweightSnapshotKg.toFixed(1)} kg`}</strong>
            <small>Frozen for this session.</small>
          </article>
        </section>

        <section className="details-section">
          <p className="eyebrow">Setup</p>
          <p>{record?.essentialCue ?? 'No personal setup cue has been saved yet.'}</p>
        </section>

        <section className="details-section">
          <p className="eyebrow">Recent evidence</p>
          {recent.length === 0 ? (
            <p className="muted">No completed history for this movement yet.</p>
          ) : (
            <div className="recent-performance-list">
              {recent.map(({ session, exercise: historic }) => {
                const performance = calculateExercisePerformance(historic);
                return (
                  <article key={historic.id}>
                    <time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(session.completedAt ?? session.startedAt))}</time>
                    <strong>{Math.round(performance.primaryTotal)} {performance.primaryUnit}</strong>
                    <span>{performance.completedSets}/{historic.prescription.sets} sets</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="details-section future-details">
          <p className="eyebrow">Later layers</p>
          <p>Personal notes, substitutions, deeper progression logic and character imagery will attach here without crowding the workout card.</p>
        </section>
      </section>
    </div>
  );
}
