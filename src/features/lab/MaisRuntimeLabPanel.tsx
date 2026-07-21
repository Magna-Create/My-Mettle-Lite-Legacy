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

export function MaisRuntimeLabPanel() {
  const artifact = useMemo(() => getFirstMaisRuntimeArtifact(), []);
  const [status, setStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [progress, setProgress] = useState<MaisModelDownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      setStatus(await readMaisModelArtifactStatus(artifact));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Model status could not be read.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => Promise<void>) | undefined;
    void (async () => {
      const initial = await readMaisModelArtifactStatus(artifact);
      if (!cancelled) setStatus(initial);
      dispose = await subscribeMaisModelDownload((event) => {
        if (event.artifactId !== artifact.artifactId || cancelled) return;
        setProgress(event);
        setStatus((current) => current ? {
          ...current,
          state: event.state === 'downloaded' ? 'verifying' : event.state === 'cancelled' ? 'partial' : event.state,
          partialBytes: event.downloadedBytes,
        } : current);
      });
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Runtime Lab could not initialise.');
    });
    return () => {
      cancelled = true;
      if (dispose) void dispose();
    };
  }, [artifact]);

  async function run(operation: () => Promise<MaisModelArtifactStatus>): Promise<void> {
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

  const downloading = busy && (status?.state === 'downloading' || progress?.state === 'downloading');
  const canDownload = !busy && status?.state !== 'ready' && status?.state !== 'unverified';
  const canVerify = !busy && status?.state === 'unverified';
  const canDelete = !busy && Boolean(status?.installed || status?.partialBytes);

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
          <button className="primary-action compact" type="button" onClick={() => void run(() => downloadMaisModelArtifact(artifact))}>
            {status?.state === 'partial' ? 'Resume download' : 'Download model'}
          </button>
        )}
        {downloading && (
          <button className="text-button" type="button" onClick={() => void cancelMaisModelDownload(artifact.artifactId)}>
            Cancel download
          </button>
        )}
        {canVerify && (
          <button className="primary-action compact" type="button" onClick={() => void run(() => verifyMaisModelArtifact(artifact))}>
            Verify model
          </button>
        )}
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        {canDelete && (
          <button
            className="text-button danger-text"
            type="button"
            onClick={() => {
              if (window.confirm('Delete the installed or partial Gemma model from this phone?')) {
                void run(() => deleteMaisModelArtifact(artifact));
              }
            }}
          >
            Delete model
          </button>
        )}
      </div>

      <p className="mais-runtime-note">
        The file downloads directly into app-private storage. It is not included in the APK, Git repository or JavaScript state.
      </p>
    </section>
  );
}
