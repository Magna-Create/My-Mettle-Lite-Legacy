import type { SetRecord } from '../domain/model';

interface Props {
  set: SetRecord;
  onChange: (patch: Partial<Pick<SetRecord, 'load' | 'reps'>>) => void;
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SetEntryRow({ set, onChange }: Props) {
  return (
    <div className="set-row">
      <span className="set-index">{set.setIndex + 1}</span>
      <label>
        <span>Load</span>
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="0.5"
          value={set.load ?? ''}
          onChange={(event) => onChange({ load: parseNumber(event.target.value) })}
          aria-label={`Set ${set.setIndex + 1} load`}
        />
      </label>
      <span className="unit">{set.unit}</span>
      <label>
        <span>Reps</span>
        <input
          inputMode="numeric"
          type="number"
          min="0"
          step="1"
          value={set.reps ?? ''}
          onChange={(event) => onChange({ reps: parseNumber(event.target.value) })}
          aria-label={`Set ${set.setIndex + 1} repetitions`}
        />
      </label>
    </div>
  );
}
