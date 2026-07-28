import { describe, expect, it } from 'vitest';
import { beginLiteSession, completeLiteSession } from '../src/application/LiteSessionService';
import { createSeedDatabase } from '../src/data/seed';
import type { Experiment } from '../src/domain/model';
import { SCHEMA_VERSION } from '../src/domain/model';

function activeExperimentForFirstSlot(): { database: ReturnType<typeof createSeedDatabase>; experiment: Experiment } {
  const database = createSeedDatabase();
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId)!;
  const slot = routine.days.find((day) => day.symbol === 'ψ')!.slots[0]!;
  const exercise = database.exercises.find((candidate) => candidate.id === slot.exerciseId)!;
  const experiment: Experiment = {
    id: 'legacy-experiment',
    exerciseId: exercise.id,
    routineSlotId: slot.id,
    exerciseName: exercise.name,
    hypothesis: 'Legacy proposal that Lite must ignore.',
    baselineLoad: slot.plannedLoad,
    proposedLoad: slot.plannedLoad + 50,
    targetRepMin: slot.prescriptions.A.repMin,
    status: 'active',
    createdAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
  database.experiments = [experiment];
  return { database, experiment };
}

describe('Lite workout lifecycle', () => {
  it('starts from the static routine and ignores legacy experiments', () => {
    const { database, experiment } = activeExperimentForFirstSlot();
    const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId)!;
    const slot = routine.days.find((day) => day.symbol === 'ψ')!.slots[0]!;
    const next = beginLiteSession(database, 'ψ', 'A');
    const session = next.sessions.find((candidate) => candidate.id === next.activeSessionId)!;
    const firstExercise = session.exercises[0]!;

    expect(firstExercise.plannedLoad).toBe(slot.plannedLoad);
    expect(firstExercise.plannedLoad).not.toBe(experiment.proposedLoad);
    expect(firstExercise.movementReason).toBe('base_routine');
    expect(firstExercise.sets).toHaveLength(slot.prescriptions.A.sets);
  });

  it('completes a core day without generating or mutating experiments', () => {
    const { database, experiment } = activeExperimentForFirstSlot();
    const started = beginLiteSession(database, 'ψ', 'A');
    const completed = completeLiteSession(started, started.activeSessionId!);
    const cycle = completed.cycles.find((candidate) => candidate.id === completed.currentCycleId)!;

    expect(completed.activeSessionId).toBeNull();
    expect(completed.sessions.at(-1)?.status).toBe('completed');
    expect(cycle.completedCoreDays).toEqual(['ψ']);
    expect(completed.experiments).toEqual([experiment]);
  });

  it('keeps the optional day locked until all three core days are complete', () => {
    const database = createSeedDatabase();
    expect(() => beginLiteSession(database, '&', 'A')).toThrow('& remains locked');

    const cycle = database.cycles.find((candidate) => candidate.id === database.currentCycleId)!;
    cycle.completedCoreDays = ['ψ', 'φ', 'π'];
    const started = beginLiteSession(database, '&', 'A');
    const completed = completeLiteSession(started, started.activeSessionId!);

    expect(started.sessions.at(-1)?.day).toBe('&');
    expect(completed.currentCycleId).not.toBe(cycle.id);
    expect(completed.cycles.find((candidate) => candidate.id === cycle.id)?.andCompleted).toBe(true);
  });
});
