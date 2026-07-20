import { createId } from '../domain/ids';
import type { AppDatabase, DaySymbol, RoutineDay, RoutineSlot, RoutineVersion } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

export interface RoutineEditDraft {
  baseRoutineVersionId: string;
  days: RoutineDay[];
  updatedAt: string;
}

const timestamp = () => new Date().toISOString();

function currentRoutine(database: AppDatabase): RoutineVersion {
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

function structuralSignature(days: RoutineDay[]) {
  return days.map((day) => `${day.symbol}:${day.slots.map((slot) => slot.id).join(',')}`).join('|');
}

export function createRoutineEditDraft(database: AppDatabase): RoutineEditDraft {
  const routine = currentRoutine(database);
  return {
    baseRoutineVersionId: routine.id,
    days: structuredClone(routine.days),
    updatedAt: timestamp(),
  };
}

export function isRoutineEditDraftDirty(database: AppDatabase, draft: RoutineEditDraft): boolean {
  const routine = currentRoutine(database);
  if (routine.id !== draft.baseRoutineVersionId) return true;
  return structuralSignature(routine.days) !== structuralSignature(draft.days);
}

export function locateDraftSlot(draft: RoutineEditDraft, slotId: string) {
  for (const day of draft.days) {
    const index = day.slots.findIndex((slot) => slot.id === slotId);
    if (index >= 0) return { day, index, slot: day.slots[index]! };
  }
  throw new Error('Routine slot not found in edit draft.');
}

export function moveRoutineDraftSlot(
  draft: RoutineEditDraft,
  slotId: string,
  targetDay: DaySymbol,
  targetIndex: number,
): RoutineEditDraft {
  const { slot } = locateDraftSlot(draft, slotId);
  const daysWithoutSlot = draft.days.map((day) => ({
    ...day,
    slots: day.slots.filter((candidate) => candidate.id !== slotId),
  }));
  const days = daysWithoutSlot.map((day) => {
    if (day.symbol !== targetDay) return day;
    const slots = [...day.slots];
    const insertionIndex = Math.max(0, Math.min(targetIndex, slots.length));
    slots.splice(insertionIndex, 0, slot);
    return { ...day, slots };
  });
  return { ...draft, days: normaliseDays(days), updatedAt: timestamp() };
}

export function duplicateRoutineDraftSlot(draft: RoutineEditDraft, slotId: string): RoutineEditDraft {
  const { day: sourceDay, index, slot } = locateDraftSlot(draft, slotId);
  const duplicate: RoutineSlot = {
    ...structuredClone(slot),
    id: createId('slot'),
  };
  const days = draft.days.map((day) => {
    if (day.symbol !== sourceDay.symbol) return day;
    const slots = [...day.slots];
    slots.splice(index + 1, 0, duplicate);
    return { ...day, slots };
  });
  return { ...draft, days: normaliseDays(days), updatedAt: timestamp() };
}

export function removeRoutineDraftSlot(draft: RoutineEditDraft, slotId: string): RoutineEditDraft {
  locateDraftSlot(draft, slotId);
  const days = draft.days.map((day) => ({
    ...day,
    slots: day.slots.filter((slot) => slot.id !== slotId),
  }));
  return { ...draft, days: normaliseDays(days), updatedAt: timestamp() };
}

export function validateRoutineEditDraft(database: AppDatabase, draft: RoutineEditDraft): void {
  const routine = currentRoutine(database);
  if (routine.id !== draft.baseRoutineVersionId) {
    throw new Error('The routine changed after this edit began. Reopen Edit routine and try again.');
  }
  const expectedDays: DaySymbol[] = ['ψ', 'φ', 'π', '&'];
  if (draft.days.length !== expectedDays.length || expectedDays.some((symbol) => !draft.days.some((day) => day.symbol === symbol))) {
    throw new Error('Routine edit is missing a training day.');
  }
  const slotIds = draft.days.flatMap((day) => day.slots.map((slot) => slot.id));
  if (new Set(slotIds).size !== slotIds.length) throw new Error('A routine slot appears more than once.');
  const exerciseIds = new Set(database.exercises.map((exercise) => exercise.id));
  if (draft.days.some((day) => day.slots.some((slot) => !exerciseIds.has(slot.exerciseId)))) {
    throw new Error('Routine edit contains an exercise that no longer exists.');
  }
}

export function commitRoutineEditDraft(database: AppDatabase, draft: RoutineEditDraft): AppDatabase {
  validateRoutineEditDraft(database, draft);
  if (!isRoutineEditDraftDirty(database, draft)) return database;

  const current = currentRoutine(database);
  const committedAt = timestamp();
  const activeExerciseIds = new Set(draft.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
  const previouslyActiveExerciseIds = new Set(current.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
  const orphanedExerciseIds = new Set(
    [...previouslyActiveExerciseIds].filter((exerciseId) => !activeExerciseIds.has(exerciseId)),
  );
  const nextRoutine: RoutineVersion = {
    ...current,
    id: createId('routine_version'),
    version: current.version + 1,
    parentId: current.id,
    createdAt: committedAt,
    effectiveAt: committedAt,
    source: 'manual_edit',
    changeReason: 'Reconstructed routine in Edit mode',
    days: normaliseDays(structuredClone(draft.days)),
    schemaVersion: SCHEMA_VERSION,
  };

  return {
    ...database,
    exercises: database.exercises.map((exercise) => orphanedExerciseIds.has(exercise.id)
      ? { ...exercise, archived: true, updatedAt: committedAt, schemaVersion: SCHEMA_VERSION }
      : exercise),
    routineVersions: [...database.routineVersions, nextRoutine],
    currentRoutineVersionId: nextRoutine.id,
    updatedAt: committedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function parseRoutineEditDraft(value: string, expectedBaseRoutineVersionId: string): RoutineEditDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<RoutineEditDraft>;
    if (parsed.baseRoutineVersionId !== expectedBaseRoutineVersionId || !Array.isArray(parsed.days)) return null;
    if (typeof parsed.updatedAt !== 'string') return null;
    return {
      baseRoutineVersionId: parsed.baseRoutineVersionId,
      days: normaliseDays(structuredClone(parsed.days as RoutineDay[])),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function slotDestinationIndex(
  draft: RoutineEditDraft,
  targetDay: DaySymbol,
  targetSlotId: string | null,
  placeAfter: boolean,
): number {
  const day = draft.days.find((candidate) => candidate.symbol === targetDay);
  if (!day) throw new Error('Target day is missing.');
  if (!targetSlotId) return day.slots.length;
  const index = day.slots.findIndex((slot) => slot.id === targetSlotId);
  if (index < 0) return day.slots.length;
  return index + (placeAfter ? 1 : 0);
}

export function describeDraftMove(
  database: AppDatabase,
  slot: RoutineSlot,
  targetDay: DaySymbol,
): string {
  const name = database.exercises.find((exercise) => exercise.id === slot.exerciseId)?.name ?? 'Exercise';
  return `Moved ${name} to ${targetDay}`;
}
