import { createId } from '../domain/ids';
import { normaliseExerciseMemory } from '../domain/exerciseMemory';
import type {
  AppDatabase,
  CoreDay,
  DaySymbol,
  Exercise,
  ExerciseMemory,
  ExerciseTrackingProfile,
  Importance,
  ModePrescription,
  RoutineDay,
  RoutineSlot,
  Session,
  SetRecord,
} from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import { isSetComplete } from '../domain/tracking';

const timestamp = () => new Date().toISOString();

function currentRoutine(database: AppDatabase) {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) throw new Error('Current routine version is missing.');
  return routine;
}

function normaliseDays(days: RoutineDay[]): RoutineDay[] {
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot, position) => ({ ...slot, position })),
  }));
}

function withRoutineVersion(database: AppDatabase, days: RoutineDay[], changeReason: string): AppDatabase {
  const current = currentRoutine(database);
  const createdAt = timestamp();
  const next = {
    ...current,
    id: createId('routine_version'),
    version: current.version + 1,
    parentId: current.id,
    createdAt,
    effectiveAt: createdAt,
    source: 'manual_edit' as const,
    changeReason,
    days: normaliseDays(days),
    schemaVersion: SCHEMA_VERSION,
  };
  return {
    ...database,
    routineVersions: [...database.routineVersions, next],
    currentRoutineVersionId: next.id,
    updatedAt: createdAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

function locateSlot(database: AppDatabase, slotId: string) {
  const routine = currentRoutine(database);
  for (const day of routine.days) {
    const index = day.slots.findIndex((slot) => slot.id === slotId);
    if (index >= 0) return { routine, day, index, slot: day.slots[index]! };
  }
  throw new Error('Routine slot not found.');
}

export function reorderRoutineSlot(database: AppDatabase, slotId: string, direction: -1 | 1): AppDatabase {
  const { routine, day, index, slot } = locateSlot(database, slotId);
  const target = index + direction;
  if (target < 0 || target >= day.slots.length) return database;
  const slots = [...day.slots];
  slots.splice(index, 1);
  slots.splice(target, 0, slot);
  const days = routine.days.map((candidate) => candidate.symbol === day.symbol ? { ...candidate, slots } : candidate);
  return withRoutineVersion(database, days, `Moved ${slot.exerciseId} ${direction < 0 ? 'up' : 'down'} in ${day.symbol}`);
}

export function moveRoutineSlot(database: AppDatabase, slotId: string, targetDay: DaySymbol): AppDatabase {
  const { routine, day, slot } = locateSlot(database, slotId);
  if (day.symbol === targetDay) return database;
  const days = routine.days.map((candidate) => {
    if (candidate.symbol === day.symbol) {
      return { ...candidate, slots: candidate.slots.filter((item) => item.id !== slotId) };
    }
    if (candidate.symbol === targetDay) {
      return { ...candidate, slots: [...candidate.slots, slot] };
    }
    return candidate;
  });
  return withRoutineVersion(database, days, `Moved routine slot from ${day.symbol} to ${targetDay}`);
}

export function removeRoutineSlot(database: AppDatabase, slotId: string): AppDatabase {
  const { routine, day, slot } = locateSlot(database, slotId);
  const exercise = database.exercises.find((candidate) => candidate.id === slot.exerciseId);
  const days = routine.days.map((candidate) => candidate.symbol === day.symbol
    ? { ...candidate, slots: candidate.slots.filter((item) => item.id !== slotId) }
    : candidate);
  return withRoutineVersion(database, days, `Removed ${exercise?.name ?? 'exercise'} from ${day.symbol}`);
}

export interface RoutineSlotPatch {
  importance?: Importance;
  plannedLoad?: number;
  prescriptions?: Partial<Record<'A' | 'B' | 'C', Partial<ModePrescription>>>;
}

export function updateRoutineSlot(database: AppDatabase, slotId: string, patch: RoutineSlotPatch): AppDatabase {
  const { routine, slot } = locateSlot(database, slotId);
  if (patch.plannedLoad !== undefined && (!Number.isFinite(patch.plannedLoad) || patch.plannedLoad < 0)) {
    throw new Error('Starting value cannot be negative.');
  }
  const prescriptions = { ...slot.prescriptions };
  for (const mode of ['A', 'B', 'C'] as const) {
    if (patch.prescriptions?.[mode]) {
      prescriptions[mode] = { ...prescriptions[mode], ...patch.prescriptions[mode] };
    }
  }
  const updated: RoutineSlot = {
    ...slot,
    importance: patch.importance ?? slot.importance,
    plannedLoad: patch.plannedLoad ?? slot.plannedLoad,
    lockedToDay: (patch.importance ?? slot.importance) === 'principal',
    prescriptions,
  };
  const days = routine.days.map((day) => ({
    ...day,
    slots: day.slots.map((candidate) => candidate.id === slotId ? updated : candidate),
  }));
  return withRoutineVersion(database, days, 'Updated routine prescription');
}

export interface ExerciseRecordPatch {
  name?: string;
  archived?: boolean;
  tracking?: ExerciseTrackingProfile;
  progressionStep?: number;
  memory?: Partial<ExerciseMemory>;
}

export function updateExerciseRecord(database: AppDatabase, exerciseId: string, patch: ExerciseRecordPatch): AppDatabase {
  const existing = database.exercises.find((candidate) => candidate.id === exerciseId);
  if (!existing) throw new Error('Exercise not found.');
  const name = patch.name?.trim() ?? existing.name;
  if (!name) throw new Error('Exercise name is required.');
  const progressionStep = patch.progressionStep ?? existing.progressionStep;
  if (!Number.isFinite(progressionStep) || progressionStep <= 0) {
    throw new Error('Progression step must be greater than zero.');
  }
  const baseMemory = normaliseExerciseMemory(existing.memory, existing.essentialCue);
  const memory = normaliseExerciseMemory({ ...baseMemory, ...patch.memory }, existing.essentialCue);
  const updatedAt = timestamp();
  const exercise: Exercise = {
    ...existing,
    name,
    archived: patch.archived ?? existing.archived,
    tracking: patch.tracking ?? existing.tracking,
    progressionStep,
    memory,
    essentialCue: memory.cues[0] || existing.essentialCue,
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
  };
  return {
    ...database,
    exercises: database.exercises.map((candidate) => candidate.id === exerciseId ? exercise : candidate),
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function archiveExercise(database: AppDatabase, exerciseId: string): AppDatabase {
  const exercise = database.exercises.find((candidate) => candidate.id === exerciseId);
  if (!exercise) throw new Error('Exercise not found.');
  const routine = currentRoutine(database);
  const hasSlots = routine.days.some((day) => day.slots.some((slot) => slot.exerciseId === exerciseId));
  const updatedDatabase = updateExerciseRecord(database, exerciseId, { archived: true });
  if (!hasSlots) return updatedDatabase;
  const days = routine.days.map((day) => ({
    ...day,
    slots: day.slots.filter((slot) => slot.exerciseId !== exerciseId),
  }));
  return withRoutineVersion(updatedDatabase, days, `Archived ${exercise.name}`);
}

export function restoreExercise(database: AppDatabase, exerciseId: string): AppDatabase {
  return updateExerciseRecord(database, exerciseId, { archived: false });
}

function sessionEdited(session: Session): Session {
  return { ...session, editedAt: timestamp(), healthExportState: session.healthExportState === 'exported' ? 'queued' : session.healthExportState };
}

function reindexSets(sets: SetRecord[]): SetRecord[] {
  return sets.map((set, setIndex) => ({ ...set, setIndex }));
}

export function addSessionSet(database: AppDatabase, sessionId: string, sessionExerciseId: string): AppDatabase {
  const sessions = database.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const updated = sessionEdited(session);
    return {
      ...updated,
      exercises: updated.exercises.map((exercise) => {
        if (exercise.id !== sessionExerciseId) return exercise;
        const last = exercise.sets.at(-1);
        const set: SetRecord = {
          id: createId('set'),
          setIndex: exercise.sets.length,
          load: last?.load ?? (exercise.trackingSnapshot.metric === 'load_reps' ? exercise.plannedLoad : null),
          reps: null,
          durationSeconds: null,
          distanceMetres: null,
          unit: last?.unit ?? 'kg',
          warmUp: false,
          kind: 'additional',
        };
        return { ...exercise, sets: [...exercise.sets, set] };
      }),
    };
  });
  return { ...database, sessions, updatedAt: timestamp(), schemaVersion: SCHEMA_VERSION };
}

export function removeSessionSet(database: AppDatabase, sessionId: string, sessionExerciseId: string, setId: string): AppDatabase {
  const sessions = database.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const updated = sessionEdited(session);
    return {
      ...updated,
      exercises: updated.exercises.map((exercise) => exercise.id === sessionExerciseId
        ? { ...exercise, sets: reindexSets(exercise.sets.filter((set) => set.id !== setId)) }
        : exercise),
    };
  });
  return { ...database, sessions, updatedAt: timestamp(), schemaVersion: SCHEMA_VERSION };
}

export function amendHistoricalSet(
  database: AppDatabase,
  sessionId: string,
  sessionExerciseId: string,
  setId: string,
  patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>,
): AppDatabase {
  const sessions = database.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const updated = sessionEdited(session);
    return {
      ...updated,
      exercises: updated.exercises.map((exercise) => {
        if (exercise.id !== sessionExerciseId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set) => {
            if (set.id !== setId) return set;
            const next = { ...set, ...patch };
            if (isSetComplete(next, exercise.trackingSnapshot)) {
              return { ...next, completedAt: set.completedAt ?? timestamp() };
            }
            const { completedAt: _completedAt, ...withoutCompletedAt } = next;
            return withoutCompletedAt;
          }),
        };
      }),
    };
  });
  return { ...database, sessions, updatedAt: timestamp(), schemaVersion: SCHEMA_VERSION };
}

export function setSessionExcluded(database: AppDatabase, sessionId: string, excluded: boolean): AppDatabase {
  const sessions = database.sessions.map((session) => session.id === sessionId
    ? { ...sessionEdited(session), excludedFromInsights: excluded }
    : session);
  return { ...database, sessions, updatedAt: timestamp(), schemaVersion: SCHEMA_VERSION };
}

function recalculateCycleDays(database: AppDatabase, sessions: Session[]) {
  return database.cycles.map((cycle) => {
    const relevant = sessions.filter((session) => session.cycleId === cycle.id && session.status === 'completed');
    const completedCoreDays = Array.from(new Set(
      relevant
        .map((session) => session.day)
        .filter((day): day is CoreDay => day !== '&'),
    ));
    return {
      ...cycle,
      completedCoreDays,
      andCompleted: relevant.some((session) => session.day === '&'),
    };
  });
}

export function discardSession(database: AppDatabase, sessionId: string): AppDatabase {
  const discardedAt = timestamp();
  const sessions = database.sessions.map((session) => session.id === sessionId
    ? {
        ...session,
        status: 'discarded' as const,
        discardedAt,
        editedAt: discardedAt,
        excludedFromInsights: true,
        healthExportState: 'skipped' as const,
      }
    : session);
  return {
    ...database,
    sessions,
    cycles: recalculateCycleDays(database, sessions),
    activeSessionId: database.activeSessionId === sessionId ? null : database.activeSessionId,
    updatedAt: discardedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function restoreDiscardedSession(database: AppDatabase, sessionId: string): AppDatabase {
  const editedAt = timestamp();
  const sessions = database.sessions.map((session) => session.id === sessionId
    ? {
        ...session,
        status: 'completed' as const,
        discardedAt: undefined,
        editedAt,
        excludedFromInsights: false,
        healthExportState: 'queued' as const,
      }
    : session);
  return {
    ...database,
    sessions,
    cycles: recalculateCycleDays(database, sessions),
    updatedAt: editedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}