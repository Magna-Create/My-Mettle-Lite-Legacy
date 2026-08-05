import { useEffect, useState, type CSSProperties } from 'react';
import type { SessionCelebrationSummary } from '../../domain/rules/sessionCelebration';

interface Props {
  summary: SessionCelebrationSummary;
  onBack: () => void;
  onContinue: () => Promise<void>;
}

function vibration(tier: SessionCelebrationSummary['tier']): number[] {
  if (tier === 'partial') return [70];
  if (tier === 'complete') return [90, 55, 150];
  if (tier === 'strong') return [120, 45, 170, 55, 220];
  return [150, 40, 190, 45, 260, 60, 360];
}

export function SessionCelebration({ summary, onBack, onContinue }: Props) {
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    navigator.vibrate?.(vibration(summary.tier));
    return () => { navigator.vibrate?.(0); };
  }, [summary.tier]);

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await onContinue();
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className={`session-celebration tier-${summary.tier}`} role="dialog" aria-modal="true" aria-labelledby="session-celebration-title">
      <div className="celebration-effects" aria-hidden="true">
        <i className="celebration-halo" />
        <i className="celebration-ring ring-one" />
        <i className="celebration-ring ring-two" />
        {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--particle-index': index } as CSSProperties} />)}
      </div>
      <section className="celebration-card">
        <p className="eyebrow">Workout complete</p>
        <h2 id="session-celebration-title">{summary.heading}</h2>
        <p>{summary.message}</p>
        <div className="celebration-score-grid">
          <article><strong>{summary.completedPrescribedSets}/{summary.prescribedSets}</strong><span>planned sets</span></article>
          <article><strong>{summary.achievedExercises}/{summary.totalExercises}</strong><span>goals met</span></article>
          <article><strong>{summary.exceededExercises}</strong><span>exceeded</span></article>
        </div>
        <div className="celebration-actions">
          <button type="button" className="secondary-action" disabled={finishing} onClick={onBack}>Back</button>
          <button type="button" className="primary-action" disabled={finishing} onClick={() => { void finish(); }}>{finishing ? 'Saving…' : 'View progress'}</button>
        </div>
      </section>
    </div>
  );
}
