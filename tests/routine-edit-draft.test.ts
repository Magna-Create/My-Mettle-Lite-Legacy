import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import {
  commitRoutineEditDraft,
  createRoutineEditDraft,
  isRoutineEditDraftDirty,
  moveRoutineDraftSlot,
  parseRoutineEditDraft,
  removeRoutineDraftSlot,
} from '../src/application/RoutineEditDraft';

function currentRoutine(database: ReturnType<typeof createSeedDatabase>) {
  return database.routineVersions.find((routine) => routine.id === database.currentRoutineVersionId)!;
}

describe('routine edit drafts', () => {
  it('stages multiple moves and commits exactly one immutable version', () => {
    const database = createSeedDatabase();
    const original = currentRoutine(database);
    const firstSlot = original.days[0]!.slots[0]!;
    const secondSlot = original.days[0]!.slots[1]!;

    let draft = createRoutineEditDraft(database);
    draft = moveRoutineDraftSlot(draft, secondSlot.id, 'ψ', 0);
    draft = moveRoutineDraftSlot(draft, firstSlot.id, 'π', 0);

    expect(isRoutineEditDraftDirty(database, draft)).toBe(true);
    const committed = commitRoutineEditDraft(database, draft);
    const next = currentRoutine(committed);

    expect(committed.routineVersions).toHaveLength(database.routineVersions.length + 1);
    expect(next.parentId).toBe(original.id);
    expect(next.version).toBe(original.version + 1);
    expect(next.days[0]!.slots[0]!.id).toBe(secondSlot.id);
    expect(next.days[2]!.slots[0]!.id).toBe(firstSlot.id);
    expect(database.currentRoutineVersionId).toBe(original.id);
  });

  it('does not create a version for a structurally unchanged draft', () => {
    const database = createSeedDatabase();
    const draft = createRoutineEditDraft(database);
    const committed = commitRoutineEditDraft(database, draft);
    expect(committed).toBe(database);
  });

  it('archives an exercise removed from its final active slot', () => {
    const database = createSeedDatabase();
    const slot = currentRoutine(database).days[0]!.slots[0]!;
    const draft = removeRoutineDraftSlot(createRoutineEditDraft(database), slot.id);
    const committed = commitRoutineEditDraft(database, draft);

    expect(committed.exercises.find((exercise) => exercise.id === slot.exerciseId)?.archived).toBe(true);
    expect(currentRoutine(committed).days.some((day) => day.slots.some((candidate) => candidate.exerciseId === slot.exerciseId))).toBe(false);
  });

  it('keeps an exercise active when another occurrence remains', () => {
    const database = createSeedDatabase();
    const routine = currentRoutine(database);
    const sourceSlot = routine.days[0]!.slots[0]!;
    routine.days[1]!.slots.push({ ...structuredClone(sourceSlot), id: `${sourceSlot.id}_duplicate`, position: routine.days[1]!.slots.length });

    const draft = removeRoutineDraftSlot(createRoutineEditDraft(database), sourceSlot.id);
    const committed = commitRoutineEditDraft(database, draft);

    expect(committed.exercises.find((exercise) => exercise.id === sourceSlot.exerciseId)?.archived).toBe(false);
    expect(currentRoutine(committed).days.some((day) => day.slots.some((candidate) => candidate.exerciseId === sourceSlot.exerciseId))).toBe(true);
  });

  it('rejects stale recovered drafts after the current routine changes', () => {
    const database = createSeedDatabase();
    const draft = createRoutineEditDraft(database);
    const serialised = JSON.stringify(draft);
    expect(parseRoutineEditDraft(serialised, database.currentRoutineVersionId)).toEqual(draft);
    expect(parseRoutineEditDraft(serialised, 'newer-routine')).toBeNull();
  });

  it('does not mutate an active session snapshot', () => {
    const database = createSeedDatabase();
    const activeSession = database.sessions.find((session) => session.id === database.activeSessionId);
    if (!activeSession) throw new Error('Seed database requires an active session for this test.');
    const snapshot = structuredClone(activeSession);
    const slot = currentRoutine(database).days[0]!.slots[0]!;
    const draft = moveRoutineDraftSlot(createRoutineEditDraft(database), slot.id, 'π', 0);
    const committed = commitRoutineEditDraft(database, draft);

    expect(committed.sessions.find((session) => session.id === activeSession.id)).toEqual(snapshot);
  });
});
