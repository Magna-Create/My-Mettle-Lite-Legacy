import type { SessionExercise } from '../model';
import { effectiveLoadKg, isSetComplete, trackingValue } from '../tracking';

export interface ExercisePerformance {
  workVolume: number;
  completedSets: number;
  allTargetsMet: boolean;
  repDropWarning: boolean;
  primaryTotal: number;
  primaryUnit: 'kg volume' | 'reps' | 'sec' | 'm';
}

export function calculateExercisePerformance(exercise: SessionExercise): ExercisePerformance {
  const completedSets = exercise.sets.filter((set) =>
    isSetComplete(set, exercise.trackingSnapshot),
  );
  const metric = exercise.trackingSnapshot.metric;

  const workVolume = completedSets.reduce((sum, set) => {
    const reps = set.reps ?? 0;
    const effectiveLoad = effectiveLoadKg(
      set,
      exercise.trackingSnapshot,
      exercise.bodyweightSnapshotKg,
    );
    return sum + (effectiveLoad ?? 0) * reps;
  }, 0);

  const primaryTotal = metric === 'load_reps'
    ? workVolume
    : completedSets.reduce(
        (sum, set) => sum + (trackingValue(set, metric) ?? 0),
        0,
      );

  const allTargetsMet =
    completedSets.length >= exercise.prescription.sets
    && completedSets.slice(0, exercise.prescription.sets).every(
      (set) => (trackingValue(set, metric) ?? 0) >= exercise.prescription.repMin,
    );

  let repDropWarning = false;
  if (metric === 'load_reps' || metric === 'reps') {
    for (let index = 1; index < completedSets.length; index += 1) {
      const previous = completedSets[index - 1];
      const current = completedSets[index];
      const comparableLoad = metric === 'reps' || previous?.load === current?.load;
      if (
        previous
        && current
        && comparableLoad
        && (previous.reps ?? 0) - (current.reps ?? 0) > 3
      ) {
        repDropWarning = true;
      }
    }
  }

  const primaryUnit = metric === 'load_reps'
    ? 'kg volume'
    : metric === 'duration'
      ? 'sec'
      : metric === 'distance'
        ? 'm'
        : 'reps';

  return {
    workVolume,
    completedSets: completedSets.length,
    allTargetsMet,
    repDropWarning,
    primaryTotal,
    primaryUnit,
  };
}
