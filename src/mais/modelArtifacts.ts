import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import artifactsJson from '../../models/artifacts.json';

export type MaisModelArtifactState = 'absent' | 'partial' | 'downloading' | 'unverified' | 'verifying' | 'ready' | 'failed';
export type MaisArtifactIntegrityMode = 'sha256' | 'trust_on_first_use' | 'manual';
export type MaisArtifactDownloadPolicy = 'direct' | 'manual';

export interface MaisModelArtifactDefinition {
  artifactId: string;
  modelId: string;
  displayName: string;
  runtime: 'litert-lm' | 'litert' | string;
  runtimeVersion: string;
  backendCandidates: string[];
  defaultBackend: string;
  roleSlots: string[];
  contextTokens: number;
  sourceRepository: string;
  sourceRevision: string;
  downloadUrl: string;
  fileName: string;
  format: string;
  approximateBytes: number;
  integrityMode: MaisArtifactIntegrityMode;
  sha256: string;
  licence: string;
  downloadPolicy: MaisArtifactDownloadPolicy;
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
  actualSha256?: string | null | undefined;
  cancelled?: boolean | undefined;
}

export interface MaisModelDownloadProgress {
  artifactId: string;
  state: MaisModelArtifactState | 'downloaded' | 'cancelled' | 'ready';
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
  integrityMode: MaisArtifactIntegrityMode;
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

export function getMaisGenerativeArtifacts(): MaisModelArtifactDefinition[] {
  return getMaisModelArtifacts().filter((artifact) => artifact.runtime === 'litert-lm');
}

export function getFirstMaisRuntimeArtifact(): MaisModelArtifactDefinition {
  const artifact = registry[0];
  if (!artifact) throw new Error('No MAIS runtime artefact is registered.');
  return structuredClone(artifact);
}

export function getMaisModelArtifact(artifactId: string): MaisModelArtifactDefinition {
  const artifact = registry.find((candidate) => candidate.artifactId === artifactId);
  if (!artifact) throw new Error(`MAIS model artefact ${artifactId} is not registered.`);
  return structuredClone(artifact);
}

export function canDirectlyDownloadMaisArtifact(artifact: MaisModelArtifactDefinition): boolean {
  return artifact.downloadPolicy === 'direct' && artifact.downloadUrl.startsWith('https://');
}

function callFor(artifact: MaisModelArtifactDefinition): ArtifactCall {
  return {
    artifactId: artifact.artifactId,
    fileName: artifact.fileName,
    sha256: artifact.sha256,
    integrityMode: artifact.integrityMode,
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
      actualSha256: null,
    };
  }
  return nativePlugin.getStatus(callFor(artifact));
}

export async function readAllMaisModelArtifactStatuses(): Promise<Map<string, MaisModelArtifactStatus>> {
  const entries = await Promise.all(getMaisModelArtifacts().map(async (artifact) => [
    artifact.artifactId,
    await readMaisModelArtifactStatus(artifact),
  ] as const));
  return new Map(entries);
}

export async function downloadMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  if (!canDirectlyDownloadMaisArtifact(artifact)) {
    throw new Error(`${artifact.displayName} requires a manual licence/access step before installation.`);
  }
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
