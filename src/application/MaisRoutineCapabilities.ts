import type { AddExerciseInput } from './GymAppService';
import {
  commitRoutineEditDraft,
  createRoutineEditDraft,
  duplicateRoutineDraftSlot,
  moveRoutineDraftSlot,
  removeRoutineDraftSlot,
  type RoutineEditDraft,
} from './RoutineEditDraft';
import type { AppDatabase, DaySymbol } from '../domain/model';
import type { MaisActionExecutor } from '../mais/capabilityProtocol';

export type MaisRoutineOperation =
  | { type: 'move_slot'; slotId: string; targetDay: DaySymbol; targetIndex: number }
  | { type: 'duplicate_slot'; slotId: string }
  | { type: 'remove_slot'; slotId: string };

export interface MaisRoutineChangeSetPayload {
  baseRoutineVersionId: string;
  operations: MaisRoutineOperation[];
}

export interface MaisAddExercisePayload {
  baseRoutineVersionId: string;
  exercise: AddExerciseInput;
}

interface RoutineRollbackToken {
  previousRoutineVersionId: string;
  appliedRoutineVersionId: string;
  createdExerciseId?: string | undefined;
}

interface CapabilityEnvironment {
  readDatabase(): AppDatabase;
  persist(database: AppDatabase): Promise<AppDatabase>;
}

function parseRoutinePayload(payload: Record<string, unknown>): MaisRoutineChangeSetPayload | null {
  if (typeof payload.baseRoutineVersionId !== 'string' || !Array.isArray(payload.operations)) return null;
  return payload as unknown as MaisRoutineChangeSetPayload;
}

function restorePreviousRoutine(database: AppDatabase, token: RoutineRollbackToken): AppDatabase {
  if (database.currentRoutineVersionId !== token.appliedRoutineVersionId) {
    throw new Error('Routine changed after MAIS executed this proposal; rollback requires a new reviewed proposal.');
  }
  const previous = database.routineVersions.find((routine) => routine.id === token.previousRoutineVersionId);
  if (!previous) throw new Error('Previous routine version is unavailable.');
  const draft: RoutineEditDraft = {
    baseRoutineVersionId: database.currentRoutineVersionId,
    days: structuredClone(previous.days),
    updatedAt: new Date().toISOString(),
  };
  const restored = commitRoutineEditDraft(database, draft);
  const activeExerciseIds = new Set(previous.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
  return {
    ...restored,
    exercises: restored.exercises.map((exercise) => {
      if (token.createdExerciseId === exercise.id) return { ...exercise, archived: true };
      return activeExerciseIds.has(exercise.id) ? { ...exercise, archived: false } : exercise;
    }),
  };
}

export function createMaisRoutineChangeSetExecutor(environment: CapabilityEnvironment): MaisActionExecutor {
  return {
    validate(payload) {
      const parsed = parseRoutinePayload(payload);
      if (!parsed) return ['baseRoutineVersionId and operations are required'];
      if (parsed.operations.length === 0) return ['at least one routine operation is required'];
      const errors: string[] = [];
      for (const operation of parsed.operations) {
        if (!operation || typeof operation !== 'object' || typeof operation.type !== 'string') {
          errors.push('every routine operation must be typed');
          continue;
        }
        if (!('slotId' in operation) || typeof operation.slotId !== 'string') errors.push('every operation requires a slotId');
        if (operation.type === 'move_slot') {
          if (!['ψ', 'φ', 'π', '&'].includes(operation.targetDay)) errors.push('move_slot requires a valid targetDay');
          if (!Number.isInteger(operation.targetIndex) || operation.targetIndex < 0) errors.push('move_slot requires a non-negative targetIndex');
        } else if (!['duplicate_slot', 'remove_slot'].includes(operation.type)) {
          errors.push(`unsupported routine operation ${operation.type}`);
        }
      }
      return errors;
    },

    async execute(payload) {
      const parsed = parseRoutinePayload(payload);
      if (!parsed) throw new Error('Invalid MAIS routine change set.');
      const current = environment.readDatabase();
      if (current.currentRoutineVersionId !== parsed.baseRoutineVersionId) throw new Error('The base routine changed after this proposal was created.');
      let draft = createRoutineEditDraft(current);
      for (const operation of parsed.operations) {
        if (operation.type === 'move_slot') draft = moveRoutineDraftSlot(draft, operation.slotId, operation.targetDay, operation.targetIndex);
        if (operation.type === 'duplicate_slot') draft = duplicateRoutineDraftSlot(draft, operation.slotId);
        if (operation.type === 'remove_slot') draft = removeRoutineDraftSlot(draft, operation.slotId);
      }
      const next = commitRoutineEditDraft(current, draft);
      if (next === current) throw new Error('MAIS routine proposal produced no structural change.');
      const persisted = await environment.persist(next);
      return {
        result: {
          previousRoutineVersionId: current.currentRoutineVersionId,
          routineVersionId: persisted.currentRoutineVersionId,
          operationCount: parsed.operations.length,
        },
        rollbackToken: {
          previousRoutineVersionId: current.currentRoutineVersionId,
          appliedRoutineVersionId: persisted.currentRoutineVersionId,
        } satisfies RoutineRollbackToken,
      };
    },

    async revert(token) {
      const rollback = token as unknown as RoutineRollbackToken;
      const restored = await environment.persist(restorePreviousRoutine(environment.readDatabase(), rollback));
      return { routineVersionId: restored.currentRoutineVersionId };
    },
  };
}

export function createMaisAddExerciseExecutor(
  environment: CapabilityEnvironment & { addExercise(database: AppDatabase, input: AddExerciseInput): Promise<AppDatabase> },
): MaisActionExecutor {
  return {
    validate(payload) {
      const candidate = payload as Partial<MaisAddExercisePayload>;
      const errors: string[] = [];
      if (typeof candidate.baseRoutineVersionId !== 'string') errors.push('baseRoutineVersionId is required');
      if (!candidate.exercise || typeof candidate.exercise !== 'object') errors.push('exercise draft is required');
      else {
        if (!candidate.exercise.name?.trim()) errors.push('exercise name is required');
        if (!['ψ', 'φ', 'π', '&'].includes(candidate.exercise.day as string)) errors.push('exercise day is invalid');
        if (!['principal', 'core', 'accessory'].includes(candidate.exercise.importance as string)) errors.push('exercise importance is invalid');
      }
      return errors;
    },

    async execute(payload) {
      const parsed = payload as unknown as MaisAddExercisePayload;
      const current = environment.readDatabase();
      if (current.currentRoutineVersionId !== parsed.baseRoutineVersionId) throw new Error('The base routine changed after this exercise proposal was created.');
      const previousExerciseIds = new Set(current.exercises.map((exercise) => exercise.id));
      const next = await environment.addExercise(current, structuredClone(parsed.exercise));
      const created = next.exercises.find((exercise) => !previousExerciseIds.has(exercise.id));
      if (!created) throw new Error('Exercise service did not create a new exercise record.');
      return {
        result: {
          exerciseId: created.id,
          routineVersionId: next.currentRoutineVersionId,
        },
        rollbackToken: {
          previousRoutineVersionId: current.currentRoutineVersionId,
          appliedRoutineVersionId: next.currentRoutineVersionId,
          createdExerciseId: created.id,
        } satisfies RoutineRollbackToken,
      };
    },

    async revert(token) {
      const rollback = token as unknown as RoutineRollbackToken;
      const restored = await environment.persist(restorePreviousRoutine(environment.readDatabase(), rollback));
      return { routineVersionId: restored.currentRoutineVersionId, archivedExerciseId: rollback.createdExerciseId };
    },
  };
}
