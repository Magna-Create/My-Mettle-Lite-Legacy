import { describe, expect, it } from 'vitest';
import { InMemoryGymRepository } from '../src/adapters/storage/InMemoryGymRepository';
import { GymAppService } from '../src/application/GymAppService';

describe('vertical slice', () => {
  it('creates a session and persists set input', async () => {
    const service = new GymAppService(new InMemoryGymRepository());
    let database = await service.initialise();
    database = await service.beginSession(database, 'ψ', 'A');
    const session = database.sessions[0];
    const exercise = session?.exercises[0];
    const set = exercise?.sets[0];
    expect(session).toBeDefined();
    expect(exercise).toBeDefined();
    expect(set).toBeDefined();
    if (!session || !exercise || !set) throw new Error('Seed session incomplete');
    database = await service.updateSet(database, session.id, exercise.id, set.id, { reps: 6 });
    expect(database.sessions[0]?.exercises[0]?.sets[0]?.reps).toBe(6);
  });

  it('creates a new routine version when an exercise is added', async () => {
    const service = new GymAppService(new InMemoryGymRepository());
    let database = await service.initialise();
    database = await service.addExerciseToRoutine(database, {
      name: 'Cable fly',
      day: 'ψ',
      importance: 'accessory',
      tracking: {
        metric: 'load_reps',
        loadRelationship: 'external',
        entryBasis: 'total',
      },
      startingValue: 10,
      targetValue: 8,
      progressionStep: 1,
    });
    expect(database.routineVersions).toHaveLength(2);
    expect(database.routineVersions.at(-1)?.source).toBe('manual_edit');
  });
});

it('carries a micro-load experiment through tested exposure and explicit routine promotion', async () => {
  const service = new GymAppService(new InMemoryGymRepository());
  let database = await service.initialise();
  database = await service.beginSession(database, 'ψ', 'A');

  let session = database.sessions.at(-1);
  if (!session) throw new Error('Session missing');
  const principal = session.exercises[0];
  if (!principal) throw new Error('Principal exercise missing');
  for (const set of principal.sets) {
    database = await service.updateSet(database, session.id, principal.id, set.id, { reps: 6 });
  }
  database = await service.completeSession(database, session.id);

  const proposal = database.experiments.find((experiment) => experiment.exerciseId === principal.exerciseId);
  expect(proposal?.status).toBe('proposed');
  if (!proposal) throw new Error('Proposal missing');

  database = await service.activateExperiment(database, proposal.id);
  database = await service.beginSession(database, 'ψ', 'A');
  session = database.sessions.at(-1);
  if (!session) throw new Error('Test session missing');
  const tested = session.exercises.find((exercise) => exercise.exerciseId === principal.exerciseId);
  if (!tested) throw new Error('Tested exercise missing');
  expect(tested.plannedLoad).toBe(proposal.proposedLoad);

  for (const set of tested.sets) {
    database = await service.updateSet(database, session.id, tested.id, set.id, { reps: 6 });
  }
  database = await service.completeSession(database, session.id);
  expect(database.experiments.find((experiment) => experiment.id === proposal.id)?.status).toBe('ready_for_decision');

  database = await service.promoteExperiment(database, proposal.id);
  expect(database.routineVersions).toHaveLength(2);
  expect(database.routineVersions.at(-1)?.source).toBe('experiment_promotion');
  const promotedSlot = database.routineVersions.at(-1)?.days
    .flatMap((day) => day.slots)
    .find((slot) => slot.exerciseId === principal.exerciseId);
  expect(promotedSlot?.plannedLoad).toBe(proposal.proposedLoad);
});

it('reduces assistance when an assisted bodyweight experiment is proposed', async () => {
  const service = new GymAppService(new InMemoryGymRepository());
  let database = await service.initialise();
  database = await service.addBodyMeasurement(database, {
    recordedAt: new Date('2026-07-20T09:00:00Z').toISOString(),
    weightKg: 80,
    heightCm: 168,
  });
  database = await service.addExerciseToRoutine(database, {
    name: 'Assisted pull-up',
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
  const session = database.sessions.at(-1);
  const assisted = session?.exercises.find((exercise) => exercise.exerciseNameSnapshot === 'Assisted pull-up');
  if (!session || !assisted) throw new Error('Assisted exercise missing');

  expect(session.bodyweightSnapshotKg).toBe(80);
  for (const set of assisted.sets) {
    database = await service.updateSet(database, session.id, assisted.id, set.id, { reps: 6 });
  }
  database = await service.completeSession(database, session.id);

  const proposal = database.experiments.find((experiment) => experiment.exerciseId === assisted.exerciseId);
  expect(proposal?.baselineLoad).toBe(30);
  expect(proposal?.proposedLoad).toBe(27.5);
});

it('opens a new cycle when a core day begins after ψ, φ and π are complete', async () => {
  const service = new GymAppService(new InMemoryGymRepository());
  let database = await service.initialise();
  const originalCycleId = database.currentCycleId;

  for (const day of ['ψ', 'φ', 'π'] as const) {
    database = await service.beginSession(database, day, 'C');
    const session = database.sessions.at(-1);
    if (!session) throw new Error('Session missing');
    database = await service.completeSession(database, session.id);
  }

  expect(database.cycles.find((cycle) => cycle.id === originalCycleId)?.completedCoreDays).toEqual(['ψ', 'φ', 'π']);
  database = await service.beginSession(database, 'ψ', 'C');
  expect(database.currentCycleId).not.toBe(originalCycleId);
  expect(database.cycles.find((cycle) => cycle.id === originalCycleId)?.status).toBe('closed');
  expect(database.cycles.find((cycle) => cycle.id === database.currentCycleId)?.completedCoreDays).toEqual([]);
});
