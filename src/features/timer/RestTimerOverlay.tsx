import type { RestTimerState } from './useRestTimer';

interface Props {
  state: RestTimerState | null;
  onPause: () => void;
  onResume: () => void;
  onAddSeconds: (seconds: number) => void;
  onMinimise: () => void;
  onDismiss: () => void;
}

export function formatRestTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function RestTimerOverlay({
  state,
  onPause,
  onResume,
  onAddSeconds,
  onMinimise,
  onDismiss,
}: Props) {
  if (!state || state.minimized) return null;
  const progress = state.totalSeconds > 0
    ? Math.max(0, Math.min(1, state.remainingSeconds / state.totalSeconds))
    : 0;

  return (
    <div className="rest-focus-layer" role="presentation">
      <button className="rest-focus-scrim" onClick={onMinimise} aria-label="Minimise rest timer" />
      <section className={`rest-focus-card ${state.completed ? 'is-complete' : ''}`} role="dialog" aria-modal="true" aria-label="Rest timer">
        <header>
          <div>
            <p className="eyebrow">{state.completed ? 'Ready' : state.paused ? 'Rest paused' : 'Rest'}</p>
            <h2>{state.exerciseName}</h2>
          </div>
          <button className="timer-minimise" type="button" onClick={onMinimise}>Minimise</button>
        </header>

        <div className="rest-clock" aria-live="polite">
          <strong>{formatRestTime(state.remainingSeconds)}</strong>
          <span>{state.completed ? 'Timer complete' : state.paused ? 'Paused' : 'Remaining'}</span>
        </div>

        <div className="rest-focus-track" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>

        <footer>
          {state.completed ? (
            <button className="timer-pause" type="button" onClick={onDismiss}>Done</button>
          ) : (
            <button className="timer-pause" type="button" onClick={state.paused ? onResume : onPause}>
              {state.paused ? 'Resume' : 'Pause'}
            </button>
          )}
          <div>
            {!state.completed && <button type="button" onClick={() => onAddSeconds(30)}>+30</button>}
            <button type="button" onClick={onDismiss}>{state.completed ? 'Close' : 'Skip'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
