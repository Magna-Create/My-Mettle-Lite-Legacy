import type { AppDatabase, ExerciseTrackingProfile, VibrationStrength } from './model';
import { SCHEMA_VERSION } from './model';
import { normaliseExerciseMemory } from './exerciseMemory';
import { normaliseMuscleLoadModel } from './muscleLoadModel';
import { DEFAULT_TRACKING } from './tracking';

type LegacyRecord = Record<string, any>;

function legacyTrackingForName(name: unknown): ExerciseTrackingProfile {
  const normalised = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (normalised === 'incline dumbbell press' || normalised === 'incline dumbbell curl') {
    return { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'per_hand' };
  }
  if (normalised === 'cable lateral raise') {
    return { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'per_side' };
  }
  return { ...DEFAULT_TRACKING };
}

function cloneTracking(value: unknown, exerciseName?: unknown): ExerciseTrackingProfile {
  if (!value || typeof value !== 'object') return legacyTrackingForName(exerciseName);
  const candidate = value as LegacyRecord;
  const metric = ['load_reps', 'reps', 'duration', 'distance'].includes(candidate.metric)
    ? candidate.metric
    : DEFAULT_TRACKING.metric;
  const loadRelationship = ['external', 'assistance', 'bodyweight', 'bodyweight_plus_external', 'none'].includes(candidate.loadRelationship)
    ? candidate.loadRelationship
    : DEFAULT_TRACKING.loadRelationship;
  const entryBasis = ['total', 'per_hand', 'per_side'].includes(candidate.entryBasis)
    ? candidate.entryBasis
    : DEFAULT_TRACKING.entryBasis;
  return { metric, loadRelationship, entryBasis } as ExerciseTrackingProfile;
}

function vibrationStrength(value: unknown): VibrationStrength {
  if (value === 'low' || value === 'medium' || value === 'strong' || value === 'very_strong') return value;
  if (value === 'standard') return 'medium';
  return 'strong';
}

export function migrateDatabase(database: AppDatabase): AppDatabase {
  const source = structuredClone(database) as unknown as LegacyRecord;
  const exercises = (source.exercises ?? []).map((exercise: LegacyRecord) => {
    const muscleLoadModel = normaliseMuscleLoadModel(exercise.muscleLoadModel);
    const { muscleLoadModel: _legacyMuscleLoadModel, ...legacyExercise } = exercise;
    return {
      ...legacyExercise,
      archived: Boolean(exercise.archived),
      tracking: cloneTracking(exercise.tracking, exercise.name),
      memory: normaliseExerciseMemory(exercise.memory, exercise.essentialCue),
      ...(muscleLoadModel ? { muscleLoadModel } : {}),
      schemaVersion: SCHEMA_VERSION,
    };
  });
  const trackingByExercise = new Map(
    exercises.map((exercise: LegacyRecord) => [exercise.id, exercise.tracking as ExerciseTrackingProfile]),
  );

  const bodyMeasurements = (source.bodyMeasurements ?? []).map((measurement: LegacyRecord) => ({
    ...measurement,
    source: measurement.source ?? 'manual',
    schemaVersion: SCHEMA_VERSION,
  }));

  const sessions = (source.sessions ?? []).map((session: LegacyRecord) => {
    const bodyweightSnapshotKg = typeof session.bodyweightSnapshotKg === 'number'
      ? session.bodyweightSnapshotKg
      : null;
    return {
      ...session,
      bodyweightSnapshotKg,
      excludedFromInsights: Boolean(session.excludedFromInsights),
      healthExportState: session.healthExportState ?? 'not_requested',
      exercises: (session.exercises ?? []).map((exercise: LegacyRecord) => ({
        ...exercise,
        trackingSnapshot: cloneTracking(
          exercise.trackingSnapshot ?? trackingByExercise.get(exercise.exerciseId),
          exercise.exerciseNameSnapshot,
        ),
        bodyweightSnapshotKg:
          typeof exercise.bodyweightSnapshotKg === 'number'
            ? exercise.bodyweightSnapshotKg
            : bodyweightSnapshotKg,
        sets: (exercise.sets ?? []).map((set: LegacyRecord, index: number) => ({
          ...set,
          setIndex: index,
          durationSeconds:
            typeof set.durationSeconds === 'number' ? set.durationSeconds : null,
          distanceMetres:
            typeof set.distanceMetres === 'number' ? set.distanceMetres : null,
          warmUp: Boolean(set.warmUp),
          kind: set.kind ?? (set.warmUp ? 'warm_up' : index < Number(exercise.prescription?.sets ?? 0) ? 'prescribed' : 'additional'),
        })),
      })),
      schemaVersion: SCHEMA_VERSION,
    };
  });

  return {
    ...source,
    profile: {
      ...source.profile,
      schemaVersion: SCHEMA_VERSION,
    },
    settings: {
      restTimer: {
        autoStart: source.settings?.restTimer?.autoStart ?? true,
        vibrationEnabled: source.settings?.restTimer?.vibrationEnabled ?? true,
        vibrationStrength: vibrationStrength(source.settings?.restTimer?.vibrationStrength),
        chimeEnabled: source.settings?.restTimer?.chimeEnabled ?? false,
        backgroundNotificationEnabled: source.settings?.restTimer?.backgroundNotificationEnabled ?? true,
      },
      schemaVersion: SCHEMA_VERSION,
    },
    bodyMeasurements,
    exercises,
    routineVersions: (source.routineVersions ?? []).map((version: LegacyRecord) => ({
      ...version,
      days: (version.days ?? []).map((day: LegacyRecord) => ({
        ...day,
        slots: (day.slots ?? []).map((slot: LegacyRecord, index: number) => ({ ...slot, position: index })),
      })),
      schemaVersion: SCHEMA_VERSION,
    })),
    sessions,
    cycles: (source.cycles ?? []).map((cycle: LegacyRecord) => ({
      ...cycle,
      schemaVersion: SCHEMA_VERSION,
    })),
    experiments: (source.experiments ?? []).map((experiment: LegacyRecord) => ({
      ...experiment,
      schemaVersion: SCHEMA_VERSION,
    })),
    healthObservations: (source.healthObservations ?? []).map((observation: LegacyRecord) => ({
      ...observation,
      schemaVersion: SCHEMA_VERSION,
    })),
    healthIntegration: {
      provider: source.healthIntegration?.provider ?? 'none',
      permissionState: source.healthIntegration?.permissionState ?? 'not_requested',
      lastSyncedAt: source.healthIntegration?.lastSyncedAt,
      lastError: source.healthIntegration?.lastError,
      schemaVersion: SCHEMA_VERSION,
    },
    schemaVersion: SCHEMA_VERSION,
  } as AppDatabase;
}
