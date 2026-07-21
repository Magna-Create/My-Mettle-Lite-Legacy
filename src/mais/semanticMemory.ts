import { createId } from '../domain/ids';

export const MAIS_SEMANTIC_MEMORY_VERSION = 1;
export const MAIS_DEFAULT_EMBEDDING_DIMENSIONS = 256;
export const MAIS_DEFAULT_CHUNK_TOKEN_BUDGET = 384;

export type MaisSemanticDocumentKind =
  | 'session'
  | 'exercise_history'
  | 'reflection'
  | 'experiment'
  | 'belief'
  | 'research_report'
  | 'routine_version'
  | 'system_note';

export interface MaisSemanticSection {
  key: string;
  heading: string;
  text: string;
  provenanceRefs: string[];
}

export interface MaisSemanticDocument {
  id: string;
  kind: MaisSemanticDocumentKind;
  title: string;
  summary: string;
  sections: MaisSemanticSection[];
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface MaisSemanticChunk {
  id: string;
  documentId: string;
  documentKind: MaisSemanticDocumentKind;
  documentTitle: string;
  sectionKey: string;
  sectionHeading: string;
  ordinal: number;
  text: string;
  estimatedTokens: number;
  contentHash: string;
  provenanceRefs: string[];
  updatedAt: string;
}

export interface MaisEmbeddingRecord {
  chunkId: string;
  documentId: string;
  modelId: 'google.embeddinggemma';
  dimensions: 128 | 256 | 512 | 768;
  vector: Float32Array;
  contentHash: string;
  embeddedAt: string;
}

export interface MaisSemanticMatch {
  chunk: MaisSemanticChunk;
  score: number;
}

export interface MaisSemanticRetrievalOptions {
  topK: number;
  maximumPerDocument: number;
  minimumScore?: number | undefined;
  kinds?: MaisSemanticDocumentKind[] | undefined;
}

export interface MaisSemanticContextSelection {
  matches: MaisSemanticMatch[];
  documentSummaries: Array<{
    documentId: string;
    title: string;
    kind: MaisSemanticDocumentKind;
  }>;
  estimatedTokens: number;
  omittedMatchCount: number;
}

function normaliseText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function estimateSemanticTokens(value: string): number {
  const text = normaliseText(value);
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function stableSemanticHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function splitOversizedParagraph(paragraph: string, tokenBudget: number): string[] {
  const maximumCharacters = Math.max(64, tokenBudget * 4);
  if (paragraph.length <= maximumCharacters) return [paragraph];

  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const parts: string[] = [];
    for (let start = 0; start < paragraph.length; start += maximumCharacters) {
      parts.push(paragraph.slice(start, start + maximumCharacters));
    }
    return parts;
  }

  const parts: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (estimateSemanticTokens(candidate) > tokenBudget && current) {
      parts.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts.flatMap((part) => part.length > maximumCharacters ? splitOversizedParagraph(part, tokenBudget) : [part]);
}

export function chunkSemanticDocument(
  document: MaisSemanticDocument,
  tokenBudget = MAIS_DEFAULT_CHUNK_TOKEN_BUDGET,
): MaisSemanticChunk[] {
  if (!Number.isInteger(tokenBudget) || tokenBudget < 64) throw new Error('Semantic chunk token budget must be at least 64.');
  const chunks: MaisSemanticChunk[] = [];

  for (const section of document.sections) {
    const text = normaliseText(section.text);
    if (!text) continue;
    const paragraphs = text
      .split(/\n\s*\n/)
      .flatMap((paragraph) => splitOversizedParagraph(paragraph.trim(), tokenBudget))
      .filter(Boolean);

    let current: string[] = [];
    const flush = () => {
      if (current.length === 0) return;
      const chunkText = current.join('\n\n');
      const ordinal = chunks.filter((chunk) => chunk.sectionKey === section.key).length;
      const hashInput = `${document.id}\n${section.key}\n${ordinal}\n${chunkText}`;
      chunks.push({
        id: `semantic_chunk_${stableSemanticHash(hashInput)}`,
        documentId: document.id,
        documentKind: document.kind,
        documentTitle: document.title,
        sectionKey: section.key,
        sectionHeading: section.heading,
        ordinal,
        text: chunkText,
        estimatedTokens: estimateSemanticTokens(chunkText),
        contentHash: stableSemanticHash(chunkText),
        provenanceRefs: [...section.provenanceRefs],
        updatedAt: document.updatedAt,
      });
      current = [];
    };

    for (const paragraph of paragraphs) {
      const candidate = [...current, paragraph].join('\n\n');
      if (current.length > 0 && estimateSemanticTokens(candidate) > tokenBudget) flush();
      current.push(paragraph);
    }
    flush();
  }

  return chunks;
}

export function createEmbeddingRecord(
  chunk: MaisSemanticChunk,
  vector: ArrayLike<number>,
  dimensions: MaisEmbeddingRecord['dimensions'] = MAIS_DEFAULT_EMBEDDING_DIMENSIONS,
  embeddedAt = new Date().toISOString(),
): MaisEmbeddingRecord {
  if (vector.length !== dimensions) throw new Error(`Embedding vector must contain exactly ${dimensions} values.`);
  const typed = Float32Array.from(vector);
  if (typed.some((value) => !Number.isFinite(value))) throw new Error('Embedding vector contains a non-finite value.');
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    modelId: 'google.embeddinggemma',
    dimensions,
    vector: typed,
    contentHash: chunk.contentHash,
    embeddedAt,
  };
}

export function cosineSimilarity(left: ArrayLike<number>, right: ArrayLike<number>): number {
  if (left.length !== right.length || left.length === 0) throw new Error('Cosine similarity requires equal non-empty vectors.');
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function rankSemanticChunks(
  queryVector: ArrayLike<number>,
  chunks: MaisSemanticChunk[],
  embeddings: Map<string, MaisEmbeddingRecord>,
  options: MaisSemanticRetrievalOptions,
): MaisSemanticMatch[] {
  const kinds = options.kinds ? new Set(options.kinds) : null;
  const minimumScore = options.minimumScore ?? -1;
  const maximumPerDocument = Math.max(1, options.maximumPerDocument);
  const topK = Math.max(1, options.topK);
  const counts = new Map<string, number>();

  return chunks
    .filter((chunk) => !kinds || kinds.has(chunk.documentKind))
    .map((chunk): MaisSemanticMatch | null => {
      const embedding = embeddings.get(chunk.id);
      if (!embedding || embedding.contentHash !== chunk.contentHash || embedding.vector.length !== queryVector.length) return null;
      return { chunk, score: cosineSimilarity(queryVector, embedding.vector) };
    })
    .filter((match): match is MaisSemanticMatch => match !== null && match.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .filter((match) => {
      const count = counts.get(match.chunk.documentId) ?? 0;
      if (count >= maximumPerDocument) return false;
      counts.set(match.chunk.documentId, count + 1);
      return true;
    })
    .slice(0, topK);
}

export function compileSemanticContextSelection(
  rankedMatches: MaisSemanticMatch[],
  tokenBudget: number,
): MaisSemanticContextSelection {
  if (tokenBudget < 1) throw new Error('Semantic context token budget must be positive.');
  const matches: MaisSemanticMatch[] = [];
  let estimatedTokens = 0;

  for (const match of rankedMatches) {
    if (estimatedTokens + match.chunk.estimatedTokens > tokenBudget) continue;
    matches.push(match);
    estimatedTokens += match.chunk.estimatedTokens;
  }

  const documents = new Map<string, MaisSemanticContextSelection['documentSummaries'][number]>();
  for (const match of matches) {
    documents.set(match.chunk.documentId, {
      documentId: match.chunk.documentId,
      title: match.chunk.documentTitle,
      kind: match.chunk.documentKind,
    });
  }

  return {
    matches,
    documentSummaries: [...documents.values()],
    estimatedTokens,
    omittedMatchCount: rankedMatches.length - matches.length,
  };
}

export interface MaisSemanticIndexManifest {
  id: string;
  documentId: string;
  documentKind: MaisSemanticDocumentKind;
  chunkIds: string[];
  documentHash: string;
  indexedAt: string;
  embeddingModelId: 'google.embeddinggemma';
  dimensions: MaisEmbeddingRecord['dimensions'];
}

export function createSemanticIndexManifest(
  document: MaisSemanticDocument,
  chunks: MaisSemanticChunk[],
  dimensions: MaisEmbeddingRecord['dimensions'] = MAIS_DEFAULT_EMBEDDING_DIMENSIONS,
  indexedAt = new Date().toISOString(),
): MaisSemanticIndexManifest {
  const source = `${document.id}\n${document.updatedAt}\n${chunks.map((chunk) => chunk.contentHash).join('\n')}`;
  return {
    id: createId('mais_semantic_manifest'),
    documentId: document.id,
    documentKind: document.kind,
    chunkIds: chunks.map((chunk) => chunk.id),
    documentHash: stableSemanticHash(source),
    indexedAt,
    embeddingModelId: 'google.embeddinggemma',
    dimensions,
  };
}
