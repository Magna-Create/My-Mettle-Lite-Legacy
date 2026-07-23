import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import artifactsJson from '../../models/artifacts.json';

export type MaisModelArtifactState = 'absent' | 'partial' | 'downloading' | 'unverified' | 'verifying' | 'ready' | 'failed';
export type MaisArtifactIntegrityMode = 'sha256' | 'trust_on_first_use' | 'manual';
export type MaisArtifactDownloadPolicy = 'direct' | 'manual';

export interface MaisModelArtifactFileDefinition {
  fileName: string;
  downloadUrl: string;
  approximateBytes: number;
  integrityMode?: MaisArtifactIntegrityMode | undefined;
  sha256?: string | undefined;
}

export interface MaisModelArtifactDefinition {
  artifactId: string;
  modelId: string;
  displayName: string;
  runtime: 'litert-lm' | 'litert' | 'geniex-qairt' | string;
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
  files?: MaisModelArtifactFileDefinition[] | undefined;
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
  sourceFileName?: string | null | undefined;
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

interface MaisModelImportPlugin {
  pickAndImport(options: {
    artifactId: string;
    fileName: string;
    displayName: string;
    expectedExtension: string;
    minimumBytes: number;
    maximumBytes: number;
  }): Promise<MaisModelArtifactStatus>;
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

interface ResolvedArtifactFile extends MaisModelArtifactFileDefinition {
  childArtifactId: string;
  integrityMode: MaisArtifactIntegrityMode;
  sha256: string;
}

interface BundleProgressMetadata {
  parentArtifactId: string;
  bytesBeforeFile: number;
  fileApproximateBytes: number;
  totalApproximateBytes: number;
  finalFile: boolean;
}

const nativePlugin = registerPlugin<MaisModelRuntimePlugin>('MaisModelRuntime');
const importPlugin = registerPlugin<MaisModelImportPlugin>('MaisModelImport');
const registry = artifactsJson as MaisModelArtifactDefinition[];
const activeChildDownloadByArtifact = new Map<string, string>();
const bundleProgressByChild = new Map<string, BundleProgressMetadata>();

const embeddingGemmaTokenizer: MaisModelArtifactDefinition = {
  artifactId: 'google.embeddinggemma.sentencepiece-tokenizer',
  modelId: 'google.embeddinggemma',
  displayName: 'EmbeddingGemma tokenizer',
  runtime: 'sentencepiece',
  runtimeVersion: 'model-file',
  backendCandidates: [],
  defaultBackend: 'none',
  roleSlots: ['tokenizer'],
  contextTokens: 0,
  sourceRepository: 'litert-community/embeddinggemma-300m',
  sourceRevision: 'main',
  downloadUrl: '',
  fileName: 'sentencepiece.model',
  format: '.model',
  approximateBytes: 4_700_000,
  integrityMode: 'manual',
  sha256: '',
  licence: 'Gemma licence — user acceptance required on Hugging Face',
  downloadPolicy: 'manual',
  status: 'access_required',
  notes: 'Tokenizer required to convert text into the token IDs consumed by the imported EmbeddingGemma TFLite model.',
};

export function getMaisModelArtifacts(): MaisModelArtifactDefinition[] {
  return structuredClone(registry);
}

export function getMaisGenerativeArtifacts(): MaisModelArtifactDefinition[] {
  return getMaisModelArtifacts().filter((artifact) => ['litert-lm', 'geniex-qairt'].includes(artifact.runtime));
}

export function getMaisLiteRtGenerativeArtifacts(): MaisModelArtifactDefinition[] {
  return getMaisModelArtifacts().filter((artifact) => artifact.runtime === 'litert-lm');
}

export function getEmbeddingGemmaTokenizerArtifact(): MaisModelArtifactDefinition {
  return structuredClone(embeddingGemmaTokenizer);
}

export function getFirstMaisRuntimeArtifact(): MaisModelArtifactDefinition {
  const artifact = registry.find((candidate) => ['litert-lm', 'geniex-qairt'].includes(candidate.runtime));
  if (!artifact) throw new Error('No MAIS runtime artefact is registered.');
  return structuredClone(artifact);
}

export function getMaisModelArtifact(artifactId: string): MaisModelArtifactDefinition {
  const artifact = registry.find((candidate) => candidate.artifactId === artifactId);
  if (!artifact) throw new Error(`MAIS model artefact ${artifactId} is not registered.`);
  return structuredClone(artifact);
}

export function getMaisModelArtifactFiles(artifact: MaisModelArtifactDefinition): MaisModelArtifactFileDefinition[] {
  if (artifact.files?.length) return structuredClone(artifact.files);
  return [{
    fileName: artifact.fileName,
    downloadUrl: artifact.downloadUrl,
    approximateBytes: artifact.approximateBytes,
    integrityMode: artifact.integrityMode,
    sha256: artifact.sha256,
  }];
}

function resolvedFilesFor(artifact: MaisModelArtifactDefinition): ResolvedArtifactFile[] {
  const files = getMaisModelArtifactFiles(artifact);
  const bundle = files.length > 1;
  return files.map((file, index) => ({
    ...file,
    childArtifactId: bundle ? `${artifact.artifactId}.file.${index + 1}` : artifact.artifactId,
    integrityMode: file.integrityMode ?? artifact.integrityMode,
    sha256: file.sha256 ?? artifact.sha256,
  }));
}

export function canDirectlyDownloadMaisArtifact(artifact: MaisModelArtifactDefinition): boolean {
  return artifact.downloadPolicy === 'direct'
    && resolvedFilesFor(artifact).every((file) => file.downloadUrl.startsWith('https://'));
}

function callForFile(file: ResolvedArtifactFile): ArtifactCall {
  return {
    artifactId: file.childArtifactId,
    fileName: file.fileName,
    sha256: file.sha256,
    integrityMode: file.integrityMode,
  };
}

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) throw new Error('Model installation is available in the Android app only.');
}

function absentStatus(artifactId: string): MaisModelArtifactStatus {
  return {
    artifactId,
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

function aggregateStatuses(
  artifact: MaisModelArtifactDefinition,
  files: ResolvedArtifactFile[],
  statuses: MaisModelArtifactStatus[],
): MaisModelArtifactStatus {
  if (statuses.length === 1) return { ...statuses[0]!, artifactId: artifact.artifactId };

  const everyReady = statuses.every((status) => status.state === 'ready');
  const everyInstalled = statuses.every((status) => status.installed);
  const anyDownloading = statuses.some((status) => status.state === 'downloading');
  const anyVerifying = statuses.some((status) => status.state === 'verifying');
  const anyFailed = statuses.some((status) => status.state === 'failed');
  const anyRetained = statuses.some((status) => status.installed || status.partialBytes > 0);

  let state: MaisModelArtifactState = 'absent';
  if (everyReady) state = 'ready';
  else if (anyDownloading) state = 'downloading';
  else if (anyVerifying) state = 'verifying';
  else if (anyFailed) state = 'failed';
  else if (everyInstalled) state = 'unverified';
  else if (anyRetained) state = 'partial';

  const entrypointIndex = Math.max(0, files.findIndex((file) => file.fileName === artifact.fileName));
  const entrypointStatus = statuses[entrypointIndex] ?? statuses[0];
  const retainedBytes = statuses.reduce((sum, status) => sum + status.bytes + status.partialBytes, 0);

  return {
    artifactId: artifact.artifactId,
    state,
    installed: everyInstalled,
    verified: everyReady,
    bytes: statuses.reduce((sum, status) => sum + status.bytes, 0),
    partialBytes: everyReady ? 0 : retainedBytes,
    availableBytes: Math.min(...statuses.map((status) => status.availableBytes)),
    modelPath: everyReady ? entrypointStatus?.modelPath ?? null : null,
    actualSha256: null,
    sourceFileName: everyReady ? artifact.fileName : null,
    cancelled: statuses.some((status) => status.cancelled),
  };
}

export async function readMaisModelArtifactStatus(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  if (!Capacitor.isNativePlatform()) return absentStatus(artifact.artifactId);
  const files = resolvedFilesFor(artifact);
  const statuses = await Promise.all(files.map((file) => nativePlugin.getStatus(callForFile(file))));
  return aggregateStatuses(artifact, files, statuses);
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

  const files = resolvedFilesFor(artifact);
  const totalApproximateBytes = files.reduce((sum, file) => sum + file.approximateBytes, 0);
  let bytesBeforeFile = 0;

  for (const [index, file] of files.entries()) {
    bundleProgressByChild.set(file.childArtifactId, {
      parentArtifactId: artifact.artifactId,
      bytesBeforeFile,
      fileApproximateBytes: file.approximateBytes,
      totalApproximateBytes,
      finalFile: index === files.length - 1,
    });

    let current = await nativePlugin.getStatus(callForFile(file));
    if (current.state === 'unverified') current = await nativePlugin.verifyModel(callForFile(file));
    if (current.state !== 'ready') {
      activeChildDownloadByArtifact.set(artifact.artifactId, file.childArtifactId);
      current = await nativePlugin.downloadModel({
        ...callForFile(file),
        downloadUrl: file.downloadUrl,
        approximateBytes: file.approximateBytes,
      });
      activeChildDownloadByArtifact.delete(artifact.artifactId);
      if (current.cancelled) break;
    }
    bytesBeforeFile += file.approximateBytes;
  }

  activeChildDownloadByArtifact.delete(artifact.artifactId);
  return readMaisModelArtifactStatus(artifact);
}

export async function importMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  if (artifact.files?.length) throw new Error(`${artifact.displayName} is a multi-file pack and cannot be imported as one local file.`);
  if (artifact.downloadPolicy !== 'manual' || !['.tflite', '.model', '.litertlm'].includes(artifact.format)) {
    throw new Error(`${artifact.displayName} is not configured for local-file import.`);
  }
  const minimumRatio = artifact.format === '.model' ? 0.2 : 0.5;
  const minimumFloor = artifact.format === '.model' ? 512 * 1024 : 32 * 1024 * 1024;
  const minimumBytes = Math.max(minimumFloor, Math.floor(artifact.approximateBytes * minimumRatio));
  const maximumBytes = Math.max(minimumBytes, Math.ceil(artifact.approximateBytes * 2.5));
  return importPlugin.pickAndImport({
    artifactId: artifact.artifactId,
    fileName: artifact.fileName,
    displayName: artifact.displayName,
    expectedExtension: artifact.format,
    minimumBytes,
    maximumBytes,
  });
}

export async function verifyMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  for (const file of resolvedFilesFor(artifact)) await nativePlugin.verifyModel(callForFile(file));
  return readMaisModelArtifactStatus(artifact);
}

export async function cancelMaisModelDownload(artifactId: string): Promise<boolean> {
  requireNative();
  const activeId = activeChildDownloadByArtifact.get(artifactId) ?? artifactId;
  return (await nativePlugin.cancelDownload({ artifactId: activeId })).requested;
}

export async function deleteMaisModelArtifact(
  artifact: MaisModelArtifactDefinition,
): Promise<MaisModelArtifactStatus> {
  requireNative();
  const activeId = activeChildDownloadByArtifact.get(artifact.artifactId);
  if (activeId) await nativePlugin.cancelDownload({ artifactId: activeId });
  for (const file of resolvedFilesFor(artifact)) await nativePlugin.deleteModel(callForFile(file));
  activeChildDownloadByArtifact.delete(artifact.artifactId);
  return readMaisModelArtifactStatus(artifact);
}

export async function subscribeMaisModelDownload(
  listener: (event: MaisModelDownloadProgress) => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => undefined;
  const handle = await nativePlugin.addListener('modelDownloadProgress', (event) => {
    const metadata = bundleProgressByChild.get(event.artifactId);
    if (!metadata) {
      listener(event);
      return;
    }
    const downloadedWithinFile = metadata.fileApproximateBytes > 0
      ? Math.min(event.downloadedBytes, metadata.fileApproximateBytes)
      : event.downloadedBytes;
    const downloadedBytes = Math.min(
      metadata.totalApproximateBytes,
      metadata.bytesBeforeFile + downloadedWithinFile,
    );
    const state = event.state === 'ready' && !metadata.finalFile ? 'downloading' : event.state;
    listener({
      artifactId: metadata.parentArtifactId,
      state,
      downloadedBytes,
      totalBytes: metadata.totalApproximateBytes,
      percent: metadata.totalApproximateBytes > 0
        ? Math.min(100, downloadedBytes * 100 / metadata.totalApproximateBytes)
        : null,
    });
  });
  return async () => handle.remove();
}

export function formatModelBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gib = bytes / (1024 ** 3);
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
  return `${Math.round(bytes / (1024 ** 2))} MB`;
}
