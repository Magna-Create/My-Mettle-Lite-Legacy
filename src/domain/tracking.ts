import type {
  EntryBasis,
  ExerciseTrackingProfile,
  LoadRelationship,
  LoadUnit,
  SetRecord,
  TrackingMetric,
} from './model';

export type TrackingPreset =
  | 'external_load'
  | 'assisted_bodyweight'
  | 'bodyweight'
  | 'weighted_bodyweight'
  | 'reps_only'
  | 'duration'
  | 'distance';

export interface TrackingPresentation {
  valueLabel: string;
  valueSuffix: string;
  targetLabel: string;
  targetSuffix: string;
  progressionLabel: string;
  progressionSuffix: string;
  requiresStartingValue: boolean;
  supportsEntryBasis: boolean;
}

export const DEFAULT_TRACKING: ExerciseTrackingProfile = {
  metric: 'load_reps',
  loadRelationship: 'external',
  entryBasis: 'total',
};

export const TRACKING_PRESET_LABELS: Record<TrackingPreset, string> = {
  external_load: 'External load + reps',
  assisted_bodyweight: 'Assistance + reps',
  bodyweight: 'Bodyweight + reps',
  weighted_bodyweight: 'Added load + reps',
  reps_only: 'Repetitions only',
  duration: 'Duration',
  distance: 'Distance',
};

export function trackingFromPreset(
  preset: TrackingPreset,
  entryBasis: EntryBasis = 'total',
): ExerciseTrackingProfile {
  switch (preset) {
    case 'assisted_bodyweight':
      return { metric: 'load_reps', loadRelationship: 'assistance', entryBasis: 'total' };
    case 'bodyweight':
      return { metric: 'reps', loadRelationship: 'bodyweight', entryBasis: 'total' };
    case 'weighted_bodyweight':
      return { metric: 'load_reps', loadRelationship: 'bodyweight_plus_external', entryBasis };
    case 'reps_only':
      return { metric: 'reps', loadRelationship: 'none', entryBasis: 'total' };
    case 'duration':
      return { metric: 'duration', loadRelationship: 'none', entryBasis: 'total' };
    case 'distance':
      return { metric: 'distance', loadRelationship: 'none', entryBasis: 'total' };
    default:
      return { metric: 'load_reps', loadRelationship: 'external', entryBasis };
  }
}

export function presetFromTracking(tracking: ExerciseTrackingProfile): TrackingPreset {
  if (tracking.metric === 'duration') return 'duration';
  if (tracking.metric === 'distance') return 'distance';
  if (tracking.metric === 'reps' && tracking.loadRelationship === 'bodyweight') return 'bodyweight';
  if (tracking.metric === 'reps') return 'reps_only';
  if (tracking.loadRelationship === 'assistance') return 'assisted_bodyweight';
  if (tracking.loadRelationship === 'bodyweight_plus_external') return 'weighted_bodyweight';
  return 'external_load';
}

export function getTrackingPresentation(
  tracking: ExerciseTrackingProfile,
  unit: LoadUnit,
): TrackingPresentation {
  if (tracking.metric === 'duration') {
    return {
      valueLabel: 'Duration',
      valueSuffix: 'sec',
      targetLabel: 'Target duration',
      targetSuffix: 'sec',
      progressionLabel: 'Progression step',
      progressionSuffix: 'sec',
      requiresStartingValue: false,
      supportsEntryBasis: false,
    };
  }

  if (tracking.metric === 'distance') {
    return {
      valueLabel: 'Distance',
      valueSuffix: 'm',
      targetLabel: 'Target distance',
      targetSuffix: 'm',
      progressionLabel: 'Progression step',
      progressionSuffix: 'm',
      requiresStartingValue: false,
      supportsEntryBasis: false,
    };
  }

  if (tracking.metric === 'reps') {
    return {
      valueLabel: 'Repetitions',
      valueSuffix: 'reps',
      targetLabel: 'Target reps',
      targetSuffix: 'reps',
      progressionLabel: 'Progression step',
      progressionSuffix: 'reps',
      requiresStartingValue: false,
      supportsEntryBasis: false,
    };
  }

  const valueLabel = tracking.loadRelationship === 'assistance'
    ? 'Assistance'
    : tracking.loadRelationship === 'bodyweight_plus_external'
      ? 'Added load'
      : 'Load';

  return {
    valueLabel,
    valueSuffix: unit,
    targetLabel: 'Target reps',
    targetSuffix: 'reps',
    progressionLabel: tracking.loadRelationship === 'assistance' ? 'Assistance step' : 'Load step',
    progressionSuffix: unit,
    requiresStartingValue: true,
    supportsEntryBasis:
      tracking.loadRelationship === 'external'
      || tracking.loadRelationship === 'bodyweight_plus_external',
  };
}

export function trackingValue(set: SetRecord, metric: TrackingMetric): number | null {
  switch (metric) {
    case 'duration':
      return set.durationSeconds;
    case 'distance':
      return set.distanceMetres;
    default:
      return set.reps;
  }
}

export function isSetComplete(set: SetRecord, tracking: ExerciseTrackingProfile): boolean {
  const value = trackingValue(set, tracking.metric);
  if (value === null || value <= 0) return false;
  if (tracking.metric !== 'load_reps') return true;
  if (tracking.loadRelationship === 'bodyweight') return true;
  return set.load !== null && set.load >= 0;
}

export function entryMultiplier(entryBasis: EntryBasis): number {
  return entryBasis === 'total' ? 1 : 2;
}

export function loadToKg(value: number, unit: LoadUnit): number {
  return unit === 'lb' ? value * 0.45359237 : value;
}

export function effectiveLoadKg(
  set: SetRecord,
  tracking: ExerciseTrackingProfile,
  bodyweightKg: number | null,
): number | null {
  const entered = set.load === null
    ? null
    : loadToKg(set.load * entryMultiplier(tracking.entryBasis), set.unit);

  switch (tracking.loadRelationship) {
    case 'bodyweight':
      return bodyweightKg;
    case 'bodyweight_plus_external':
      return bodyweightKg === null ? null : bodyweightKg + (entered ?? 0);
    case 'assistance':
      return bodyweightKg === null || entered === null ? null : Math.max(0, bodyweightKg - entered);
    case 'external':
      return entered;
    default:
      return null;
  }
}

export function relationshipLabel(relationship: LoadRelationship): string {
  switch (relationship) {
    case 'assistance':
      return 'Assisted bodyweight';
    case 'bodyweight':
      return 'Bodyweight';
    case 'bodyweight_plus_external':
      return 'Bodyweight + added load';
    case 'external':
      return 'External load';
    default:
      return 'No external load';
  }
}

export function entryBasisLabel(entryBasis: EntryBasis): string {
  switch (entryBasis) {
    case 'per_hand':
      return 'Per hand';
    case 'per_side':
      return 'Per side';
    default:
      return 'Total';
  }
}
