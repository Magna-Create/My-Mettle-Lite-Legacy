import { useEffect, useMemo, useState } from 'react';
import type { ExerciseReflection, ReflectionScale, SessionExercise } from '../../domain/model';
import type { ExerciseReflectionInput } from '../../application/ExerciseReflectionManagement';

interface Props {
  exercise: SessionExercise | null;
  onClose: () => void;
  onSave: (input: ExerciseReflectionInput) => Promise<void>;
}

type Step = 0 | 1 | 2;

function ScaleQuestion({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: ReflectionScale | null;
  onChange: (value: ReflectionScale) => void;
}) {
  const numericValue = typeof value === 'number' ? value : 4;
  return <div className={`reflection-question reflection-slider ${value === null ? 'is-unanswered' : ''}`}>
    <div className="reflection-question-heading"><strong>{label}</strong>{typeof value === 'number' && <span>{value}/7</span>}</div>
    <input
      type="range"
      min="1"
      max="7"
      step="1"
      value={numericValue}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value) as ReflectionScale)}
    />
    <div className="reflection-scale-labels"><span>{low}</span><span>{high}</span></div>
    <button className={`reflection-unsure ${value === 'unsure' ? 'is-selected' : ''}`} type="button" onClick={() => onChange('unsure')}>Unsure</button>
  </div>;
}

function OptionQuestion<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return <div className="reflection-question">
    <strong>{label}</strong>
    <div className="reflection-options">{options.map((option) => <button key={option.value} className={value === option.value ? 'is-selected' : ''} type="button" onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
  </div>;
}

function initialValue(exercise: SessionExercise | null) {
  return exercise?.reflection ?? null;
}

export function ExerciseReflectionOverlay({ exercise, onClose, onSave }: Props) {
  const existing = initialValue(exercise);
  const [step, setStep] = useState<Step>(0);
  const [targetMuscleEngagement, setTargetMuscleEngagement] = useState<ReflectionScale | null>(existing?.targetMuscleEngagement ?? null);
  const [execution, setExecution] = useState<ExerciseReflection['execution'] | null>(existing?.execution ?? null);
  const [enjoyment, setEnjoyment] = useState<ReflectionScale | null>(existing?.enjoyment ?? null);
  const [comfort, setComfort] = useState<ExerciseReflection['comfort'] | null>(existing?.comfort ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reflection = initialValue(exercise);
    setStep(0);
    setTargetMuscleEngagement(reflection?.targetMuscleEngagement ?? null);
    setExecution(reflection?.execution ?? null);
    setEnjoyment(reflection?.enjoyment ?? null);
    setComfort(reflection?.comfort ?? null);
    setNote(reflection?.note ?? '');
    setSaving(false);
    setSaved(false);
    setError(null);
  }, [exercise?.id]);

  const stepReady = useMemo(() => {
    if (step === 0) return targetMuscleEngagement !== null && execution !== null;
    if (step === 1) return enjoyment !== null && comfort !== null;
    return true;
  }, [step, targetMuscleEngagement, execution, enjoyment, comfort]);

  if (!exercise) return null;

  async function complete() {
    if (targetMuscleEngagement === null || execution === null || enjoyment === null || comfort === null) {
      setError('Answer each item or choose Unsure.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave({ targetMuscleEngagement, execution, enjoyment, comfort, note });
      setSaved(true);
      window.setTimeout(onClose, 1050);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The reflection could not be saved.');
      setSaving(false);
    }
  }

  return <div className={`modal-backdrop reflection-backdrop ${saved ? 'is-complete' : ''}`} onMouseDown={saved ? undefined : onClose}>
    <section className="reflection-surface" role="dialog" aria-modal="true" aria-labelledby="reflection-title" onMouseDown={(event) => event.stopPropagation()}>
      {saved ? <div className="reflection-success"><div className="reflection-success-mark">✓</div><p className="eyebrow">Saved to this session</p><h2>Nice. That was worth it.</h2><div className="reflection-success-wave" aria-hidden="true" /></div> : <>
        <header><div><p className="eyebrow">Exercise reflection · {step + 1}/3</p><h2 id="reflection-title">{exercise.exerciseNameSnapshot}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close reflection">×</button></header>
        <div className="reflection-progress" aria-hidden="true">{[0, 1, 2].map((index) => <i key={index} data-active={index <= step} />)}</div>
        <div className="reflection-card" key={step}>
          {step === 0 && <><p className="eyebrow">Experience</p><h3>How did the movement feel?</h3><ScaleQuestion label="Target muscle engagement" low="Broad" high="Concentrated" value={targetMuscleEngagement} onChange={setTargetMuscleEngagement} /><OptionQuestion label="Form & execution" value={execution} onChange={setExecution} options={[{ value: 'clean', label: 'Clean' }, { value: 'mixed', label: 'Mixed' }, { value: 'poor', label: 'Poor' }, { value: 'unsure', label: 'Unsure' }]} /></>}
          {step === 1 && <><p className="eyebrow">Vibe</p><h3>What was it like to do?</h3><ScaleQuestion label="Enjoyment" low="Hate" high="Love" value={enjoyment} onChange={setEnjoyment} /><OptionQuestion label="Comfort" value={comfort} onChange={setComfort} options={[{ value: 'good', label: 'Good' }, { value: 'fine', label: 'Fine' }, { value: 'unsure', label: 'Unsure' }, { value: 'uncomfortable', label: 'Uncomfortable' }, { value: 'pain', label: 'Pain' }]} /></>}
          {step === 2 && <><p className="eyebrow">Optional note</p><h3>Anything worth remembering?</h3><label className="reflection-note"><textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Setup, sensation, context, or anything else worth keeping…" /><small>Optional. Leave this empty when there’s nothing to add. A future on-device model may choose to read this note.</small></label></>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="reflection-actions"><button className="text-button" type="button" onClick={step === 0 ? onClose : () => setStep((step - 1) as Step)}>{step === 0 ? 'Cancel' : 'Back'}</button>{step < 2 ? <button className="primary-action compact" type="button" disabled={!stepReady} onClick={() => setStep((step + 1) as Step)}>Next</button> : <button className="primary-action compact reflection-complete" type="button" disabled={saving} onClick={() => { void complete(); }}>{saving ? 'Saving…' : existing ? 'Update reflection' : 'Complete'}</button>}</footer>
      </>}
    </section>
  </div>;
}
