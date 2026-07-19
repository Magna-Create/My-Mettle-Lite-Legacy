import type { CoreDay, DaySymbol, TrainingCycle } from '../model';

const CORE_DAYS: CoreDay[] = ['ψ', 'φ', 'π'];

export interface CycleSnapshot {
  completedCoreDays: CoreDay[];
  andEligible: boolean;
  nextRecommendedDay: DaySymbol;
  explanation: string;
}

export function getCycleSnapshot(cycle: TrainingCycle): CycleSnapshot {
  const missing = CORE_DAYS.find((day) => !cycle.completedCoreDays.includes(day));

  if (missing) {
    return {
      completedCoreDays: cycle.completedCoreDays,
      andEligible: false,
      nextRecommendedDay: missing,
      explanation: `${missing} is the cleanest next step because it is the first unfinished core day in this calibration cycle.`,
    };
  }

  return {
    completedCoreDays: cycle.completedCoreDays,
    andEligible: true,
    nextRecommendedDay: '&',
    explanation: 'All three core days are complete, so & is now available. You can also begin a new core cycle instead.',
  };
}

export function isAndEligible(cycle: TrainingCycle): boolean {
  return cycle.completedCoreDays.length === 3;
}
