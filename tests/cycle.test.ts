import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import type { TrainingCycle } from '../src/domain/model';
import { getCycleSnapshot, isAndEligible } from '../src/domain/rules/cycle';

function cycle(completedCoreDays: TrainingCycle['completedCoreDays']): TrainingCycle {
  return {
    id: 'cycle_1',
    startedAt: '2026-07-19T10:00:00.000Z',
    status: 'active',
    completedCoreDays,
    andCompleted: false,
    schemaVersion: 1,
  };
}

describe('& gate and recommendation', () => {
  it('recommends ψ first and keeps & locked', () => {
    const snapshot = getCycleSnapshot(cycle([]));
    expect(snapshot.nextRecommendedDay).toBe('ψ');
    expect(snapshot.andEligible).toBe(false);
  });

  it('unlocks & only after all three core days are completed', () => {
    const completed = cycle(['ψ', 'φ', 'π']);
    expect(isAndEligible(completed)).toBe(true);
    expect(getCycleSnapshot(completed).nextRecommendedDay).toBe('&');
  });

  it('seed data has four routine days and an active cycle', () => {
    const database = createSeedDatabase();
    const routine = database.routineVersions[0];
    expect(routine?.days.map((day) => day.symbol)).toEqual(['ψ', 'φ', 'π', '&']);
    expect(database.cycles).toHaveLength(1);
  });
});
