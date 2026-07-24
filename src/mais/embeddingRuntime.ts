import { Capacitor, registerPlugin } from '@capacitor/core';
import { withMaisHighPriorityWork } from './highPriorityWork';
import type { MaisEmbeddingRuntime } from './semanticIndexCoordinator';
import type { MaisEmbeddingRecord } from './semanticMemory';

export interface MaisEmbeddingRuntimeStatus {
  ready: boolean;
  modelInstalled: boolean;
  tokenizerInstalled: boolean;
  modelBytes: number;
  tokenizerBytes: number;
  sourceDimensions: number;
  backend: string;
  acceleratorClaim: string;
  initialized: boolean;
  initializedAtEpochMs: number;
}

interface NativeEmbeddingResult {
  vectors: number[][];
  dimensions: number;
  sourceDimensions: number;
  backend: string;
  acceleratorClaim: string;
  loadMs: number;
  totalMs: number;
  batchSize: number;
}

export interface MaisEmbeddingProbeResult {
  success: boolean;
  dimensions: number;
  sourceDimensions: number;
  backend: string;
  acceleratorClaim: string;
  documentLoadMs: number;
  documentTotalMs: number;
  queryLoadMs: number;
  queryTotalMs: number;
  matchingScore: number;
  unrelatedScore: number;
  margin: number;
  error?: string | undefined;
}

interface MaisEmbeddingRuntimePlugin {
  getStatus(): Promise<MaisEmbeddingRuntimeStatus>;
  embed(options: {
    texts: string[];
    purpose: 'document' | 'query';
    dimensions: MaisEmbeddingRecord['dimensions'];
  }): Promise<NativeEmbeddingResult>;
}

const nativePlugin = registerPlugin<MaisEmbeddingRuntimePlugin>('MaisEmbeddingRuntime');

function validateResult(
  result: NativeEmbeddingResult,
  expectedCount: number,
  dimensions: MaisEmbeddingRecord['dimensions'],
): Float32Array[] {
  if (result.dimensions !== dimensions || result.vectors.length !== expectedCount) {
    throw new Error('EmbeddingGemma returned an incompatible result shape.');
  }
  return result.vectors.map((vector) => {
    if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('EmbeddingGemma returned an invalid vector.');
    }
    return Float32Array.from(vector);
  });
}

function dot(left: ArrayLike<number>, right: ArrayLike<number>): number {
  if (left.length !== right.length) throw new Error('Embedding vectors use different dimensions.');
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result += left[index]! * right[index]!;
  return result;
}

export class NativeMaisEmbeddingRuntime implements MaisEmbeddingRuntime {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  async status(): Promise<MaisEmbeddingRuntimeStatus> {
    if (!this.isAvailable()) {
      return {
        ready: false,
        modelInstalled: false,
        tokenizerInstalled: false,
        modelBytes: 0,
        tokenizerBytes: 0,
        sourceDimensions: 768,
        backend: 'unavailable',
        acceleratorClaim: 'none',
        initialized: false,
        initializedAtEpochMs: 0,
      };
    }
    return nativePlugin.getStatus();
  }

  async embed(input: {
    texts: string[];
    purpose: 'document' | 'query';
    dimensions: MaisEmbeddingRecord['dimensions'];
  }): Promise<ArrayLike<number>[]> {
    if (!this.isAvailable()) throw new Error('EmbeddingGemma is available in the Android app only.');
    if (input.texts.length === 0) return [];
    return withMaisHighPriorityWork('embedding-index', `Embedding ${input.texts.length} ${input.purpose} item${input.texts.length === 1 ? '' : 's'}`, async () =>
      validateResult(await nativePlugin.embed(input), input.texts.length, input.dimensions));
  }
}

export async function readNativeMaisEmbeddingStatus(): Promise<MaisEmbeddingRuntimeStatus> {
  return new NativeMaisEmbeddingRuntime().status();
}

export async function runNativeMaisEmbeddingProbe(): Promise<MaisEmbeddingProbeResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: false,
      dimensions: 256,
      sourceDimensions: 768,
      backend: 'unavailable',
      acceleratorClaim: 'none',
      documentLoadMs: 0,
      documentTotalMs: 0,
      queryLoadMs: 0,
      queryTotalMs: 0,
      matchingScore: 0,
      unrelatedScore: 0,
      margin: 0,
      error: 'EmbeddingGemma is available in the Android app only.',
    };
  }
  try {
    return await withMaisHighPriorityWork('embedding-index', 'Running the EmbeddingGemma probe', async () => {
      const dimensions = 256 as const;
      const documentResult = await nativePlugin.embed({
        texts: [
          'Hack squat performance improved while knee comfort remained good across comparable exposures.',
          'The user prefers a light carbohydrate meal before an evening workout.',
        ],
        purpose: 'document',
        dimensions,
      });
      const documents = validateResult(documentResult, 2, dimensions);
      const queryResult = await nativePlugin.embed({
        texts: ['What does the evidence say about hack squat performance and knee comfort?'],
        purpose: 'query',
        dimensions,
      });
      const [query] = validateResult(queryResult, 1, dimensions);
      const matchingScore = dot(query!, documents[0]!);
      const unrelatedScore = dot(query!, documents[1]!);
      return {
        success: true,
        dimensions,
        sourceDimensions: documentResult.sourceDimensions,
        backend: documentResult.backend,
        acceleratorClaim: documentResult.acceleratorClaim,
        documentLoadMs: documentResult.loadMs,
        documentTotalMs: documentResult.totalMs,
        queryLoadMs: queryResult.loadMs,
        queryTotalMs: queryResult.totalMs,
        matchingScore,
        unrelatedScore,
        margin: matchingScore - unrelatedScore,
      };
    });
  } catch (reason) {
    return {
      success: false,
      dimensions: 256,
      sourceDimensions: 768,
      backend: 'litert-aot-precompiled',
      acceleratorClaim: 'unverified_until_device_probe',
      documentLoadMs: 0,
      documentTotalMs: 0,
      queryLoadMs: 0,
      queryTotalMs: 0,
      matchingScore: 0,
      unrelatedScore: 0,
      margin: 0,
      error: reason instanceof Error ? reason.message : String(reason),
    };
  }
}
