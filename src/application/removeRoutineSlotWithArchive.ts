import type { AppDatabase } from '../domain/model';
import { removeRoutineSlot, updateExerciseRecord } from './Phase2Management';

export function removeRoutineSlotWithArchive(database: AppDatabase, slotId: string): AppDatabase {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) throw new Error('Current routine version is missing.');
  const slot = routine.days.flatMap((day) => day.slots).find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error('Routine slot not found.');

  const updated = removeRoutineSlot(database, slotId);
  const nextRoutine = updated.routineVersions.find((candidate) => candidate.id === updated.currentRoutineVersionId);
  if (!nextRoutine) throw new Error('Updated routine version is missing.');
  const stillUsed = nextRoutine.days.some((day) => day.slots.some((candidate) => candidate.exerciseId === slot.exerciseId));
  return stillUsed ? updated : updateExerciseRecord(updated, slot.exerciseId, { archived: true });
}

export function removingSlotWillArchive(database: AppDatabase, slotId: string): boolean {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) return false;
  const slots = routine.days.flatMap((day) => day.slots);
  const selected = slots.find((slot) => slot.id === slotId);
  return Boolean(selected && slots.filter((slot) => slot.exerciseId === selected.exerciseId).length === 1);
}
