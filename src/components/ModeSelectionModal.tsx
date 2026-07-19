import type { Mode } from '../domain/model';

interface Props {
  day: string;
  onSelect: (mode: Mode) => void;
  onClose: () => void;
}

const descriptions: Record<Mode, string> = {
  A: 'The full intended session.',
  B: 'A reduced session for limited time or capacity.',
  C: 'The smallest useful dose that keeps the day moving.',
};

export function ModeSelectionModal({ day, onSelect, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal mode-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">{day} is prepared</p>
        <h2 id="mode-title">What capacity are you bringing?</h2>
        <p className="muted">There is no morally correct choice. Choose the dose you can perform properly.</p>
        <div className="mode-grid">
          {(['A', 'B', 'C'] as const).map((mode) => (
            <button key={mode} className="mode-choice" onClick={() => onSelect(mode)}>
              <strong>{mode}</strong>
              <span>{descriptions[mode]}</span>
            </button>
          ))}
        </div>
        <button className="text-button" onClick={onClose}>Not yet</button>
      </section>
    </div>
  );
}
