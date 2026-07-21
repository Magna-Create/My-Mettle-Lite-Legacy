import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import type { ExerciseTrackingProfile, Session, SessionExercise, SetRecord } from '../src/domain/model';
import { buildComparableExposureSeries, compareExposures, deriveComparableExposure } from '../src/mais/comparableExposureEngine';

function set(input: Partial<SetRecord> & Pick<SetRecord, 'id'>): SetRecord {
  return {
    id: input.id,
    setIndex: input.setIndex ?? 0,
    load: input.load ?? null,
    reps: input.reps ?? null,
    durationSeconds: input.durationSeconds ?? null,
    distanceMetres: input.distanceMetres ?? null,
    unit: input.unit ?? 'kg',
    completedAt: input.completedAt ?? '2026-07-21T10:10:00.000Z',
    warmUp: input.warmUp ?? false,
    kind: input.kind ?? 'prescribed',
  };
}

function exercise(tracking: ExerciseTrackingProfile, sets: SetRecord[]): SessionExercise {
  return {
    id: 'session_exercise_1',
    exerciseId: 'exercise_1',
    slotId: 'slot_1',
    exerciseNameSnapshot: 'Test exercise',
    importanceSnapshot: 'principal',
    trackingSnapshot: tracking,
    bodyweightSnapshotKg: 70,
    plannedLoad: 20,
    prescription: { mode: 'A', included: true, sets: 2, repMin: 6, repMax: 10, restSeconds: 120, deferToAnd: false },
    status: 'completed',
    sets,
    completedAt: '2026-07-21T10:20:00.000Z',
    movementReason: 'base_routine',
  };
}

function session(sessionExercise: SessionExercise, id = 'session_1', mode: Session['mode'] = 'A'): Session {
  return {
    id,
    cycleId: 'cycle_1',
    day: 'ψ',
    mode,
    routineVersionId: 'routine_1',
    status: 'completed',
    startedAt: '2026-07-21T10:00:00.000Z',
    completedAt: '2026-07-21T10:30:00.000Z',
    bodyweightSnapshotKg: 70,
    exercises: [sessionExercise],
    schemaVersion: 4,
  };
}

describe('MAIS comparable exposure engine', () => {
  it('normalises per-hand external load and records metric provenance', () => {
    const exposure = deriveComparableExposure(session(exercise(
      { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'per_hand' },
      [set({ id: 'set_1', load: 20, reps: 10 }), set({ id: 'set_2', load: 20, reps: 8, setIndex: 1 })],
    )), exercise(
      { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'per_hand' },
      [set({ id: 'set_1', load: 20, reps: 10 }), set({ id: 'set_2', load: 20, reps: 8, setIndex: 1 })],
    ));

    expect(exposure.bestEffectiveLoadKg).toBe(40);
    expect(exposure.totalEffectiveVolumeKgReps).toBe(720);
    expect(exposure.bestEstimatedOneRepMaxKg).toBeCloseTo(53.333, 2);
    expect(exposure.provenance.inputRefs).toContain('set_1');
  });

  it('converts assistance to effective moved bodyweight', () => {
    const sessionExercise = exercise(
      { metric: 'load_reps', loadRelationship: 'assistance', entryBasis: 'total' },
      [set({ id: 'set_1', load: 20, reps: 8 })],
    );
    const exposure = deriveComparableExposure(session(sessionExercise), sessionExercise);
    expect(exposure.bestEffectiveLoadKg).toBe(50);
    expect(exposure.totalEffectiveVolumeKgReps).toBe(400);
  });

  it('supports duration and distance without inventing load metrics', () => {
    const durationExercise = exercise(
      { metric: 'duration', loadRelationship: 'none', entryBasis: 'total' },
      [set({ id: 'duration_1', durationSeconds: 30 }), set({ id: 'duration_2', durationSeconds: 45, setIndex: 1 })],
    );
    const duration = deriveComparableExposure(session(durationExercise), durationExercise);
    expect(duration.totalDurationSeconds).toBe(75);
    expect(duration.bestEffectiveLoadKg).toBeNull();

    const distanceExercise = exercise(
      { metric: 'distance', loadRelationship: 'none', entryBasis: 'total' },
      [set({ id: 'distance_1', distanceMetres: 500 }), set({ id: 'distance_2', distanceMetres: 700, setIndex: 1 })],
    );
    const distance = deriveComparableExposure(session(distanceExercise), distanceExercise);
    expect(distance.totalDistanceMetres).toBe(1200);
  });

  it('filters excluded evidence and identifies non-comparable modes', () => {
    const database = createSeedDatabase();
    const firstExercise = exercise(
      { metric: 'reps', loadRelationship: 'bodyweight', entryBasis: 'total' },
      [set({ id: 'a', reps: 8 })],
    );
    const secondExercise = { ...firstExercise, id: 'session_exercise_2', sets: [set({ id: 'b', reps: 10 })] };
    const excluded = { ...session(firstExercise, 'session_excluded'), excludedFromInsights: true };
    const modeB = session(secondExercise, 'session_b', 'B');
    const updated = { ...database, sessions: [excluded, modeB] };
    const series = buildComparableExposureSeries(updated, 'exercise_1');
    expect(series.map((item) => item.sessionId)).toEqual(['session_b']);

    const modeAExposure = deriveComparableExposure(session(firstExercise, 'session_a', 'A'), firstExercise);
    const modeBExposure = deriveComparableExposure(modeB, secondExercise);
    expect(compareExposures(modeAExposure, modeBExposure)).toMatchObject({ comparable: false, reasons: ['different_mode'] });
  });
});
