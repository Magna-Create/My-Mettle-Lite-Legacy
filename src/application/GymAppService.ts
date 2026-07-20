import { createSeedDatabase } from '../data/seed';
import { createId } from '../domain/ids';
import { migrateDatabase } from '../domain/migrations';
import type {
  AppDatabase,
  AppSettings,
  BodyMeasurement,
  CoreDay,
  DaySymbol,
  EntryBasis,
  ExerciseTrackingProfile,
  Experiment,
  Importance,
  Mode,
  RoutineDay,
  RoutineSlot,
  Session,
  SessionExercise,
  SetRecord,
  TrainingCycle,
} from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import { isAndEligible } from '../domain/rules/cycle';
import { calculateExercisePerformance } from '../domain/rules/performance';
import { isSetComplete } from '../domain/tracking';
import { healthClientRecordId } from '../health/HealthDataProvider';
import type { GymRepository } from '../adapters/storage/GymRepository';

const timestamp = () => new Date().toISOString();

export interface AddExerciseInput {
  name: string;
  day: DaySymbol;
  importance: Importance;
  tracking: ExerciseTrackingProfile;
  startingValue: number;
  targetValue: number;
  progressionStep: number;
}

function latestBodyweight(database: AppDatabase, at = timestamp()): number | null {
  const measurement = [...database.bodyMeasurements]
    .filter((candidate) => candidate.recordedAt <= at && typeof candidate.weightKg === 'number')
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  return measurement?.weightKg ?? null;
}

function progressionProposal(
  relationship: ExerciseTrackingProfile['loadRelationship'],
  baseline: number,
  step: number,
): number {
  return relationship === 'assistance'
    ? Math.max(0, baseline - step)
    : baseline + step;
}

function progressionHypothesis(
  name: string,
  relationship: ExerciseTrackingProfile['loadRelationship'],
  baseline: number,
  proposed: number,
): string {
  if (relationship === 'assistance') {
    return `${name} can preserve the current repetition target with assistance reduced from ${baseline} kg to ${proposed} kg.`;
  }
  return `${name} can preserve the current clean repetition target after moving from ${baseline} kg to ${proposed} kg.`;
}

export class GymAppService {
  constructor(private readonly repository: GymRepository) {}

  async initialise(): Promise<AppDatabase> {
    const existing = await this.repository.load();
    if (existing) {
      const migrated = migrateDatabase(existing);
      await this.repository.save(migrated);
      return migrated;
    }
    const seeded = createSeedDatabase();
    await this.repository.save(seeded);
    return seeded;
  }

  async persist(database: AppDatabase): Promise<AppDatabase> {
    const next = { ...database, updatedAt: timestamp(), schemaVersion: SCHEMA_VERSION };
    await this.repository.save(next);
    return next;
  }

  async reset(): Promise<AppDatabase> {
    await this.repository.clear();
    const seeded = createSeedDatabase();
    await this.repository.save(seeded);
    return seeded;
  }

  getCurrentRoutine(database: AppDatabase) {
    const routine = database.routineVersions.find(
      (version) => version.id === database.currentRoutineVersionId,
    );
    if (!routine) throw new Error('Current routine version is missing.');
    return routine;
  }

  getCurrentCycle(database: AppDatabase): TrainingCycle {
    const cycle = database.cycles.find((candidate) => candidate.id === database.currentCycleId);
    if (!cycle) throw new Error('Current training cycle is missing.');
    return cycle;
  }

  async beginSession(database: AppDatabase, day: DaySymbol, mode: Mode): Promise<AppDatabase> {
    if (database.activeSessionId) {
      throw new Error('An active session already exists.');
    }

    let workingDatabase = database;
    let cycle = this.getCurrentCycle(workingDatabase);

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
          ...workingDatabase.cycles.map((candidate) =>
            candidate.id === cycle.id
              ? { ...candidate, status: 'closed' as const, endedAt: closedAt }
              : candidate,
          ),
          nextCycle,
        ],
        currentCycleId: nextCycle.id,
      };
      cycle = nextCycle;
    }

    const routine = this.getCurrentRoutine(workingDatabase);
    const routineDay = routine.days.find((candidate) => candidate.symbol === day);
    if (!routineDay) throw new Error(`Routine day ${day} is missing.`);

    const activeExperiments = workingDatabase.experiments.filter(
      (experiment) => experiment.status === 'active',
    );
    const sessionStartedAt = timestamp();
    const bodyweightSnapshotKg = latestBodyweight(workingDatabase, sessionStartedAt);

    const exercises: SessionExercise[] = routineDay.slots
      .filter((slot) => slot.prescriptions[mode].included)
      .map((slot) => {
        const exercise = workingDatabase.exercises.find((candidate) => candidate.id === slot.exerciseId);
        if (!exercise) throw new Error(`Exercise ${slot.exerciseId} is missing.`);
        const experiment = activeExperiments.find(
          (candidate) => candidate.routineSlotId === slot.id,
        );
        const prescription = structuredClone(slot.prescriptions[mode]);
        const plannedLoad = experiment?.proposedLoad ?? slot.plannedLoad;
        const startsWithLoad = exercise.tracking.metric === 'load_reps'
          && exercise.tracking.loadRelationship !== 'bodyweight';
        const sets: SetRecord[] = Array.from({ length: prescription.sets }, (_, setIndex) => ({
          id: createId('set'),
          setIndex,
          load: startsWithLoad ? plannedLoad : null,
          reps: null,
          durationSeconds: null,
          distanceMetres: null,
          unit: exercise.defaultUnit,
          warmUp: false,
        }));

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
          movementReason: experiment ? 'active_experiment' : 'base_routine',
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

    return this.persist({
      ...workingDatabase,
      sessions: [...workingDatabase.sessions, session],
      activeSessionId: session.id,
    });
  }

  async updateSet(
    database: AppDatabase,
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
    patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>,
  ): Promise<AppDatabase> {
    const sessions = database.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        exercises: session.exercises.map((exercise) => {
          if (exercise.id !== sessionExerciseId) return exercise;
          return {
            ...exercise,
            status: exercise.status === 'planned' ? ('active' as const) : exercise.status,
            startedAt: exercise.startedAt ?? timestamp(),
            sets: exercise.sets.map((set) => {
              if (set.id !== setId) return set;
              const updated = { ...set, ...patch };
              return isSetComplete(updated, exercise.trackingSnapshot)
                ? { ...updated, completedAt: set.completedAt ?? timestamp() }
                : { ...updated, completedAt: undefined };
            }),
          };
        }),
      };
    });
    return this.persist({ ...database, sessions });
  }

  async completeExercise(
    database: AppDatabase,
    sessionId: string,
    sessionExerciseId: string,
  ): Promise<AppDatabase> {
    const sessions = database.sessions.map((session) =>
      session.id !== sessionId
        ? session
        : {
            ...session,
            exercises: session.exercises.map((exercise) =>
              exercise.id !== sessionExerciseId
                ? exercise
                : { ...exercise, status: 'completed' as const, completedAt: timestamp() },
            ),
          },
    );
    return this.persist({ ...database, sessions });
  }

  async abandonSession(database: AppDatabase, sessionId: string): Promise<AppDatabase> {
    const session = database.sessions.find((candidate) => candidate.id === sessionId);
    if (!session || session.status !== 'active') throw new Error('Active session not found.');
    return this.persist({
      ...database,
      activeSessionId: null,
      sessions: database.sessions.map((candidate) =>
        candidate.id === sessionId
          ? { ...candidate, status: 'abandoned' as const, completedAt: timestamp() }
          : candidate,
      ),
    });
  }

  async completeSession(database: AppDatabase, sessionId: string): Promise<AppDatabase> {
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
          : exercise,
      ),
    };

    const sessions = database.sessions.map((candidate) =>
      candidate.id === sessionId ? completedSession : candidate,
    );
    let experiments = [...database.experiments];

    for (const exercise of completedSession.exercises) {
      const performance = calculateExercisePerformance(exercise);
      const existingActive = experiments.find(
        (experiment) =>
          experiment.routineSlotId === exercise.slotId && experiment.status === 'active',
      );

      if (existingActive && exercise.plannedLoad === existingActive.proposedLoad) {
        experiments = experiments.map((experiment) =>
          experiment.id !== existingActive.id
            ? experiment
            : {
                ...experiment,
                status: 'ready_for_decision' as const,
                testedSessionId: completedSession.id,
                evidenceSummary: performance.allTargetsMet
                  ? `Target met at the tested value of ${existingActive.proposedLoad} kg.`
                  : `Exposure logged at ${existingActive.proposedLoad} kg, but the prescribed minimum was not met across every work set.`,
              },
        );
        continue;
      }

      const alreadyOpen = experiments.some(
        (experiment) =>
          experiment.routineSlotId === exercise.slotId
          && ['proposed', 'active', 'ready_for_decision'].includes(experiment.status),
      );
      const exerciseRecord = database.exercises.find(
        (candidate) => candidate.id === exercise.exerciseId,
      );
      const loadProgressionSupported = exercise.trackingSnapshot.metric === 'load_reps'
        && ['external', 'assistance', 'bodyweight_plus_external'].includes(
          exercise.trackingSnapshot.loadRelationship,
        );

      if (performance.allTargetsMet && !alreadyOpen && exerciseRecord && loadProgressionSupported) {
        const proposedLoad = progressionProposal(
          exercise.trackingSnapshot.loadRelationship,
          exercise.plannedLoad,
          exerciseRecord.progressionStep,
        );
        if (proposedLoad !== exercise.plannedLoad) {
          const proposal: Experiment = {
            id: createId('experiment'),
            exerciseId: exercise.exerciseId,
            routineSlotId: exercise.slotId,
            exerciseName: exercise.exerciseNameSnapshot,
            hypothesis: progressionHypothesis(
              exercise.exerciseNameSnapshot,
              exercise.trackingSnapshot.loadRelationship,
              exercise.plannedLoad,
              proposedLoad,
            ),
            baselineLoad: exercise.plannedLoad,
            proposedLoad,
            targetRepMin: exercise.prescription.repMin,
            status: 'proposed',
            createdAt: timestamp(),
            schemaVersion: SCHEMA_VERSION,
          };
          experiments.push(proposal);
        }
      }
    }

    let cycles = [...database.cycles];
    let currentCycleId = database.currentCycleId;
    const cycle = cycles.find((candidate) => candidate.id === completedSession.cycleId);
    if (!cycle) throw new Error('Session training cycle is missing.');

    if (completedSession.day === '&') {
      const endedAt = timestamp();
      cycles = cycles.map((candidate) =>
        candidate.id === cycle.id
          ? { ...candidate, andCompleted: true, status: 'closed' as const, endedAt }
          : candidate,
      );
      const nextCycle: TrainingCycle = {
        id: createId('cycle'),
        startedAt: endedAt,
        status: 'active',
        completedCoreDays: [],
        andCompleted: false,
        schemaVersion: SCHEMA_VERSION,
      };
      cycles.push(nextCycle);
      currentCycleId = nextCycle.id;
    } else {
      const day = completedSession.day as CoreDay;
      cycles = cycles.map((candidate) =>
        candidate.id === cycle.id && !candidate.completedCoreDays.includes(day)
          ? { ...candidate, completedCoreDays: [...candidate.completedCoreDays, day] }
          : candidate,
      );
    }

    return this.persist({
      ...database,
      sessions,
      experiments,
      cycles,
      currentCycleId,
      activeSessionId: null,
    });
  }

  async activateExperiment(database: AppDatabase, experimentId: string): Promise<AppDatabase> {
    return this.persist({
      ...database,
      experiments: database.experiments.map((experiment) =>
        experiment.id === experimentId
          ? { ...experiment, status: 'active' as const, activatedAt: timestamp() }
          : experiment,
      ),
    });
  }

  async rejectExperiment(database: AppDatabase, experimentId: string): Promise<AppDatabase> {
    return this.persist({
      ...database,
      experiments: database.experiments.map((experiment) =>
        experiment.id === experimentId
          ? { ...experiment, status: 'rejected' as const }
          : experiment,
      ),
    });
  }

  async promoteExperiment(database: AppDatabase, experimentId: string): Promise<AppDatabase> {
    const experiment = database.experiments.find((candidate) => candidate.id === experimentId);
    if (!experiment || experiment.status !== 'ready_for_decision') {
      throw new Error('This experiment is not ready for promotion.');
    }

    const current = this.getCurrentRoutine(database);
    const nextVersionId = createId('routine_version');
    const days = current.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) =>
        slot.id === experiment.routineSlotId
          ? { ...slot, plannedLoad: experiment.proposedLoad }
          : slot,
      ),
    }));

    const nextVersion = {
      ...current,
      id: nextVersionId,
      version: current.version + 1,
      parentId: current.id,
      createdAt: timestamp(),
      effectiveAt: timestamp(),
      source: 'experiment_promotion' as const,
      changeReason: `Promoted experiment: ${experiment.hypothesis}`,
      days,
      schemaVersion: SCHEMA_VERSION,
    };

    return this.persist({
      ...database,
      routineVersions: [...database.routineVersions, nextVersion],
      currentRoutineVersionId: nextVersionId,
      experiments: database.experiments.map((candidate) =>
        candidate.id === experiment.id
          ? {
              ...candidate,
              status: 'adopted' as const,
              adoptedRoutineVersionId: nextVersionId,
            }
          : candidate,
      ),
    });
  }

  async addExerciseToRoutine(
    database: AppDatabase,
    input: AddExerciseInput,
  ): Promise<AppDatabase> {
    const name = input.name.trim();
    if (!name) throw new Error('Exercise name is required.');
    if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) {
      throw new Error('Target value must be greater than zero.');
    }
    if (!Number.isFinite(input.progressionStep) || input.progressionStep <= 0) {
      throw new Error('Progression step must be greater than zero.');
    }

    const createdAt = timestamp();
    const exerciseId = createId('exercise');
    const exercise = {
      id: exerciseId,
      name,
      archived: false,
      defaultUnit: database.profile.units,
      tracking: structuredClone(input.tracking),
      progressionStep: input.progressionStep,
      createdAt,
      updatedAt: createdAt,
      schemaVersion: SCHEMA_VERSION,
    };
    const slot: RoutineSlot = {
      id: createId('slot'),
      exerciseId,
      position: 999,
      importance: input.importance,
      plannedLoad: input.tracking.metric === 'load_reps' ? input.startingValue : 0,
      lockedToDay: input.importance === 'principal',
      prescriptions: {
        A: {
          mode: 'A', included: true, sets: 3, repMin: input.targetValue, repMax: input.targetValue + 1, restSeconds: 120, deferToAnd: false,
        },
        B: {
          mode: 'B', included: true, sets: 2, repMin: input.targetValue, repMax: input.targetValue + 1, restSeconds: 120, deferToAnd: true,
        },
        C: {
          mode: 'C', included: true, sets: 1, repMin: input.targetValue, repMax: input.targetValue + 1, restSeconds: 120, deferToAnd: true,
        },
      },
    };

    const current = this.getCurrentRoutine(database);
    const nextVersionId = createId('routine_version');
    const days: RoutineDay[] = current.days.map((day) =>
      day.symbol !== input.day
        ? day
        : {
            ...day,
            slots: [...day.slots, { ...slot, position: day.slots.length }],
          },
    );
    const nextVersion = {
      ...current,
      id: nextVersionId,
      version: current.version + 1,
      parentId: current.id,
      createdAt,
      effectiveAt: createdAt,
      source: 'manual_edit' as const,
      changeReason: `Added ${exercise.name} to ${input.day}`,
      days,
      schemaVersion: SCHEMA_VERSION,
    };

    return this.persist({
      ...database,
      exercises: [...database.exercises, exercise],
      routineVersions: [...database.routineVersions, nextVersion],
      currentRoutineVersionId: nextVersionId,
    });
  }

  async addBodyMeasurement(
    database: AppDatabase,
    input: { recordedAt: string; weightKg?: number; heightCm?: number },
  ): Promise<AppDatabase> {
    const weightKg = input.weightKg;
    const heightCm = input.heightCm;
    if (weightKg === undefined && heightCm === undefined) {
      throw new Error('Add a weight or height measurement.');
    }
    if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0)) {
      throw new Error('Weight must be greater than zero.');
    }
    if (heightCm !== undefined && (!Number.isFinite(heightCm) || heightCm <= 0)) {
      throw new Error('Height must be greater than zero.');
    }

    const measurement: BodyMeasurement = {
      id: createId('measurement'),
      recordedAt: input.recordedAt,
      weightKg,
      heightCm,
      source: 'manual',
      schemaVersion: SCHEMA_VERSION,
    };

    return this.persist({
      ...database,
      bodyMeasurements: [...database.bodyMeasurements, measurement]
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt)),
    });
  }

  async updateSettings(
    database: AppDatabase,
    patch: { restTimer?: Partial<AppSettings['restTimer']> },
  ): Promise<AppDatabase> {
    return this.persist({
      ...database,
      settings: {
        ...database.settings,
        restTimer: {
          ...database.settings.restTimer,
          ...patch.restTimer,
        },
        schemaVersion: SCHEMA_VERSION,
      },
    });
  }
}
