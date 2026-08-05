import { useMemo, useState } from 'react';
import { DAY_LABELS } from '../../data/seed';
import type { AppDatabase, DaySymbol, Mode } from '../../domain/model';
import { getCycleSnapshot } from '../../domain/rules/cycle';
import { ModeSelectionModal, type ModeSummary } from '../../components/ModeSelectionModal';

interface Props { database: AppDatabase; onBeginSession: (day: DaySymbol, mode: Mode) => Promise<void>; }
interface BriefSuggestion { label: string; value: string; }

function buildSuggestions(hour: number, firstMovement?: string): BriefSuggestion[] {
  const carbohydrate = hour < 11
    ? '30–60 g carbohydrate with breakfast or a light pre-workout meal.'
    : hour < 18
      ? '30–60 g carbohydrate 1–3 hours before training; use the lower end if eating close to the session.'
      : '30–45 g easy carbohydrate if dinner is not already covering the session.';

  return [
    { label: 'Carbohydrate', value: carbohydrate },
    { label: 'Protein', value: '25–40 g protein in the 1–3 hours before training.' },
    { label: 'Water', value: '500–750 ml across the hour before training.' },
    { label: 'Warm-up', value: firstMovement ? `Two lighter sets before ${firstMovement}.` : 'Two lighter sets before the first working movement.' },
  ];
}

export function BriefPage({ database, onBeginSession }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentCycle = database.cycles.find((item) => item.id === database.currentCycleId);
  if (!currentCycle) throw new Error('Current cycle missing.');

  const cycle = getCycleSnapshot(currentCycle);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  const optionalExerciseCount = routine?.days.find((day) => day.symbol === '&')?.slots.length ?? 0;
  const recommendedSymbol: DaySymbol = cycle.nextRecommendedDay === '&' && optionalExerciseCount === 0
    ? 'ψ'
    : cycle.nextRecommendedDay;
  const [selectedDay, setSelectedDay] = useState<DaySymbol>(recommendedSymbol);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date());
  const recommendedDay = routine?.days.find((day) => day.symbol === recommendedSymbol);
  const recommendedExerciseCount = recommendedDay?.slots.length ?? 0;
  const firstExerciseId = recommendedDay?.slots[0]?.exerciseId;
  const firstMovement = database.exercises.find((exercise) => exercise.id === firstExerciseId)?.name;
  const suggestions = useMemo(() => buildSuggestions(new Date().getHours(), firstMovement), [firstMovement]);
  const selectedRoutineDay = routine?.days.find((day) => day.symbol === selectedDay);
  const modeSummaries = Object.fromEntries((['A', 'B', 'C'] as Mode[]).map((mode) => {
    const included = selectedRoutineDay?.slots.filter((slot) => slot.prescriptions[mode].included) ?? [];
    const summary: ModeSummary = {
      exerciseCount: included.length,
      setCount: included.reduce((sum, slot) => sum + slot.prescriptions[mode].sets, 0),
    };
    return [mode, summary];
  })) as Record<Mode, ModeSummary>;

  return <main className="page brief-page">
    <section className="hero-panel">
      <div className="hero-atmosphere" aria-hidden="true" />
      <div className="particle-field" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
      <div className="brief-intro">
        <p className="eyebrow">{weekday} · {recommendedSymbol}</p>
        <h1>{DAY_LABELS[recommendedSymbol]}.</h1>
        <div className="brief-snapshot">
          <span>{recommendedExerciseCount} exercise{recommendedExerciseCount === 1 ? '' : 's'}</span>
          <span>{cycle.completedCoreDays.length}/3 core days</span>
        </div>
      </div>
      <section className="brief-suggestions">
        {suggestions.map((suggestion) => <article key={suggestion.label}><span>{suggestion.label}</span><p>{suggestion.value}</p></article>)}
      </section>
      <div className="brief-action-zone">
        <button className="primary-action brief-begin" onClick={() => { setSelectedDay(recommendedSymbol); setModalOpen(true); }} disabled={Boolean(database.activeSessionId)}>{database.activeSessionId ? 'Session active' : `Begin ${recommendedSymbol}`}</button>
        <div className="day-override">
          <span>Or choose</span>
          {(['ψ', 'φ', 'π', '&'] as DaySymbol[]).map((day) => {
            const optionalUnavailable = day === '&' && (!cycle.andEligible || optionalExerciseCount === 0);
            const title = day === '&'
              ? optionalExerciseCount === 0 ? 'Optional fourth day · no exercises assigned' : 'Optional fourth day'
              : DAY_LABELS[day];
            return <button key={day} title={title} disabled={Boolean(database.activeSessionId) || optionalUnavailable} onClick={() => { setSelectedDay(day); setModalOpen(true); }}>{day}</button>;
          })}
        </div>
      </div>
    </section>
    {modalOpen && <ModeSelectionModal day={selectedDay} summaries={modeSummaries} onClose={() => setModalOpen(false)} onSelect={async (mode) => { await onBeginSession(selectedDay, mode); setModalOpen(false); }} />}
  </main>;
}
