import { createId } from '../domain/ids';
import type { AppDatabase, RoutineDay, RoutineSlot } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

const timestamp = () => new Date().toISOString();

export function restoreArchivedExercise(database: AppDatabase, exerciseId: string): AppDatabase {
  const exercise = database.exercises.find((candidate) => candidate.id === exerciseId);
  if (!exercise) throw new Error('Exercise not found.');
  const current = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!current) throw new Error('Current routine version is missing.');

  const restoredAt = timestamp();
  const exercises = database.exercises.map((candidate) => candidate.id === exerciseId
    ? { ...candidate, archived: false, updatedAt: restoredAt, schemaVersion: SCHEMA_VERSION }
    : candidate);
  if (current.days.some((day) => day.slots.some((slot) => slot.exerciseId === exerciseId))) {
    return { ...database, exercises, updatedAt: restoredAt, schemaVersion: SCHEMA_VERSION };
  }

  let historicalDay: RoutineDay | undefined;
  let historicalSlot: RoutineSlot | undefined;
  for (const version of [...database.routineVersions].reverse()) {
    const day = version.days.find((candidate) => candidate.slots.some((slot) => slot.exerciseId === exerciseId));
    const slot = day?.slots.find((candidate) => candidate.exerciseId === exerciseId);
    if (day && slot) {
      historicalDay = day;
      historicalSlot = slot;
      break;
    }
  }
  if (!historicalDay || !historicalSlot) {
    return { ...database, exercises, updatedAt: restoredAt, schemaVersion: SCHEMA_VERSION };
  }

  const restoredSlot: RoutineSlot = { ...structuredClone(historicalSlot), id: createId('slot') };
  const days = current.days.map((day) => {
    const slots = day.symbol === historicalDay.symbol ? [...day.slots, restoredSlot] : day.slots;
    return { ...day, slots: slots.map((slot, position) => ({ ...slot, position })) };
  });
  const nextRoutine = {
    ...current,
    id: createId('routine_version'),
    version: current.version + 1,
    parentId: current.id,
    createdAt: restoredAt,
    effectiveAt: restoredAt,
    source: 'manual_edit' as const,
    changeReason: `Restored ${exercise.name} to ${historicalDay.symbol}`,
    days,
    schemaVersion: SCHEMA_VERSION,
  };
  return {
    ...database,
    exercises,
    routineVersions: [...database.routineVersions, nextRoutine],
    currentRoutineVersionId: nextRoutine.id,
    updatedAt: restoredAt,
    schemaVersion: SCHEMA_VERSION,
  };
}
