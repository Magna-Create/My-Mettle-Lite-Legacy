import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { MaisModelArtifactDefinition } from './modelArtifacts';

export type MaisLiteRtBackend = 'cpu' | 'gpu';
export type MaisLiteRtRunState = 'loading' | 'generating' | 'completed' | 'cancelled' | 'failed';

export interface MaisLiteRtRunResult {
  state: MaisLiteRtRunState;
  success: boolean;
  modelId: string;
  runtime: 'litert-lm';
  runtimeVersion: string;
  backend: MaisLiteRtBackend;
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
  lastResult?: MaisLiteRtRunResult | null | undefined;
}

export interface MaisLiteRtProgress {
  state: MaisLiteRtRunState;
  backend: MaisLiteRtBackend;
  loadMs: number;
  outputChars?: number | null | undefined;
  capturedAtEpochMs: number;
}

interface MaisLiteRtRuntimePlugin {
  getStatus(): Promise<MaisLiteRtStatus>;
  runBaseline(options: {
    fileName: string;
    backend: MaisLiteRtBackend;
    prompt?: string;
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

export async function readMaisLiteRtStatus(): Promise<MaisLiteRtStatus> {
  if (!Capacitor.isNativePlatform()) return { running: false, lastResult: null };
  return nativePlugin.getStatus();
}

export async function runMaisLiteRtBaseline(
  artifact: MaisModelArtifactDefinition,
  backend: MaisLiteRtBackend,
): Promise<MaisLiteRtRunResult> {
  requireNative();
  return nativePlugin.runBaseline({ fileName: artifact.fileName, backend });
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
