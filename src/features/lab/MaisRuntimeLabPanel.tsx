import { useEffect, useMemo, useState } from 'react';
import {
  canDirectlyDownloadMaisArtifact,
  cancelMaisModelDownload,
  deleteMaisModelArtifact,
  downloadMaisModelArtifact,
  formatModelBytes,
  getMaisModelArtifacts,
  readMaisModelArtifactStatus,
  subscribeMaisModelDownload,
  verifyMaisModelArtifact,
  type MaisModelArtifactDefinition,
  type MaisModelArtifactStatus,
  type MaisModelDownloadProgress,
} from '../../mais/modelArtifacts';
import {
  cancelMaisLiteRtRun,
  readMaisLiteRtStatus,
  runMaisLiteRtBaseline,
  subscribeMaisLiteRtProgress,
  type MaisLiteRtBackend,
  type MaisLiteRtProgress,
  type MaisLiteRtRunResult,
  type MaisLiteRtStatus,
} from '../../mais/liteRtRuntime';

function statusLabel(status: MaisModelArtifactStatus | null | undefined): string {
  if (!status) return 'Checking';
  switch (status.state) {
    case 'ready': return 'Verified and ready';
    case 'downloading': return 'Downloading';
    case 'partial': return 'Partial download';
    case 'unverified': return 'Installed · verification required';
    case 'verifying': return 'Verifying';
    case 'failed': return 'Failed';
    default: return 'Not installed';
  }
}

function progressText(
  status: MaisModelArtifactStatus | null | undefined,
  progress: MaisModelDownloadProgress | null | undefined,
): string | null {
  if (progress?.state === 'downloading') {
    const total = progress.totalBytes > 0 ? ` / ${formatModelBytes(progress.totalBytes)}` : '';
    const percent = typeof progress.percent === 'number' ? ` · ${progress.percent.toFixed(1)}%` : '';
    return `${formatModelBytes(progress.downloadedBytes)}${total}${percent}`;
  }
  if (status?.partialBytes) return `${formatModelBytes(status.partialBytes)} retained for resume`;
  if (status?.bytes) return formatModelBytes(status.bytes);
  return null;
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Not recorded';
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)} s`;
}

function runLabel(progress: MaisLiteRtProgress | null, status: MaisLiteRtStatus | null): string {
  if (progress?.state === 'loading') return `Loading on ${progress.backend.toUpperCase()}`;
  if (progress?.state === 'generating') return `Generating on ${progress.backend.toUpperCase()}`;
  if (status?.running) return 'Runtime active';
  return 'Runtime idle';
}

function resultState(result: MaisLiteRtRunResult): string {
  if (result.state === 'completed') return 'Completed';
  if (result.state === 'cancelled') return 'Cancelled';
  return 'Failed';
}

function backendLabel(backend: string): string {
  if (backend === 'npu') return 'NPU probe';
  return backend.toUpperCase();
}

export function MaisRuntimeLabPanel() {
  const artifacts = useMemo(() => getMaisModelArtifacts(), []);
  const initialArtifact = artifacts.find((artifact) => artifact.runtime === 'litert-lm') ?? artifacts[0];
  const [selectedArtifactId, setSelectedArtifactId] = useState(initialArtifact?.artifactId ?? '');
  const [statuses, setStatuses] = useState<Record<string, MaisModelArtifactStatus>>({});
  const [progressByArtifact, setProgressByArtifact] = useState<Record<string, MaisModelDownloadProgress>>({});
  const [busyArtifactId, setBusyArtifactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MaisLiteRtStatus | null>(null);
  const [runtimeProgress, setRuntimeProgress] = useState<MaisLiteRtProgress | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const selectedArtifact = artifacts.find((artifact) => artifact.artifactId === selectedArtifactId) ?? initialArtifact ?? null;
  const selectedStatus = selectedArtifact ? statuses[selectedArtifact.artifactId] : undefined;

  async function refreshArtifacts(): Promise<void> {
    const entries = await Promise.all(artifacts.map(async (artifact) => [
      artifact.artifactId,
      await readMaisModelArtifactStatus(artifact),
    ] as const));
    setStatuses(Object.fromEntries(entries));
  }

  async function refreshRuntime(modelId?: string): Promise<void> {
    setRuntimeStatus(await readMaisLiteRtStatus(modelId));
  }

  async function refresh(): Promise<void> {
    try {
      await Promise.all([
        refreshArtifacts(),
        refreshRuntime(selectedArtifact?.modelId),
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Runtime Lab status could not be read.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    let disposeDownload: (() => Promise<void>) | undefined;
    let disposeRuntime: (() => Promise<void>) | undefined;
    void (async () => {
      await refreshArtifacts();
      if (selectedArtifact) setRuntimeStatus(await readMaisLiteRtStatus(selectedArtifact.modelId));
      disposeDownload = await subscribeMaisModelDownload((event) => {
        if (cancelled) return;
        setProgressByArtifact((current) => ({ ...current, [event.artifactId]: event }));
        setStatuses((current) => {
          const existing = current[event.artifactId];
          if (!existing) return current;
          return {
            ...current,
            [event.artifactId]: {
              ...existing,
              state: event.state === 'downloaded' ? 'verifying' : event.state === 'cancelled' ? 'partial' : event.state === 'ready' ? 'ready' : event.state,
              partialBytes: event.downloadedBytes,
            },
          };
        });
      });
      disposeRuntime = await subscribeMaisLiteRtProgress((event) => {
        if (cancelled) return;
        setRuntimeProgress(event);
        setRuntimeStatus((current) => ({
          ...current,
          running: ['loading', 'generating'].includes(event.state),
          activeModelId: event.modelId,
        }));
      });
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Runtime Lab could not initialise.');
    });
    return () => {
      cancelled = true;
      if (disposeDownload) void disposeDownload();
      if (disposeRuntime) void disposeRuntime();
    };
  }, []);

  useEffect(() => {
    if (!selectedArtifact) return;
    void refreshRuntime(selectedArtifact.modelId).catch((reason: unknown) => {
      setRuntimeError(reason instanceof Error ? reason.message : 'Runtime result could not be read.');
    });
  }, [selectedArtifactId]);

  async function runArtifactOperation(
    artifact: MaisModelArtifactDefinition,
    operation: () => Promise<MaisModelArtifactStatus>,
  ): Promise<void> {
    setBusyArtifactId(artifact.artifactId);
    setError(null);
    try {
      const next = await operation();
      setStatuses((current) => ({ ...current, [artifact.artifactId]: next }));
      setProgressByArtifact((current) => {
        const nextProgress = { ...current };
        delete nextProgress[artifact.artifactId];
        return nextProgress;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The model operation failed.');
      await refreshArtifacts();
    } finally {
      setBusyArtifactId(null);
    }
  }

  async function runBaseline(artifact: MaisModelArtifactDefinition, backend: MaisLiteRtBackend): Promise<void> {
    setSelectedArtifactId(artifact.artifactId);
    setRuntimeBusy(true);
    setRuntimeError(null);
    setRuntimeProgress({ modelId: artifact.modelId, state: 'loading', backend, loadMs: 0, outputChars: null, capturedAtEpochMs: Date.now() });
    try {
      const result = await runMaisLiteRtBaseline(artifact, backend);
      setRuntimeStatus({ running: false, activeModelId: null, lastResult: result });
      setRuntimeProgress(null);
    } catch (reason) {
      setRuntimeError(reason instanceof Error ? reason.message : 'LiteRT-LM inference failed.');
      setRuntimeStatus(await readMaisLiteRtStatus(artifact.modelId));
      setRuntimeProgress(null);
    } finally {
      setRuntimeBusy(false);
    }
  }

  const running = runtimeBusy || runtimeStatus?.running === true;
  const lastResult = runtimeStatus?.lastResult ?? null;

  return (
    <section className="paper-card mais-runtime-lab" aria-labelledby="mais-runtime-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">MAIS Runtime Lab · Phase 3B</p>
          <h2 id="mais-runtime-title">Local model pack</h2>
        </div>
        <span className="status-chip">{artifacts.filter((artifact) => statuses[artifact.artifactId]?.state === 'ready').length}/{artifacts.length} ready</span>
      </header>

      <p className="mais-runtime-note">
        Each role resolves to a capability slot rather than a hard-coded binary. Small frequent work defaults to CPU; normal and deep reasoning default to GPU. NPU remains an explicit compatibility probe until a model-specific accelerated path passes on this phone.
      </p>

      {error && <p className="mais-runtime-error" role="alert">{error}</p>}

      <div className="mais-model-pack">
        {artifacts.map((artifact) => {
          const status = statuses[artifact.artifactId];
          const progress = progressByArtifact[artifact.artifactId];
          const busy = busyArtifactId === artifact.artifactId;
          const downloading = busy && (status?.state === 'downloading' || progress?.state === 'downloading');
          const directDownload = canDirectlyDownloadMaisArtifact(artifact);
          const canDownload = directDownload && !busy && status?.state !== 'ready' && status?.state !== 'unverified';
          const canVerify = !busy && status?.state === 'unverified';
          const canDelete = !busy && !running && Boolean(status?.installed || status?.partialBytes);
          const selected = selectedArtifactId === artifact.artifactId;
          const roleText = artifact.roleSlots.join(' · ');

          return (
            <article className={`mais-runtime-model mais-model-card ${selected ? 'is-selected' : ''}`} key={artifact.artifactId}>
              <header>
                <div>
                  <strong>{artifact.displayName}</strong>
                  <p>{artifact.runtime} {artifact.runtimeVersion} · {formatModelBytes(artifact.approximateBytes)}</p>
                </div>
                <span className={`status-chip is-${status?.state ?? 'checking'}`}>{statusLabel(status)}</span>
              </header>

              <p className="mais-model-roles">{roleText}</p>

              <dl>
                <div><dt>Installed</dt><dd>{progressText(status, progress) ?? 'No'}</dd></div>
                <div><dt>Default</dt><dd>{artifact.defaultBackend.toUpperCase()}</dd></div>
                <div><dt>Context</dt><dd>{artifact.contextTokens.toLocaleString()} tokens</dd></div>
              </dl>

              {typeof progress?.percent === 'number' && (
                <div className="mais-runtime-progress" aria-label={`${artifact.displayName} download ${progress.percent.toFixed(1)} percent`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
                </div>
              )}

              {status?.actualSha256 && (
                <p className="mais-model-digest"><strong>{artifact.integrityMode === 'trust_on_first_use' ? 'Pinned on device' : 'SHA-256'}</strong><span>{status.actualSha256}</span></p>
              )}

              {artifact.downloadPolicy === 'manual' && (
                <p className="mais-runtime-note">Access must be accepted at the source before this gated retrieval model can be installed.</p>
              )}

              <div className="mais-runtime-actions">
                {canDownload && (
                  <button className="primary-action compact" type="button" onClick={() => void runArtifactOperation(artifact, () => downloadMaisModelArtifact(artifact))}>
                    {status?.state === 'partial' ? 'Resume download' : 'Download model'}
                  </button>
                )}
                {downloading && (
                  <button className="text-button" type="button" onClick={() => void cancelMaisModelDownload(artifact.artifactId)}>Cancel download</button>
                )}
                {canVerify && (
                  <button className="primary-action compact" type="button" onClick={() => void runArtifactOperation(artifact, () => verifyMaisModelArtifact(artifact))}>Verify model</button>
                )}
                {artifact.runtime === 'litert-lm' && status?.state === 'ready' && (
                  <button className="text-button" type="button" onClick={() => setSelectedArtifactId(artifact.artifactId)}>Select for benchmark</button>
                )}
                {canDelete && (
                  <button
                    className="text-button danger-text"
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete ${artifact.displayName} from this phone?`)) {
                        void runArtifactOperation(artifact, () => deleteMaisModelArtifact(artifact));
                      }
                    }}
                  >
                    Delete model
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {selectedArtifact?.runtime === 'litert-lm' && selectedStatus?.state === 'ready' && (
        <section className="mais-inference-lab" aria-labelledby="mais-inference-title">
          <header>
            <div>
              <p className="eyebrow">{selectedArtifact.displayName}</p>
              <h3 id="mais-inference-title">Measured inference</h3>
            </div>
            <span className="status-chip">{runLabel(runtimeProgress, runtimeStatus)}</span>
          </header>

          <p className="mais-runtime-note">
            Every run loads one model, executes one bounded prompt, records timing and process memory, then unloads it. The NPU button is a compatibility probe; it does not silently fall back to CPU or GPU.
          </p>

          {runtimeError && <p className="mais-runtime-error" role="alert">{runtimeError}</p>}

          <div className="mais-runtime-actions">
            {!running && selectedArtifact.backendCandidates.map((backend) => (
              <button
                className={backend === selectedArtifact.defaultBackend ? 'primary-action compact' : 'text-button'}
                type="button"
                key={backend}
                onClick={() => void runBaseline(selectedArtifact, backend as MaisLiteRtBackend)}
              >
                Run {backendLabel(backend)} baseline
              </button>
            ))}
            {running && <button className="text-button danger-text" type="button" onClick={() => void cancelMaisLiteRtRun()}>Cancel run</button>}
          </div>

          {runtimeProgress && runtimeProgress.modelId === selectedArtifact.modelId && (
            <p className="mais-runtime-live" aria-live="polite">
              <strong>{runtimeProgress.state}</strong>
              <span>{runtimeProgress.backend.toUpperCase()} · {runtimeProgress.outputChars ?? 0} characters</span>
            </p>
          )}

          {lastResult && lastResult.modelId === selectedArtifact.modelId && (
            <article className={`mais-runtime-result is-${lastResult.state}`}>
              <header>
                <strong>{resultState(lastResult)} · {lastResult.backend.toUpperCase()}</strong>
                <span>{new Date(lastResult.completedAtEpochMs).toLocaleString()}</span>
              </header>
              <dl>
                <div><dt>Model load</dt><dd>{formatDuration(lastResult.loadMs)}</dd></div>
                <div><dt>First chunk</dt><dd>{formatDuration(lastResult.firstChunkLatencyMs)}</dd></div>
                <div><dt>Generation</dt><dd>{formatDuration(lastResult.generationMs)}</dd></div>
                <div><dt>Unload</dt><dd>{formatDuration(lastResult.unloadMs)}</dd></div>
                <div><dt>Total</dt><dd>{formatDuration(lastResult.totalMs)}</dd></div>
                <div><dt>Peak PSS</dt><dd>{formatModelBytes(lastResult.peakPssBytes)}</dd></div>
              </dl>
              {lastResult.output && <blockquote>{lastResult.output}</blockquote>}
              {lastResult.error && <p className="mais-runtime-error">{lastResult.error}</p>}
            </article>
          )}
        </section>
      )}

      <div className="mais-runtime-actions">
        <button className="text-button" type="button" disabled={Boolean(busyArtifactId) || running} onClick={() => void refresh()}>Refresh all</button>
      </div>

      <p className="mais-runtime-note">
        Model files live in persistent app-private data. Normal signed APK updates reuse them; uninstalling the app or clearing app data removes them.
      </p>
    </section>
  );
}
