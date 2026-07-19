import type { SessionExercise } from '../model';

export interface ExercisePerformance {
  workVolume: number;
  completedSets: number;
  allTargetsMet: boolean;
  repDropWarning: boolean;
}

export function calculateExercisePerformance(exercise: SessionExercise): ExercisePerformance {
  const completedSets = exercise.sets.filter(
    (set) => set.load !== null && set.reps !== null && set.reps > 0,
  );
  const workVolume = completedSets.reduce(
    (sum, set) => sum + (set.load ?? 0) * (set.reps ?? 0),
    0,
  );
  const allTargetsMet =
    completedSets.length >= exercise.prescription.sets &&
    completedSets.slice(0, exercise.prescription.sets).every(
      (set) => (set.reps ?? 0) >= exercise.prescription.repMin,
    );

  let repDropWarning = false;
  for (let index = 1; index < completedSets.length; index += 1) {
    const previous = completedSets[index - 1];
    const current = completedSets[index];
    if (
      previous &&
      current &&
      previous.load === current.load &&
      (previous.reps ?? 0) - (current.reps ?? 0) > 3
    ) {
      repDropWarning = true;
    }
  }

  return {
    workVolume,
    completedSets: completedSets.length,
    allTargetsMet,
    repDropWarning,
  };
}
