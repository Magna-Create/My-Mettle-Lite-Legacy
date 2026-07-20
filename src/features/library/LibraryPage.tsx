import { useRef, useState, type TouchEvent } from 'react';
import type { AppDatabase, DaySymbol, Importance } from '../../domain/model';

interface ExerciseDraft {
  name: string;
  day: DaySymbol;
  importance: Importance;
  plannedLoad: number;
  targetReps: number;
  progressionStep: number;
}

interface Props {
  database: AppDatabase;
  onAddExercise: (input: ExerciseDraft) => Promise<void>;
}

const emptyDraft: ExerciseDraft = {
  name: '',
  day: 'ψ',
  importance: 'core',
  plannedLoad: 10,
  targetReps: 6,
  progressionStep: 1,
};

const guidedSteps = ['Movement', 'Place', 'Dose', 'Review'] as const;

function isDaySymbol(value: unknown): value is DaySymbol {
  return value === 'ψ' || value === 'φ' || value === 'π' || value === '&';
}

function isImportance(value: unknown): value is Importance {
  return value === 'principal' || value === 'core' || value === 'accessory';
}

function parseImport(value: string): ExerciseDraft {
  const candidate = JSON.parse(value) as Partial<ExerciseDraft>;
  const plannedLoad = Number(candidate.plannedLoad);
  const targetReps = Number(candidate.targetReps);
  const progressionStep = Number(candidate.progressionStep);

  if (
    typeof candidate.name !== 'string'
    || candidate.name.trim().length === 0
    || !isDaySymbol(candidate.day)
    || !isImportance(candidate.importance)
    || !Number.isFinite(plannedLoad)
    || plannedLoad < 0
    || !Number.isInteger(targetReps)
    || targetReps < 1
    || !Number.isFinite(progressionStep)
    || progressionStep <= 0
  ) {
    throw new Error('That JSON does not match an exercise card.');
  }

  return {
    name: candidate.name.trim(),
    day: candidate.day,
    importance: candidate.importance,
    plannedLoad,
    targetReps,
    progressionStep,
  };
}

export function LibraryPage({ database, onAddExercise }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'guided' | 'json'>('guided');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft);
  const [jsonValue, setJsonValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const touchStart = useRef<number | null>(null);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  if (!routine) return null;

  function close() {
    setOpen(false);
    setStep(0);
    setMethod('guided');
    setDraft(emptyDraft);
    setJsonValue('');
    setError(null);
  }

  function updateDraft<K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function canContinue() {
    if (step === 0) return draft.name.trim().length > 0;
    if (step === 2) return draft.plannedLoad >= 0 && draft.targetReps > 0 && draft.progressionStep > 0;
    return true;
  }

  async function save(input: ExerciseDraft) {
    try {
      setSaving(true);
      setError(null);
      await onAddExercise(input);
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The exercise could not be added.');
    } finally {
      setSaving(false);
    }
  }

  function moveStep(direction: -1 | 1) {
    if (direction === 1 && !canContinue()) {
      setError(step === 0 ? 'Give the movement a name first.' : 'Check the training dose.');
      return;
    }
    setError(null);
    setStep((current) => Math.max(0, Math.min(guidedSteps.length - 1, current + direction)));
  }

  function onTouchStart(event: TouchEvent) {
    touchStart.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    const end = event.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (start === null || end === undefined || Math.abs(end - start) < 55) return;
    moveStep(end < start ? 1 : -1);
  }

  async function importJson() {
    try {
      setError(null);
      await save(parseImport(jsonValue));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The JSON could not be read.');
    }
  }

  return (
    <main className="page library-page">
      <section className="page-heading library-heading">
        <div>
          <p className="eyebrow">Library · routine v{routine.version}</p>
          <h1>How the training system is constructed.</h1>
        </div>
        <button className="primary-action compact" onClick={() => setOpen(true)}>Add exercise</button>
      </section>

      <section className="routine-board">
        {routine.days.map((day) => (
          <article className="routine-column" key={day.symbol}>
            <header>
              <strong>{day.symbol}</strong>
              <span>{day.symbol === '&' ? 'conditional catch-up' : 'core day'}</span>
            </header>
            {day.slots.length === 0 && <p className="muted">No permanent slots.</p>}
            {day.slots.map((slot) => {
              const exercise = database.exercises.find((item) => item.id === slot.exerciseId);
              return (
                <div className="routine-slot" key={slot.id}>
                  <span className="importance-dot" data-importance={slot.importance} />
                  <div>
                    <strong>{exercise?.name ?? 'Missing exercise'}</strong>
                    <small>{slot.importance} · {slot.plannedLoad} kg · A {slot.prescriptions.A.sets}×{slot.prescriptions.A.repMin}–{slot.prescriptions.A.repMax}</small>
                  </div>
                </div>
              );
            })}
          </article>
        ))}
      </section>

      <section className="paper-card version-card">
        <p className="eyebrow">Version history</p>
        <h2>{database.routineVersions.length} immutable routine version{database.routineVersions.length === 1 ? '' : 's'}</h2>
        <p>Every permanent edit creates a new version rather than silently rewriting previous sessions.</p>
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={close}>
          <section className="modal exercise-wizard" role="dialog" aria-modal="true" aria-labelledby="exercise-wizard-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="wizard-header">
              <div>
                <p className="eyebrow">New routine slot</p>
                <h2 id="exercise-wizard-title">Create an exercise</h2>
              </div>
              <button className="icon-button" onClick={close} aria-label="Close exercise creator">×</button>
            </header>

            <div className="creation-methods" role="tablist" aria-label="Exercise creation method">
              <button type="button" data-active={method === 'guided'} onClick={() => { setMethod('guided'); setError(null); }}>Guided cards</button>
              <button type="button" data-active={method === 'json'} onClick={() => { setMethod('json'); setError(null); }}>Import JSON</button>
            </div>

            {method === 'guided' ? (
              <>
                <div className="wizard-progress" aria-label={`Step ${step + 1} of ${guidedSteps.length}`}>
                  {guidedSteps.map((label, index) => <i key={label} data-active={index <= step} title={label} />)}
                </div>

                <div className="wizard-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                  <article className="wizard-card" key={step}>
                    {step === 0 && (
                      <>
                        <p className="eyebrow">1 · Movement</p>
                        <h3>What are we adding?</h3>
                        <label>Name<input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} autoFocus placeholder="e.g. Bayesian bicep curl" /></label>
                      </>
                    )}

                    {step === 1 && (
                      <>
                        <p className="eyebrow">2 · Place</p>
                        <h3>Where does it live?</h3>
                        <label>Day<select value={draft.day} onChange={(event) => updateDraft('day', event.target.value as DaySymbol)}><option>ψ</option><option>φ</option><option>π</option><option>&</option></select></label>
                        <label>Importance<select value={draft.importance} onChange={(event) => updateDraft('importance', event.target.value as Importance)}><option value="principal">Principal</option><option value="core">Core</option><option value="accessory">Accessory</option></select></label>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className="eyebrow">3 · Dose</p>
                        <h3>Set the starting point.</h3>
                        <div className="form-grid">
                          <label>Planned load<input type="number" inputMode="decimal" step="0.5" min="0" value={draft.plannedLoad} onChange={(event) => updateDraft('plannedLoad', Number(event.target.value))} /></label>
                          <label>Target reps<input type="number" inputMode="numeric" min="1" value={draft.targetReps} onChange={(event) => updateDraft('targetReps', Number(event.target.value))} /></label>
                          <label>Progression step<input type="number" inputMode="decimal" step="0.5" min="0.5" value={draft.progressionStep} onChange={(event) => updateDraft('progressionStep', Number(event.target.value))} /></label>
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <p className="eyebrow">4 · Review</p>
                        <h3>{draft.name || 'Unnamed movement'}</h3>
                        <dl className="exercise-review">
                          <div><dt>Day</dt><dd>{draft.day}</dd></div>
                          <div><dt>Role</dt><dd>{draft.importance}</dd></div>
                          <div><dt>Start</dt><dd>{draft.plannedLoad} kg × {draft.targetReps}</dd></div>
                          <div><dt>Step</dt><dd>+{draft.progressionStep} kg</dd></div>
                        </dl>
                        <p className="muted">Creating this slot makes routine v{routine.version + 1}.</p>
                      </>
                    )}
                  </article>
                </div>

                {error && <p className="form-error" role="alert">{error}</p>}
                <footer className="wizard-actions">
                  <button className="text-button" type="button" onClick={step === 0 ? close : () => moveStep(-1)}>{step === 0 ? 'Cancel' : 'Back'}</button>
                  {step < guidedSteps.length - 1 ? (
                    <button className="primary-action compact" type="button" onClick={() => moveStep(1)}>Next</button>
                  ) : (
                    <button className="primary-action compact" type="button" disabled={saving} onClick={() => save({ ...draft, name: draft.name.trim() })}>{saving ? 'Creating…' : 'Create routine version'}</button>
                  )}
                </footer>
              </>
            ) : (
              <div className="json-import-panel">
                <p>Paste one exercise object. The import stays local and creates a normal immutable routine version.</p>
                <textarea
                  value={jsonValue}
                  onChange={(event) => setJsonValue(event.target.value)}
                  placeholder={'{"name":"Cable fly","day":"ψ","importance":"accessory","plannedLoad":10,"targetReps":8,"progressionStep":1}'}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                {error && <p className="form-error" role="alert">{error}</p>}
                <footer className="wizard-actions">
                  <button className="text-button" type="button" onClick={close}>Cancel</button>
                  <button className="primary-action compact" type="button" disabled={saving || jsonValue.trim().length === 0} onClick={importJson}>{saving ? 'Importing…' : 'Import and version'}</button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
