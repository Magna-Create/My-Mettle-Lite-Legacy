import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { buildComparableExposureSeries } from '../src/mais/comparableExposureEngine';
import { createMaisSyntheticHistory } from '../src/mais/syntheticHistory';

describe('MAIS synthetic training history', () => {
  it.each([10, 50, 200, 1_000])('creates %i deterministic completed sessions', (count) => {
    const source = createSeedDatabase();
    const beforeSessions = source.sessions.length;
    const first = createMaisSyntheticHistory(source, count, { seed: 2026 });
    const second = createMaisSyntheticHistory(source, count, { seed: 2026 });

    expect(source.sessions).toHaveLength(beforeSessions);
    expect(first.database.sessions).toHaveLength(count);
    expect(first.database.sessions.every((session) => session.status === 'completed')).toBe(true);
    expect(first.generatedSessionIds).toEqual(second.generatedSessionIds);
    expect(first.database.sessions.at(-1)).toEqual(second.database.sessions.at(-1));
    expect(first.database.activeSessionId).toBeNull();
  });

  it('produces complete valid sets for duration and distance tracking', () => {
    const source = createSeedDatabase();
    const firstExercise = source.exercises[0]!;
    firstExercise.tracking = { metric: 'duration', loadRelationship: 'none', entryBasis: 'total' };
    const duration = createMaisSyntheticHistory(source, 20, { seed: 9 });
    const durationSets = duration.database.sessions.flatMap((session) => session.exercises)
      .filter((exercise) => exercise.exerciseId === firstExercise.id)
      .flatMap((exercise) => exercise.sets);
    expect(durationSets.length).toBeGreaterThan(0);
    expect(durationSets.every((set) => set.durationSeconds !== null && set.reps === null && set.load === null)).toBe(true);

    firstExercise.tracking = { metric: 'distance', loadRelationship: 'none', entryBasis: 'total' };
    const distance = createMaisSyntheticHistory(source, 20, { seed: 9 });
    const distanceSets = distance.database.sessions.flatMap((session) => session.exercises)
      .filter((exercise) => exercise.exerciseId === firstExercise.id)
      .flatMap((exercise) => exercise.sets);
    expect(distanceSets.length).toBeGreaterThan(0);
    expect(distanceSets.every((set) => set.distanceMetres !== null && set.durationSeconds === null)).toBe(true);
  });

  it('marks configured exclusions and amendments without corrupting raw sessions', () => {
    const result = createMaisSyntheticHistory(createSeedDatabase(), 24, {
      seed: 77,
      excludedEvery: 5,
      amendedEvery: 7,
    });
    expect(result.database.sessions.filter((session) => session.excludedFromInsights)).toHaveLength(4);
    expect(result.database.sessions.filter((session) => session.editedAt)).toHaveLength(3);
    expect(result.database.sessions.every((session) => session.exercises.every((exercise) => exercise.sets.length === exercise.prescription.sets))).toBe(true);
  });

  it('feeds a bounded comparable-exposure window at 1,000-session scale', () => {
    const result = createMaisSyntheticHistory(createSeedDatabase(), 1_000, { seed: 1234, excludedEvery: 17 });
    const exerciseId = result.database.sessions.flatMap((session) => session.exercises)[0]!.exerciseId;
    const exposures = buildComparableExposureSeries(result.database, exerciseId, { limit: 12 });
    expect(exposures).toHaveLength(12);
    expect(exposures.every((exposure) => exposure.provenance.algorithmVersion === 1)).toBe(true);
    expect(exposures.every((exposure) => !result.database.sessions.find((session) => session.id === exposure.sessionId)?.excludedFromInsights)).toBe(true);
  });

  it('supports an empty fixture without altering routine foundations', () => {
    const source = createSeedDatabase();
    const result = createMaisSyntheticHistory(source, 0);
    expect(result.database.sessions).toEqual([]);
    expect(result.database.routineVersions).toEqual(source.routineVersions);
    expect(result.generatedCycleIds).toEqual([]);
  });
});
