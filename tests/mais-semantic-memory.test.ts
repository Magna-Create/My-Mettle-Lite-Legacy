import { describe, expect, it } from 'vitest';
import {
  chunkSemanticDocument,
  compileSemanticContextSelection,
  cosineSimilarity,
  createEmbeddingRecord,
  createSemanticIndexManifest,
  rankSemanticChunks,
  type MaisSemanticDocument,
} from '../src/mais/semanticMemory';

function document(): MaisSemanticDocument {
  return {
    id: 'exercise_history_pullup',
    kind: 'exercise_history',
    title: 'Assisted pull-up history',
    summary: 'Longitudinal evidence for assisted pull-ups.',
    updatedAt: '2026-07-21T03:00:00.000Z',
    metadata: { exerciseId: 'pullup' },
    sections: [
      {
        key: 'recent',
        heading: 'Recent exposures',
        text: [
          'Session one used 35 kg assistance for eight clean repetitions. Engagement was concentrated.',
          'Session two used 32.5 kg assistance for eight clean repetitions. Execution remained clean.',
          'Session three used 30 kg assistance but repetitions fell to six after shorter rest.',
        ].join('\n\n'),
        provenanceRefs: ['session_1', 'session_2', 'session_3'],
      },
    ],
  };
}

describe('MAIS semantic memory', () => {
  it('creates stable provenance-linked chunks within the requested token budget', () => {
    const first = chunkSemanticDocument(document(), 64);
    const second = chunkSemanticDocument(document(), 64);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((chunk) => chunk.id)).toEqual(second.map((chunk) => chunk.id));
    expect(first.every((chunk) => chunk.estimatedTokens <= 64)).toBe(true);
    expect(first[0]?.provenanceRefs).toContain('session_1');
  });

  it('stores reduced-dimension vectors as Float32Array records', () => {
    const chunk = chunkSemanticDocument(document(), 128)[0]!;
    const record = createEmbeddingRecord(chunk, new Array(256).fill(0.25), 256, '2026-07-21T03:01:00.000Z');
    expect(record.vector).toBeInstanceOf(Float32Array);
    expect(record.vector.length).toBe(256);
    expect(record.contentHash).toBe(chunk.contentHash);
  });

  it('calculates cosine similarity and diversifies retrieval across documents', () => {
    const firstChunks = chunkSemanticDocument(document(), 64);
    const secondDocument = { ...document(), id: 'experiment_rest', title: 'Rest experiment', kind: 'experiment' as const };
    const secondChunks = chunkSemanticDocument(secondDocument, 64);
    const allChunks = [...firstChunks, ...secondChunks];
    const embeddings = new Map(allChunks.map((chunk, index) => [
      chunk.id,
      createEmbeddingRecord(chunk, index < firstChunks.length ? [1, 0] : [0.8, 0.2], 128),
    ]));
    for (const record of embeddings.values()) record.vector = Float32Array.from([record.vector[0] ?? 0, record.vector[1] ?? 0, ...new Array(126).fill(0)]);

    const query = Float32Array.from([1, 0, ...new Array(126).fill(0)]);
    expect(cosineSimilarity(query, query)).toBeCloseTo(1);
    const ranked = rankSemanticChunks(query, allChunks, embeddings, { topK: 4, maximumPerDocument: 1 });
    expect(ranked).toHaveLength(2);
    expect(new Set(ranked.map((match) => match.chunk.documentId)).size).toBe(2);
  });

  it('compiles only matches that fit the downstream model context budget', () => {
    const chunks = chunkSemanticDocument(document(), 64);
    const ranked = chunks.map((chunk, index) => ({ chunk, score: 1 - index * 0.1 }));
    const selection = compileSemanticContextSelection(ranked, 70);
    expect(selection.matches.length).toBeGreaterThan(0);
    expect(selection.estimatedTokens).toBeLessThanOrEqual(70);
    expect(selection.omittedMatchCount).toBe(ranked.length - selection.matches.length);
  });

  it('creates a manifest without duplicating vectors into the main MAIS snapshot', () => {
    const chunks = chunkSemanticDocument(document(), 128);
    const manifest = createSemanticIndexManifest(document(), chunks, 256, '2026-07-21T03:02:00.000Z');
    expect(manifest.chunkIds).toEqual(chunks.map((chunk) => chunk.id));
    expect(manifest.embeddingModelId).toBe('google.embeddinggemma');
    expect('vector' in manifest).toBe(false);
  });
});
