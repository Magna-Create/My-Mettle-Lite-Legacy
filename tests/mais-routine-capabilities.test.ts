import { describe, expect, it } from 'vitest';
import { GymAppService } from '../src/application/GymAppService';
import { createMaisAddExerciseExecutor, createMaisRoutineChangeSetExecutor } from '../src/application/MaisRoutineCapabilities';
import type { GymRepository } from '../src/adapters/storage/GymRepository';
import { createSeedDatabase } from '../src/data/seed';
import type { AppDatabase } from '../src/domain/model';
import { MaisCapabilityBus } from '../src/mais/capabilityProtocol';

function environment() {
  let database = createSeedDatabase();
  const repository: GymRepository = {
    async load() { return database; },
    async save(next) { database = structuredClone(next); },
    async clear() { database = createSeedDatabase(); },
  };
  const service = new GymAppService(repository);
  return {
    readDatabase: () => database,
    async persist(next: AppDatabase) {
      database = await service.persist(next);
      return database;
    },
    async addExercise(current: AppDatabase, input: Parameters<GymAppService['addExerciseToRoutine']>[1]) {
      database = await service.addExerciseToRoutine(current, input);
      return database;
    },
  };
}

describe('MAIS routine capability executors', () => {
  it('executes an exactly approved move through immutable routine history and can revert it', async () => {
    const app = environment();
    const before = app.readDatabase();
    const baseRoutine = before.routineVersions.find((routine) => routine.id === before.currentRoutineVersionId)!;
    const slot = baseRoutine.days.find((day) => day.symbol === 'ψ')!.slots[0]!;
    const bus = new MaisCapabilityBus();
    bus.register({
      id: 'routine.apply_change_set',
      kind: 'action',
      description: 'Apply approved routine operations.',
      authorityLevel: 3,
      reversible: true,
      inputSchema: 'MaisRoutineChangeSetV1',
      outputSchema: 'MaisRoutineChangeResultV1',
    }, createMaisRoutineChangeSetExecutor(app));

    const proposal = bus.propose('routine.apply_change_set', 'Test a cross-day order change.', {
      baseRoutineVersionId: baseRoutine.id,
      operations: [{ type: 'move_slot', slotId: slot.id, targetDay: 'φ', targetIndex: 0 }],
    });
    bus.approve(proposal.id, proposal.payloadFingerprint);
    const execution = await bus.execute(proposal.id);

    const changed = app.readDatabase();
    expect(changed.currentRoutineVersionId).not.toBe(baseRoutine.id);
    expect(changed.routineVersions).toHaveLength(before.routineVersions.length + 1);
    expect(changed.routineVersions.find((routine) => routine.id === changed.currentRoutineVersionId)?.days.find((day) => day.symbol === 'φ')?.slots[0]?.id).toBe(slot.id);

    await bus.revert(execution.id);
    const restored = app.readDatabase();
    const restoredRoutine = restored.routineVersions.find((routine) => routine.id === restored.currentRoutineVersionId)!;
    expect(restoredRoutine.days.map((day) => day.slots.map((candidate) => candidate.id))).toEqual(baseRoutine.days.map((day) => day.slots.map((candidate) => candidate.id)));
  });

  it('adds a proposed exercise through GymAppService and archives it on rollback', async () => {
    const app = environment();
    const before = app.readDatabase();
    const bus = new MaisCapabilityBus();
    bus.register({
      id: 'exercise.add_to_routine',
      kind: 'action',
      description: 'Add an approved exercise draft.',
      authorityLevel: 3,
      reversible: true,
      inputSchema: 'MaisAddExerciseV1',
      outputSchema: 'MaisAddExerciseResultV1',
    }, createMaisAddExerciseExecutor(app));

    const proposal = bus.propose('exercise.add_to_routine', 'Test an additional rear-delt movement.', {
      baseRoutineVersionId: before.currentRoutineVersionId,
      exercise: {
        name: 'Cable rear-delt fly',
        day: 'π',
        importance: 'accessory',
        tracking: { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' },
        startingValue: 10,
        targetValue: 8,
        progressionStep: 1,
      },
    });
    bus.approve(proposal.id, proposal.payloadFingerprint);
    const execution = await bus.execute(proposal.id);
    const exerciseId = execution.result.exerciseId as string;
    expect(app.readDatabase().exercises.find((exercise) => exercise.id === exerciseId)?.archived).toBe(false);

    await bus.revert(execution.id);
    expect(app.readDatabase().exercises.find((exercise) => exercise.id === exerciseId)?.archived).toBe(true);
  });
});
