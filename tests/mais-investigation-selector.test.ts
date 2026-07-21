import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { selectMaisInvestigationCandidates } from '../src/mais/investigationSelector';
import { createMaisSyntheticHistory } from '../src/mais/syntheticHistory';

function targetExerciseId(database: ReturnType<typeof createSeedDatabase>): string {
  return database.sessions.flatMap((session) => session.exercises)[0]?.exerciseId ?? database.exercises[0]!.id;
}

function exposuresFor(database: ReturnType<typeof createSeedDatabase>, exerciseId: string) {
  return database.sessions.flatMap((session) => session.exercises
    .filter((exercise) => exercise.exerciseId === exerciseId)
    .map((exercise) => ({ session, exercise })));
}

describe('MAIS investigation selector', () => {
  it('identifies a sustained flat performance window as a plateau question', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 90, { seed: 4 }).database;
    const exerciseId = targetExerciseId(database);
    for (const { exercise } of exposuresFor(database, exerciseId)) {
      for (const set of exercise.sets) {
        set.load = 40;
        set.reps = 8;
      }
    }
    const candidates = selectMaisInvestigationCandidates(database, { maximumCandidates: 30 });
    const plateau = candidates.find((candidate) => candidate.exerciseId === exerciseId && candidate.kind === 'plateau');
    expect(plateau).toBeDefined();
    expect(plateau?.requiredTier).toBe('deep');
    expect(plateau?.competingHypotheses.length).toBeGreaterThan(2);
    expect(plateau?.suggestedAnalysis.operations).toEqual(expect.arrayContaining([expect.objectContaining({ op: 'linear_regression' })]));
  });

  it('identifies a material negative trend as a regression question', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 90, { seed: 8 }).database;
    const exerciseId = targetExerciseId(database);
    exposuresFor(database, exerciseId).forEach(({ exercise }, index) => {
      for (const set of exercise.sets) {
        set.load = Math.max(10, 70 - index * 1.8);
        set.reps = 8;
      }
    });
    const candidates = selectMaisInvestigationCandidates(database, { maximumCandidates: 30 });
    const regression = candidates.find((candidate) => candidate.exerciseId === exerciseId && candidate.kind === 'regression');
    expect(regression).toBeDefined();
    expect(regression?.priority).toBeGreaterThan(0.7);
    expect(regression?.reasonCodes).toContain('negative_longitudinal_slope');
  });

  it('identifies repeated discomfort without turning it into a diagnosis', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 60, { seed: 12 }).database;
    const exerciseId = targetExerciseId(database);
    const exposures = exposuresFor(database, exerciseId);
    for (const { exercise } of exposures.slice(-3)) {
      exercise.reflection = {
        targetMuscleEngagement: 3,
        execution: 'mixed',
        enjoyment: 2,
        comfort: 'uncomfortable',
        note: 'Setup felt wrong.',
        recordedAt: exercise.completedAt!,
        updatedAt: exercise.completedAt!,
      };
    }
    const candidate = selectMaisInvestigationCandidates(database, { maximumCandidates: 30 })
      .find((item) => item.exerciseId === exerciseId && item.kind === 'comfort_risk');
    expect(candidate?.question).toMatch(/setup or selection/i);
    expect(candidate?.competingHypotheses.join(' ')).not.toMatch(/diagnos/i);
  });

  it('identifies a between-mode difference only when each mode has repeated evidence', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 180, { seed: 19 }).database;
    const exerciseId = targetExerciseId(database);
    for (const { session, exercise } of exposuresFor(database, exerciseId)) {
      for (const set of exercise.sets) {
        set.load = session.mode === 'A' ? 30 : session.mode === 'B' ? 45 : 60;
        set.reps = 8;
      }
    }
    const candidate = selectMaisInvestigationCandidates(database, { maximumCandidates: 50 })
      .find((item) => item.exerciseId === exerciseId && item.kind === 'mode_effect');
    expect(candidate).toBeDefined();
    expect(candidate?.requiredTier).toBe('standard');
    expect(candidate?.confounds.join(' ')).toMatch(/mode changed/i);
  });

  it('does not manufacture investigations from an undersized history', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 3, { seed: 1 }).database;
    expect(selectMaisInvestigationCandidates(database, { minimumExposures: 6 })).toEqual([]);
  });

  it('is stable for the same immutable history', () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 100, { seed: 123 }).database;
    const first = selectMaisInvestigationCandidates(database);
    const second = selectMaisInvestigationCandidates(database);
    expect(first).toEqual(second);
  });
});
