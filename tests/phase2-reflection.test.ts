import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { createId } from '../src/domain/ids';
import type { Session } from '../src/domain/model';
import { saveExerciseReflection } from '../src/application/ExerciseReflectionManagement';
import { removeRoutineSlotWithArchive } from '../src/application/removeRoutineSlotWithArchive';

function currentRoutine(database: ReturnType<typeof createSeedDatabase>) {
  return database.routineVersions.find((item) => item.id === database.currentRoutineVersionId)!;
}

function databaseWithSession() {
  const database = createSeedDatabase();
  const slot = currentRoutine(database).days[0]!.slots[0]!;
  const exercise = database.exercises.find((item) => item.id === slot.exerciseId)!;
  const session: Session = {
    id: createId('session'),
    cycleId: database.currentCycleId,
    day: 'ψ',
    mode: 'A',
    routineVersionId: database.currentRoutineVersionId,
    status: 'completed',
    startedAt: '2026-07-20T10:00:00Z',
    completedAt: '2026-07-20T11:00:00Z',
    bodyweightSnapshotKg: 70,
    exercises: [{
      id: createId('session_exercise'),
      exerciseId: exercise.id,
      slotId: slot.id,
      exerciseNameSnapshot: exercise.name,
      importanceSnapshot: slot.importance,
      trackingSnapshot: structuredClone(exercise.tracking),
      bodyweightSnapshotKg: 70,
      plannedLoad: slot.plannedLoad,
      prescription: structuredClone(slot.prescriptions.A),
      status: 'completed',
      sets: [],
      movementReason: 'base_routine',
    }],
    schemaVersion: database.schemaVersion,
  };
  return { database: { ...database, sessions: [session] }, session };
}

describe('exercise reflection', () => {
  it('stores experience, vibe and the optional note on the session exercise', () => {
    const { database, session } = databaseWithSession();
    const exercise = session.exercises[0]!;
    const updated = saveExerciseReflection(database, session.id, exercise.id, {
      targetMuscleEngagement: 6,
      execution: 'clean',
      enjoyment: 5,
      comfort: 'good',
      note: 'Seat one notch lower next time.',
    });

    expect(updated.sessions[0]!.exercises[0]!.reflection).toMatchObject({
      targetMuscleEngagement: 6,
      execution: 'clean',
      enjoyment: 5,
      comfort: 'good',
      note: 'Seat one notch lower next time.',
    });
    expect(updated.sessions[0]!.editedAt).toBeTruthy();
  });

  it('accepts zero as the broad end of target engagement', () => {
    const { database, session } = databaseWithSession();
    const exercise = session.exercises[0]!;
    const updated = saveExerciseReflection(database, session.id, exercise.id, {
      targetMuscleEngagement: 0,
      execution: 'mixed',
      enjoyment: 4,
      comfort: 'fine',
    });
    expect(updated.sessions[0]!.exercises[0]!.reflection?.targetMuscleEngagement).toBe(0);
  });

  it('keeps enjoyment on its one-to-seven scale', () => {
    const { database, session } = databaseWithSession();
    const exercise = session.exercises[0]!;
    expect(() => saveExerciseReflection(database, session.id, exercise.id, {
      targetMuscleEngagement: 5,
      execution: 'clean',
      enjoyment: 0 as never,
      comfort: 'good',
    })).toThrow('Enjoyment must be between 1 and 7 or marked unsure.');
  });

  it('accepts unsure without inventing a middle score', () => {
    const { database, session } = databaseWithSession();
    const exercise = session.exercises[0]!;
    const updated = saveExerciseReflection(database, session.id, exercise.id, {
      targetMuscleEngagement: 'unsure',
      execution: 'unsure',
      enjoyment: 'unsure',
      comfort: 'unsure',
    });
    expect(updated.sessions[0]!.exercises[0]!.reflection).toMatchObject({
      targetMuscleEngagement: 'unsure',
      execution: 'unsure',
      enjoyment: 'unsure',
      comfort: 'unsure',
    });
  });
});

describe('routine slot removal', () => {
  it('archives an exercise when its final active routine occurrence is removed', () => {
    const database = createSeedDatabase();
    const slot = currentRoutine(database).days[0]!.slots[0]!;
    const updated = removeRoutineSlotWithArchive(database, slot.id);
    expect(updated.exercises.find((item) => item.id === slot.exerciseId)?.archived).toBe(true);
  });

  it('keeps an exercise active when another slot still uses it', () => {
    const database = createSeedDatabase();
    const routine = currentRoutine(database);
    const slot = routine.days[0]!.slots[0]!;
    routine.days[1]!.slots.push({ ...structuredClone(slot), id: createId('slot'), position: routine.days[1]!.slots.length });
    const updated = removeRoutineSlotWithArchive(database, slot.id);
    expect(updated.exercises.find((item) => item.id === slot.exerciseId)?.archived).toBe(false);
  });
});
