import { useMemo, useState } from 'react';
import { DAY_LABELS } from '../../data/seed';
import type { AppDatabase, DaySymbol, Mode } from '../../domain/model';
import { getCycleSnapshot } from '../../domain/rules/cycle';
import { ModeSelectionModal } from '../../components/ModeSelectionModal';

interface Props {
  database: AppDatabase;
  onBeginSession: (day: DaySymbol, mode: Mode) => Promise<void>;
}

interface BriefSuggestion {
  label: string;
  value: string;
}

function buildSuggestions(hour: number): BriefSuggestion[] {
  const fuel = hour < 11
    ? 'Carbs + protein if breakfast has not happened.'
    : hour < 18
      ? 'Quick carbs if the last meal was more than three hours ago.'
      : 'Late session: caffeine only if sleep can take the hit.';

  return [
    { label: 'Fuel', value: fuel },
    { label: 'Water', value: '500–750 ml across the hour before training.' },
    { label: 'Start', value: 'Ramp the first movement. No extra ceremony.' },
  ];
}

export function BriefPage({ database, onBeginSession }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentCycle = database.cycles.find((item) => item.id === database.currentCycleId);
  if (!currentCycle) throw new Error('Current cycle missing.');

  const cycle = getCycleSnapshot(currentCycle);
  const [selectedDay, setSelectedDay] = useState<DaySymbol>(cycle.nextRecommendedDay);
  const completedCount = database.sessions.filter((session) => session.status === 'completed').length;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date());
  const suggestions = useMemo(() => buildSuggestions(new Date().getHours()), []);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  const recommendedExerciseCount = routine?.days.find((day) => day.symbol === cycle.nextRecommendedDay)?.slots.length ?? 0;
  const openExperimentCount = database.experiments.filter((item) =>
    ['active', 'ready_for_decision'].includes(item.status),
  ).length;

  return (
    <main className="page brief-page">
      <section className="hero-panel">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="particle-field" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
        </div>

        <div className="brief-intro">
          <p className="eyebrow">{weekday} · {cycle.nextRecommendedDay}</p>
          <h1>{DAY_LABELS[cycle.nextRecommendedDay]}.</h1>
          <div className="brief-snapshot" aria-label="Recommended session summary">
            <span>{recommendedExerciseCount} exercise{recommendedExerciseCount === 1 ? '' : 's'}</span>
            <span>{cycle.completedCoreDays.length}/3 core days</span>
            <span>{openExperimentCount} live test{openExperimentCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        <section className="brief-suggestions" aria-label="Before training">
          {suggestions.map((suggestion) => (
            <article key={suggestion.label}>
              <span>{suggestion.label}</span>
              <p>{suggestion.value}</p>
            </article>
          ))}
        </section>

        <div className="brief-action-zone">
          <button
            className="primary-action brief-begin"
            onClick={() => {
              setSelectedDay(cycle.nextRecommendedDay);
              setModalOpen(true);
            }}
            disabled={Boolean(database.activeSessionId)}
          >
            {database.activeSessionId ? 'Session active' : `Begin ${cycle.nextRecommendedDay}`}
          </button>
          <div className="day-override" aria-label="Choose another routine day">
            <span>Or choose</span>
            {(['ψ', 'φ', 'π', '&'] as DaySymbol[]).map((day) => (
              <button
                key={day}
                disabled={Boolean(database.activeSessionId) || (day === '&' && !cycle.andEligible)}
                onClick={() => {
                  setSelectedDay(day);
                  setModalOpen(true);
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card-grid" aria-label="Cycle briefing">
        <article className="paper-card featured-card">
          <p className="eyebrow">Next</p>
          <h2>{cycle.nextRecommendedDay}</h2>
          <p>{recommendedExerciseCount} movements in the current routine.</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Cycle</p>
          <h2>{cycle.completedCoreDays.length}/3</h2>
          <p>& {cycle.andEligible ? 'open' : 'locked'}.</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Evidence</p>
          <h2>{completedCount}</h2>
          <p>Completed session{completedCount === 1 ? '' : 's'}.</p>
        </article>
        <article className="paper-card">
          <p className="eyebrow">Lab</p>
          <h2>{openExperimentCount}</h2>
          <p>Active or ready for review.</p>
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
