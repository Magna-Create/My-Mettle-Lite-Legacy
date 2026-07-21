import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import artifactsJson from '../../models/artifacts.json';

export type MaisModelArtifactState = 'absent' | 'partial' | 'downloading' | 'unverified' | 'verifying' | 'ready' | 'failed';

export interface MaisModelArtifactDefinition {
  artifactId: string;
  modelId: string;
  displayName: string;
  runtime: string;
  runtimeVersion: string;
  backendCandidates: string[];
  sourceRepository: string;
  sourceRevision: string;
  downloadUrl: string;
  fileName: string;
  format: string;
  approximateBytes: number;
  sha256: string;
  licence: string;
  status: string;
  notes: string;
}

export interface MaisModelArtifactStatus {
  artifactId: string;
  state: MaisModelArtifactState;
  installed: boolean;
  verified: boolean;
  bytes: number;
  partialBytes: number;
  availableBytes: number;
  modelPath?: string | null | undefined;
  cancelled?: boolean | undefined;
}

export interface MaisModelDownloadProgress {
  artifactId: string;
  state: MaisModelArtifactState | 'downloaded' | 'cancelled';
  downloadedBytes: number;
  totalBytes: number;
  percent?: number | null | undefined;
}

interface MaisModelRuntimePlugin {
  getStatus(options: ArtifactCall): Promise<MaisModelArtifactStatus>;
  verifyModel(options: ArtifactCall): Promise<MaisModelArtifactStatus>;
  downloadModel(options: DownloadCall): Promise<MaisModelArtifactStatus>;
  cancelDownload(options: Pick<ArtifactCall, 'artifactId'>): Promise<{ requested: boolean }>;
  deleteModel(options: ArtifactCall): Promise<MaisModelArtifactStatus>;
  addListener(
    eventName: 'modelDownloadProgress',
    listener: (event: MaisModelDownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
}

interface ArtifactCall {
  artifactId: string;
  fileName: string;
  sha256: string;
}

interface DownloadCall extends ArtifactCall {
  downloadUrl: string;
  approximateBytes: number;
}

const nativePlugin = registerPlugin<MaisModelRuntimePlugin>('MaisModelRuntime');
const registry = artifactsJson as MaisModelArtifactDefinition[];

export function getMaisModelArtifacts(): MaisModelArtifactDefinition[] {
  return structuredClone(registry);
}

export function getFirstMaisRuntimeArtifact(): MaisModelArtifactDefinition {
  const artifact = registry[0];
  if (!artifact) throw new Error('No MAIS runtime artefact is registered.');
  return structuredClone(artifact);
}

function callFor(artifact: MaisModelArtifactDefinition): ArtifactCall {
  return {
    artifactId: artifact.artifactId,
    fileName: artifact.fileName,
    sha256: artifact.sha256,
  };
}

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) throw new Error('Model installation is available in the Android app only.');
}

export async function readMaisModelArtifactStatus(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      artifactId: artifact.artifactId,
      state: 'absent',
      installed: false,
      verified: false,
      bytes: 0,
      partialBytes: 0,
      availableBytes: 0,
      modelPath: null,
    };
  }
  return nativePlugin.getStatus(callFor(artifact));
}

export async function downloadMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  return nativePlugin.downloadModel({
    ...callFor(artifact),
    downloadUrl: artifact.downloadUrl,
    approximateBytes: artifact.approximateBytes,
  });
}

export async function verifyMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  return nativePlugin.verifyModel(callFor(artifact));
}

export async function cancelMaisModelDownload(artifactId: string): Promise<boolean> {
  requireNative();
  return (await nativePlugin.cancelDownload({ artifactId })).requested;
}

export async function deleteMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  return nativePlugin.deleteModel(callFor(artifact));
}

export async function subscribeMaisModelDownload(
  listener: (event: MaisModelDownloadProgress) => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => undefined;
  const handle = await nativePlugin.addListener('modelDownloadProgress', listener);
  return async () => handle.remove();
}

export function formatModelBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gib = bytes / (1024 ** 3);
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
  return `${Math.round(bytes / (1024 ** 2))} MB`;
}
