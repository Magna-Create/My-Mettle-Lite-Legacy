import { useEffect, useState } from 'react';
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
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    setConfirmEnd(false);
  }, [state?.exerciseId, state?.completed, state?.minimized]);

  useEffect(() => {
    if (!confirmEnd) return;
    const timeout = window.setTimeout(() => setConfirmEnd(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [confirmEnd]);

  if (!state || state.minimized) return null;
  const progress = state.totalSeconds > 0
    ? Math.max(0, Math.min(1, state.remainingSeconds / state.totalSeconds))
    : 0;

  function requestEnd() {
    if (state?.completed || confirmEnd) {
      onDismiss();
      return;
    }
    setConfirmEnd(true);
  }

  return (
    <div className="rest-focus-layer" role="presentation">
      <button className="rest-focus-scrim" onClick={onMinimise} aria-label="Minimise rest timer" />
      <section className={`rest-focus-card ${state.completed ? 'is-complete' : ''}`} role="dialog" aria-modal="true" aria-label="Rest timer">
        <header>
          <div>
            <p className="eyebrow">{state.completed ? 'Ready' : state.paused ? 'Rest paused' : 'Rest'}</p>
            <h2>{state.exerciseName}</h2>
          </div>
          <button className={`timer-end ${confirmEnd ? 'is-confirming' : ''}`} type="button" onClick={requestEnd}>
            {state.completed ? 'Close' : confirmEnd ? 'Tap again to end' : 'End'}
          </button>
        </header>

        <div className="rest-clock" aria-live="polite">
          <strong>{formatRestTime(state.remainingSeconds)}</strong>
          <span>{state.completed ? 'Timer complete' : state.paused ? 'Paused' : 'Remaining'}</span>
        </div>

        <div className="rest-focus-track" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>

        {state.completed ? (
          <footer className="timer-complete-footer">
            <button className="timer-done" type="button" onClick={onDismiss}>Done</button>
          </footer>
        ) : (
          <footer className="timer-control-footer">
            <div className="timer-adjust-row">
              <button type="button" onClick={() => onAddSeconds(-15)} aria-label="Subtract 15 seconds">−15</button>
              <button className="timer-pause" type="button" onClick={state.paused ? onResume : onPause}>
                {state.paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" onClick={() => onAddSeconds(15)} aria-label="Add 15 seconds">+15</button>
            </div>
            <button className="timer-minimise-primary" type="button" onClick={onMinimise}>Minimise</button>
          </footer>
        )}
      </section>
    </div>
  );
}
