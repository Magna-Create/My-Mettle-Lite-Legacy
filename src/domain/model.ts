export const SCHEMA_VERSION = 1;

export type Id = string;
export type DaySymbol = 'ψ' | 'φ' | 'π' | '&';
export type CoreDay = Exclude<DaySymbol, '&'>;
export type Mode = 'A' | 'B' | 'C';
export type Importance = 'principal' | 'core' | 'accessory';
export type LoadUnit = 'kg' | 'lb';

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

export interface Exercise {
  id: Id;
  name: string;
  archived: boolean;
  defaultUnit: LoadUnit;
  progressionStep: number;
  essentialCue?: string;
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

export interface SetRecord {
  id: Id;
  setIndex: number;
  load: number | null;
  reps: number | null;
  unit: LoadUnit;
  completedAt?: string;
  note?: string;
  warmUp: boolean;
}

export type SessionExerciseStatus = 'planned' | 'active' | 'completed' | 'skipped' | 'deferred';

export interface SessionExercise {
  id: Id;
  exerciseId: Id;
  slotId: Id;
  exerciseNameSnapshot: string;
  importanceSnapshot: Importance;
  plannedLoad: number;
  prescription: ModePrescription;
  status: SessionExerciseStatus;
  sets: SetRecord[];
  startedAt?: string;
  completedAt?: string;
  movementReason: 'base_routine' | 'active_experiment';
}

export interface Session {
  id: Id;
  cycleId: Id;
  day: DaySymbol;
  mode: Mode;
  routineVersionId: Id;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  exercises: SessionExercise[];
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
  exercises: Exercise[];
  routineVersions: RoutineVersion[];
  currentRoutineVersionId: Id;
  sessions: Session[];
  cycles: TrainingCycle[];
  currentCycleId: Id;
  activeSessionId: Id | null;
  experiments: Experiment[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}
