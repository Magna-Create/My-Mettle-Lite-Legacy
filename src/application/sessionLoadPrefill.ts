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

interface PreviousSetEvidence {
  exercise: SessionExercise;
  set: SetRecord;
}

function latestCompletedSet(
  database: AppDatabase,
  exerciseId: string,
  setIndex: number,
): PreviousSetEvidence | null {
  const sessions = [...database.sessions]
    .filter((session) => session.status === 'completed')
    .sort((left, right) => {
      const leftTime = left.completedAt ?? left.startedAt;
      const rightTime = right.completedAt ?? right.startedAt;
      return rightTime.localeCompare(leftTime);
    });

  for (const session of sessions) {
    const exercise = session.exercises.find((candidate) => candidate.exerciseId === exerciseId);
    if (!exercise) continue;

    const set = exercise.sets.find((candidate) =>
      candidate.setIndex === setIndex
      && !candidate.warmUp
      && candidate.kind !== 'additional'
    );

    if (set && isSetComplete(set, exercise.trackingSnapshot)) {
      return { exercise, set };
    }
  }

  return null;
}

function earnedProgression(set: SetRecord): boolean {
  const reps = set.reps;
  return reps !== null && reps >= 6 && reps <= 8;
}

export interface SuggestedSetLoadInput {
  database: AppDatabase;
  exercise: Exercise;
  setIndex: number;
  fallbackLoad: number;
}

export function suggestedSetLoad({
  database,
  exercise,
  setIndex,
  fallbackLoad,
}: SuggestedSetLoadInput): number | null {
  const startsWithLoad = exercise.tracking.metric === 'load_reps'
    && exercise.tracking.loadRelationship !== 'bodyweight';
  if (!startsWithLoad) return null;

  const previous = latestCompletedSet(database, exercise.id, setIndex);
  if (!previous || previous.set.load === null) return fallbackLoad;

  return earnedProgression(previous.set)
    ? adjustedLoad(exercise.tracking.loadRelationship, previous.set.load, exercise.progressionStep)
    : previous.set.load;
}
