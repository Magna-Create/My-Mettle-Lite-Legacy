import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { addSessionSet, archiveExercise, discardSession, moveRoutineSlot, removeSessionSet, reorderRoutineSlot, restoreDiscardedSession, setSessionExcluded } from '../src/application/Phase2Management';
import { createId } from '../src/domain/ids';
import type { Session } from '../src/domain/model';

function routine(database: ReturnType<typeof createSeedDatabase>) {
  return database.routineVersions.find((item) => item.id === database.currentRoutineVersionId)!;
}

function completedSession(database: ReturnType<typeof createSeedDatabase>): Session {
  const slot = routine(database).days[0]!.slots[0]!;
  const exercise = database.exercises.find((item) => item.id === slot.exerciseId)!;
  return {
    id: createId('session'), cycleId: database.currentCycleId, day: 'ψ', mode: 'A', routineVersionId: database.currentRoutineVersionId,
    status: 'completed', startedAt: '2026-07-20T10:00:00Z', completedAt: '2026-07-20T11:00:00Z', excludedFromInsights: false,
    bodyweightSnapshotKg: 70, healthExportState: 'not_requested', schemaVersion: database.schemaVersion,
    exercises: [{
      id: createId('session_exercise'), exerciseId: exercise.id, slotId: slot.id, exerciseNameSnapshot: exercise.name,
      importanceSnapshot: slot.importance, trackingSnapshot: structuredClone(exercise.tracking), bodyweightSnapshotKg: 70,
      plannedLoad: slot.plannedLoad, prescription: structuredClone(slot.prescriptions.A), status: 'completed', movementReason: 'base_routine',
      completedAt: '2026-07-20T10:35:00Z',
      sets: [{ id: createId('set'), setIndex: 0, load: slot.plannedLoad, reps: 6, durationSeconds: null, distanceMetres: null, unit: 'kg', warmUp: false, kind: 'prescribed', completedAt: '2026-07-20T10:30:00Z' }],
    }],
  };
}

describe('Phase 2 routine management', () => {
  it('creates immutable versions when reordering and moving slots', () => {
    const database = createSeedDatabase();
    const original = routine(database);
    const slot = original.days[0]!.slots[1]!;
    const reordered = reorderRoutineSlot(database, slot.id, -1);
    expect(reordered.routineVersions).toHaveLength(2);
    expect(routine(reordered).days[0]!.slots[0]!.id).toBe(slot.id);
    expect(original.days[0]!.slots[0]!.id).not.toBe(slot.id);

    const moved = moveRoutineSlot(reordered, slot.id, 'π');
    expect(routine(moved).days[0]!.slots.some((item) => item.id === slot.id)).toBe(false);
    expect(routine(moved).days[2]!.slots.at(-1)?.id).toBe(slot.id);
  });

  it('archives an exercise without mutating the previous routine', () => {
    const database = createSeedDatabase();
    const slot = routine(database).days[0]!.slots[0]!;
    const updated = archiveExercise(database, slot.exerciseId);
    expect(updated.exercises.find((item) => item.id === slot.exerciseId)?.archived).toBe(true);
    expect(routine(updated).days.some((day) => day.slots.some((item) => item.exerciseId === slot.exerciseId))).toBe(false);
    expect(database.exercises.find((item) => item.id === slot.exerciseId)?.archived).toBe(false);
  });
});

describe('Phase 2 session management', () => {
  it('adds and removes a distinguished additional set', () => {
    const database = createSeedDatabase();
    const session = completedSession(database);
    const withSession = { ...database, sessions: [session] };
    const exercise = session.exercises[0]!;
    const added = addSessionSet(withSession, session.id, exercise.id);
    expect(added.sessions[0]!.exercises[0]!.sets[1]!.kind).toBe('additional');
    const extraId = added.sessions[0]!.exercises[0]!.sets[1]!.id;
    const removed = removeSessionSet(added, session.id, exercise.id, extraId);
    expect(removed.sessions[0]!.exercises[0]!.sets).toHaveLength(1);
    expect(removed.sessions[0]!.exercises[0]!.sets[0]!.setIndex).toBe(0);
  });

  it('excludes, discards and restores cycle evidence', () => {
    const database = createSeedDatabase();
    const session = completedSession(database);
    const withSession = { ...database, sessions: [session], cycles: database.cycles.map((cycle) => ({ ...cycle, completedCoreDays: ['ψ'] as ['ψ'] })) };
    const excluded = setSessionExcluded(withSession, session.id, true);
    expect(excluded.sessions[0]!.excludedFromInsights).toBe(true);
    const discarded = discardSession(excluded, session.id);
    expect(discarded.sessions[0]!.status).toBe('discarded');
    expect(discarded.cycles[0]!.completedCoreDays).toEqual([]);
    const restored = restoreDiscardedSession(discarded, session.id);
    expect(restored.sessions[0]!.status).toBe('completed');
    expect(restored.cycles[0]!.completedCoreDays).toEqual(['ψ']);
  });
});
