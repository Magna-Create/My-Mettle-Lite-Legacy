import { useMemo, useState, type FormEvent } from 'react';
import type { AppDatabase } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onAddMeasurement: (input: { recordedAt: string; weightKg?: number; heightCm?: number }) => Promise<void>;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ProfileSheet({ database, onClose, onAddMeasurement }: Props) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedSessions = database.sessions.filter((session) => session.status === 'completed').length;
  const activeExperiments = database.experiments.filter((experiment) =>
    ['active', 'ready_for_decision'].includes(experiment.status),
  ).length;
  const measurements = useMemo(
    () => [...database.bodyMeasurements].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
    [database.bodyMeasurements],
  );
  const latestWeight = measurements.find((measurement) => typeof measurement.weightKg === 'number')?.weightKg;
  const latestHeight = measurements.find((measurement) => typeof measurement.heightCm === 'number')?.heightCm;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    try {
      setSaving(true);
      setError(null);
      await onAddMeasurement({
        recordedAt: new Date(`${date}T12:00:00`).toISOString(),
        weightKg: optionalNumber(form.get('weightKg')),
        heightCm: optionalNumber(form.get('heightCm')),
      });
      setAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Measurement could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet profile-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Profile</p>
            <h2>{database.profile.displayName}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close profile">×</button>
        </header>

        <div className="profile-mark" aria-hidden="true">
          {database.profile.displayName.slice(0, 1).toUpperCase()}
        </div>

        <section className="profile-stats" aria-label="Current profile summary">
          <div><span>Weight</span><strong>{latestWeight === undefined ? 'Not logged' : `${latestWeight.toFixed(1)} kg`}</strong></div>
          <div><span>Height</span><strong>{latestHeight === undefined ? 'Not logged' : `${latestHeight.toFixed(0)} cm`}</strong></div>
          <div><span>Sessions</span><strong>{completedSessions}</strong></div>
          <div><span>Live tests</span><strong>{activeExperiments}</strong></div>
        </section>

        <section className="measurement-section">
          <div className="section-heading-inline">
            <div>
              <p className="eyebrow">Body measurements</p>
              <h3>Dated, not overwritten.</h3>
            </div>
            <button className="secondary-action compact-control" type="button" onClick={() => setAdding((current) => !current)}>
              {adding ? 'Cancel' : 'Add'}
            </button>
          </div>

          {adding && (
            <form className="measurement-form" onSubmit={submit}>
              <label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label>Weight<span className="input-with-suffix"><input name="weightKg" type="number" inputMode="decimal" min="1" step="0.1" /><i>kg</i></span></label>
              <label>Height<span className="input-with-suffix"><input name="heightCm" type="number" inputMode="decimal" min="1" step="0.1" defaultValue={latestHeight} /><i>cm</i></span></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-action compact" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save measurement'}</button>
            </form>
          )}

          {measurements.length === 0 ? (
            <p className="muted">Add a weight before assisted or weighted bodyweight work so sessions can preserve effective resistance.</p>
          ) : (
            <div className="measurement-history">
              {measurements.slice(0, 6).map((measurement) => (
                <div key={measurement.id}>
                  <time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(measurement.recordedAt))}</time>
                  <span>{measurement.weightKg === undefined ? '—' : `${measurement.weightKg.toFixed(1)} kg`}</span>
                  <span>{measurement.heightCm === undefined ? '—' : `${measurement.heightCm.toFixed(0)} cm`}</span>
                  <small>{measurement.source.replace('_', ' ')}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
