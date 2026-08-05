import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExerciseTrackingProfile, SetRecord } from '../domain/model';
import { evaluateMathExpression } from '../domain/mathExpression';
import { effectiveLoadKg, getTrackingPresentation } from '../domain/tracking';

type SetPatch = Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres'>>;

interface Props {
  set: SetRecord;
  tracking: ExerciseTrackingProfile;
  bodyweightKg: number | null;
  readOnly?: boolean;
  onRemove?: (() => void) | undefined;
  onChange: (patch: SetPatch) => void;
  onCommit?: (patch: SetPatch) => void;
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface NumberInputProps {
  label: string;
  suffix: string;
  value: number | null;
  step: number;
  inputMode: 'decimal' | 'numeric';
  ariaLabel: string;
  readOnly: boolean;
  onChange: (value: number | null) => void;
  onCommit?: (value: number | null) => void;
}

function NumberInput({ label, suffix, value, step, inputMode, ariaLabel, readOnly, onChange, onCommit }: NumberInputProps) {
  return <label className="tracked-input"><span>{label}</span><span className="input-with-suffix"><input inputMode={inputMode} type="number" min="0" step={step} value={value ?? ''} readOnly={readOnly} onChange={(event) => onChange(parseNumber(event.target.value))} onBlur={(event) => onCommit?.(parseNumber(event.currentTarget.value))} aria-label={ariaLabel} /><i>{suffix}</i></span></label>;
}

interface CalculatorInputProps {
  label: string;
  suffix: string;
  value: number | null;
  ariaLabel: string;
  readOnly: boolean;
  onChange: (value: number | null) => void;
  onCommit?: (value: number | null) => void;
}

const CALCULATOR_KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '(', ')', 'C', '⌫', '+', '×2'] as const;

function CalculatorInput({ label, suffix, value, ariaLabel, readOnly, onChange, onCommit }: CalculatorInputProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setExpression(value === null ? '' : String(value));
    setError(null);
  }, [open, value]);

  function append(key: typeof CALCULATOR_KEYS[number]) {
    setError(null);
    if (key === 'C') {
      setExpression('');
      return;
    }
    if (key === '⌫') {
      setExpression((current) => current.slice(0, -1));
      return;
    }
    if (key === '×2') {
      setExpression((current) => current ? `${current}×2` : '2');
      return;
    }
    setExpression((current) => `${current}${key}`);
  }

  function confirm() {
    try {
      const resolved = evaluateMathExpression(expression);
      onChange(resolved);
      onCommit?.(resolved);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the formula.');
    }
  }

  const dialog = open ? createPortal(
    <div className="calculator-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="calculator-dialog" role="dialog" aria-modal="true" aria-labelledby="calculator-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Calculator entry</p><h2 id="calculator-title">{label}</h2></div><button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close calculator">×</button></header>
        <div className="calculator-display">
          <span>{expression || '0'}</span>
          <strong>{(() => { try { return expression ? `= ${evaluateMathExpression(expression)} ${suffix}` : `0 ${suffix}`; } catch { return '—'; } })()}</strong>
        </div>
        {error && <p className="calculator-error" role="alert">{error}</p>}
        <div className="calculator-keypad">{CALCULATOR_KEYS.map((key) => <button key={key} type="button" data-action={key === 'C' || key === '⌫' ? 'utility' : key === '×2' ? 'shortcut' : undefined} onClick={() => append(key)}>{key}</button>)}</div>
        <button className="primary-action calculator-confirm" type="button" onClick={confirm}>Use value</button>
      </section>
    </div>,
    document.body,
  ) : null;

  return <label className="tracked-input calculator-tracked-input"><span>{label}</span><span className="input-with-suffix"><input type="text" inputMode="none" value={value ?? ''} readOnly aria-label={`${ariaLabel}. Opens calculator.`} onClick={() => { if (!readOnly) setOpen(true); }} onKeyDown={(event) => { if (!readOnly && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setOpen(true); } }} /><i>{suffix}</i><button className="calculator-pin" type="button" disabled={readOnly} onClick={() => setOpen(true)} aria-label={`Open calculator for ${label.toLowerCase()}`}>⌗</button></span>{dialog}</label>;
}

export function SetEntryRow({ set, tracking, bodyweightKg, readOnly = false, onRemove, onChange, onCommit }: Props) {
  const presentation = getTrackingPresentation(tracking, set.unit);
  const effectiveLoad = effectiveLoadKg(set, tracking, bodyweightKg);
  const showEffectiveLoad = effectiveLoad !== null && ['assistance', 'bodyweight', 'bodyweight_plus_external'].includes(tracking.loadRelationship);
  const additional = set.kind === 'additional';
  return <div className={`set-row metric-${tracking.metric} ${additional ? 'is-additional-set' : ''}`}>
    <div className="set-index-block"><span className="set-index">{set.setIndex + 1}</span>{additional && <small>extra</small>}</div>
    <div className="set-inputs">
      {tracking.metric === 'load_reps' && <CalculatorInput label={presentation.valueLabel} suffix={presentation.valueSuffix} value={set.load} ariaLabel={`Set ${set.setIndex + 1} ${presentation.valueLabel.toLowerCase()}`} readOnly={readOnly} onChange={(load) => onChange({ load })} onCommit={(load) => onCommit?.({ load })} />}
      {(tracking.metric === 'load_reps' || tracking.metric === 'reps') && <NumberInput label="Repetitions" suffix="reps" value={set.reps} step={1} inputMode="numeric" ariaLabel={`Set ${set.setIndex + 1} repetitions`} readOnly={readOnly} onChange={(reps) => onChange({ reps })} onCommit={(reps) => onCommit?.({ reps })} />}
      {tracking.metric === 'duration' && <NumberInput label="Duration" suffix="sec" value={set.durationSeconds} step={1} inputMode="numeric" ariaLabel={`Set ${set.setIndex + 1} duration`} readOnly={readOnly} onChange={(durationSeconds) => onChange({ durationSeconds })} onCommit={(durationSeconds) => onCommit?.({ durationSeconds })} />}
      {tracking.metric === 'distance' && <NumberInput label="Distance" suffix="m" value={set.distanceMetres} step={1} inputMode="decimal" ariaLabel={`Set ${set.setIndex + 1} distance`} readOnly={readOnly} onChange={(distanceMetres) => onChange({ distanceMetres })} onCommit={(distanceMetres) => onCommit?.({ distanceMetres })} />}
    </div>
    {showEffectiveLoad && <small className="effective-load">Effective resistance {effectiveLoad.toFixed(1)} kg</small>}
    {onRemove && !readOnly && <button className="set-remove-button" type="button" onClick={onRemove} aria-label={`Remove set ${set.setIndex + 1}`}>×</button>}
  </div>;
}
