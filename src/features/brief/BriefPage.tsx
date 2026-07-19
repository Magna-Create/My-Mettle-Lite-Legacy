import { useState } from 'react';
import { DAY_LABELS } from '../../data/seed';
import type { AppDatabase, DaySymbol, Mode } from '../../domain/model';
import { getCycleSnapshot } from '../../domain/rules/cycle';
import { ModeSelectionModal } from '../../components/ModeSelectionModal';

interface Props {
  database: AppDatabase;
  onBeginSession: (day: DaySymbol, mode: Mode) => Promise<void>;
}

export function BriefPage({ database, onBeginSession }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentCycle = database.cycles.find((item) => item.id === database.currentCycleId);
  if (!currentCycle) throw new Error('Current cycle missing.');
  const cycle = getCycleSnapshot(currentCycle);
  const [selectedDay, setSelectedDay] = useState<DaySymbol>(cycle.nextRecommendedDay);
  const completedCount = database.sessions.filter((session) => session.status === 'completed').length;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date());

  return (
    <main className="page brief-page">
      <section className="hero-panel">
        <div className="particle-field" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
        </div>
        <p className="eyebrow">{weekday} brief · calibration</p>
        <h1>You have a clean place to begin.</h1>
        <p className="hero-copy">
          {cycle.nextRecommendedDay} is the next useful step. The app is collecting evidence rather than pretending to know your body already.
        </p>
        <button className="primary-action" onClick={() => { setSelectedDay(cycle.nextRecommendedDay); setModalOpen(true); }} disabled={Boolean(database.activeSessionId)}>
          {database.activeSessionId ? 'Session already active' : `Begin ${cycle.nextRecommendedDay}`}
        </button>
        <div className="day-override" aria-label="Choose another routine day">
          <span>Or choose</span>
          {(['ψ', 'φ', 'π', '&'] as DaySymbol[]).map((day) => (
            <button
              key={day}
              disabled={Boolean(database.activeSessionId) || (day === '&' && !cycle.andEligible)}
              onClick={() => { setSelectedDay(day); setModalOpen(true); }}
            >
              {day}
            </button>
          ))}
        </div>
      </section>

      <section className="card-grid" aria-label="Today’s briefing">
        <article className="paper-card featured-card">
          <p className="eyebrow">Recommended day</p>
          <h2>{DAY_LABELS[cycle.nextRecommendedDay]}</h2>
          <p>{cycle.explanation}</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Cycle balance</p>
          <h2>{cycle.completedCoreDays.length}/3 core days</h2>
          <p>& is {cycle.andEligible ? 'available' : 'still gated'}.</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Evidence quality</p>
          <h2>{completedCount < 3 ? 'Collecting evidence' : 'Early pattern forming'}</h2>
          <p>{Math.min(completedCount, 3)}/3 comparable exposures towards the first exercise trend.</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Active experiments</p>
          <h2>{database.experiments.filter((item) => ['active', 'ready_for_decision'].includes(item.status)).length}</h2>
          <p>Controlled changes remain separate from the base routine until you approve them.</p>
        </article>
      </section>

      {modalOpen && (
        <ModeSelectionModal
          day={selectedDay}
          onClose={() => setModalOpen(false)}
          onSelect={async (mode) => {
            await onBeginSession(selectedDay, mode);
            setModalOpen(false);
          }}
        />
      )}
    </main>
  );
}
