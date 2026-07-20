import { useMemo, useRef, useState, type TouchEvent } from 'react';
import type { AddExerciseInput } from '../../application/GymAppService';
import type { AppDatabase, DaySymbol, EntryBasis, ExerciseTrackingProfile, Importance } from '../../domain/model';
import {
  entryBasisLabel,
  getTrackingPresentation,
  presetFromTracking,
  relationshipLabel,
  TRACKING_PRESET_LABELS,
  trackingFromPreset,
  type TrackingPreset,
} from '../../domain/tracking';

interface WizardDraft {
  name: string;
  day: DaySymbol;
  importance: Importance;
  preset: TrackingPreset;
  entryBasis: EntryBasis;
  startingValue: number;
  targetValue: number;
  progressionStep: number;
}

interface Props {
  database: AppDatabase;
  onAddExercise: (input: AddExerciseInput) => Promise<void>;
}

const emptyDraft: WizardDraft = {
  name: '',
  day: 'ψ',
  importance: 'core',
  preset: 'external_load',
  entryBasis: 'total',
  startingValue: 10,
  targetValue: 6,
  progressionStep: 1,
};

const guidedSteps = ['Movement', 'Place', 'Dose', 'Review'] as const;
const presets = Object.keys(TRACKING_PRESET_LABELS) as TrackingPreset[];

function isDaySymbol(value: unknown): value is DaySymbol {
  return value === 'ψ' || value === 'φ' || value === 'π' || value === '&';
}

function isImportance(value: unknown): value is Importance {
  return value === 'principal' || value === 'core' || value === 'accessory';
}

function isEntryBasis(value: unknown): value is EntryBasis {
  return value === 'total' || value === 'per_hand' || value === 'per_side';
}

function isTracking(value: unknown): value is ExerciseTrackingProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExerciseTrackingProfile>;
  return ['load_reps', 'reps', 'duration', 'distance'].includes(candidate.metric ?? '')
    && ['external', 'assistance', 'bodyweight', 'bodyweight_plus_external', 'none'].includes(candidate.loadRelationship ?? '')
    && isEntryBasis(candidate.entryBasis);
}

function defaultsForPreset(preset: TrackingPreset): Pick<WizardDraft, 'startingValue' | 'targetValue' | 'progressionStep'> {
  if (preset === 'duration') return { startingValue: 0, targetValue: 60, progressionStep: 15 };
  if (preset === 'distance') return { startingValue: 0, targetValue: 1000, progressionStep: 100 };
  if (preset === 'reps_only' || preset === 'bodyweight') {
    return { startingValue: 0, targetValue: 6, progressionStep: 1 };
  }
  return { startingValue: 10, targetValue: 6, progressionStep: 1 };
}

function parseImport(value: string): AddExerciseInput {
  const candidate = JSON.parse(value) as Partial<AddExerciseInput> & {
    trackingPreset?: TrackingPreset;
    entryBasis?: EntryBasis;
    plannedLoad?: number;
    targetReps?: number;
  };
  const tracking = isTracking(candidate.tracking)
    ? candidate.tracking
    : trackingFromPreset(candidate.trackingPreset ?? 'external_load', candidate.entryBasis ?? 'total');
  const startingValue = Number(candidate.startingValue ?? candidate.plannedLoad ?? 0);
  const targetValue = Number(candidate.targetValue ?? candidate.targetReps);
  const progressionStep = Number(candidate.progressionStep);

  if (
    typeof candidate.name !== 'string'
    || candidate.name.trim().length === 0
    || !isDaySymbol(candidate.day)
    || !isImportance(candidate.importance)
    || !Number.isFinite(startingValue)
    || startingValue < 0
    || !Number.isFinite(targetValue)
    || targetValue <= 0
    || !Number.isFinite(progressionStep)
    || progressionStep <= 0
  ) {
    throw new Error('That JSON does not match an exercise card.');
  }

  return {
    name: candidate.name.trim(),
    day: candidate.day,
    importance: candidate.importance,
    tracking,
    startingValue,
    targetValue,
    progressionStep,
  };
}

interface SuffixInputProps {
  label: string;
  suffix: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}

function SuffixInput({ label, suffix, value, step, onChange }: SuffixInputProps) {
  return (
    <label>
      {label}
      <span className="input-with-suffix">
        <input
          type="number"
          inputMode={step % 1 === 0 ? 'numeric' : 'decimal'}
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <i>{suffix}</i>
      </span>
    </label>
  );
}

export function LibraryPage({ database, onAddExercise }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'guided' | 'json'>('guided');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [jsonValue, setJsonValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const touchStart = useRef<number | null>(null);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  if (!routine) return null;

  const tracking = useMemo(
    () => trackingFromPreset(draft.preset, draft.entryBasis),
    [draft.preset, draft.entryBasis],
  );
  const presentation = getTrackingPresentation(tracking, database.profile.units);

  function close() {
    setOpen(false);
    setStep(0);
    setMethod('guided');
    setDraft(emptyDraft);
    setJsonValue('');
    setError(null);
  }

  function updateDraft<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function choosePreset(preset: TrackingPreset) {
    const defaults = defaultsForPreset(preset);
    setDraft((current) => ({
      ...current,
      preset,
      entryBasis: preset === 'assisted_bodyweight' || preset === 'bodyweight' || preset === 'reps_only' || preset === 'duration' || preset === 'distance'
        ? 'total'
        : current.entryBasis,
      ...defaults,
    }));
  }

  function canContinue() {
    if (step === 0) return draft.name.trim().length > 0;
    if (step === 2) {
      return (!presentation.requiresStartingValue || draft.startingValue >= 0)
        && draft.targetValue > 0
        && draft.progressionStep > 0;
    }
    return true;
  }

  function buildInput(): AddExerciseInput {
    return {
      name: draft.name.trim(),
      day: draft.day,
      importance: draft.importance,
      tracking,
      startingValue: presentation.requiresStartingValue ? draft.startingValue : 0,
      targetValue: draft.targetValue,
      progressionStep: draft.progressionStep,
    };
  }

  async function save(input: AddExerciseInput) {
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
              if (!exercise) return null;
              const exercisePresentation = getTrackingPresentation(exercise.tracking, exercise.defaultUnit);
              const starting = exercisePresentation.requiresStartingValue
                ? `${exercisePresentation.valueLabel} ${slot.plannedLoad} ${exercisePresentation.valueSuffix}`
                : TRACKING_PRESET_LABELS[presetFromTracking(exercise.tracking)];
              return (
                <div className="routine-slot" key={slot.id}>
                  <span className="importance-dot" data-importance={slot.importance} />
                  <div>
                    <strong>{exercise.name}</strong>
                    <small>{slot.importance} · {starting} · A {slot.prescriptions.A.sets}×{slot.prescriptions.A.repMin}–{slot.prescriptions.A.repMax}</small>
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
                        <label>Name<input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} autoFocus placeholder="e.g. Assisted pull-up" /></label>
                        <label>Track by
                          <select value={draft.preset} onChange={(event) => choosePreset(event.target.value as TrackingPreset)}>
                            {presets.map((preset) => <option key={preset} value={preset}>{TRACKING_PRESET_LABELS[preset]}</option>)}
                          </select>
                        </label>
                      </>
                    )}

                    {step === 1 && (
                      <>
                        <p className="eyebrow">2 · Place</p>
                        <h3>Where does it live?</h3>
                        <label>Day<select value={draft.day} onChange={(event) => updateDraft('day', event.target.value as DaySymbol)}><option>ψ</option><option>φ</option><option>π</option><option>&</option></select></label>
                        <label>Importance<select value={draft.importance} onChange={(event) => updateDraft('importance', event.target.value as Importance)}><option value="principal">Principal</option><option value="core">Core</option><option value="accessory">Accessory</option></select></label>
                        {presentation.supportsEntryBasis && (
                          <label>Load is entered
                            <select value={draft.entryBasis} onChange={(event) => updateDraft('entryBasis', event.target.value as EntryBasis)}>
                              <option value="total">Total</option>
                              <option value="per_hand">Per hand</option>
                              <option value="per_side">Per side</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className="eyebrow">3 · Dose</p>
                        <h3>Set the starting point.</h3>
                        <div className="form-grid">
                          {presentation.requiresStartingValue && (
                            <SuffixInput
                              label={presentation.valueLabel}
                              suffix={presentation.valueSuffix}
                              value={draft.startingValue}
                              step={0.5}
                              onChange={(value) => updateDraft('startingValue', value)}
                            />
                          )}
                          <SuffixInput
                            label={presentation.targetLabel}
                            suffix={presentation.targetSuffix}
                            value={draft.targetValue}
                            step={tracking.metric === 'distance' ? 10 : 1}
                            onChange={(value) => updateDraft('targetValue', value)}
                          />
                          <SuffixInput
                            label={presentation.progressionLabel}
                            suffix={presentation.progressionSuffix}
                            value={draft.progressionStep}
                            step={tracking.metric === 'distance' ? 10 : tracking.metric === 'load_reps' ? 0.5 : 1}
                            onChange={(value) => updateDraft('progressionStep', value)}
                          />
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
                          <div><dt>Tracking</dt><dd>{TRACKING_PRESET_LABELS[draft.preset]}</dd></div>
                          <div><dt>Entry</dt><dd>{presentation.supportsEntryBasis ? entryBasisLabel(draft.entryBasis) : relationshipLabel(tracking.loadRelationship)}</dd></div>
                          {presentation.requiresStartingValue && <div><dt>{presentation.valueLabel}</dt><dd>{draft.startingValue} {presentation.valueSuffix}</dd></div>}
                          <div><dt>{presentation.targetLabel}</dt><dd>{draft.targetValue} {presentation.targetSuffix}</dd></div>
                          <div><dt>{presentation.progressionLabel}</dt><dd>{draft.progressionStep} {presentation.progressionSuffix}</dd></div>
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
                    <button className="primary-action compact" type="button" disabled={saving} onClick={() => save(buildInput())}>{saving ? 'Creating…' : 'Create routine version'}</button>
                  )}
                </footer>
              </>
            ) : (
              <div className="json-import-panel">
                <p>Paste one exercise object. The import stays local and creates a normal immutable routine version.</p>
                <textarea
                  value={jsonValue}
                  onChange={(event) => setJsonValue(event.target.value)}
                  placeholder={'{"name":"Assisted pull-up","day":"π","importance":"principal","trackingPreset":"assisted_bodyweight","startingValue":35,"targetValue":6,"progressionStep":2.5}'}
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
