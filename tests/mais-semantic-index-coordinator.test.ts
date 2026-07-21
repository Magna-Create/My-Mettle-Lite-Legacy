import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { createId } from '../src/domain/ids';
import type { Session } from '../src/domain/model';
import type { MaisEmbeddingRepository } from '../src/adapters/storage/IndexedDbMaisEmbeddingRepository';
import { MaisSemanticIndexCoordinator, type MaisEmbeddingRuntime } from '../src/mais/semanticIndexCoordinator';
import type { MaisEmbeddingRecord } from '../src/mais/semanticMemory';

class MemoryEmbeddingRepository implements MaisEmbeddingRepository {
  records = new Map<string, MaisEmbeddingRecord>();

  async upsert(records: MaisEmbeddingRecord[]): Promise<void> {
    records.forEach((record) => this.records.set(record.chunkId, structuredClone(record)));
  }
  async get(chunkId: string): Promise<MaisEmbeddingRecord | null> {
    return structuredClone(this.records.get(chunkId) ?? null);
  }
  async getMany(chunkIds: string[]): Promise<Map<string, MaisEmbeddingRecord>> {
    return new Map(chunkIds.flatMap((chunkId) => {
      const record = this.records.get(chunkId);
      return record ? [[chunkId, structuredClone(record)] as const] : [];
    }));
  }
  async listByDocument(documentId: string): Promise<MaisEmbeddingRecord[]> {
    return [...this.records.values()].filter((record) => record.documentId === documentId).map((record) => structuredClone(record));
  }
  async listAll(): Promise<MaisEmbeddingRecord[]> {
    return [...this.records.values()].map((record) => structuredClone(record));
  }
  async deleteDocument(documentId: string): Promise<void> {
    for (const record of this.records.values()) if (record.documentId === documentId) this.records.delete(record.chunkId);
  }
  async deleteChunks(chunkIds: string[]): Promise<void> {
    chunkIds.forEach((chunkId) => this.records.delete(chunkId));
  }
  async clear(): Promise<void> {
    this.records.clear();
  }
}

class DeterministicEmbeddingRuntime implements MaisEmbeddingRuntime {
  calls: Array<{ purpose: 'document' | 'query'; count: number }> = [];

  async embed(input: Parameters<MaisEmbeddingRuntime['embed']>[0]): Promise<ArrayLike<number>[]> {
    this.calls.push({ purpose: input.purpose, count: input.texts.length });
    return input.texts.map((text) => {
      const vector = new Array(input.dimensions).fill(0);
      for (let index = 0; index < text.length; index += 1) {
        vector[index % input.dimensions] += text.charCodeAt(index)! / 255;
      }
      return vector;
    });
  }
}

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

describe('MAIS semantic index coordinator', () => {
  it('embeds the first index in bounded batches and skips unchanged documents later', async () => {
    const repository = new MemoryEmbeddingRepository();
    const runtime = new DeterministicEmbeddingRuntime();
    const coordinator = new MaisSemanticIndexCoordinator(repository, runtime, 128, 3);
    const database = databaseWithSession();

    const first = await coordinator.synchronise(database, [], '2026-07-21T03:00:00.000Z');
    expect(first.indexedDocumentIds.length).toBeGreaterThan(0);
    expect(first.indexedChunkCount).toBe(repository.records.size);
    expect(runtime.calls.every((call) => call.count <= 3)).toBe(true);

    runtime.calls = [];
    const second = await coordinator.synchronise(database, first.manifests, '2026-07-21T03:01:00.000Z');
    expect(second.indexedChunkCount).toBe(0);
    expect(second.unchangedDocumentIds.length).toBe(first.manifests.length);
    expect(runtime.calls).toHaveLength(0);
  });

  it('re-indexes changed histories and deletes removed document vectors', async () => {
    const repository = new MemoryEmbeddingRepository();
    const runtime = new DeterministicEmbeddingRuntime();
    const coordinator = new MaisSemanticIndexCoordinator(repository, runtime, 128, 8);
    const database = databaseWithSession();
    const first = await coordinator.synchronise(database, []);

    const changed = structuredClone(database);
    changed.sessions[0]!.editedAt = '2026-07-21T04:00:00.000Z';
    changed.sessions[0]!.exercises[0]!.reflection = {
      targetMuscleEngagement: 7,
      execution: 'clean',
      enjoyment: 6,
      comfort: 'good',
      recordedAt: '2026-07-21T04:00:00.000Z',
      updatedAt: '2026-07-21T04:00:00.000Z',
    };
    const second = await coordinator.synchronise(changed, first.manifests);
    expect(second.indexedDocumentIds.some((id) => id.includes('semantic_session_'))).toBe(true);
    expect(second.indexedDocumentIds.some((id) => id.includes('semantic_exercise_'))).toBe(true);

    const withoutSession = { ...changed, sessions: [] };
    const third = await coordinator.synchronise(withoutSession, second.manifests);
    expect(third.removedDocumentIds.some((id) => id.includes('semantic_session_'))).toBe(true);
  });

  it('retrieves diverse chunks within the downstream context budget', async () => {
    const repository = new MemoryEmbeddingRepository();
    const runtime = new DeterministicEmbeddingRuntime();
    const coordinator = new MaisSemanticIndexCoordinator(repository, runtime, 128, 8);
    const database = databaseWithSession();
    await coordinator.synchronise(database, []);

    const result = await coordinator.search(database, {
      query: 'pulling exercise performance and reflection',
      topK: 8,
      maximumPerDocument: 2,
      contextTokenBudget: 300,
    });
    expect(result.queryDimensions).toBe(128);
    expect(result.selection.estimatedTokens).toBeLessThanOrEqual(300);
    expect(result.selection.matches.length).toBeGreaterThan(0);
    expect(result.missingEmbeddingChunkIds).toHaveLength(0);
  });
});
