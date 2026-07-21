import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { createId } from '../src/domain/ids';
import type { Session } from '../src/domain/model';
import type { MaisRoleRequest } from '../src/mais/contracts';
import { compileTrainingEvidence } from '../src/mais/trainingEvidence';

function request(sessionId: string): MaisRoleRequest {
  return {
    task: {
      id: 'task_1',
      goal: 'Integrate completed training evidence.',
      triggerEventIds: ['event_1'],
      priority: 0.82,
      requiredTier: 'light',
      status: 'running',
      steps: [],
      currentStepIndex: 0,
      createdAt: '2026-07-21T03:00:00.000Z',
      updatedAt: '2026-07-21T03:00:00.000Z',
      attempts: 1,
    },
    step: {
      id: 'step_1',
      role: 'governor',
      goal: 'Plan evidence integration.',
      requiredTier: 'light',
      outputSchema: 'MaisInvestigationPlanV1',
      status: 'running',
    },
    triggerEvents: [{
      id: 'event_1',
      type: 'session_completed',
      occurredAt: '2026-07-21T03:00:00.000Z',
      recordedAt: '2026-07-21T03:00:00.000Z',
      entityRefs: [sessionId],
      payload: { sessionId },
      processedByTaskIds: [],
      stateVersion: 1,
    }],
    taskArtifacts: [],
    resourceMode: 'full',
  };
}

function databaseWithCompletedSession() {
  const database = createSeedDatabase();
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId)!;
  const slot = routine.days[0]!.slots[0]!;
  const exercise = database.exercises.find((item) => item.id === slot.exerciseId)!;
  const session: Session = {
    id: createId('session'),
    cycleId: database.currentCycleId,
    day: routine.days[0]!.symbol,
    mode: 'A',
    routineVersionId: routine.id,
    status: 'completed',
    startedAt: '2026-07-21T01:00:00.000Z',
    completedAt: '2026-07-21T02:00:00.000Z',
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
      sets: [{
        id: createId('set'),
        setIndex: 0,
        load: slot.plannedLoad,
        reps: 8,
        durationSeconds: null,
        distanceMetres: null,
        unit: exercise.defaultUnit,
        warmUp: false,
        kind: 'prescribed',
        completedAt: '2026-07-21T01:20:00.000Z',
      }],
      reflection: {
        targetMuscleEngagement: 6,
        execution: 'clean',
        enjoyment: 5,
        comfort: 'good',
        recordedAt: '2026-07-21T02:00:00.000Z',
        updatedAt: '2026-07-21T02:00:00.000Z',
      },
      movementReason: 'base_routine',
    }],
    schemaVersion: database.schemaVersion,
  };
  return { database: { ...database, sessions: [session], updatedAt: '2026-07-21T02:01:00.000Z' }, session, exercise, routine };
}

describe('MAIS training evidence compiler', () => {
  it('resolves a completed session into typed sets, reflection, exercise and routine evidence', () => {
    const { database, session, exercise, routine } = databaseWithCompletedSession();
    const packet = compileTrainingEvidence(database, request(session.id));
    expect(packet.sessions[0]?.id).toBe(session.id);
    expect(packet.sessions[0]?.exercises[0]?.sets[0]).toMatchObject({ reps: 8, warmUp: false });
    expect(packet.sessions[0]?.exercises[0]?.reflection).toMatchObject({ execution: 'clean', targetMuscleEngagement: 6 });
    expect(packet.exercises[0]?.id).toBe(exercise.id);
    expect(packet.routines.some((item) => item.id === routine.id)).toBe(true);
    expect(packet.comparableExposures[exercise.id]).toHaveLength(1);
  });

  it('marks excluded direct sessions without removing the source evidence', () => {
    const { database, session } = databaseWithCompletedSession();
    database.sessions[0] = { ...database.sessions[0]!, excludedFromInsights: true };
    const packet = compileTrainingEvidence(database, request(session.id));
    expect(packet.sessions).toHaveLength(1);
    expect(packet.warnings.join(' ')).toContain('excluded');
    expect(packet.comparableExposures[session.exercises[0]!.exerciseId]).toHaveLength(0);
  });
});
