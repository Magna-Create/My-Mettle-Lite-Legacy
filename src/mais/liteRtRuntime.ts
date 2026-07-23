import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { MaisModelArtifactDefinition } from './modelArtifacts';

export type MaisLiteRtBackend = 'cpu' | 'gpu' | 'npu';
export type MaisLiteRtRunState = 'loading' | 'generating' | 'completed' | 'cancelled' | 'failed';

export interface MaisLiteRtRunResult {
  state: MaisLiteRtRunState;
  success: boolean;
  modelId: string;
  runtime: 'litert-lm';
  runtimeVersion: string;
  backend: MaisLiteRtBackend;
  maxNumTokens: number;
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
  output: string;
  outputChars: number;
  error?: string | null | undefined;
}

export interface MaisLiteRtStatus {
  running: boolean;
  activeModelId?: string | null | undefined;
  lastResult?: MaisLiteRtRunResult | null | undefined;
}

export interface MaisLiteRtProgress {
  modelId: string;
  state: MaisLiteRtRunState;
  backend: MaisLiteRtBackend;
  loadMs: number;
  outputChars?: number | null | undefined;
  capturedAtEpochMs: number;
}

export interface MaisLiteRtPromptOptions {
  prompt: string;
  systemInstruction: string;
  maxNumTokens?: number | undefined;
}

interface MaisLiteRtRuntimePlugin {
  getStatus(options?: { modelId?: string }): Promise<MaisLiteRtStatus>;
  runBaseline(options: {
    modelId: string;
    fileName: string;
    backend: MaisLiteRtBackend;
    maxNumTokens: number;
    prompt?: string;
    systemInstruction?: string;
  }): Promise<MaisLiteRtRunResult>;
  cancelRun(): Promise<{ requested: boolean }>;
  addListener(
    eventName: 'modelInferenceProgress',
    listener: (event: MaisLiteRtProgress) => void,
  ): Promise<PluginListenerHandle>;
}

const nativePlugin = registerPlugin<MaisLiteRtRuntimePlugin>('MaisLiteRtRuntime');

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) throw new Error('LiteRT-LM inference is available in the Android app only.');
}

export async function readMaisLiteRtStatus(modelId?: string): Promise<MaisLiteRtStatus> {
  if (!Capacitor.isNativePlatform()) return { running: false, activeModelId: null, lastResult: null };
  return nativePlugin.getStatus(modelId ? { modelId } : undefined);
}

export async function runMaisLiteRtBaseline(
  artifact: MaisModelArtifactDefinition,
  backend: MaisLiteRtBackend,
): Promise<MaisLiteRtRunResult> {
  return runMaisLiteRtPrompt(artifact, backend, {
    prompt: 'You are the first local MAIS model runtime check. Reply with exactly two short sentences: first confirm you are running locally, then name one reason typed evidence is safer than an endless chat transcript.',
    systemInstruction: 'You are a bounded local runtime check for My Mettle. Be concise, factual and do not claim access to any training data.',
    maxNumTokens: artifact.contextTokens,
  });
}

export async function runMaisLiteRtPrompt(
  artifact: MaisModelArtifactDefinition,
  backend: MaisLiteRtBackend,
  options: MaisLiteRtPromptOptions,
): Promise<MaisLiteRtRunResult> {
  requireNative();
  if (artifact.runtime !== 'litert-lm') throw new Error(`${artifact.displayName} is not a LiteRT-LM generative model.`);
  if (!artifact.backendCandidates.includes(backend)) throw new Error(`${artifact.displayName} does not register ${backend.toUpperCase()} as a candidate backend.`);
  if (backend === 'npu' && !artifact.fileName.includes('_qualcomm_')) {
    throw new Error(`${artifact.displayName} is a generic CPU/GPU artefact and cannot be opened through the Qualcomm NPU executor. Install and select the dedicated _qualcomm_sm8750.litertlm build.`);
  }
  return nativePlugin.runBaseline({
    modelId: artifact.modelId,
    fileName: artifact.fileName,
    backend,
    maxNumTokens: options.maxNumTokens ?? artifact.contextTokens,
    prompt: options.prompt,
    systemInstruction: options.systemInstruction,
  });
}

export async function cancelMaisLiteRtRun(): Promise<boolean> {
  requireNative();
  return (await nativePlugin.cancelRun()).requested;
}

export async function subscribeMaisLiteRtProgress(
  listener: (event: MaisLiteRtProgress) => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => undefined;
  const handle = await nativePlugin.addListener('modelInferenceProgress', listener);
  return async () => handle.remove();
}
