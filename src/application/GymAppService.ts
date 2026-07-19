import { createSeedDatabase } from '../data/seed';
import { createId } from '../domain/ids';
import type {
  AppDatabase,
  CoreDay,
  DaySymbol,
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
import type { GymRepository } from '../adapters/storage/GymRepository';

const timestamp = () => new Date().toISOString();

export class GymAppService {
  constructor(private readonly repository: GymRepository) {}

  async initialise(): Promise<AppDatabase> {
    const existing = await this.repository.load();
    if (existing) return existing;
    const seeded = createSeedDatabase();
    await this.repository.save(seeded);
    return seeded;
  }

  async persist(database: AppDatabase): Promise<AppDatabase> {
    const next = { ...database, updatedAt: timestamp() };
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

    const exercises: SessionExercise[] = routineDay.slots
      .filter((slot) => slot.prescriptions[mode].included)
      .map((slot) => {
        const exercise = workingDatabase.exercises.find((candidate) => candidate.id === slot.exerciseId);
        if (!exercise) throw new Error(`Exercise ${slot.exerciseId} is missing.`);
        const experiment = activeExperiments.find(
          (candidate) => candidate.routineSlotId === slot.id,
        );
        const prescription = structuredClone(slot.prescriptions[mode]);
        const sets: SetRecord[] = Array.from({ length: prescription.sets }, (_, setIndex) => ({
          id: createId('set'),
          setIndex,
          load: experiment?.proposedLoad ?? slot.plannedLoad,
          reps: null,
          unit: exercise.defaultUnit,
          warmUp: false,
        }));

        return {
          id: createId('session_exercise'),
          exerciseId: exercise.id,
          slotId: slot.id,
          exerciseNameSnapshot: exercise.name,
          importanceSnapshot: slot.importance,
          plannedLoad: experiment?.proposedLoad ?? slot.plannedLoad,
          prescription,
          status: 'planned',
          sets,
          movementReason: experiment ? 'active_experiment' : 'base_routine',
        };
      });

    const session: Session = {
      id: createId('session'),
      cycleId: cycle.id,
      day,
      mode,
      routineVersionId: routine.id,
      status: 'active',
      startedAt: timestamp(),
      exercises,
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
    patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'note'>>,
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
              return patch.reps !== undefined && patch.reps !== null
                ? { ...updated, completedAt: timestamp() }
                : updated;
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

  async completeSession(database: AppDatabase, sessionId: string): Promise<AppDatabase> {
    const session = database.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error('Session not found.');

    const completedSession: Session = {
      ...session,
      status: 'completed',
      completedAt: timestamp(),
      exercises: session.exercises.map((exercise) =>
        exercise.status === 'planned' || exercise.status === 'active'
          ? { ...exercise, status: 'completed' as const, completedAt: timestamp() }
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
                  ? `Target met at ${existingActive.proposedLoad} kg across the prescribed work sets.`
                  : `Exposure logged at ${existingActive.proposedLoad} kg, but the prescribed minimum was not met across every work set.`,
              },
        );
        continue;
      }

      const alreadyOpen = experiments.some(
        (experiment) =>
          experiment.routineSlotId === exercise.slotId &&
          ['proposed', 'active', 'ready_for_decision'].includes(experiment.status),
      );

      const exerciseRecord = database.exercises.find(
        (candidate) => candidate.id === exercise.exerciseId,
      );

      if (performance.allTargetsMet && !alreadyOpen && exerciseRecord) {
        const proposal: Experiment = {
          id: createId('experiment'),
          exerciseId: exercise.exerciseId,
          routineSlotId: exercise.slotId,
          exerciseName: exercise.exerciseNameSnapshot,
          hypothesis: `A ${exerciseRecord.progressionStep} kg micro-load increase can preserve the current clean repetition target.`,
          baselineLoad: exercise.plannedLoad,
          proposedLoad: exercise.plannedLoad + exerciseRecord.progressionStep,
          targetRepMin: exercise.prescription.repMin,
          status: 'proposed',
          createdAt: timestamp(),
          schemaVersion: SCHEMA_VERSION,
        };
        experiments.push(proposal);
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
    input: {
      name: string;
      day: DaySymbol;
      importance: Importance;
      plannedLoad: number;
      targetReps: number;
      progressionStep: number;
    },
  ): Promise<AppDatabase> {
    const createdAt = timestamp();
    const exerciseId = createId('exercise');
    const exercise = {
      id: exerciseId,
      name: input.name.trim(),
      archived: false,
      defaultUnit: database.profile.units,
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
      plannedLoad: input.plannedLoad,
      lockedToDay: input.importance === 'principal',
      prescriptions: {
        A: {
          mode: 'A', included: true, sets: 3, repMin: input.targetReps, repMax: input.targetReps + 1, restSeconds: 120, deferToAnd: false,
        },
        B: {
          mode: 'B', included: true, sets: 2, repMin: input.targetReps, repMax: input.targetReps + 1, restSeconds: 120, deferToAnd: true,
        },
        C: {
          mode: 'C', included: true, sets: 1, repMin: input.targetReps, repMax: input.targetReps + 1, restSeconds: 120, deferToAnd: true,
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
    };

    return this.persist({
      ...database,
      exercises: [...database.exercises, exercise],
      routineVersions: [...database.routineVersions, nextVersion],
      currentRoutineVersionId: nextVersionId,
    });
  }
}
