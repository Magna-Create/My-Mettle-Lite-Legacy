import { createId } from '../domain/ids';
import type { AppDatabase, CoreDay, DaySymbol, Mode, Session, SessionExercise, SetRecord, TrainingCycle } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import { isAndEligible } from '../domain/rules/cycle';
import { healthClientRecordId } from '../health/HealthDataProvider';
import { suggestedSetLoad } from './sessionLoadPrefill';

const timestamp = () => new Date().toISOString();

function currentRoutine(database: AppDatabase) {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) throw new Error('Current routine version is missing.');
  return routine;
}

function currentCycle(database: AppDatabase): TrainingCycle {
  const cycle = database.cycles.find((candidate) => candidate.id === database.currentCycleId);
  if (!cycle) throw new Error('Current training cycle is missing.');
  return cycle;
}

function latestBodyweight(database: AppDatabase, at: string): number | null {
  const measurement = [...database.bodyMeasurements]
    .filter((candidate) => candidate.recordedAt <= at && typeof candidate.weightKg === 'number')
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  return measurement?.weightKg ?? null;
}

export function beginLiteSession(database: AppDatabase, day: DaySymbol, mode: Mode): AppDatabase {
  if (database.activeSessionId) throw new Error('An active session already exists.');

  let workingDatabase = database;
  let cycle = currentCycle(workingDatabase);

  if (day === '&' && !isAndEligible(cycle)) {
    throw new Error('& remains locked until ψ, φ and π are complete.');
  }

  if (day !== '&' && cycle.completedCoreDays.length === 3) {
    const closedAt = timestamp();
    const nextCycle: TrainingCycle = {
      id: createId('cycle'),
      startedAt: closedAt,
      status: 'active',
      completedCoreDays: [],
      andCompleted: false,
      schemaVersion: SCHEMA_VERSION,
    };
    workingDatabase = {
      ...workingDatabase,
      cycles: [
        ...workingDatabase.cycles.map((candidate) => candidate.id === cycle.id
          ? { ...candidate, status: 'closed' as const, endedAt: closedAt }
          : candidate),
        nextCycle,
      ],
      currentCycleId: nextCycle.id,
    };
    cycle = nextCycle;
  }

  const routine = currentRoutine(workingDatabase);
  const routineDay = routine.days.find((candidate) => candidate.symbol === day);
  if (!routineDay) throw new Error(`Routine day ${day} is missing.`);

  const sessionStartedAt = timestamp();
  const bodyweightSnapshotKg = latestBodyweight(workingDatabase, sessionStartedAt);
  const exercises: SessionExercise[] = routineDay.slots
    .filter((slot) => slot.prescriptions[mode].included)
    .map((slot) => {
      const exercise = workingDatabase.exercises.find((candidate) => candidate.id === slot.exerciseId);
      if (!exercise) throw new Error(`Exercise ${slot.exerciseId} is missing.`);
      const prescription = structuredClone(slot.prescriptions[mode]);
      const startsWithLoad = exercise.tracking.metric === 'load_reps'
        && exercise.tracking.loadRelationship !== 'bodyweight';
      const sets: SetRecord[] = Array.from({ length: prescription.sets }, (_, setIndex) => ({
        id: createId('set'),
        setIndex,
        load: startsWithLoad
          ? suggestedSetLoad({
              database: workingDatabase,
              exercise,
              setIndex,
              fallbackLoad: slot.plannedLoad,
            })
          : null,
        reps: null,
        durationSeconds: null,
        distanceMetres: null,
        unit: exercise.defaultUnit,
        warmUp: false,
      }));
      const plannedLoad = startsWithLoad
        ? sets[0]?.load ?? slot.plannedLoad
        : slot.plannedLoad;

      return {
        id: createId('session_exercise'),
        exerciseId: exercise.id,
        slotId: slot.id,
        exerciseNameSnapshot: exercise.name,
        importanceSnapshot: slot.importance,
        trackingSnapshot: structuredClone(exercise.tracking),
        bodyweightSnapshotKg,
        plannedLoad,
        prescription,
        status: 'planned',
        sets,
        movementReason: 'base_routine',
      };
    });

  const sessionId = createId('session');
  const session: Session = {
    id: sessionId,
    cycleId: cycle.id,
    day,
    mode,
    routineVersionId: routine.id,
    status: 'active',
    startedAt: sessionStartedAt,
    bodyweightSnapshotKg,
    exercises,
    healthExportState: 'not_requested',
    healthClientRecordId: healthClientRecordId(sessionId),
    schemaVersion: SCHEMA_VERSION,
  };

  return {
    ...workingDatabase,
    sessions: [...workingDatabase.sessions, session],
    activeSessionId: session.id,
  };
}

export function completeLiteSession(database: AppDatabase, sessionId: string): AppDatabase {
  const session = database.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error('Session not found.');

  const completedAt = timestamp();
  const completedSession: Session = {
    ...session,
    status: 'completed',
    completedAt,
    healthExportState: 'queued',
    exercises: session.exercises.map((exercise) =>
      exercise.status === 'planned' || exercise.status === 'active'
        ? { ...exercise, status: 'completed' as const, completedAt }
        : exercise),
  };

  const sessions = database.sessions.map((candidate) => candidate.id === sessionId ? completedSession : candidate);
  let cycles = [...database.cycles];
  let currentCycleId = database.currentCycleId;
  const cycle = cycles.find((candidate) => candidate.id === completedSession.cycleId);
  if (!cycle) throw new Error('Session training cycle is missing.');

  if (completedSession.day === '&') {
    cycles = cycles.map((candidate) => candidate.id === cycle.id
      ? { ...candidate, andCompleted: true, status: 'closed' as const, endedAt: completedAt }
      : candidate);
    const nextCycle: TrainingCycle = {
      id: createId('cycle'),
      startedAt: completedAt,
      status: 'active',
      completedCoreDays: [],
      andCompleted: false,
      schemaVersion: SCHEMA_VERSION,
    };
    cycles.push(nextCycle);
    currentCycleId = nextCycle.id;
  } else {
    const day = completedSession.day as CoreDay;
    cycles = cycles.map((candidate) => candidate.id === cycle.id && !candidate.completedCoreDays.includes(day)
      ? { ...candidate, completedCoreDays: [...candidate.completedCoreDays, day] }
      : candidate);
  }

  return {
    ...database,
    sessions,
    cycles,
    currentCycleId,
    activeSessionId: null,
  };
}
