import { useEffect, useState } from 'react';
import {
  deleteMaisQairtRuntime,
  importMaisQairtRuntime,
  readMaisQairtRuntimeStatus,
  type MaisQairtRuntimeStatus,
} from '../../mais/qairtRuntime';
import { formatModelBytes } from '../../mais/modelArtifacts';

function statusLabel(status: MaisQairtRuntimeStatus | null): string {
  if (!status) return 'Checking';
  if (status.ready) return 'Runtime ready';
  if (status.installed) return 'Runtime incomplete';
  return 'Setup required';
}

export function QairtRuntimeImportPanel() {
  const [status, setStatus] = useState<MaisQairtRuntimeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setStatus(await readMaisQairtRuntimeStatus());
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'QAIRT runtime status could not be read.');
    });
  }, []);

  async function run(operation: () => Promise<MaisQairtRuntimeStatus>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setStatus(await operation());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'QAIRT runtime operation failed.';
      if (message !== 'QAIRT runtime import cancelled.') setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="paper-card intelligence-model-import" aria-labelledby="qairt-runtime-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Qualcomm native runtime</p>
          <h2 id="qairt-runtime-title">QAIRT 2.45</h2>
        </div>
        <span className={`status-chip ${status?.ready ? 'is-ready' : 'is-absent'}`}>{statusLabel(status)}</span>
      </header>

      <p>
        Qwen’s compiled model pack does not contain Qualcomm’s licensed Android runtime libraries. Create the local runtime ZIP from your matching QAIRT SDK, then import it here. My Mettle stores it privately and never uploads it.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Required build</dt><dd>{status?.version ?? '2.45.0.260326154327'}</dd></div>
        <div><dt>JNI bridge</dt><dd>{status?.bridgeLoaded ? 'Loaded' : 'Unavailable'}</dd></div>
        <div><dt>Runtime files</dt><dd>{status ? `${status.arm64Files.length} ARM64 · ${status.hexagonFiles.length} DSP` : 'Checking'}</dd></div>
        <div><dt>Private storage</dt><dd>{status?.bytes ? formatModelBytes(status.bytes) : '0 MB'}</dd></div>
      </dl>

      {status?.missing.length ? (
        <p className="mais-runtime-note">Missing: {status.missing.join(', ')}</p>
      ) : null}
      {status?.bridgeError ? <p className="mais-runtime-error">JNI bridge: {status.bridgeError}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      <div className="mais-runtime-actions">
        <button className="primary-action compact" type="button" disabled={busy} onClick={() => void run(importMaisQairtRuntime)}>
          {busy ? 'Importing…' : status?.installed ? 'Replace QAIRT runtime ZIP' : 'Import QAIRT runtime ZIP'}
        </button>
        {status?.installed ? (
          <button
            className="text-button danger-text"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Delete the imported QAIRT runtime from My Mettle? The Qwen model pack will remain installed.')) {
                void run(deleteMaisQairtRuntime);
              }
            }}
          >
            Delete runtime
          </button>
        ) : null}
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>
    </section>
  );
}
