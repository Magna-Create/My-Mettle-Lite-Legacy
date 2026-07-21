import { useEffect, useMemo, useState } from 'react';
import {
  cancelMaisModelDownload,
  deleteMaisModelArtifact,
  downloadMaisModelArtifact,
  formatModelBytes,
  getFirstMaisRuntimeArtifact,
  readMaisModelArtifactStatus,
  subscribeMaisModelDownload,
  verifyMaisModelArtifact,
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

function statusLabel(status: MaisModelArtifactStatus | null): string {
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
  status: MaisModelArtifactStatus | null,
  progress: MaisModelDownloadProgress | null,
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

export function MaisRuntimeLabPanel() {
  const artifact = useMemo(() => getFirstMaisRuntimeArtifact(), []);
  const [status, setStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [progress, setProgress] = useState<MaisModelDownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MaisLiteRtStatus | null>(null);
  const [runtimeProgress, setRuntimeProgress] = useState<MaisLiteRtProgress | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [nextArtifact, nextRuntime] = await Promise.all([
        readMaisModelArtifactStatus(artifact),
        readMaisLiteRtStatus(),
      ]);
      setStatus(nextArtifact);
      setRuntimeStatus(nextRuntime);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Runtime Lab status could not be read.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    let disposeDownload: (() => Promise<void>) | undefined;
    let disposeRuntime: (() => Promise<void>) | undefined;
    void (async () => {
      const [initialArtifact, initialRuntime] = await Promise.all([
        readMaisModelArtifactStatus(artifact),
        readMaisLiteRtStatus(),
      ]);
      if (!cancelled) {
        setStatus(initialArtifact);
        setRuntimeStatus(initialRuntime);
      }
      disposeDownload = await subscribeMaisModelDownload((event) => {
        if (event.artifactId !== artifact.artifactId || cancelled) return;
        setProgress(event);
        setStatus((current) => current ? {
          ...current,
          state: event.state === 'downloaded' ? 'verifying' : event.state === 'cancelled' ? 'partial' : event.state,
          partialBytes: event.downloadedBytes,
        } : current);
      });
      disposeRuntime = await subscribeMaisLiteRtProgress((event) => {
        if (cancelled) return;
        setRuntimeProgress(event);
        setRuntimeStatus((current) => ({ ...current, running: ['loading', 'generating'].includes(event.state) }));
      });
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Runtime Lab could not initialise.');
    });
    return () => {
      cancelled = true;
      if (disposeDownload) void disposeDownload();
      if (disposeRuntime) void disposeRuntime();
    };
  }, [artifact]);

  async function runArtifactOperation(operation: () => Promise<MaisModelArtifactStatus>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setStatus(await operation());
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The model operation failed.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runBaseline(backend: MaisLiteRtBackend): Promise<void> {
    setRuntimeBusy(true);
    setRuntimeError(null);
    setRuntimeProgress({ state: 'loading', backend, loadMs: 0, outputChars: null, capturedAtEpochMs: Date.now() });
    try {
      const result = await runMaisLiteRtBaseline(artifact, backend);
      setRuntimeStatus({ running: false, lastResult: result });
      setRuntimeProgress(null);
    } catch (reason) {
      setRuntimeError(reason instanceof Error ? reason.message : 'LiteRT-LM inference failed.');
      setRuntimeStatus(await readMaisLiteRtStatus());
      setRuntimeProgress(null);
    } finally {
      setRuntimeBusy(false);
    }
  }

  const downloading = busy && (status?.state === 'downloading' || progress?.state === 'downloading');
  const canDownload = !busy && status?.state !== 'ready' && status?.state !== 'unverified';
  const canVerify = !busy && status?.state === 'unverified';
  const canDelete = !busy && !runtimeBusy && !runtimeStatus?.running && Boolean(status?.installed || status?.partialBytes);
  const canRun = status?.state === 'ready' && !busy && !runtimeBusy && !runtimeStatus?.running;
  const running = runtimeBusy || runtimeStatus?.running === true;
  const lastResult = runtimeStatus?.lastResult ?? null;

  return (
    <section className="paper-card mais-runtime-lab" aria-labelledby="mais-runtime-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">MAIS Runtime Lab · Phase 3B</p>
          <h2 id="mais-runtime-title">First real model</h2>
        </div>
        <span className={`status-chip is-${status?.state ?? 'checking'}`}>{statusLabel(status)}</span>
      </header>

      <div className="mais-runtime-model">
        <div>
          <strong>{artifact.displayName}</strong>
          <p>{artifact.runtime} {artifact.runtimeVersion} · {formatModelBytes(artifact.approximateBytes)}</p>
        </div>
        <dl>
          <div><dt>Installed</dt><dd>{progressText(status, progress) ?? 'No'}</dd></div>
          <div><dt>Free storage</dt><dd>{formatModelBytes(status?.availableBytes ?? 0)}</dd></div>
          <div><dt>Integrity</dt><dd>{status?.verified ? 'SHA-256 verified' : 'Not verified'}</dd></div>
        </dl>
      </div>

      {typeof progress?.percent === 'number' && (
        <div className="mais-runtime-progress" aria-label={`Model download ${progress.percent.toFixed(1)} percent`}>
          <span style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
        </div>
      )}

      {error && <p className="mais-runtime-error" role="alert">{error}</p>}

      <div className="mais-runtime-actions">
        {canDownload && (
          <button className="primary-action compact" type="button" onClick={() => void runArtifactOperation(() => downloadMaisModelArtifact(artifact))}>
            {status?.state === 'partial' ? 'Resume download' : 'Download model'}
          </button>
        )}
        {downloading && (
          <button className="text-button" type="button" onClick={() => void cancelMaisModelDownload(artifact.artifactId)}>
            Cancel download
          </button>
        )}
        {canVerify && (
          <button className="primary-action compact" type="button" onClick={() => void runArtifactOperation(() => verifyMaisModelArtifact(artifact))}>
            Verify model
          </button>
        )}
        <button className="text-button" type="button" disabled={busy || runtimeBusy} onClick={() => void refresh()}>Refresh</button>
        {canDelete && (
          <button
            className="text-button danger-text"
            type="button"
            onClick={() => {
              if (window.confirm('Delete the installed or partial Gemma model from this phone?')) {
                void runArtifactOperation(() => deleteMaisModelArtifact(artifact));
              }
            }}
          >
            Delete model
          </button>
        )}
      </div>

      {status?.state === 'ready' && (
        <section className="mais-inference-lab" aria-labelledby="mais-inference-title">
          <header>
            <div>
              <p className="eyebrow">LiteRT-LM 0.14.0</p>
              <h3 id="mais-inference-title">Real inference baseline</h3>
            </div>
            <span className="status-chip">{runLabel(runtimeProgress, runtimeStatus)}</span>
          </header>

          <p className="mais-runtime-note">
            This runs one bounded local prompt, records the complete load → generate → unload lifecycle, then releases the model. The autonomous Heart remains simulated until this gate passes.
          </p>

          {runtimeError && <p className="mais-runtime-error" role="alert">{runtimeError}</p>}

          <div className="mais-runtime-actions">
            {canRun && <button className="primary-action compact" type="button" onClick={() => void runBaseline('cpu')}>Run CPU baseline</button>}
            {canRun && <button className="text-button" type="button" onClick={() => void runBaseline('gpu')}>Run GPU baseline</button>}
            {running && <button className="text-button danger-text" type="button" onClick={() => void cancelMaisLiteRtRun()}>Cancel run</button>}
          </div>

          {runtimeProgress && (
            <p className="mais-runtime-live" aria-live="polite">
              <strong>{runtimeProgress.state}</strong>
              <span>{runtimeProgress.backend.toUpperCase()} · {runtimeProgress.outputChars ?? 0} characters</span>
            </p>
          )}

          {lastResult && (
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

      <p className="mais-runtime-note">
        The model file lives in persistent app-private data. Normal signed APK updates reuse it; uninstalling the app or clearing app data removes it.
      </p>
    </section>
  );
}
