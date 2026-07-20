import type { AppDatabase, ExerciseTrackingProfile } from './model';
import { SCHEMA_VERSION } from './model';
import { DEFAULT_TRACKING } from './tracking';

type LegacyRecord = Record<string, any>;

function cloneTracking(value: unknown): ExerciseTrackingProfile {
  if (!value || typeof value !== 'object') return { ...DEFAULT_TRACKING };
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

export function migrateDatabase(database: AppDatabase): AppDatabase {
  const source = structuredClone(database) as unknown as LegacyRecord;
  const exercises = (source.exercises ?? []).map((exercise: LegacyRecord) => ({
    ...exercise,
    tracking: cloneTracking(exercise.tracking),
    schemaVersion: SCHEMA_VERSION,
  }));
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
      healthExportState: session.healthExportState ?? 'not_requested',
      exercises: (session.exercises ?? []).map((exercise: LegacyRecord) => ({
        ...exercise,
        trackingSnapshot: cloneTracking(
          exercise.trackingSnapshot ?? trackingByExercise.get(exercise.exerciseId),
        ),
        bodyweightSnapshotKg:
          typeof exercise.bodyweightSnapshotKg === 'number'
            ? exercise.bodyweightSnapshotKg
            : bodyweightSnapshotKg,
        sets: (exercise.sets ?? []).map((set: LegacyRecord) => ({
          ...set,
          durationSeconds:
            typeof set.durationSeconds === 'number' ? set.durationSeconds : null,
          distanceMetres:
            typeof set.distanceMetres === 'number' ? set.distanceMetres : null,
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
        vibrationStrength: source.settings?.restTimer?.vibrationStrength ?? 'strong',
        chimeEnabled: source.settings?.restTimer?.chimeEnabled ?? false,
      },
      schemaVersion: SCHEMA_VERSION,
    },
    bodyMeasurements,
    exercises,
    routineVersions: (source.routineVersions ?? []).map((version: LegacyRecord) => ({
      ...version,
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
