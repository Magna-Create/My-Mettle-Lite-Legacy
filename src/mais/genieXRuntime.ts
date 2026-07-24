import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { withMaisHighPriorityWork } from './highPriorityWork';
import {
  readMaisModelArtifactStatus,
  type MaisModelArtifactDefinition,
} from './modelArtifacts';

export type MaisGenieXRunState =
  | 'preparing'
  | 'importing'
  | 'initialising'
  | 'loading'
  | 'generating'
  | 'completed'
  | 'cancelled'
  | 'failed';

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

export interface MaisGenieXPrepareResult {
  success: boolean;
  state: 'completed' | 'failed';
  modelId: string;
  imported: boolean;
  totalMs: number;
  sourceBundleBytes: number;
  cachedBundleBytes: number;
  modelPath?: string | null | undefined;
  error?: string | null | undefined;
}

export interface MaisGenieXRuntimeStage {
  capturedAtEpochMs: number;
  component: string;
  stage: string;
  state: string;
  detail?: string | null | undefined;
  processPssBytes?: number | undefined;
  nativeHeapAllocatedBytes?: number | undefined;
  javaHeapUsedBytes?: number | undefined;
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
  modelPrepared: boolean;
  preparedModelPath?: string | null | undefined;
  sourceBundleBytes: number;
  cachedBundleBytes: number;
  missingModelFiles: string[];
  runtimeInstalled: boolean;
  bridgeLoaded: boolean;
  bridgeError?: string | null | undefined;
  lastNativeStage?: MaisGenieXRuntimeStage | null | undefined;
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
  prepareModel(options: { modelId: string }): Promise<MaisGenieXPrepareResult>;
  clearPreparedModel(options: { modelId: string }): Promise<{ cleared: boolean }>;
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
      modelPrepared: false,
      preparedModelPath: null,
      sourceBundleBytes: 0,
      cachedBundleBytes: 0,
      missingModelFiles: [],
      runtimeInstalled: false,
      bridgeLoaded: false,
      bridgeError: 'Android native runtime unavailable.',
      lastNativeStage: null,
      lastResult: null,
    };
  }
  return nativePlugin.getStatus();
}

function validateArtifact(artifact: MaisModelArtifactDefinition): void {
  requireNative();
  if (artifact.runtime !== 'geniex-qairt') throw new Error(`${artifact.displayName} is not a GenieX QAIRT model pack.`);
  if (artifact.modelId !== 'qwen.qwen3-4b') throw new Error('The current GenieX adapter supports Qwen3-4B only.');
}

async function requireVerifiedPack(artifact: MaisModelArtifactDefinition): Promise<void> {
  const installation = await readMaisModelArtifactStatus(artifact);
  if (installation.state !== 'ready' || !installation.verified) {
    throw new Error('Verify the complete Qwen3-4B 12K pack before starting native inference.');
  }
}

export async function prepareMaisGenieXModel(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisGenieXPrepareResult> {
  validateArtifact(artifact);
  await requireVerifiedPack(artifact);
  return withMaisHighPriorityWork('model-import', 'Preparing Qwen3-4B for GenieX', () =>
    nativePlugin.prepareModel({ modelId: artifact.modelId }));
}

export async function clearMaisGenieXPreparedModel(
  artifact: MaisModelArtifactDefinition,
): Promise<boolean> {
  validateArtifact(artifact);
  return withMaisHighPriorityWork('developer-operation', 'Clearing the GenieX Qwen cache', async () =>
    (await nativePlugin.clearPreparedModel({ modelId: artifact.modelId })).cleared);
}

export async function runMaisGenieXBaseline(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisGenieXRunResult> {
  validateArtifact(artifact);
  await requireVerifiedPack(artifact);
  const status = await nativePlugin.getStatus();
  if (!status.modelPrepared) {
    throw new Error('Prepare the verified Qwen pack for GenieX before loading the NPU model.');
  }
  return withMaisHighPriorityWork('model-generation', 'Loading and running Qwen3-4B on the NPU', () =>
    nativePlugin.runBaseline({ modelId: artifact.modelId }));
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
