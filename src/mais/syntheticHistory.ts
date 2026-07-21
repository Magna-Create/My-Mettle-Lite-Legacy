import type {
  AppDatabase,
  CoreDay,
  Exercise,
  ExerciseReflection,
  Mode,
  RoutineSlot,
  Session,
  SessionExercise,
  SetRecord,
  TrainingCycle,
} from '../domain/model';

export interface MaisSyntheticHistoryOptions {
  seed?: number | undefined;
  startAt?: string | undefined;
  sessionSpacingHours?: number | undefined;
  excludedEvery?: number | undefined;
  amendedEvery?: number | undefined;
}

export interface MaisSyntheticHistoryResult {
  database: AppDatabase;
  generatedSessionIds: string[];
  generatedCycleIds: string[];
  seed: number;
}

const coreDays: CoreDay[] = ['ψ', 'φ', 'π'];
const modes: Mode[] = ['A', 'B', 'C'];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function timestamp(baseMs: number, hourOffset: number): string {
  return new Date(baseMs + hourOffset * 60 * 60 * 1_000).toISOString();
}

function boundedInt(random: () => number, minimum: number, maximum: number): number {
  return Math.floor(minimum + random() * (maximum - minimum + 1));
}

function syntheticReflection(index: number, random: () => number, completedAt: string): ExerciseReflection | undefined {
  if (index % 3 !== 0) return undefined;
  const engagement = Math.min(7, Math.max(0, 4 + boundedInt(random, -1, 2))) as ExerciseReflection['targetMuscleEngagement'];
  const enjoyment = Math.min(7, Math.max(1, 4 + boundedInt(random, -1, 2))) as ExerciseReflection['enjoyment'];
  return {
    targetMuscleEngagement: engagement,
    execution: random() < 0.72 ? 'clean' : random() < 0.88 ? 'mixed' : 'poor',
    enjoyment,
    comfort: random() < 0.82 ? 'good' : random() < 0.95 ? 'fine' : 'uncomfortable',
    note: index % 9 === 0 ? 'Synthetic note: monitor setup consistency.' : undefined,
    recordedAt: completedAt,
    updatedAt: completedAt,
  };
}

function loadFor(
  exercise: Exercise,
  slot: RoutineSlot,
  exposureIndex: number,
  random: () => number,
): number | null {
  const relationship = exercise.tracking.loadRelationship;
  if (relationship === 'none' || relationship === 'bodyweight') return null;
  const slowProgress = Math.floor(exposureIndex / 8) * Math.max(0.5, exercise.progressionStep);
  const noise = (random() - 0.5) * Math.max(0.5, exercise.progressionStep * 0.5);
  if (relationship === 'assistance') return round(Math.max(0, slot.plannedLoad - slowProgress + noise));
  return round(Math.max(0, slot.plannedLoad + slowProgress + noise));
}

function syntheticSet(
  sessionId: string,
  exercise: Exercise,
  slot: RoutineSlot,
  mode: Mode,
  setIndex: number,
  exposureIndex: number,
  random: () => number,
  completedAt: string,
): SetRecord {
  const prescription = slot.prescriptions[mode];
  const metric = exercise.tracking.metric;
  const fatiguePenalty = setIndex * (metric === 'load_reps' || metric === 'reps' ? 1 : 0);
  const repProgress = Math.floor(exposureIndex / 3) % Math.max(1, prescription.repMax - prescription.repMin + 1);
  const reps = Math.max(prescription.repMin, Math.min(prescription.repMax, prescription.repMin + repProgress - fatiguePenalty + boundedInt(random, -1, 1)));
  const duration = Math.max(5, round(25 + exposureIndex * 0.25 - setIndex * 1.5 + (random() - 0.5) * 4));
  const distance = Math.max(10, round(400 + exposureIndex * 3 - setIndex * 12 + (random() - 0.5) * 30));

  return {
    id: `synthetic_set_${sessionId}_${slot.id}_${setIndex}`,
    setIndex,
    load: metric === 'load_reps' ? loadFor(exercise, slot, exposureIndex, random) : null,
    reps: metric === 'load_reps' || metric === 'reps' ? reps : null,
    durationSeconds: metric === 'duration' ? duration : null,
    distanceMetres: metric === 'distance' ? distance : null,
    unit: exercise.defaultUnit,
    completedAt,
    warmUp: false,
    kind: 'prescribed',
  };
}

function sessionExercise(
  sessionId: string,
  exercise: Exercise,
  slot: RoutineSlot,
  mode: Mode,
  bodyweightKg: number,
  exposureIndex: number,
  random: () => number,
  startedAt: string,
  completedAt: string,
): SessionExercise {
  const prescription = slot.prescriptions[mode];
  const sets = Array.from({ length: prescription.sets }, (_, setIndex) => syntheticSet(
    sessionId,
    exercise,
    slot,
    mode,
    setIndex,
    exposureIndex,
    random,
    completedAt,
  ));
  return {
    id: `synthetic_session_exercise_${sessionId}_${slot.id}`,
    exerciseId: exercise.id,
    slotId: slot.id,
    exerciseNameSnapshot: exercise.name,
    importanceSnapshot: slot.importance,
    trackingSnapshot: structuredClone(exercise.tracking),
    bodyweightSnapshotKg: bodyweightKg,
    plannedLoad: slot.plannedLoad,
    prescription: structuredClone(prescription),
    status: 'completed',
    sets,
    reflection: syntheticReflection(exposureIndex, random, completedAt),
    startedAt,
    completedAt,
    movementReason: 'base_routine',
  };
}

function activeRoutine(database: AppDatabase) {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) throw new Error('Synthetic history requires a current routine version.');
  return routine;
}

export function createMaisSyntheticHistory(
  source: AppDatabase,
  sessionCount: number,
  options: MaisSyntheticHistoryOptions = {},
): MaisSyntheticHistoryResult {
  if (!Number.isInteger(sessionCount) || sessionCount < 0) throw new Error('Synthetic session count must be a non-negative integer.');
  const seed = options.seed ?? 41_903;
  const random = mulberry32(seed);
  const startMs = new Date(options.startAt ?? '2024-01-01T08:00:00.000Z').getTime();
  if (!Number.isFinite(startMs)) throw new Error('Synthetic history start time is invalid.');
  const spacingHours = Math.max(1, options.sessionSpacingHours ?? 48);
  const database = structuredClone(source);
  const routine = activeRoutine(database);
  const exercises = new Map(database.exercises.map((exercise) => [exercise.id, exercise]));
  const sessions: Session[] = [];
  const cycles: TrainingCycle[] = [];
  const exposureCount = new Map<string, number>();

  for (let index = 0; index < sessionCount; index += 1) {
    const cycleIndex = Math.floor(index / coreDays.length);
    const day = coreDays[index % coreDays.length]!;
    const mode = modes[cycleIndex % modes.length]!;
    const cycleId = `synthetic_cycle_${cycleIndex + 1}`;
    if (!cycles.some((cycle) => cycle.id === cycleId)) {
      const cycleStartIndex = cycleIndex * coreDays.length;
      cycles.push({
        id: cycleId,
        startedAt: timestamp(startMs, cycleStartIndex * spacingHours),
        status: cycleStartIndex + coreDays.length <= sessionCount ? 'closed' : 'active',
        completedCoreDays: [],
        andCompleted: false,
        schemaVersion: database.schemaVersion,
      });
    }

    const sessionId = `synthetic_session_${index + 1}`;
    const startedAt = timestamp(startMs, index * spacingHours);
    const completedAt = timestamp(startMs, index * spacingHours + 1.25);
    const bodyweightKg = round(70 + index * 0.005 + (random() - 0.5) * 0.8);
    const dayDefinition = routine.days.find((candidate) => candidate.symbol === day);
    if (!dayDefinition) throw new Error(`Synthetic history could not find routine day ${day}.`);

    const sessionExercises = dayDefinition.slots
      .filter((slot) => slot.prescriptions[mode].included)
      .map((slot) => {
        const exercise = exercises.get(slot.exerciseId);
        if (!exercise) throw new Error(`Synthetic history could not find exercise ${slot.exerciseId}.`);
        const exposureIndex = exposureCount.get(exercise.id) ?? 0;
        exposureCount.set(exercise.id, exposureIndex + 1);
        return sessionExercise(sessionId, exercise, slot, mode, bodyweightKg, exposureIndex, random, startedAt, completedAt);
      });

    const excluded = Boolean(options.excludedEvery && options.excludedEvery > 0 && (index + 1) % options.excludedEvery === 0);
    const amended = Boolean(options.amendedEvery && options.amendedEvery > 0 && (index + 1) % options.amendedEvery === 0);
    sessions.push({
      id: sessionId,
      cycleId,
      day,
      mode,
      routineVersionId: routine.id,
      status: 'completed',
      startedAt,
      completedAt,
      editedAt: amended ? timestamp(startMs, index * spacingHours + 2) : undefined,
      excludedFromInsights: excluded,
      bodyweightSnapshotKg: bodyweightKg,
      exercises: sessionExercises,
      healthExportState: 'not_requested',
      schemaVersion: database.schemaVersion,
    });
    const cycle = cycles.find((candidate) => candidate.id === cycleId)!;
    if (!cycle.completedCoreDays.includes(day)) cycle.completedCoreDays.push(day);
    if (cycle.completedCoreDays.length === coreDays.length) {
      cycle.status = 'closed';
      cycle.endedAt = completedAt;
    }
  }

  const finalCycle = cycles.at(-1);
  if (finalCycle && finalCycle.completedCoreDays.length < coreDays.length) {
    finalCycle.status = 'active';
    delete finalCycle.endedAt;
  }

  database.sessions = sessions;
  database.cycles = cycles.length ? cycles : database.cycles.slice(0, 1);
  database.currentCycleId = finalCycle?.id ?? database.currentCycleId;
  database.activeSessionId = null;
  database.updatedAt = sessions.at(-1)?.completedAt ?? database.updatedAt;

  return {
    database,
    generatedSessionIds: sessions.map((session) => session.id),
    generatedCycleIds: cycles.map((cycle) => cycle.id),
    seed,
  };
}
