import { createId } from './ids';
import { normaliseExerciseMemory } from './exerciseMemory';
import type {
  AppDatabase,
  DaySymbol,
  Exercise,
  ExerciseMemory,
  ExerciseTrackingProfile,
  Importance,
  Mode,
  ModePrescription,
  RoutineDay,
  RoutineSlot,
  RoutineVersion,
} from './model';
import { SCHEMA_VERSION } from './model';

const DAY_SYMBOLS: DaySymbol[] = ['ψ', 'φ', 'π', '&'];
const MODES: Mode[] = ['A', 'B', 'C'];
const IMPORTANCE: Importance[] = ['principal', 'core', 'accessory'];
const METRICS: ExerciseTrackingProfile['metric'][] = ['load_reps', 'reps', 'duration', 'distance'];
const RELATIONSHIPS: ExerciseTrackingProfile['loadRelationship'][] = ['external', 'assistance', 'bodyweight', 'bodyweight_plus_external', 'none'];
const ENTRY_BASES: ExerciseTrackingProfile['entryBasis'][] = ['total', 'per_hand', 'per_side'];

export interface RoutinePackExercise {
  key: string;
  name: string;
  tracking: ExerciseTrackingProfile;
  progressionStep: number;
  memory: ExerciseMemory;
}

export interface RoutinePackSlot {
  exerciseKey: string;
  importance: Importance;
  plannedLoad: number;
  lockedToDay: boolean;
  prescriptions: Record<Mode, ModePrescription>;
}

export interface RoutinePackDay {
  symbol: DaySymbol;
  slots: RoutinePackSlot[];
}

export interface ParsedRoutinePack {
  format: 'my-mettle-routine-pack';
  version: 1;
  name: string;
  exercises: RoutinePackExercise[];
  days: RoutinePackDay[];
}

export interface RoutinePackPreview {
  name: string;
  exerciseCount: number;
  slotCount: number;
  dayCounts: Record<DaySymbol, number>;
  duplicateNames: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, label: string, maxLength = 160): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim().slice(0, maxLength);
}

function number(value: unknown, label: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function integer(value: unknown, label: string, fallback: number): number {
  const parsed = number(value, label, fallback);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number.`);
  return parsed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string, fallback?: T): T {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function defaultPrescription(mode: Mode): ModePrescription {
  const sets = mode === 'A' ? 3 : mode === 'B' ? 2 : 1;
  return { mode, included: true, sets, repMin: 8, repMax: 10, restSeconds: 120, deferToAnd: false };
}

function parsePrescription(value: unknown, mode: Mode, label: string): ModePrescription {
  const defaults = defaultPrescription(mode);
  if (value === undefined) return defaults;
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);

  const sets = integer(value.sets, `${label}.sets`, defaults.sets);
  const repMin = number(value.repMin, `${label}.repMin`, defaults.repMin);
  const repMax = number(value.repMax, `${label}.repMax`, defaults.repMax);
  const restSeconds = integer(value.restSeconds, `${label}.restSeconds`, defaults.restSeconds);
  if (repMin <= 0 || repMax <= 0 || repMax < repMin) throw new Error(`${label} has an invalid repetition range.`);

  return {
    mode,
    included: value.included === undefined ? defaults.included : Boolean(value.included),
    sets,
    repMin,
    repMax,
    restSeconds,
    deferToAnd: false,
  };
}

function parseTracking(value: unknown, label: string): ExerciseTrackingProfile {
  if (value === undefined) return { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' };
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return {
    metric: oneOf(value.metric, METRICS, `${label}.metric`, 'load_reps'),
    loadRelationship: oneOf(value.loadRelationship, RELATIONSHIPS, `${label}.loadRelationship`, 'external'),
    entryBasis: oneOf(value.entryBasis, ENTRY_BASES, `${label}.entryBasis`, 'total'),
  };
}

export function parseRoutinePack(value: unknown): ParsedRoutinePack {
  if (!isRecord(value)) throw new Error('Routine pack must contain a JSON object.');
  if (value.format !== 'my-mettle-routine-pack') throw new Error('This is not a My Mettle routine pack.');
  if (value.version !== 1) throw new Error('Only routine pack version 1 is supported.');
  if (!Array.isArray(value.exercises) || value.exercises.length === 0) throw new Error('Routine pack exercises are missing.');
  if (!Array.isArray(value.days)) throw new Error('Routine pack days are missing.');

  const seenKeys = new Set<string>();
  const exercises = value.exercises.map((candidate, index): RoutinePackExercise => {
    if (!isRecord(candidate)) throw new Error(`Exercise ${index + 1} must be an object.`);
    const key = text(candidate.key, `Exercise ${index + 1} key`, 100);
    if (seenKeys.has(key)) throw new Error(`Exercise key “${key}” appears more than once.`);
    seenKeys.add(key);
    const progressionStep = number(candidate.progressionStep, `Exercise ${key} progressionStep`, 1);
    if (progressionStep <= 0) throw new Error(`Exercise ${key} progressionStep must be greater than zero.`);
    return {
      key,
      name: text(candidate.name, `Exercise ${key} name`),
      tracking: parseTracking(candidate.tracking, `Exercise ${key} tracking`),
      progressionStep,
      memory: normaliseExerciseMemory(candidate.memory, candidate.essentialCue),
    };
  });

  const seenDays = new Set<DaySymbol>();
  const suppliedDays = value.days.map((candidate, dayIndex): RoutinePackDay => {
    if (!isRecord(candidate)) throw new Error(`Day ${dayIndex + 1} must be an object.`);
    const symbol = oneOf(candidate.symbol, DAY_SYMBOLS, `Day ${dayIndex + 1} symbol`);
    if (seenDays.has(symbol)) throw new Error(`Routine day ${symbol} appears more than once.`);
    seenDays.add(symbol);
    if (!Array.isArray(candidate.slots)) throw new Error(`Routine day ${symbol} slots are missing.`);

    const slots = candidate.slots.map((slotCandidate, slotIndex): RoutinePackSlot => {
      if (!isRecord(slotCandidate)) throw new Error(`Day ${symbol}, slot ${slotIndex + 1} must be an object.`);
      const exerciseKey = text(slotCandidate.exerciseKey, `Day ${symbol}, slot ${slotIndex + 1} exerciseKey`, 100);
      if (!seenKeys.has(exerciseKey)) throw new Error(`Day ${symbol} references unknown exercise key “${exerciseKey}”.`);
      const importance = oneOf(slotCandidate.importance, IMPORTANCE, `Day ${symbol}, ${exerciseKey} importance`, 'core');
      const plannedLoad = number(slotCandidate.plannedLoad, `Day ${symbol}, ${exerciseKey} plannedLoad`, 0);
      if (plannedLoad < 0) throw new Error(`Day ${symbol}, ${exerciseKey} plannedLoad cannot be negative.`);
      const prescriptionSource = isRecord(slotCandidate.prescriptions) ? slotCandidate.prescriptions : {};
      const prescriptions = Object.fromEntries(MODES.map((mode) => [
        mode,
        parsePrescription(prescriptionSource[mode], mode, `Day ${symbol}, ${exerciseKey}, mode ${mode}`),
      ])) as Record<Mode, ModePrescription>;

      return {
        exerciseKey,
        importance,
        plannedLoad,
        lockedToDay: slotCandidate.lockedToDay === undefined ? importance === 'principal' : Boolean(slotCandidate.lockedToDay),
        prescriptions,
      };
    });

    return { symbol, slots };
  });

  const days = DAY_SYMBOLS.map((symbol) => suppliedDays.find((day) => day.symbol === symbol) ?? { symbol, slots: [] });
  return {
    format: 'my-mettle-routine-pack',
    version: 1,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 160) : 'Imported routine',
    exercises,
    days,
  };
}

export function previewRoutinePack(pack: ParsedRoutinePack): RoutinePackPreview {
  const nameCounts = new Map<string, number>();
  for (const exercise of pack.exercises) {
    const key = exercise.name.trim().toLocaleLowerCase('en-GB');
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  return {
    name: pack.name,
    exerciseCount: pack.exercises.length,
    slotCount: pack.days.reduce((sum, day) => sum + day.slots.length, 0),
    dayCounts: Object.fromEntries(pack.days.map((day) => [day.symbol, day.slots.length])) as Record<DaySymbol, number>,
    duplicateNames: [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  };
}

export function applyRoutinePack(database: AppDatabase, pack: ParsedRoutinePack): AppDatabase {
  if (database.activeSessionId) throw new Error('Finish or discard the active workout before replacing the routine.');
  const current = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!current) throw new Error('Current routine version is missing.');

  const importedAt = new Date().toISOString();
  const exerciseIdByKey = new Map<string, string>();
  const importedExercises: Exercise[] = [];

  for (const definition of pack.exercises) {
    const matches = database.exercises.filter((candidate) => !candidate.archived
      && candidate.name.trim().toLocaleLowerCase('en-GB') === definition.name.trim().toLocaleLowerCase('en-GB'));
    const existing = matches.length === 1 ? matches[0] : undefined;
    const id = existing?.id ?? createId('exercise');
    exerciseIdByKey.set(definition.key, id);
    importedExercises.push({
      id,
      name: definition.name,
      archived: false,
      defaultUnit: existing?.defaultUnit ?? database.profile.units,
      tracking: structuredClone(definition.tracking),
      progressionStep: definition.progressionStep,
      essentialCue: definition.memory.cues[0],
      memory: structuredClone(definition.memory),
      createdAt: existing?.createdAt ?? importedAt,
      updatedAt: importedAt,
      schemaVersion: SCHEMA_VERSION,
    });
  }

  const importedById = new Map(importedExercises.map((exercise) => [exercise.id, exercise]));
  const exercises = database.exercises
    .filter((exercise) => !importedById.has(exercise.id))
    .map((exercise) => exercise.archived ? exercise : { ...exercise, archived: true, updatedAt: importedAt, schemaVersion: SCHEMA_VERSION })
    .concat(importedExercises);

  const days: RoutineDay[] = pack.days.map((day) => ({
    symbol: day.symbol,
    slots: day.slots.map((slot, position): RoutineSlot => {
      const exerciseId = exerciseIdByKey.get(slot.exerciseKey);
      if (!exerciseId) throw new Error(`Imported exercise key “${slot.exerciseKey}” could not be resolved.`);
      return {
        id: createId('slot'),
        exerciseId,
        position,
        importance: slot.importance,
        plannedLoad: slot.plannedLoad,
        lockedToDay: slot.lockedToDay,
        prescriptions: structuredClone(slot.prescriptions),
      };
    }),
  }));

  const nextRoutine: RoutineVersion = {
    id: createId('routine_version'),
    version: current.version + 1,
    parentId: current.id,
    createdAt: importedAt,
    effectiveAt: importedAt,
    source: 'manual_edit',
    changeReason: `Imported routine pack: ${pack.name}`,
    days,
    schemaVersion: SCHEMA_VERSION,
  };

  return {
    ...database,
    exercises,
    routineVersions: [...database.routineVersions, nextRoutine],
    currentRoutineVersionId: nextRoutine.id,
    updatedAt: importedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}
