import type { AppDatabase, Exercise, ExerciseTrackingProfile, SessionExercise, SetRecord } from '../domain/model';
import { isSetComplete } from '../domain/tracking';

function adjustedLoad(
  relationship: ExerciseTrackingProfile['loadRelationship'],
  baseline: number,
  step: number,
): number {
  return relationship === 'assistance'
    ? Math.max(0, baseline - step)
    : baseline + step;
}

function latestCompletedExercise(
  database: AppDatabase,
  exerciseId: string,
): SessionExercise | null {
  const sessions = [...database.sessions]
    .filter((session) => session.status === 'completed')
    .sort((left, right) => {
      const leftTime = left.completedAt ?? left.startedAt;
      const rightTime = right.completedAt ?? right.startedAt;
      return rightTime.localeCompare(leftTime);
    });

  for (const session of sessions) {
    const match = session.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    if (match) return match;
  }
  return null;
}

function previousPrescribedSet(
  previousExercise: SessionExercise | null,
  setIndex: number,
): SetRecord | null {
  if (!previousExercise) return null;
  return previousExercise.sets.find((set) =>
    set.setIndex === setIndex
    && !set.warmUp
    && set.kind !== 'additional'
  ) ?? null;
}

function earnedProgression(set: SetRecord, exercise: SessionExercise): boolean {
  const reps = set.reps;
  return reps !== null
    && reps >= 6
    && reps <= 8
    && isSetComplete(set, exercise.trackingSnapshot);
}

export interface SuggestedSetLoadInput {
  database: AppDatabase;
  exercise: Exercise;
  setIndex: number;
  fallbackLoad: number;
  experimentLoad?: number | null;
}

export function suggestedSetLoad({
  database,
  exercise,
  setIndex,
  fallbackLoad,
  experimentLoad = null,
}: SuggestedSetLoadInput): number | null {
  const startsWithLoad = exercise.tracking.metric === 'load_reps'
    && exercise.tracking.loadRelationship !== 'bodyweight';
  if (!startsWithLoad) return null;

  if (experimentLoad !== null) return experimentLoad;

  const previousExercise = latestCompletedExercise(database, exercise.id);
  const previousSet = previousPrescribedSet(previousExercise, setIndex);
  if (!previousSet || previousSet.load === null) return fallbackLoad;

  return previousExercise && earnedProgression(previousSet, previousExercise)
    ? adjustedLoad(exercise.tracking.loadRelationship, previousSet.load, exercise.progressionStep)
    : previousSet.load;
}
