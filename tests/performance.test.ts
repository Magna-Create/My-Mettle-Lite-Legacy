import { describe, expect, it } from 'vitest';
import type { SessionExercise } from '../src/domain/model';
import { calculateExercisePerformance } from '../src/domain/rules/performance';

function exercise(reps: number[]): SessionExercise {
  return {
    id: 'session_exercise_1',
    exerciseId: 'exercise_1',
    slotId: 'slot_1',
    exerciseNameSnapshot: 'Test press',
    importanceSnapshot: 'principal',
    trackingSnapshot: {
      metric: 'load_reps',
      loadRelationship: 'external',
      entryBasis: 'total',
    },
    bodyweightSnapshotKg: null,
    plannedLoad: 20,
    prescription: {
      mode: 'A', included: true, sets: 3, repMin: 6, repMax: 7, restSeconds: 150, deferToAnd: false,
    },
    status: 'completed',
    movementReason: 'base_routine',
    sets: reps.map((value, index) => ({
      id: `set_${index}`,
      setIndex: index,
      load: 20,
      reps: value,
      durationSeconds: null,
      distanceMetres: null,
      unit: 'kg',
      warmUp: false,
    })),
  };
}

describe('exercise performance', () => {
  it('calculates deterministic work volume', () => {
    expect(calculateExercisePerformance(exercise([6, 6, 6])).workVolume).toBe(360);
  });

  it('recognises a clean target achievement', () => {
    expect(calculateExercisePerformance(exercise([6, 7, 6])).allTargetsMet).toBe(true);
  });

  it('retains the v8 rep-drop protection trigger', () => {
    expect(calculateExercisePerformance(exercise([8, 4, 4])).repDropWarning).toBe(true);
  });

  it('calculates assisted bodyweight from the historical bodyweight snapshot', () => {
    const assisted = exercise([6]);
    assisted.trackingSnapshot = {
      metric: 'load_reps',
      loadRelationship: 'assistance',
      entryBasis: 'total',
    };
    assisted.bodyweightSnapshotKg = 80;
    assisted.sets = [{
      id: 'assisted_set',
      setIndex: 0,
      load: 30,
      reps: 6,
      durationSeconds: null,
      distanceMetres: null,
      unit: 'kg',
      warmUp: false,
    }];
    assisted.prescription = { ...assisted.prescription, sets: 1 };

    expect(calculateExercisePerformance(assisted).workVolume).toBe(300);
  });

  it('tracks duration without inventing load volume', () => {
    const duration = exercise([]);
    duration.trackingSnapshot = {
      metric: 'duration',
      loadRelationship: 'none',
      entryBasis: 'total',
    };
    duration.sets = [{
      id: 'duration_set',
      setIndex: 0,
      load: null,
      reps: null,
      durationSeconds: 60,
      distanceMetres: null,
      unit: 'kg',
      warmUp: false,
    }];
    duration.prescription = { ...duration.prescription, sets: 1, repMin: 45, repMax: 60 };

    const performance = calculateExercisePerformance(duration);
    expect(performance.primaryTotal).toBe(60);
    expect(performance.primaryUnit).toBe('sec');
    expect(performance.allTargetsMet).toBe(true);
  });
});
