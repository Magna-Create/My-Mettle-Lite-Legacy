import type { AppDatabase, Mode, Session, SessionExercise, TrackingMetric } from '../domain/model';
import { effectiveLoadKg, isSetComplete } from '../domain/tracking';

export const MAIS_EXPOSURE_ALGORITHM_ID = 'mais.comparable-exposure';
export const MAIS_EXPOSURE_ALGORITHM_VERSION = 1;

export interface MaisMetricProvenance {
  algorithmId: typeof MAIS_EXPOSURE_ALGORITHM_ID;
  algorithmVersion: typeof MAIS_EXPOSURE_ALGORITHM_VERSION;
  inputRefs: string[];
  assumptions: string[];
}

export interface MaisComparableExposure {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  routineVersionId: string;
  day: Session['day'];
  mode: Mode;
  occurredAt: string;
  trackingSignature: string;
  metric: TrackingMetric;
  prescribedSetTarget: number;
  completedWorkSets: number;
  completionRatio: number | null;
  totalRepetitions: number | null;
  bestSetRepetitions: number | null;
  meanEffectiveLoadKg: number | null;
  bestEffectiveLoadKg: number | null;
  totalEffectiveVolumeKgReps: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  totalDurationSeconds: number | null;
  bestDurationSeconds: number | null;
  totalDistanceMetres: number | null;
  bestDistanceMetres: number | null;
  reflection: SessionExercise['reflection'] | null;
  provenance: MaisMetricProvenance;
}

export interface MaisExposureSeriesOptions {
  mode?: Mode | undefined;
  limit?: number | undefined;
  includeIncompleteExercises?: boolean | undefined;
}

export interface MaisExposureDelta {
  beforeExposureId: string;
  afterExposureId: string;
  comparable: boolean;
  reasons: string[];
  changes: {
    completionRatio: number | null;
    totalRepetitions: number | null;
    bestEffectiveLoadKg: number | null;
    totalEffectiveVolumeKgReps: number | null;
    bestEstimatedOneRepMaxKg: number | null;
    totalDurationSeconds: number | null;
    totalDistanceMetres: number | null;
  };
}

function trackingSignature(exercise: SessionExercise): string {
  const tracking = exercise.trackingSnapshot;
  return [exercise.exerciseId, tracking.metric, tracking.loadRelationship, tracking.entryBasis].join('|');
}

function sum(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function maximum(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function mean(values: number[]): number | null {
  const total = sum(values);
  return total === null ? null : total / values.length;
}

function delta(before: number | null, after: number | null): number | null {
  return before === null || after === null ? null : after - before;
}

function epleyEstimate(loadKg: number, repetitions: number): number {
  return loadKg * (1 + repetitions / 30);
}

export function deriveComparableExposure(session: Session, exercise: SessionExercise): MaisComparableExposure {
  const workSets = exercise.sets.filter((set) => !set.warmUp && isSetComplete(set, exercise.trackingSnapshot));
  const repetitions = workSets.flatMap((set) => set.reps === null ? [] : [set.reps]);
  const effectiveLoads = workSets.flatMap((set) => {
    const value = effectiveLoadKg(set, exercise.trackingSnapshot, exercise.bodyweightSnapshotKg ?? session.bodyweightSnapshotKg);
    return value === null ? [] : [value];
  });
  const volume = workSets.flatMap((set) => {
    if (set.reps === null) return [];
    const load = effectiveLoadKg(set, exercise.trackingSnapshot, exercise.bodyweightSnapshotKg ?? session.bodyweightSnapshotKg);
    return load === null ? [] : [load * set.reps];
  });
  const estimatedOneRepMaxes = workSets.flatMap((set) => {
    if (set.reps === null || set.reps <= 0) return [];
    const load = effectiveLoadKg(set, exercise.trackingSnapshot, exercise.bodyweightSnapshotKg ?? session.bodyweightSnapshotKg);
    return load === null ? [] : [epleyEstimate(load, set.reps)];
  });
  const durations = workSets.flatMap((set) => set.durationSeconds === null ? [] : [set.durationSeconds]);
  const distances = workSets.flatMap((set) => set.distanceMetres === null ? [] : [set.distanceMetres]);
  const target = Math.max(0, exercise.prescription.sets);
  const completionRatio = target > 0 ? Math.min(1, workSets.length / target) : null;
  const assumptions = [
    'Warm-up sets are excluded.',
    'Only complete sets under the exercise tracking definition are included.',
    'Per-hand and per-side loads are converted to total load before comparison.',
  ];
  if (estimatedOneRepMaxes.length) assumptions.push('Estimated one-repetition maximum uses the Epley equation as a comparison proxy, not a tested maximum.');

  return {
    id: `exposure:${session.id}:${exercise.id}`,
    sessionId: session.id,
    sessionExerciseId: exercise.id,
    exerciseId: exercise.exerciseId,
    routineVersionId: session.routineVersionId,
    day: session.day,
    mode: session.mode,
    occurredAt: exercise.completedAt ?? session.completedAt ?? session.startedAt,
    trackingSignature: trackingSignature(exercise),
    metric: exercise.trackingSnapshot.metric,
    prescribedSetTarget: target,
    completedWorkSets: workSets.length,
    completionRatio,
    totalRepetitions: sum(repetitions),
    bestSetRepetitions: maximum(repetitions),
    meanEffectiveLoadKg: mean(effectiveLoads),
    bestEffectiveLoadKg: maximum(effectiveLoads),
    totalEffectiveVolumeKgReps: sum(volume),
    bestEstimatedOneRepMaxKg: maximum(estimatedOneRepMaxes),
    totalDurationSeconds: sum(durations),
    bestDurationSeconds: maximum(durations),
    totalDistanceMetres: sum(distances),
    bestDistanceMetres: maximum(distances),
    reflection: exercise.reflection ?? null,
    provenance: {
      algorithmId: MAIS_EXPOSURE_ALGORITHM_ID,
      algorithmVersion: MAIS_EXPOSURE_ALGORITHM_VERSION,
      inputRefs: [session.id, exercise.id, ...workSets.map((set) => set.id)],
      assumptions,
    },
  };
}

export function buildComparableExposureSeries(
  database: AppDatabase,
  exerciseId: string,
  options: MaisExposureSeriesOptions = {},
): MaisComparableExposure[] {
  const limit = Math.max(1, options.limit ?? 12);
  return database.sessions
    .filter((session) => session.status === 'completed'
      && !session.discardedAt
      && !session.excludedFromInsights
      && (!options.mode || session.mode === options.mode))
    .flatMap((session) => session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId
        && (options.includeIncompleteExercises || exercise.status === 'completed'))
      .map((exercise) => deriveComparableExposure(session, exercise)))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .slice(-limit);
}

export function compareExposures(before: MaisComparableExposure, after: MaisComparableExposure): MaisExposureDelta {
  const reasons: string[] = [];
  if (before.exerciseId !== after.exerciseId) reasons.push('different_exercise');
  if (before.trackingSignature !== after.trackingSignature) reasons.push('different_tracking_definition');
  if (before.mode !== after.mode) reasons.push('different_mode');

  return {
    beforeExposureId: before.id,
    afterExposureId: after.id,
    comparable: reasons.length === 0,
    reasons,
    changes: {
      completionRatio: delta(before.completionRatio, after.completionRatio),
      totalRepetitions: delta(before.totalRepetitions, after.totalRepetitions),
      bestEffectiveLoadKg: delta(before.bestEffectiveLoadKg, after.bestEffectiveLoadKg),
      totalEffectiveVolumeKgReps: delta(before.totalEffectiveVolumeKgReps, after.totalEffectiveVolumeKgReps),
      bestEstimatedOneRepMaxKg: delta(before.bestEstimatedOneRepMaxKg, after.bestEstimatedOneRepMaxKg),
      totalDurationSeconds: delta(before.totalDurationSeconds, after.totalDurationSeconds),
      totalDistanceMetres: delta(before.totalDistanceMetres, after.totalDistanceMetres),
    },
  };
}
