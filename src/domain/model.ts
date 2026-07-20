export const SCHEMA_VERSION = 3;

export type Id = string;
export type DaySymbol = 'ψ' | 'φ' | 'π' | '&';
export type CoreDay = Exclude<DaySymbol, '&'>;
export type Mode = 'A' | 'B' | 'C';
export type Importance = 'principal' | 'core' | 'accessory';
export type LoadUnit = 'kg' | 'lb';

export type TrackingMetric = 'load_reps' | 'reps' | 'duration' | 'distance';
export type LoadRelationship =
  | 'external'
  | 'assistance'
  | 'bodyweight'
  | 'bodyweight_plus_external'
  | 'none';
export type EntryBasis = 'total' | 'per_hand' | 'per_side';

export interface ExerciseTrackingProfile {
  metric: TrackingMetric;
  loadRelationship: LoadRelationship;
  entryBasis: EntryBasis;
}

export interface BodyMeasurement {
  id: Id;
  recordedAt: string;
  weightKg?: number | undefined;
  heightCm?: number | undefined;
  source: 'manual' | 'health_connect' | 'samsung_health';
  sourceRecordId?: string;
  schemaVersion: number;
}

export type VibrationStrength = 'low' | 'medium' | 'strong' | 'very_strong';

export interface RestTimerSettings {
  autoStart: boolean;
  vibrationEnabled: boolean;
  vibrationStrength: VibrationStrength;
  chimeEnabled: boolean;
  backgroundNotificationEnabled?: boolean;
}

export interface AppSettings {
  restTimer: RestTimerSettings;
  schemaVersion: number;
}

export type HealthPermissionState = 'unavailable' | 'not_requested' | 'granted' | 'denied';
export type HealthProviderKind = 'none' | 'health_connect' | 'samsung_health';
export type HealthObservationType =
  | 'exercise_session'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'heart_rate_variability'
  | 'sleep'
  | 'weight'
  | 'body_composition';

export interface HealthObservation {
  id: Id;
  type: HealthObservationType;
  startTime: string;
  endTime?: string;
  value?: number;
  unit?: string;
  provider: Exclude<HealthProviderKind, 'none'>;
  sourceRecordId: string;
  sourceDevice?: string;
  payload?: Record<string, unknown>;
  importedAt: string;
  schemaVersion: number;
}

export interface HealthIntegrationState {
  provider: HealthProviderKind;
  permissionState: HealthPermissionState;
  lastSyncedAt?: string;
  lastError?: string;
  schemaVersion: number;
}

export interface UserProfile {
  id: Id;
  displayName: string;
  units: LoadUnit;
  dietaryPreference: 'vegetarian';
  cycleStartDay: number;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface ModePrescription {
  mode: Mode;
  included: boolean;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  deferToAnd: boolean;
}

export interface ExerciseMemory {
  category: string;
  equipment: string;
  targetMuscles: string[];
  fatigueCost: 1 | 2 | 3 | 4 | 5;
  skillDifficulty: 1 | 2 | 3 | 4 | 5;
  cues: string[];
  commonMistakes: string[];
  setupNotes: string;
  personalNotes: string;
  machineSettings: string;
  substitutions: string[];
}

export interface Exercise {
  id: Id;
  name: string;
  archived: boolean;
  defaultUnit: LoadUnit;
  tracking: ExerciseTrackingProfile;
  progressionStep: number;
  essentialCue?: string;
  memory?: ExerciseMemory;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface RoutineSlot {
  id: Id;
  exerciseId: Id;
  position: number;
  importance: Importance;
  plannedLoad: number;
  prescriptions: Record<Mode, ModePrescription>;
  lockedToDay: boolean;
}

export interface RoutineDay {
  symbol: DaySymbol;
  slots: RoutineSlot[];
}

export interface RoutineVersion {
  id: Id;
  version: number;
  parentId?: Id;
  createdAt: string;
  effectiveAt: string;
  source: 'seed' | 'manual_edit' | 'experiment_promotion';
  changeReason: string;
  days: RoutineDay[];
  schemaVersion: number;
}

export type SetKind = 'prescribed' | 'additional' | 'warm_up';

export interface SetRecord {
  id: Id;
  setIndex: number;
  load: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMetres: number | null;
  unit: LoadUnit;
  completedAt?: string | undefined;
  note?: string;
  warmUp: boolean;
  kind?: SetKind;
}

export type SessionExerciseStatus = 'planned' | 'active' | 'completed' | 'skipped' | 'deferred';

export interface SessionExercise {
  id: Id;
  exerciseId: Id;
  slotId: Id;
  exerciseNameSnapshot: string;
  importanceSnapshot: Importance;
  trackingSnapshot: ExerciseTrackingProfile;
  bodyweightSnapshotKg: number | null;
  plannedLoad: number;
  prescription: ModePrescription;
  status: SessionExerciseStatus;
  sets: SetRecord[];
  note?: string;
  startedAt?: string;
  completedAt?: string;
  movementReason: 'base_routine' | 'active_experiment';
}

export type SessionStatus = 'active' | 'completed' | 'abandoned' | 'discarded';

export interface Session {
  id: Id;
  cycleId: Id;
  day: DaySymbol;
  mode: Mode;
  routineVersionId: Id;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  editedAt?: string;
  discardedAt?: string;
  excludedFromInsights?: boolean;
  bodyweightSnapshotKg: number | null;
  exercises: SessionExercise[];
  healthExportState?: 'not_requested' | 'queued' | 'exported' | 'skipped' | 'conflict';
  healthClientRecordId?: string;
  schemaVersion: number;
}

export type ExperimentStatus = 'proposed' | 'active' | 'ready_for_decision' | 'adopted' | 'rejected';

export interface Experiment {
  id: Id;
  exerciseId: Id;
  routineSlotId: Id;
  exerciseName: string;
  hypothesis: string;
  baselineLoad: number;
  proposedLoad: number;
  targetRepMin: number;
  status: ExperimentStatus;
  createdAt: string;
  activatedAt?: string;
  testedSessionId?: Id;
  evidenceSummary?: string;
  adoptedRoutineVersionId?: Id;
  schemaVersion: number;
}

export interface TrainingCycle {
  id: Id;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'closed';
  completedCoreDays: CoreDay[];
  andCompleted: boolean;
  schemaVersion: number;
}

export interface AppDatabase {
  profile: UserProfile;
  settings: AppSettings;
  bodyMeasurements: BodyMeasurement[];
  exercises: Exercise[];
  routineVersions: RoutineVersion[];
  currentRoutineVersionId: Id;
  sessions: Session[];
  cycles: TrainingCycle[];
  currentCycleId: Id;
  activeSessionId: Id | null;
  experiments: Experiment[];
  healthObservations: HealthObservation[];
  healthIntegration: HealthIntegrationState;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}