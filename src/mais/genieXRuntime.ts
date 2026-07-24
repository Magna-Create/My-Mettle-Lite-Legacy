import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  readMaisModelArtifactStatus,
  type MaisModelArtifactDefinition,
} from './modelArtifacts';

export type MaisGenieXRunState = 'loading' | 'generating' | 'completed' | 'cancelled' | 'failed';

export interface MaisGenieXProfileMetrics {
  available: boolean;
  timeToFirstTokenMs?: number | null | undefined;
  promptProcessingTimeMs?: number | null | undefined;
  decodeTimeMs?: number | null | undefined;
  tokenGenerationRate?: number | null | undefined;
  tokenGenerationRateUnit?: string | null | undefined;
  promptProcessingRate?: number | null | undefined;
  promptProcessingRateUnit?: string | null | undefined;
  promptTokens?: number | null | undefined;
  generatedTokens?: number | null | undefined;
  stopReason?: string | null | undefined;
}

export interface MaisGenieXRunResult {
  state: MaisGenieXRunState;
  success: boolean;
  modelId: string;
  runtime: 'geniex-qairt';
  runtimeVersion: string;
  sdkVersion: string;
  distribution: 'maven-central';
  backend: 'npu';
  contextTokens: number;
  thinkingEnabled: true;
  thinkingObserved: boolean;
  thinkingCharacters: number;
  reasoningContentStored: false;
  startedAtEpochMs: number;
  completedAtEpochMs: number;
  loadMs: number;
  firstChunkLatencyMs: number;
  generationMs: number;
  unloadMs: number;
  totalMs: number;
  memoryBeforeBytes: number;
  peakPssBytes: number;
  memoryAfterBytes: number;
  finalOutput: string;
  outputChars: number;
  profile: MaisGenieXProfileMetrics;
  error?: string | null | undefined;
}

export interface MaisGenieXRuntimeStatus {
  ready: boolean;
  running: boolean;
  modelId: string;
  runtime: 'geniex-qairt';
  runtimeVersion: string;
  sdkVersion: string;
  distribution: 'maven-central';
  backend: 'npu';
  contextTokens: number;
  thinkingEnabled: boolean;
  bundleReady: boolean;
  missingModelFiles: string[];
  runtimeInstalled: boolean;
  bridgeLoaded: boolean;
  bridgeError?: string | null | undefined;
  lastResult?: MaisGenieXRunResult | null | undefined;
}

export interface MaisGenieXProgress {
  modelId: string;
  state: MaisGenieXRunState;
  backend: 'npu';
  loadMs: number;
  outputChars: number;
  capturedAtEpochMs: number;
}

interface MaisGenieXRuntimePlugin {
  getStatus(): Promise<MaisGenieXRuntimeStatus>;
  runBaseline(options: {
    modelId: string;
    prompt?: string;
    systemInstruction?: string;
  }): Promise<MaisGenieXRunResult>;
  cancelRun(): Promise<{ requested: boolean; supported: boolean; reason?: string }>;
  addListener(
    eventName: 'genieXInferenceProgress',
    listener: (event: MaisGenieXProgress) => void,
  ): Promise<PluginListenerHandle>;
}

const nativePlugin = registerPlugin<MaisGenieXRuntimePlugin>('MaisGenieXRuntime');

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) throw new Error('GenieX inference is available in the Android app only.');
}

export async function readMaisGenieXStatus(): Promise<MaisGenieXRuntimeStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      ready: false,
      running: false,
      modelId: 'qwen.qwen3-4b',
      runtime: 'geniex-qairt',
      runtimeVersion: 'GenieX Android 0.3.5',
      sdkVersion: '0.3.5',
      distribution: 'maven-central',
      backend: 'npu',
      contextTokens: 12_288,
      thinkingEnabled: true,
      bundleReady: false,
      missingModelFiles: [],
      runtimeInstalled: false,
      bridgeLoaded: false,
      bridgeError: 'Android native runtime unavailable.',
      lastResult: null,
    };
  }
  return nativePlugin.getStatus();
}

export async function runMaisGenieXBaseline(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisGenieXRunResult> {
  requireNative();
  if (artifact.runtime !== 'geniex-qairt') throw new Error(`${artifact.displayName} is not a GenieX QAIRT model pack.`);
  if (artifact.modelId !== 'qwen.qwen3-4b') throw new Error('The current GenieX adapter supports Qwen3-4B only.');
  const installation = await readMaisModelArtifactStatus(artifact);
  if (installation.state !== 'ready' || !installation.verified) {
    throw new Error('Verify the complete Qwen3-4B 12K pack before starting native inference.');
  }
  return nativePlugin.runBaseline({ modelId: artifact.modelId });
}

export async function cancelMaisGenieXRun(): Promise<{ requested: boolean; supported: boolean; reason?: string }> {
  requireNative();
  return nativePlugin.cancelRun();
}

export async function subscribeMaisGenieXProgress(
  listener: (event: MaisGenieXProgress) => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => undefined;
  const handle = await nativePlugin.addListener('genieXInferenceProgress', listener);
  return async () => handle.remove();
}
