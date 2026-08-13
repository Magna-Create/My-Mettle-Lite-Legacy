import { describe, expect, it } from 'vitest';
import { InMemoryGymRepository } from '../src/adapters/storage/InMemoryGymRepository';
import { GymAppService } from '../src/application/GymAppService';

describe('session load prefill', () => {
  it('preserves set-by-set loads and only progresses completed sets in the 6–8 rep band', async () => {
    const service = new GymAppService(new InMemoryGymRepository());
    let database = await service.initialise();
    database = await service.beginSession(database, 'ψ', 'A');

    const previousSession = database.sessions.at(-1);
    const previousExercise = previousSession?.exercises.find((candidate) =>
      candidate.trackingSnapshot.metric === 'load_reps'
      && candidate.trackingSnapshot.loadRelationship === 'external'
      && candidate.sets.length >= 3,
    );
    if (!previousSession || !previousExercise) throw new Error('Load exercise missing');

    const exerciseRecord = database.exercises.find((candidate) => candidate.id === previousExercise.exerciseId);
    if (!exerciseRecord) throw new Error('Exercise record missing');

    const previousLoads = [41, 37.5, 32];
    const previousReps = [6, 8, 9];
    for (let index = 0; index < 3; index += 1) {
      const set = previousExercise.sets[index];
      if (!set) throw new Error(`Set ${index} missing`);
      database = await service.updateSet(
        database,
        previousSession.id,
        previousExercise.id,
        set.id,
        { load: previousLoads[index]!, reps: previousReps[index]! },
      );
    }
    database = await service.completeSession(database, previousSession.id);

    database = await service.beginSession(database, 'ψ', 'A');
    const nextSession = database.sessions.at(-1);
    const nextExercise = nextSession?.exercises.find((candidate) => candidate.exerciseId === previousExercise.exerciseId);
    if (!nextExercise) throw new Error('Next exercise missing');

    expect(nextExercise.sets[0]?.load).toBe(previousLoads[0]! + exerciseRecord.progressionStep);
    expect(nextExercise.sets[1]?.load).toBe(previousLoads[1]! + exerciseRecord.progressionStep);
    expect(nextExercise.sets[2]?.load).toBe(previousLoads[2]);
    expect(nextExercise.plannedLoad).toBe(nextExercise.sets[0]?.load);
  });

  it('reduces assistance per eligible set instead of increasing it', async () => {
    const service = new GymAppService(new InMemoryGymRepository());
    let database = await service.initialise();
    database = await service.addExerciseToRoutine(database, {
      name: 'Set-aware assisted pull-up',
      day: 'ψ',
      importance: 'accessory',
      tracking: {
        metric: 'load_reps',
        loadRelationship: 'assistance',
        entryBasis: 'total',
      },
      startingValue: 30,
      targetValue: 6,
      progressionStep: 2.5,
    });
    database = await service.beginSession(database, 'ψ', 'A');

    const previousSession = database.sessions.at(-1);
    const previousExercise = previousSession?.exercises.find(
      (candidate) => candidate.exerciseNameSnapshot === 'Set-aware assisted pull-up',
    );
    if (!previousSession || !previousExercise) throw new Error('Assisted exercise missing');

    const loads = [30, 25, 20];
    const reps = [6, 7, 5];
    for (let index = 0; index < 3; index += 1) {
      const set = previousExercise.sets[index];
      if (!set) throw new Error(`Set ${index} missing`);
      database = await service.updateSet(
        database,
        previousSession.id,
        previousExercise.id,
        set.id,
        { load: loads[index]!, reps: reps[index]! },
      );
    }
    database = await service.completeSession(database, previousSession.id);

    database = await service.beginSession(database, 'ψ', 'A');
    const nextSession = database.sessions.at(-1);
    const nextExercise = nextSession?.exercises.find(
      (candidate) => candidate.exerciseId === previousExercise.exerciseId,
    );
    if (!nextExercise) throw new Error('Next assisted exercise missing');

    expect(nextExercise.sets.map((set) => set.load)).toEqual([27.5, 22.5, 20]);
  });
});
