import type { Mode } from '../domain/model';
import { MODE_PRESENTATION } from '../domain/presentation';

export interface ModeSummary {
  exerciseCount: number;
  setCount: number;
}

interface Props {
  day: string;
  summaries: Record<Mode, ModeSummary>;
  onSelect: (mode: Mode) => void;
  onClose: () => void;
}

function summaryLabel(summary: ModeSummary) {
  return `${summary.exerciseCount} exercise${summary.exerciseCount === 1 ? '' : 's'} · ${summary.setCount} set${summary.setCount === 1 ? '' : 's'}`;
}

export function ModeSelectionModal({ day, summaries, onSelect, onClose }: Props) {
  return (
    <div className="modal-backdrop mode-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal mode-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">{day} · pick the version</p>
        <h2 id="mode-title">How are we doing this?</h2>
        <div className="mode-grid">
          {(['A', 'B', 'C'] as const).map((mode) => (
            <button key={mode} className="mode-choice" onClick={() => onSelect(mode)} disabled={summaries[mode].exerciseCount === 0}>
              <span className="mode-code">{mode}</span>
              <span className="mode-copy">
                <strong>{MODE_PRESENTATION[mode].name}</strong>
                <small>{MODE_PRESENTATION[mode].description} · {summaryLabel(summaries[mode])}</small>
              </span>
              <span className="mode-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <button className="text-button" onClick={onClose}>Later</button>
      </section>
    </div>
  );
}
