import { IndexedDbGymRepository } from '../adapters/storage/IndexedDbGymRepository';
import type { AppDatabase, Experiment, Exercise, RoutineVersion, Session, SessionExercise } from '../domain/model';
import type { MaisRoleRequest } from './contracts';

export interface MaisTrainingEvidenceProvider {
  read(request: MaisRoleRequest): Promise<MaisTrainingEvidencePacket | null>;
}

export interface MaisTrainingEvidencePacket {
  generatedAt: string;
  sourceDatabaseUpdatedAt: string;
  directRefs: string[];
  sessions: Array<ReturnType<typeof sessionEvidence>>;
  comparableExposures: Record<string, Array<ReturnType<typeof exposureEvidence>>>;
  exercises: Array<ReturnType<typeof exerciseEvidence>>;
  routines: Array<ReturnType<typeof routineEvidence>>;
  experiments: Array<ReturnType<typeof experimentEvidence>>;
  recentBodyMeasurements: AppDatabase['bodyMeasurements'];
  warnings: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function refsFromRequest(request: MaisRoleRequest): string[] {
  const payloadRefs = request.triggerEvents.flatMap((event) => Object.entries(event.payload)
    .filter(([key, value]) => key.toLowerCase().endsWith('id') && typeof value === 'string')
    .map(([, value]) => value as string));
  return unique([
    ...request.triggerEvents.flatMap((event) => [event.id, ...event.entityRefs]),
    ...payloadRefs,
    ...request.taskArtifacts.flatMap((artifact) => [artifact.id, ...artifact.provenanceRefs]),
  ]);
}

function setEvidence(set: SessionExercise['sets'][number]) {
  return {
    id: set.id,
    index: set.setIndex,
    kind: set.kind ?? (set.warmUp ? 'warm_up' : 'prescribed'),
    warmUp: set.warmUp,
    load: set.load,
    unit: set.unit,
    reps: set.reps,
    durationSeconds: set.durationSeconds,
    distanceMetres: set.distanceMetres,
    completedAt: set.completedAt ?? null,
    note: set.note ?? null,
  };
}

function sessionExerciseEvidence(exercise: SessionExercise) {
  return {
    sessionExerciseId: exercise.id,
    exerciseId: exercise.exerciseId,
    slotId: exercise.slotId,
    name: exercise.exerciseNameSnapshot,
    importance: exercise.importanceSnapshot,
    tracking: exercise.trackingSnapshot,
    bodyweightSnapshotKg: exercise.bodyweightSnapshotKg,
    plannedLoad: exercise.plannedLoad,
    prescription: exercise.prescription,
    status: exercise.status,
    movementReason: exercise.movementReason,
    startedAt: exercise.startedAt ?? null,
    completedAt: exercise.completedAt ?? null,
    sets: exercise.sets.map(setEvidence),
    reflection: exercise.reflection ?? null,
  };
}

function sessionEvidence(session: Session) {
  return {
    id: session.id,
    cycleId: session.cycleId,
    day: session.day,
    mode: session.mode,
    routineVersionId: session.routineVersionId,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    editedAt: session.editedAt ?? null,
    excludedFromInsights: session.excludedFromInsights ?? false,
    bodyweightSnapshotKg: session.bodyweightSnapshotKg,
    exercises: session.exercises.map(sessionExerciseEvidence),
  };
}

function exposureEvidence(session: Session, exercise: SessionExercise) {
  return {
    sessionId: session.id,
    day: session.day,
    mode: session.mode,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    routineVersionId: session.routineVersionId,
    excludedFromInsights: session.excludedFromInsights ?? false,
    exercise: sessionExerciseEvidence(exercise),
  };
}

function exerciseEvidence(exercise: Exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    archived: exercise.archived,
    tracking: exercise.tracking,
    defaultUnit: exercise.defaultUnit,
    progressionStep: exercise.progressionStep,
    essentialCue: exercise.essentialCue ?? null,
    memory: exercise.memory ?? null,
    updatedAt: exercise.updatedAt,
  };
}

function routineEvidence(routine: RoutineVersion) {
  return {
    id: routine.id,
    version: routine.version,
    parentId: routine.parentId ?? null,
    createdAt: routine.createdAt,
    effectiveAt: routine.effectiveAt,
    source: routine.source,
    changeReason: routine.changeReason,
    days: routine.days.map((day) => ({
      symbol: day.symbol,
      slots: day.slots.map((slot) => ({
        id: slot.id,
        exerciseId: slot.exerciseId,
        position: slot.position,
        importance: slot.importance,
        plannedLoad: slot.plannedLoad,
        prescriptions: slot.prescriptions,
        lockedToDay: slot.lockedToDay,
      })),
    })),
  };
}

function experimentEvidence(experiment: Experiment) {
  return {
    id: experiment.id,
    exerciseId: experiment.exerciseId,
    routineSlotId: experiment.routineSlotId,
    exerciseName: experiment.exerciseName,
    hypothesis: experiment.hypothesis,
    baselineLoad: experiment.baselineLoad,
    proposedLoad: experiment.proposedLoad,
    targetRepMin: experiment.targetRepMin,
    status: experiment.status,
    createdAt: experiment.createdAt,
    activatedAt: experiment.activatedAt ?? null,
    testedSessionId: experiment.testedSessionId ?? null,
    evidenceSummary: experiment.evidenceSummary ?? null,
    adoptedRoutineVersionId: experiment.adoptedRoutineVersionId ?? null,
  };
}

function selectDirectSessions(database: AppDatabase, refs: Set<string>): Session[] {
  const direct = database.sessions.filter((session) => refs.has(session.id)
    || refs.has(session.cycleId)
    || refs.has(session.routineVersionId)
    || session.exercises.some((exercise) => refs.has(exercise.id) || refs.has(exercise.exerciseId) || refs.has(exercise.slotId)));
  if (direct.length > 0) return direct.slice(-4);
  return database.sessions
    .filter((session) => session.status === 'completed' && !session.discardedAt)
    .slice(-2);
}

function comparableExposures(database: AppDatabase, directSessions: Session[]): MaisTrainingEvidencePacket['comparableExposures'] {
  const result: MaisTrainingEvidencePacket['comparableExposures'] = {};
  const exerciseIds = unique(directSessions.flatMap((session) => session.exercises.map((exercise) => exercise.exerciseId)));

  for (const exerciseId of exerciseIds) {
    result[exerciseId] = database.sessions
      .filter((session) => session.status === 'completed' && !session.discardedAt && !session.excludedFromInsights)
      .flatMap((session) => session.exercises
        .filter((exercise) => exercise.exerciseId === exerciseId)
        .map((exercise) => exposureEvidence(session, exercise)))
      .slice(-5);
  }
  return result;
}

export function compileTrainingEvidence(database: AppDatabase, request: MaisRoleRequest): MaisTrainingEvidencePacket {
  const directRefs = refsFromRequest(request);
  const refSet = new Set(directRefs);
  const sessions = selectDirectSessions(database, refSet);
  const exerciseIds = new Set(sessions.flatMap((session) => session.exercises.map((exercise) => exercise.exerciseId)));
  const routineIds = new Set(sessions.map((session) => session.routineVersionId));
  routineIds.add(database.currentRoutineVersionId);

  const warnings: string[] = [];
  if (sessions.length === 0) warnings.push('No matching training session was found.');
  if (sessions.some((session) => session.excludedFromInsights)) warnings.push('At least one direct session is excluded from insight calculations.');
  if (sessions.some((session) => session.status !== 'completed')) warnings.push('At least one direct session is not complete.');

  return {
    generatedAt: new Date().toISOString(),
    sourceDatabaseUpdatedAt: database.updatedAt,
    directRefs,
    sessions: sessions.map(sessionEvidence),
    comparableExposures: comparableExposures(database, sessions),
    exercises: database.exercises.filter((exercise) => exerciseIds.has(exercise.id)).map(exerciseEvidence),
    routines: database.routineVersions.filter((routine) => routineIds.has(routine.id)).map(routineEvidence),
    experiments: database.experiments.filter((experiment) => refSet.has(experiment.id)
      || exerciseIds.has(experiment.exerciseId)
      || sessions.some((session) => experiment.testedSessionId === session.id)).map(experimentEvidence),
    recentBodyMeasurements: database.bodyMeasurements.slice(-3),
    warnings,
  };
}

export class IndexedDbMaisTrainingEvidenceProvider implements MaisTrainingEvidenceProvider {
  constructor(private readonly repository = new IndexedDbGymRepository()) {}

  async read(request: MaisRoleRequest): Promise<MaisTrainingEvidencePacket | null> {
    const database = await this.repository.load();
    return database ? compileTrainingEvidence(database, request) : null;
  }
}
