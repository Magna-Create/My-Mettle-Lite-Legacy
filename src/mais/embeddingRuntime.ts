import { Capacitor, registerPlugin } from '@capacitor/core';
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

interface MaisEmbeddingRuntimePlugin {
  getStatus(): Promise<MaisEmbeddingRuntimeStatus>;
  embed(options: {
    texts: string[];
    purpose: 'document' | 'query';
    dimensions: MaisEmbeddingRecord['dimensions'];
  }): Promise<NativeEmbeddingResult>;
}

const nativePlugin = registerPlugin<MaisEmbeddingRuntimePlugin>('MaisEmbeddingRuntime');

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
    const result = await nativePlugin.embed(input);
    if (result.dimensions !== input.dimensions || result.vectors.length !== input.texts.length) {
      throw new Error('EmbeddingGemma returned an incompatible result shape.');
    }
    return result.vectors.map((vector) => {
      if (vector.length !== input.dimensions || vector.some((value) => !Number.isFinite(value))) {
        throw new Error('EmbeddingGemma returned an invalid vector.');
      }
      return Float32Array.from(vector);
    });
  }
}

export async function readNativeMaisEmbeddingStatus(): Promise<MaisEmbeddingRuntimeStatus> {
  return new NativeMaisEmbeddingRuntime().status();
}
