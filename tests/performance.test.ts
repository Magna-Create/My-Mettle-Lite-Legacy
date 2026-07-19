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
});
