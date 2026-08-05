import type { Session, SessionExercise, SetRecord } from '../model';
import { calculateExercisePerformance } from './performance';
import { isSetComplete, trackingValue } from '../tracking';

export type SessionCelebrationTier = 'partial' | 'complete' | 'strong' | 'exceptional';

export interface SessionCelebrationSummary {
  tier: SessionCelebrationTier;
  completionRatio: number;
  completedPrescribedSets: number;
  prescribedSets: number;
  achievedExercises: number;
  exceededExercises: number;
  coveredExercises: number;
  totalExercises: number;
  heading: string;
  message: string;
}

function completePrescribedSets(exercise: SessionExercise): SetRecord[] {
  return exercise.sets
    .slice(0, exercise.prescription.sets)
    .filter((set) => isSetComplete(set, exercise.trackingSnapshot));
}

function exerciseExceeded(exercise: SessionExercise): boolean {
  const completed = exercise.sets.filter((set) => isSetComplete(set, exercise.trackingSnapshot));
  if (completed.some((set) => set.kind === 'additional')) return true;

  const metric = exercise.trackingSnapshot.metric;
  return completed.slice(0, exercise.prescription.sets).some((set) => {
    if (metric === 'load_reps') {
      return (set.load ?? 0) > exercise.plannedLoad || (set.reps ?? 0) > exercise.prescription.repMax;
    }
    return (trackingValue(set, metric) ?? 0) > exercise.prescription.repMax;
  });
}

export function calculateSessionCelebration(session: Session): SessionCelebrationSummary {
  const prescribedSets = session.exercises.reduce((sum, exercise) => sum + exercise.prescription.sets, 0);
  const completedPrescribedSets = session.exercises.reduce(
    (sum, exercise) => sum + completePrescribedSets(exercise).length,
    0,
  );
  const completionRatio = prescribedSets === 0 ? 1 : completedPrescribedSets / prescribedSets;
  const coveredExercises = session.exercises.filter((exercise) => completePrescribedSets(exercise).length > 0).length;
  const achievedExercises = session.exercises.filter(
    (exercise) => calculateExercisePerformance(exercise).allTargetsMet,
  ).length;
  const exceededExercises = session.exercises.filter(exerciseExceeded).length;
  const totalExercises = session.exercises.length;
  const fullCoverage = totalExercises === 0 || coveredExercises === totalExercises;
  const targetRatio = totalExercises === 0 ? 1 : achievedExercises / totalExercises;

  let tier: SessionCelebrationTier = 'partial';
  if (completionRatio >= 0.95 && fullCoverage) tier = 'complete';
  if (completionRatio >= 0.95 && fullCoverage && targetRatio >= 0.5 && exceededExercises >= 1) tier = 'strong';
  if (completionRatio >= 0.95 && fullCoverage && targetRatio >= 0.75 && exceededExercises >= 2) tier = 'exceptional';

  const copy: Record<SessionCelebrationTier, Pick<SessionCelebrationSummary, 'heading' | 'message'>> = {
    partial: {
      heading: 'Session logged.',
      message: 'You moved the session forward. The celebration stays quiet because part of the selected plan was left unfinished.',
    },
    complete: {
      heading: 'Session complete.',
      message: 'You completed the plan you chose today. Mode does not reduce the achievement; success is measured against this session.',
    },
    strong: {
      heading: 'Strong session.',
      message: 'The selected plan was completed and you pushed beyond at least one target.',
    },
    exceptional: {
      heading: 'You smashed it.',
      message: 'The full session landed, with several targets exceeded. This one earns the full effect.',
    },
  };

  return {
    tier,
    completionRatio,
    completedPrescribedSets,
    prescribedSets,
    achievedExercises,
    exceededExercises,
    coveredExercises,
    totalExercises,
    ...copy[tier],
  };
}
