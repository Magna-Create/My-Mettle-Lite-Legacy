import type { ExerciseTrackingProfile, SetRecord } from '../domain/model';
import { effectiveLoadKg, getTrackingPresentation } from '../domain/tracking';

interface Props {
  set: SetRecord;
  tracking: ExerciseTrackingProfile;
  bodyweightKg: number | null;
  readOnly?: boolean;
  onRemove?: () => void;
  onChange: (patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres'>>) => void;
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
}

function NumberInput({ label, suffix, value, step, inputMode, ariaLabel, readOnly, onChange }: NumberInputProps) {
  return (
    <label className="tracked-input">
      <span>{label}</span>
      <span className="input-with-suffix">
        <input inputMode={inputMode} type="number" min="0" step={step} value={value ?? ''} readOnly={readOnly} onChange={(event) => onChange(parseNumber(event.target.value))} aria-label={ariaLabel} />
        <i>{suffix}</i>
      </span>
    </label>
  );
}

export function SetEntryRow({ set, tracking, bodyweightKg, readOnly = false, onRemove, onChange }: Props) {
  const presentation = getTrackingPresentation(tracking, set.unit);
  const effectiveLoad = effectiveLoadKg(set, tracking, bodyweightKg);
  const showEffectiveLoad = effectiveLoad !== null && ['assistance', 'bodyweight', 'bodyweight_plus_external'].includes(tracking.loadRelationship);
  const additional = set.kind === 'additional';

  return (
    <div className={`set-row metric-${tracking.metric} ${additional ? 'is-additional-set' : ''}`}>
      <div className="set-index-block"><span className="set-index">{set.setIndex + 1}</span>{additional && <small>extra</small>}</div>
      <div className="set-inputs">
        {tracking.metric === 'load_reps' && <NumberInput label={presentation.valueLabel} suffix={presentation.valueSuffix} value={set.load} step={0.5} inputMode="decimal" ariaLabel={`Set ${set.setIndex + 1} ${presentation.valueLabel.toLowerCase()}`} readOnly={readOnly} onChange={(load) => onChange({ load })} />}
        {(tracking.metric === 'load_reps' || tracking.metric === 'reps') && <NumberInput label="Repetitions" suffix="reps" value={set.reps} step={1} inputMode="numeric" ariaLabel={`Set ${set.setIndex + 1} repetitions`} readOnly={readOnly} onChange={(reps) => onChange({ reps })} />}
        {tracking.metric === 'duration' && <NumberInput label="Duration" suffix="sec" value={set.durationSeconds} step={1} inputMode="numeric" ariaLabel={`Set ${set.setIndex + 1} duration`} readOnly={readOnly} onChange={(durationSeconds) => onChange({ durationSeconds })} />}
        {tracking.metric === 'distance' && <NumberInput label="Distance" suffix="m" value={set.distanceMetres} step={1} inputMode="decimal" ariaLabel={`Set ${set.setIndex + 1} distance`} readOnly={readOnly} onChange={(distanceMetres) => onChange({ distanceMetres })} />}
      </div>
      {showEffectiveLoad && <small className="effective-load">Effective resistance {effectiveLoad.toFixed(1)} kg</small>}
      {onRemove && !readOnly && <button className="set-remove-button" type="button" onClick={onRemove} aria-label={`Remove set ${set.setIndex + 1}`}>×</button>}
    </div>
  );
}