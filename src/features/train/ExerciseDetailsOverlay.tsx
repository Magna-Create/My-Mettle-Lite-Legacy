import type { AppDatabase, SessionExercise } from '../../domain/model';
import { normaliseExerciseMemory } from '../../domain/exerciseMemory';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import { entryBasisLabel, getTrackingPresentation, relationshipLabel } from '../../domain/tracking';

interface Props {
  database: AppDatabase;
  exercise: SessionExercise | null;
  onClose: () => void;
}

function DetailList({ items, empty }: { items: string[]; empty: string }) {
  return items.length > 0
    ? <ul className="exercise-memory-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    : <p className="muted">{empty}</p>;
}

export function ExerciseDetailsOverlay({ database, exercise, onClose }: Props) {
  if (!exercise) return null;
  const record = database.exercises.find((candidate) => candidate.id === exercise.exerciseId);
  const memory = normaliseExerciseMemory(record?.memory, record?.essentialCue);
  const presentation = getTrackingPresentation(exercise.trackingSnapshot, record?.defaultUnit ?? database.profile.units);
  const recent = database.sessions
    .filter((session) => session.status === 'completed' && !session.excludedFromInsights)
    .flatMap((session) => session.exercises.map((candidate) => ({ session, exercise: candidate })))
    .filter((candidate) => candidate.exercise.exerciseId === exercise.exerciseId)
    .sort((left, right) => (right.session.completedAt ?? '').localeCompare(left.session.completedAt ?? ''))
    .slice(0, 4);

  return (
    <div className="modal-backdrop details-backdrop" onMouseDown={onClose}>
      <section className="exercise-details" role="dialog" aria-modal="true" aria-labelledby="exercise-details-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">Exercise details</p><h2 id="exercise-details-title">{exercise.exerciseNameSnapshot}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close exercise details">×</button>
        </header>

        <section className="details-grid">
          <article><span>Tracking</span><strong>{relationshipLabel(exercise.trackingSnapshot.loadRelationship)}</strong><small>{entryBasisLabel(exercise.trackingSnapshot.entryBasis)} · {exercise.trackingSnapshot.metric.replace('_', ' ')}</small></article>
          <article><span>{presentation.progressionLabel}</span><strong>{record?.progressionStep ?? '—'} {record ? presentation.progressionSuffix : ''}</strong><small>{exercise.trackingSnapshot.loadRelationship === 'assistance' ? 'Reduce assistance when promoted.' : 'Applied through Lab.'}</small></article>
          <article><span>Session bodyweight</span><strong>{exercise.bodyweightSnapshotKg === null ? 'Not logged' : `${exercise.bodyweightSnapshotKg.toFixed(1)} kg`}</strong><small>Frozen for this session.</small></article>
          <article><span>Fatigue cost</span><strong>{memory.fatigueCost}/5</strong><small>Manual exercise setting.</small></article>
          <article><span>Skill difficulty</span><strong>{memory.skillDifficulty}/5</strong><small>Manual exercise setting.</small></article>
          <article><span>Category</span><strong>{memory.category || 'Not set'}</strong><small>{memory.equipment || 'Equipment not set'}</small></article>
        </section>

        <div className="details-memory-grid">
          <section className="details-section">
            <p className="eyebrow">Key cues</p>
            <DetailList items={memory.cues} empty="No cues saved yet." />
          </section>
          <section className="details-section">
            <p className="eyebrow">Target muscles</p>
            <DetailList items={memory.targetMuscles} empty="No target muscles saved yet." />
          </section>
          <section className="details-section">
            <p className="eyebrow">Common mistakes</p>
            <DetailList items={memory.commonMistakes} empty="No common mistakes saved yet." />
          </section>
          <section className="details-section">
            <p className="eyebrow">Substitutions</p>
            <DetailList items={memory.substitutions} empty="No substitutions saved yet." />
          </section>
        </div>

        <section className="details-section">
          <p className="eyebrow">Setup</p>
          <p>{memory.setupNotes || memory.cues[0] || 'No setup notes saved yet.'}</p>
        </section>
        <section className="details-section">
          <p className="eyebrow">Machine / equipment settings</p>
          <p>{memory.machineSettings || 'No equipment settings saved yet.'}</p>
        </section>
        <section className="details-section">
          <p className="eyebrow">Personal notes</p>
          <p>{memory.personalNotes || 'No personal notes saved yet.'}</p>
        </section>

        <section className="details-section">
          <p className="eyebrow">Recent evidence</p>
          {recent.length === 0 ? <p className="muted">No included completed history for this movement yet.</p> : (
            <div className="recent-performance-list">
              {recent.map(({ session, exercise: historic }) => {
                const performance = calculateExercisePerformance(historic);
                return <article key={historic.id}><time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(session.completedAt ?? session.startedAt))}</time><strong>{Math.round(performance.primaryTotal)} {performance.primaryUnit}</strong><span>{performance.completedSets}/{historic.prescription.sets} prescribed sets</span></article>;
              })}
            </div>
          )}
        </section>

        <section className="details-section character-placeholder">
          <p className="eyebrow">Character visual</p>
          <p>Reserved for the dedicated character and generative-visual phase.</p>
        </section>
      </section>
    </div>
  );
}