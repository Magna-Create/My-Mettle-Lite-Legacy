import type { AppDatabase, Exercise, RoutineVersion, Session } from '../domain/model';
import { stableSemanticHash, type MaisSemanticDocument, type MaisSemanticIndexManifest } from './semanticMemory';

function asText(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function completedSessions(database: AppDatabase): Session[] {
  return database.sessions.filter((session) => session.status === 'completed' && !session.discardedAt);
}

function sessionDocument(session: Session): MaisSemanticDocument {
  const exerciseSections = session.exercises.map((exercise) => ({
    key: `exercise_${exercise.exerciseId}`,
    heading: exercise.exerciseNameSnapshot,
    text: [
      `Exercise ${exercise.exerciseNameSnapshot}. Importance ${exercise.importanceSnapshot}. Status ${exercise.status}. Movement reason ${exercise.movementReason}.`,
      `Tracking ${asText(exercise.trackingSnapshot)}. Planned load ${exercise.plannedLoad}. Bodyweight snapshot ${exercise.bodyweightSnapshotKg ?? 'missing'} kg.`,
      `Prescription ${asText(exercise.prescription)}.`,
      `Sets ${asText(exercise.sets.map((set) => ({ id: set.id, kind: set.kind ?? (set.warmUp ? 'warm_up' : 'prescribed'), warmUp: set.warmUp, load: set.load, unit: set.unit, reps: set.reps, durationSeconds: set.durationSeconds, distanceMetres: set.distanceMetres, completedAt: set.completedAt ?? null, note: set.note ?? null })))}.`,
      `Reflection ${exercise.reflection ? asText(exercise.reflection) : 'not recorded'}.`,
    ].join('\n\n'),
    provenanceRefs: [session.id, exercise.id, exercise.exerciseId, exercise.slotId, ...exercise.sets.map((set) => set.id)],
  }));

  return {
    id: `semantic_session_${session.id}`,
    kind: 'session',
    title: `${session.day} ${session.mode} session · ${session.completedAt ?? session.startedAt}`,
    summary: `${session.exercises.filter((exercise) => exercise.status === 'completed').length}/${session.exercises.length} exercises completed.`,
    updatedAt: session.editedAt ?? session.completedAt ?? session.startedAt,
    metadata: {
      sessionId: session.id,
      day: session.day,
      mode: session.mode,
      routineVersionId: session.routineVersionId,
      excludedFromInsights: session.excludedFromInsights ?? false,
    },
    sections: [
      {
        key: 'overview',
        heading: 'Session overview',
        text: `Session ${session.id}. Day ${session.day}. Mode ${session.mode}. Started ${session.startedAt}. Completed ${session.completedAt ?? 'missing'}. Routine ${session.routineVersionId}. Bodyweight ${session.bodyweightSnapshotKg ?? 'missing'} kg. Excluded from insights ${session.excludedFromInsights ?? false}.`,
        provenanceRefs: [session.id, session.cycleId, session.routineVersionId],
      },
      ...exerciseSections,
    ],
  };
}

function exerciseHistoryDocument(database: AppDatabase, exercise: Exercise): MaisSemanticDocument {
  const exposures = completedSessions(database)
    .flatMap((session) => session.exercises
      .filter((sessionExercise) => sessionExercise.exerciseId === exercise.id)
      .map((sessionExercise) => ({ session, exercise: sessionExercise })))
    .sort((left, right) => left.session.startedAt.localeCompare(right.session.startedAt));
  const latest = exposures.at(-1);

  return {
    id: `semantic_exercise_${exercise.id}`,
    kind: 'exercise_history',
    title: `${exercise.name} history`,
    summary: `${exposures.length} completed exposure${exposures.length === 1 ? '' : 's'} recorded.`,
    updatedAt: latest?.session.editedAt ?? latest?.session.completedAt ?? exercise.updatedAt,
    metadata: {
      exerciseId: exercise.id,
      archived: exercise.archived,
      trackingMetric: exercise.tracking.metric,
      loadRelationship: exercise.tracking.loadRelationship,
    },
    sections: [
      {
        key: 'exercise_memory',
        heading: 'Exercise memory',
        text: `Exercise ${exercise.name}. Tracking ${asText(exercise.tracking)}. Progression step ${exercise.progressionStep}. Essential cue ${exercise.essentialCue ?? 'missing'}. Shared memory ${exercise.memory ? asText(exercise.memory) : 'missing'}.`,
        provenanceRefs: [exercise.id],
      },
      {
        key: 'exposures',
        heading: 'Historical exposures',
        text: exposures.map(({ session, exercise: exposure }) => [
          `Session ${session.id} on ${session.completedAt ?? session.startedAt}. Day ${session.day}; mode ${session.mode}; routine ${session.routineVersionId}; excluded ${session.excludedFromInsights ?? false}.`,
          `Planned load ${exposure.plannedLoad}; bodyweight ${exposure.bodyweightSnapshotKg ?? 'missing'} kg; status ${exposure.status}; movement reason ${exposure.movementReason}.`,
          `Sets ${asText(exposure.sets.map((set) => ({ id: set.id, kind: set.kind ?? (set.warmUp ? 'warm_up' : 'prescribed'), load: set.load, unit: set.unit, reps: set.reps, durationSeconds: set.durationSeconds, distanceMetres: set.distanceMetres, warmUp: set.warmUp })))}.`,
          `Reflection ${exposure.reflection ? asText(exposure.reflection) : 'not recorded'}.`,
        ].join(' ')).join('\n\n'),
        provenanceRefs: exposures.flatMap(({ session, exercise: exposure }) => [session.id, exposure.id, ...exposure.sets.map((set) => set.id)]),
      },
    ],
  };
}

function routineDocument(routine: RoutineVersion): MaisSemanticDocument {
  return {
    id: `semantic_routine_${routine.id}`,
    kind: 'routine_version',
    title: `Routine version ${routine.version}`,
    summary: routine.changeReason,
    updatedAt: routine.createdAt,
    metadata: { routineVersionId: routine.id, version: routine.version, source: routine.source },
    sections: routine.days.map((day) => ({
      key: `day_${day.symbol}`,
      heading: `Day ${day.symbol}`,
      text: day.slots.map((slot) => `Slot ${slot.id}; exercise ${slot.exerciseId}; position ${slot.position}; importance ${slot.importance}; planned load ${slot.plannedLoad}; locked ${slot.lockedToDay}; prescriptions ${asText(slot.prescriptions)}.`).join('\n\n'),
      provenanceRefs: [routine.id, ...day.slots.flatMap((slot) => [slot.id, slot.exerciseId])],
    })),
  };
}

function experimentDocuments(database: AppDatabase): MaisSemanticDocument[] {
  return database.experiments.map((experiment) => ({
    id: `semantic_experiment_${experiment.id}`,
    kind: 'experiment',
    title: `${experiment.exerciseName} experiment`,
    summary: experiment.hypothesis,
    updatedAt: experiment.activatedAt ?? experiment.createdAt,
    metadata: {
      experimentId: experiment.id,
      exerciseId: experiment.exerciseId,
      status: experiment.status,
    },
    sections: [{
      key: 'experiment',
      heading: 'Experiment record',
      text: `Hypothesis ${experiment.hypothesis}. Baseline load ${experiment.baselineLoad}. Proposed load ${experiment.proposedLoad}. Target minimum repetitions ${experiment.targetRepMin}. Status ${experiment.status}. Activated ${experiment.activatedAt ?? 'not active'}. Tested session ${experiment.testedSessionId ?? 'missing'}. Evidence summary ${experiment.evidenceSummary ?? 'missing'}. Adopted routine ${experiment.adoptedRoutineVersionId ?? 'missing'}.`,
      provenanceRefs: [experiment.id, experiment.exerciseId, experiment.routineSlotId, ...(experiment.testedSessionId ? [experiment.testedSessionId] : [])],
    }],
  }));
}

export function buildTrainingSemanticDocuments(database: AppDatabase): MaisSemanticDocument[] {
  const sessions = completedSessions(database).map(sessionDocument);
  const exerciseHistories = database.exercises.map((exercise) => exerciseHistoryDocument(database, exercise));
  const routines = database.routineVersions.map(routineDocument);
  return [...sessions, ...exerciseHistories, ...routines, ...experimentDocuments(database)];
}

export interface MaisSemanticIndexDiff {
  pending: MaisSemanticDocument[];
  unchanged: MaisSemanticDocument[];
  removedDocumentIds: string[];
}

function documentHash(document: MaisSemanticDocument): string {
  return stableSemanticHash(JSON.stringify({
    id: document.id,
    kind: document.kind,
    title: document.title,
    summary: document.summary,
    sections: document.sections,
    updatedAt: document.updatedAt,
    metadata: document.metadata,
  }));
}

export function diffSemanticDocuments(
  documents: MaisSemanticDocument[],
  manifests: MaisSemanticIndexManifest[],
): MaisSemanticIndexDiff {
  const manifestsByDocument = new Map(manifests.map((manifest) => [manifest.documentId, manifest]));
  const currentIds = new Set(documents.map((document) => document.id));
  const pending: MaisSemanticDocument[] = [];
  const unchanged: MaisSemanticDocument[] = [];

  for (const document of documents) {
    const manifest = manifestsByDocument.get(document.id);
    if (!manifest || manifest.documentHash !== documentHash(document)) pending.push(document);
    else unchanged.push(document);
  }

  return {
    pending,
    unchanged,
    removedDocumentIds: manifests.filter((manifest) => !currentIds.has(manifest.documentId)).map((manifest) => manifest.documentId),
  };
}

export function semanticDocumentHash(document: MaisSemanticDocument): string {
  return documentHash(document);
}
