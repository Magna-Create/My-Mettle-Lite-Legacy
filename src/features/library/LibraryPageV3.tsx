import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import type { AddExerciseInput } from '../../application/GymAppService';
import type { ExerciseRecordPatch, RoutineSlotPatch } from '../../application/Phase2Management';
import {
  createRoutineEditDraft,
  isRoutineEditDraftDirty,
  parseRoutineEditDraft,
  type RoutineEditDraft,
} from '../../application/RoutineEditDraft';
import { normaliseExerciseMemory } from '../../domain/exerciseMemory';
import type { AppDatabase, DaySymbol, EntryBasis, Importance, Mode, ModePrescription } from '../../domain/model';
import {
  entryBasisLabel,
  getTrackingPresentation,
  presetFromTracking,
  relationshipLabel,
  TRACKING_PRESET_LABELS,
  trackingFromPreset,
  type TrackingPreset,
} from '../../domain/tracking';
import { ROUTINE_EDIT_STORAGE_KEY, RoutineEditMode } from './RoutineEditMode';

interface EditState { editing: boolean; dirty: boolean; }

interface Props {
  database: AppDatabase;
  externalDiscardToken: number;
  onEditStateChange: (state: EditState) => void;
  onCommitRoutineEdit: (draft: RoutineEditDraft) => Promise<void>;
  onAddExercise: (input: AddExerciseInput) => Promise<void>;
  onMoveSlot: (slotId: string, day: DaySymbol) => Promise<void>;
  onRemoveSlot: (slotId: string) => Promise<void>;
  onUpdateSlot: (slotId: string, patch: RoutineSlotPatch) => Promise<void>;
  onUpdateExercise: (exerciseId: string, patch: ExerciseRecordPatch) => Promise<void>;
  onArchiveExercise: (exerciseId: string) => Promise<void>;
  onRestoreExercise: (exerciseId: string) => Promise<void>;
}

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

interface ManageDraft {
  name: string;
  day: DaySymbol;
  importance: Importance;
  preset: TrackingPreset;
  entryBasis: EntryBasis;
  plannedLoad: number;
  progressionStep: number;
  category: string;
  equipment: string;
  targetMuscles: string;
  fatigueCost: number;
  skillDifficulty: number;
  cues: string;
  commonMistakes: string;
  setupNotes: string;
  personalNotes: string;
  machineSettings: string;
  substitutions: string;
  prescriptions: Record<Mode, ModePrescription>;
}

const emptyDraft: WizardDraft = {
  name: '', day: 'ψ', importance: 'core', preset: 'external_load', entryBasis: 'total', startingValue: 10, targetValue: 6, progressionStep: 1,
};
const guidedSteps = ['Movement', 'Place', 'Dose', 'Review'] as const;
const presets = Object.keys(TRACKING_PRESET_LABELS) as TrackingPreset[];
const days: DaySymbol[] = ['ψ', 'φ', 'π', '&'];
const modes: Mode[] = ['A', 'B', 'C'];

function defaultsForPreset(preset: TrackingPreset) {
  if (preset === 'duration') return { startingValue: 0, targetValue: 60, progressionStep: 15 };
  if (preset === 'distance') return { startingValue: 0, targetValue: 1000, progressionStep: 100 };
  if (preset === 'reps_only' || preset === 'bodyweight') return { startingValue: 0, targetValue: 6, progressionStep: 1 };
  return { startingValue: 10, targetValue: 6, progressionStep: 1 };
}

function splitLines(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}
function joinLines(value: string[] | undefined) { return (value ?? []).join('\n'); }

function SuffixInput({ label, suffix, value, step, onChange }: { label: string; suffix: string; value: number; step: number; onChange: (value: number) => void }) {
  return <label>{label}<span className="input-with-suffix"><input type="number" inputMode={step % 1 === 0 ? 'numeric' : 'decimal'} min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><i>{suffix}</i></span></label>;
}

export function LibraryPageV3(props: Props) {
  const { database } = props;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageSlotId, setManageSlotId] = useState<string | null>(null);
  const [manageDraft, setManageDraft] = useState<ManageDraft | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<RoutineEditDraft | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<RoutineEditDraft | null>(null);
  const touchStart = useRef<number | null>(null);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  const selected = routine?.days.flatMap((day) => day.slots.map((slot) => ({ day, slot }))).find((item) => item.slot.id === manageSlotId);
  const selectedExercise = database.exercises.find((item) => item.id === selected?.slot.exerciseId);
  const tracking = useMemo(() => trackingFromPreset(draft.preset, draft.entryBasis), [draft.preset, draft.entryBasis]);
  const presentation = getTrackingPresentation(tracking, database.profile.units);

  useEffect(() => () => props.onEditStateChange({ editing: false, dirty: false }), [props]);

  useEffect(() => {
    if (!selected || !selectedExercise) { setManageDraft(null); return; }
    const memory = normaliseExerciseMemory(selectedExercise.memory, selectedExercise.essentialCue);
    setManageDraft({
      name: selectedExercise.name,
      day: selected.day.symbol,
      importance: selected.slot.importance,
      preset: presetFromTracking(selectedExercise.tracking),
      entryBasis: selectedExercise.tracking.entryBasis,
      plannedLoad: selected.slot.plannedLoad,
      progressionStep: selectedExercise.progressionStep,
      category: memory.category,
      equipment: memory.equipment,
      targetMuscles: joinLines(memory.targetMuscles),
      fatigueCost: memory.fatigueCost,
      skillDifficulty: memory.skillDifficulty,
      cues: joinLines(memory.cues),
      commonMistakes: joinLines(memory.commonMistakes),
      setupNotes: memory.setupNotes,
      personalNotes: memory.personalNotes,
      machineSettings: memory.machineSettings,
      substitutions: joinLines(memory.substitutions),
      prescriptions: structuredClone(selected.slot.prescriptions),
    });
  }, [manageSlotId, selected?.slot.id, selectedExercise?.updatedAt, routine?.id]);

  if (!routine) return null;

  function beginEdit() {
    const stored = localStorage.getItem(ROUTINE_EDIT_STORAGE_KEY);
    const recovered = stored ? parseRoutineEditDraft(stored, routine.id) : null;
    if (recovered && isRoutineEditDraftDirty(database, recovered)) {
      setRecoveryDraft(recovered);
      return;
    }
    localStorage.removeItem(ROUTINE_EDIT_STORAGE_KEY);
    setEditDraft(createRoutineEditDraft(database));
  }

  function closeWizard() { setOpen(false); setStep(0); setDraft(emptyDraft); setError(null); }
  function choosePreset(preset: TrackingPreset) {
    setDraft((current) => ({ ...current, preset, entryBasis: ['assisted_bodyweight', 'bodyweight', 'reps_only', 'duration', 'distance'].includes(preset) ? 'total' : current.entryBasis, ...defaultsForPreset(preset) }));
  }
  function moveStep(direction: -1 | 1) {
    if (direction === 1 && step === 0 && !draft.name.trim()) { setError('Give the movement a name first.'); return; }
    setError(null);
    setStep((current) => Math.max(0, Math.min(guidedSteps.length - 1, current + direction)));
  }

  async function saveNew() {
    if (draft.targetValue <= 0 || draft.progressionStep <= 0) { setError('Check the training dose.'); return; }
    try {
      setSaving(true); setError(null);
      await props.onAddExercise({ name: draft.name.trim(), day: draft.day, importance: draft.importance, tracking, startingValue: presentation.requiresStartingValue ? draft.startingValue : 0, targetValue: draft.targetValue, progressionStep: draft.progressionStep });
      closeWizard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The exercise could not be added.');
    } finally { setSaving(false); }
  }

  async function saveManaged() {
    if (!selected || !selectedExercise || !manageDraft) return;
    const nextTracking = trackingFromPreset(manageDraft.preset, manageDraft.entryBasis);
    try {
      setSaving(true); setError(null);
      await props.onUpdateExercise(selectedExercise.id, {
        name: manageDraft.name,
        tracking: nextTracking,
        progressionStep: manageDraft.progressionStep,
        memory: {
          category: manageDraft.category,
          equipment: manageDraft.equipment,
          targetMuscles: splitLines(manageDraft.targetMuscles),
          fatigueCost: Math.max(1, Math.min(5, Math.round(manageDraft.fatigueCost))) as 1 | 2 | 3 | 4 | 5,
          skillDifficulty: Math.max(1, Math.min(5, Math.round(manageDraft.skillDifficulty))) as 1 | 2 | 3 | 4 | 5,
          cues: splitLines(manageDraft.cues),
          commonMistakes: splitLines(manageDraft.commonMistakes),
          setupNotes: manageDraft.setupNotes,
          personalNotes: manageDraft.personalNotes,
          machineSettings: manageDraft.machineSettings,
          substitutions: splitLines(manageDraft.substitutions),
        },
      });
      await props.onUpdateSlot(selected.slot.id, { importance: manageDraft.importance, plannedLoad: manageDraft.plannedLoad, prescriptions: manageDraft.prescriptions });
      if (manageDraft.day !== selected.day.symbol) await props.onMoveSlot(selected.slot.id, manageDraft.day);
      setManageSlotId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The exercise could not be updated.');
    } finally { setSaving(false); }
  }

  function updatePrescription(mode: Mode, key: keyof ModePrescription, value: number | boolean) {
    setManageDraft((current) => current ? { ...current, prescriptions: { ...current.prescriptions, [mode]: { ...current.prescriptions[mode], [key]: value } } } : null);
  }

  if (editDraft) {
    return <RoutineEditMode
      database={database}
      initialDraft={editDraft}
      externalDiscardToken={props.externalDiscardToken}
      onStateChange={props.onEditStateChange}
      onCommit={props.onCommitRoutineEdit}
      onExit={() => setEditDraft(null)}
    />;
  }

  return <main className="page library-page">
    <section className="page-heading library-heading">
      <div><p className="eyebrow">Library · routine v{routine.version}</p><h1>How the training system is constructed.</h1></div>
      <div className="library-heading-actions"><button className="primary-action compact" onClick={() => setOpen(true)}>Add exercise</button><button className="secondary-action compact" type="button" onClick={beginEdit}>Edit routine</button></div>
    </section>

    <section className="routine-board">
      {routine.days.map((day) => <article className="routine-column" key={day.symbol}>
        <header><strong>{day.symbol}</strong><span>{day.symbol === '&' ? 'conditional catch-up' : 'core day'}</span></header>
        {day.slots.length === 0 && <p className="muted">No permanent slots.</p>}
        {day.slots.map((slot) => {
          const exercise = database.exercises.find((item) => item.id === slot.exerciseId);
          if (!exercise) return null;
          const view = getTrackingPresentation(exercise.tracking, exercise.defaultUnit);
          return <div className="routine-slot managed-slot routine-slot-readonly" key={slot.id}>
            <span className="importance-dot" data-importance={slot.importance} />
            <div className="routine-slot-content"><strong>{exercise.name}</strong><small>{slot.importance} · {view.requiresStartingValue ? `${view.valueLabel} ${slot.plannedLoad} ${view.valueSuffix}` : TRACKING_PRESET_LABELS[presetFromTracking(exercise.tracking)]} · A {slot.prescriptions.A.sets}×{slot.prescriptions.A.repMin}–{slot.prescriptions.A.repMax}</small></div>
            <button className="routine-manage-button" type="button" onClick={() => setManageSlotId(slot.id)} aria-label={`Manage ${exercise.name}`}>•••</button>
          </div>;
        })}
      </article>)}
    </section>

    <section className="paper-card version-card"><p className="eyebrow">Version history</p><h2>{database.routineVersions.length} immutable routine version{database.routineVersions.length === 1 ? '' : 's'}</h2><p>Every permanent edit creates a new version rather than silently rewriting previous sessions.</p></section>

    <section className="archived-exercises-section">
      <button className="archived-toggle" type="button" onClick={() => setArchivedOpen((value) => !value)}><span><strong>Archived exercises</strong><small>{database.exercises.filter((item) => item.archived).length} stored</small></span><i>{archivedOpen ? '−' : '+'}</i></button>
      {archivedOpen && <div className="archived-list">{database.exercises.filter((item) => item.archived).length === 0 ? <p className="muted">Nothing archived.</p> : database.exercises.filter((item) => item.archived).map((exercise) => <div key={exercise.id}><span><strong>{exercise.name}</strong><small>{TRACKING_PRESET_LABELS[presetFromTracking(exercise.tracking)]}</small></span><button className="secondary-action compact-control" type="button" onClick={() => { void props.onRestoreExercise(exercise.id); }}>Restore</button></div>)}</div>}
    </section>

    {open && <div className="modal-backdrop" onMouseDown={closeWizard}><section className="modal exercise-wizard" onMouseDown={(event) => event.stopPropagation()}>
      <header className="wizard-header"><div><p className="eyebrow">New routine slot</p><h2>Create an exercise</h2></div><button className="icon-button" onClick={closeWizard}>×</button></header>
      <div className="wizard-progress">{guidedSteps.map((label, index) => <i key={label} data-active={index <= step} />)}</div>
      <div className="wizard-viewport" onTouchStart={(event: TouchEvent) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event: TouchEvent) => { const end = event.changedTouches[0]?.clientX; const start = touchStart.current; touchStart.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 55) moveStep(end < start ? 1 : -1); }}>
        <article className="wizard-card" key={step}>
          {step === 0 && <><p className="eyebrow">1 · Movement</p><h3>What are we adding?</h3><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus placeholder="e.g. Assisted pull-up" /></label><label>Track by<select value={draft.preset} onChange={(event) => choosePreset(event.target.value as TrackingPreset)}>{presets.map((item) => <option key={item} value={item}>{TRACKING_PRESET_LABELS[item]}</option>)}</select></label></>}
          {step === 1 && <><p className="eyebrow">2 · Place</p><h3>Where does it live?</h3><label>Day<select value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value as DaySymbol })}>{days.map((day) => <option key={day}>{day}</option>)}</select></label><label>Importance<select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: event.target.value as Importance })}><option value="principal">Principal</option><option value="core">Core</option><option value="accessory">Accessory</option></select></label>{presentation.supportsEntryBasis && <label>Load is entered<select value={draft.entryBasis} onChange={(event) => setDraft({ ...draft, entryBasis: event.target.value as EntryBasis })}><option value="total">Total</option><option value="per_hand">Per hand</option><option value="per_side">Per side</option></select></label>}</>}
          {step === 2 && <><p className="eyebrow">3 · Dose</p><h3>Set the starting point.</h3><div className="form-grid">{presentation.requiresStartingValue && <SuffixInput label={presentation.valueLabel} suffix={presentation.valueSuffix} value={draft.startingValue} step={0.5} onChange={(value) => setDraft({ ...draft, startingValue: value })} />}<SuffixInput label={presentation.targetLabel} suffix={presentation.targetSuffix} value={draft.targetValue} step={tracking.metric === 'distance' ? 10 : 1} onChange={(value) => setDraft({ ...draft, targetValue: value })} /><SuffixInput label={presentation.progressionLabel} suffix={presentation.progressionSuffix} value={draft.progressionStep} step={tracking.metric === 'distance' ? 10 : tracking.metric === 'load_reps' ? 0.5 : 1} onChange={(value) => setDraft({ ...draft, progressionStep: value })} /></div></>}
          {step === 3 && <><p className="eyebrow">4 · Review</p><h3>{draft.name || 'Unnamed movement'}</h3><dl className="exercise-review"><div><dt>Day</dt><dd>{draft.day}</dd></div><div><dt>Role</dt><dd>{draft.importance}</dd></div><div><dt>Tracking</dt><dd>{TRACKING_PRESET_LABELS[draft.preset]}</dd></div><div><dt>Entry</dt><dd>{presentation.supportsEntryBasis ? entryBasisLabel(draft.entryBasis) : relationshipLabel(tracking.loadRelationship)}</dd></div>{presentation.requiresStartingValue && <div><dt>{presentation.valueLabel}</dt><dd>{draft.startingValue} {presentation.valueSuffix}</dd></div>}<div><dt>{presentation.targetLabel}</dt><dd>{draft.targetValue} {presentation.targetSuffix}</dd></div></dl><p className="muted">Creating this slot makes routine v{routine.version + 1}.</p></>}
        </article>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer className="wizard-actions"><button className="text-button" type="button" onClick={step === 0 ? closeWizard : () => moveStep(-1)}>{step === 0 ? 'Cancel' : 'Back'}</button>{step < 3 ? <button className="primary-action compact" type="button" onClick={() => moveStep(1)}>Next</button> : <button className="primary-action compact" type="button" disabled={saving} onClick={() => { void saveNew(); }}>{saving ? 'Creating…' : 'Create routine version'}</button>}</footer>
    </section></div>}

    {selected && selectedExercise && manageDraft && <div className="modal-backdrop manage-exercise-backdrop" onMouseDown={() => setManageSlotId(null)}><section className="manage-exercise-surface" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Routine slot · {selected.day.symbol}</p><h2>Manage {selectedExercise.name}</h2></div><button className="icon-button" type="button" onClick={() => setManageSlotId(null)}>×</button></header>
      <div className="manage-exercise-scroll">
        <section className="manage-grid">
          <label>Name<input value={manageDraft.name} onChange={(event) => setManageDraft({ ...manageDraft, name: event.target.value })} /></label>
          <label>Day<select value={manageDraft.day} onChange={(event) => setManageDraft({ ...manageDraft, day: event.target.value as DaySymbol })}>{days.map((day) => <option key={day}>{day}</option>)}</select></label>
          <label>Importance<select value={manageDraft.importance} onChange={(event) => setManageDraft({ ...manageDraft, importance: event.target.value as Importance })}><option value="principal">Principal</option><option value="core">Core</option><option value="accessory">Accessory</option></select></label>
          <label>Tracking<select value={manageDraft.preset} onChange={(event) => setManageDraft({ ...manageDraft, preset: event.target.value as TrackingPreset })}>{presets.map((item) => <option key={item} value={item}>{TRACKING_PRESET_LABELS[item]}</option>)}</select></label>
          <label>Entry basis<select value={manageDraft.entryBasis} onChange={(event) => setManageDraft({ ...manageDraft, entryBasis: event.target.value as EntryBasis })}><option value="total">Total</option><option value="per_hand">Per hand</option><option value="per_side">Per side</option></select></label>
          <label>Starting value<input type="number" min="0" step="0.5" value={manageDraft.plannedLoad} onChange={(event) => setManageDraft({ ...manageDraft, plannedLoad: Number(event.target.value) })} /></label>
          <label>Progression step<input type="number" min="0.1" step="0.5" value={manageDraft.progressionStep} onChange={(event) => setManageDraft({ ...manageDraft, progressionStep: Number(event.target.value) })} /></label>
          <label>Category<input value={manageDraft.category} onChange={(event) => setManageDraft({ ...manageDraft, category: event.target.value })} /></label>
          <label>Equipment<input value={manageDraft.equipment} onChange={(event) => setManageDraft({ ...manageDraft, equipment: event.target.value })} /></label>
          <label>Fatigue cost<select value={manageDraft.fatigueCost} onChange={(event) => setManageDraft({ ...manageDraft, fatigueCost: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Skill difficulty<select value={manageDraft.skillDifficulty} onChange={(event) => setManageDraft({ ...manageDraft, skillDifficulty: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
        </section>
        <section className="prescription-editor"><p className="eyebrow">Mode prescriptions</p>{modes.map((mode) => <div key={mode}><strong>{mode}</strong><label>Sets<input type="number" min="0" value={manageDraft.prescriptions[mode].sets} onChange={(event) => updatePrescription(mode, 'sets', Number(event.target.value))} /></label><label>Min<input type="number" min="0" value={manageDraft.prescriptions[mode].repMin} onChange={(event) => updatePrescription(mode, 'repMin', Number(event.target.value))} /></label><label>Max<input type="number" min="0" value={manageDraft.prescriptions[mode].repMax} onChange={(event) => updatePrescription(mode, 'repMax', Number(event.target.value))} /></label><label>Rest<input type="number" min="0" step="15" value={manageDraft.prescriptions[mode].restSeconds} onChange={(event) => updatePrescription(mode, 'restSeconds', Number(event.target.value))} /></label></div>)}</section>
        <section className="memory-editor"><p className="eyebrow">Exercise memory</p><label>Target muscles<textarea value={manageDraft.targetMuscles} onChange={(event) => setManageDraft({ ...manageDraft, targetMuscles: event.target.value })} placeholder="One per line" /></label><label>Key cues<textarea value={manageDraft.cues} onChange={(event) => setManageDraft({ ...manageDraft, cues: event.target.value })} placeholder="One per line" /></label><label>Common mistakes<textarea value={manageDraft.commonMistakes} onChange={(event) => setManageDraft({ ...manageDraft, commonMistakes: event.target.value })} /></label><label>Setup notes<textarea value={manageDraft.setupNotes} onChange={(event) => setManageDraft({ ...manageDraft, setupNotes: event.target.value })} /></label><label>Machine / equipment settings<textarea value={manageDraft.machineSettings} onChange={(event) => setManageDraft({ ...manageDraft, machineSettings: event.target.value })} /></label><label>Personal notes<textarea value={manageDraft.personalNotes} onChange={(event) => setManageDraft({ ...manageDraft, personalNotes: event.target.value })} /></label><label>Substitutions<textarea value={manageDraft.substitutions} onChange={(event) => setManageDraft({ ...manageDraft, substitutions: event.target.value })} placeholder="One per line" /></label></section>
        {error && <p className="form-error">{error}</p>}
      </div>
      <footer className="manage-actions"><div><button className="text-button" type="button" onClick={() => { if (window.confirm('Remove this exercise from the current routine? Historical sessions remain intact.')) void props.onRemoveSlot(selected.slot.id).then(() => setManageSlotId(null)); }}>Remove from routine</button><button className="text-button danger-text" type="button" onClick={() => { if (window.confirm('Archive this exercise and remove all current routine slots?')) void props.onArchiveExercise(selectedExercise.id).then(() => setManageSlotId(null)); }}>Archive</button></div><button className="primary-action compact" type="button" disabled={saving} onClick={() => { void saveManaged(); }}>{saving ? 'Saving…' : 'Save new routine version'}</button></footer>
    </section></div>}

    {recoveryDraft && <div className="modal-backdrop routine-recovery-backdrop"><section className="modal routine-recovery-dialog"><p className="eyebrow">Unfinished routine</p><h2>Continue editing?</h2><p>The recovered draft is based on routine v{routine.version}.</p><footer><button className="secondary-action" type="button" onClick={() => { localStorage.removeItem(ROUTINE_EDIT_STORAGE_KEY); setRecoveryDraft(null); setEditDraft(createRoutineEditDraft(database)); }}>Discard</button><button className="primary-action compact" type="button" onClick={() => { setEditDraft(recoveryDraft); setRecoveryDraft(null); }}>Continue</button></footer></section></div>}
  </main>;
}
