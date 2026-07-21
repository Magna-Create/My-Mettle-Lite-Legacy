import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { createId } from '../src/domain/ids';
import type { Session } from '../src/domain/model';
import { chunkSemanticDocument, createSemanticIndexManifest } from '../src/mais/semanticMemory';
import { buildTrainingSemanticDocuments, diffSemanticDocuments } from '../src/mais/semanticDocuments';

function databaseWithSession() {
  const database = createSeedDatabase();
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId)!;
  const slot = routine.days[0]!.slots[0]!;
  const exercise = database.exercises.find((candidate) => candidate.id === slot.exerciseId)!;
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
      sets: [],
      movementReason: 'base_routine',
    }],
    schemaVersion: database.schemaVersion,
  };
  return { ...database, sessions: [session], updatedAt: '2026-07-21T02:01:00.000Z' };
}

describe('MAIS semantic training documents', () => {
  it('creates session, exercise-history and routine documents with source references', () => {
    const documents = buildTrainingSemanticDocuments(databaseWithSession());
    const session = documents.find((document) => document.kind === 'session');
    const exercise = documents.find((document) => document.kind === 'exercise_history');
    const routine = documents.find((document) => document.kind === 'routine_version');
    expect(session?.sections.some((section) => section.provenanceRefs.length > 0)).toBe(true);
    expect(exercise?.summary).toContain('1 completed exposure');
    expect(routine?.sections.length).toBeGreaterThan(0);
  });

  it('marks only changed or unindexed documents as pending', () => {
    const documents = buildTrainingSemanticDocuments(databaseWithSession());
    const first = documents[0]!;
    const manifest = createSemanticIndexManifest(first, chunkSemanticDocument(first), 256, '2026-07-21T03:00:00.000Z');
    const diff = diffSemanticDocuments(documents, [manifest]);
    expect(diff.unchanged.map((document) => document.id)).toContain(first.id);
    expect(diff.pending.length).toBe(documents.length - 1);
  });

  it('detects removed semantic documents for vector cleanup', () => {
    const documents = buildTrainingSemanticDocuments(databaseWithSession());
    const removed = {
      ...createSemanticIndexManifest(documents[0]!, chunkSemanticDocument(documents[0]!), 256),
      documentId: 'semantic_session_removed',
    };
    const diff = diffSemanticDocuments(documents, [removed]);
    expect(diff.removedDocumentIds).toEqual(['semantic_session_removed']);
  });
});
