import { useMemo, useState, type FormEvent } from 'react';
import type { AppDatabase, SetRecord } from '../../domain/model';
import type { ExerciseReflectionInput } from '../../application/ExerciseReflectionManagement';
import { SessionHistoryOverlay } from './SessionHistoryOverlay';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onAddMeasurement: (input: { recordedAt: string; weightKg?: number; heightCm?: number }) => Promise<void>;
  onAmendSet: (sessionId: string, sessionExerciseId: string, setId: string, patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>) => Promise<void>;
  onAddSet: (sessionId: string, sessionExerciseId: string) => Promise<void>;
  onRemoveSet: (sessionId: string, sessionExerciseId: string, setId: string) => Promise<void>;
  onSaveReflection: (sessionId: string, sessionExerciseId: string, input: ExerciseReflectionInput) => Promise<void>;
  onSetExcluded: (sessionId: string, excluded: boolean) => Promise<void>;
  onDiscardSession: (sessionId: string) => Promise<void>;
  onRestoreSession: (sessionId: string) => Promise<void>;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ProfileSheetV2(props: Props) {
  const { database, onClose, onAddMeasurement } = props;
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedSessions = database.sessions.filter((session) => session.status === 'completed').length;
  const activeExperiments = database.experiments.filter((experiment) => ['active', 'ready_for_decision'].includes(experiment.status)).length;
  const measurements = useMemo(() => [...database.bodyMeasurements].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [database.bodyMeasurements]);
  const latestWeight = measurements.find((item) => typeof item.weightKg === 'number')?.weightKg;
  const latestHeight = measurements.find((item) => typeof item.heightCm === 'number')?.heightCm;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weightKg = optionalNumber(form.get('weightKg'));
    const heightCm = optionalNumber(form.get('heightCm'));
    const input: { recordedAt: string; weightKg?: number; heightCm?: number } = { recordedAt: new Date(`${String(form.get('date'))}T12:00:00`).toISOString() };
    if (weightKg !== undefined) input.weightKg = weightKg;
    if (heightCm !== undefined) input.heightCm = heightCm;
    try {
      setSaving(true);
      setError(null);
      await onAddMeasurement(input);
      setAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Measurement could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet profile-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Profile</p><h2>{database.profile.displayName}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close profile">×</button></header>
        <div className="profile-mark" aria-hidden="true">{database.profile.displayName.slice(0, 1).toUpperCase()}</div>
        <section className="profile-stats" aria-label="Current profile summary"><div><span>Weight</span><strong>{latestWeight === undefined ? 'Not logged' : `${latestWeight.toFixed(1)} kg`}</strong></div><div><span>Height</span><strong>{latestHeight === undefined ? 'Not logged' : `${latestHeight.toFixed(0)} cm`}</strong></div><div><span>Sessions</span><strong>{completedSessions}</strong></div><div><span>Live tests</span><strong>{activeExperiments}</strong></div></section>
        <button className="profile-history-button" type="button" onClick={() => setHistoryOpen(true)}><span><strong>Session history</strong><small>Review, amend, rate, exclude or discard individual sessions.</small></span><i>›</i></button>
        <section className="measurement-section">
          <div className="section-heading-inline"><div><p className="eyebrow">Body measurements</p><h3>Dated, not overwritten.</h3></div><button className="secondary-action compact-control" type="button" onClick={() => setAdding((value) => !value)}>{adding ? 'Cancel' : 'Add'}</button></div>
          {adding && <form className="measurement-form" onSubmit={submit}><label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Weight<span className="input-with-suffix"><input name="weightKg" type="number" inputMode="decimal" min="1" step="0.1" /><i>kg</i></span></label><label>Height<span className="input-with-suffix"><input name="heightCm" type="number" inputMode="decimal" min="1" step="0.1" defaultValue={latestHeight} /><i>cm</i></span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-action compact" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save measurement'}</button></form>}
          {measurements.length === 0 ? <p className="muted">Add a weight before assisted or weighted bodyweight work so sessions can preserve effective resistance.</p> : <div className="measurement-history">{measurements.slice(0, 6).map((item) => <div key={item.id}><time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.recordedAt))}</time><span>{item.weightKg === undefined ? '—' : `${item.weightKg.toFixed(1)} kg`}</span><span>{item.heightCm === undefined ? '—' : `${item.heightCm.toFixed(0)} cm`}</span><small>{item.source.replace('_', ' ')}</small></div>)}</div>}
        </section>
      </aside>
    </div>
    {historyOpen && <SessionHistoryOverlay database={database} onClose={() => setHistoryOpen(false)} onAmendSet={props.onAmendSet} onAddSet={props.onAddSet} onRemoveSet={props.onRemoveSet} onSaveReflection={props.onSaveReflection} onSetExcluded={props.onSetExcluded} onDiscard={props.onDiscardSession} onRestore={props.onRestoreSession} />}
  </>;
}
