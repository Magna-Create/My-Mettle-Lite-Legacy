import { useEffect, useMemo, useState } from 'react';
import {
  deleteMaisModelArtifact,
  formatModelBytes,
  getMaisModelArtifacts,
  importMaisModelArtifact,
  readMaisModelArtifactStatus,
  verifyMaisModelArtifact,
  type MaisModelArtifactStatus,
} from '../../mais/modelArtifacts';

function stateLabel(status: MaisModelArtifactStatus | null): string {
  if (!status) return 'Checking';
  if (status.state === 'ready') return 'Installed and verified';
  if (status.state === 'unverified') return 'Installed · verification required';
  if (status.state === 'verifying') return 'Verifying';
  if (status.state === 'failed') return 'Import failed';
  return 'Not installed';
}

export function EmbeddingGemmaImportPanel() {
  const artifact = useMemo(
    () => getMaisModelArtifacts().find((candidate) => candidate.modelId === 'google.embeddinggemma') ?? null,
    [],
  );
  const [status, setStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact) return;
    void readMaisModelArtifactStatus(artifact)
      .then(setStatus)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'EmbeddingGemma status could not be read.'));
  }, [artifact]);

  if (!artifact) return null;

  async function run(operation: () => Promise<MaisModelArtifactStatus>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setStatus(await operation());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The model operation failed.';
      if (message !== 'Model import cancelled.') setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="paper-card intelligence-model-import" aria-labelledby="embeddinggemma-import-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Semantic memory</p>
          <h2 id="embeddinggemma-import-title">EmbeddingGemma</h2>
        </div>
        <span className={`status-chip is-${status?.state ?? 'checking'}`}>{stateLabel(status)}</span>
      </header>

      <p>
        After accepting the Gemma licence and downloading the Qualcomm SM8750 <code>.tflite</code> file,
        select it here. My Mettle copies it into private app storage; the original file remains untouched.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Expected file</dt><dd>{artifact.fileName}</dd></div>
        <div><dt>Expected size</dt><dd>about {formatModelBytes(artifact.approximateBytes)}</dd></div>
        <div><dt>Backend</dt><dd>NPU · CPU fallback</dd></div>
        {status?.bytes ? <div><dt>Installed</dt><dd>{formatModelBytes(status.bytes)}</dd></div> : null}
      </dl>

      {status?.actualSha256 ? (
        <p className="mais-model-digest"><strong>Device SHA-256</strong><span>{status.actualSha256}</span></p>
      ) : null}

      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      <div className="mais-runtime-actions">
        <button
          className="primary-action compact"
          type="button"
          disabled={busy}
          onClick={() => void run(() => importMaisModelArtifact(artifact))}
        >
          {busy ? 'Importing…' : status?.state === 'ready' ? 'Replace model file' : 'Select .tflite file'}
        </button>

        {status?.state === 'unverified' ? (
          <button className="text-button" type="button" disabled={busy} onClick={() => void run(() => verifyMaisModelArtifact(artifact))}>
            Verify installed file
          </button>
        ) : null}

        {status?.installed ? (
          <button
            className="text-button danger-text"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Delete the imported EmbeddingGemma model from My Mettle?')) {
                void run(() => deleteMaisModelArtifact(artifact));
              }
            }}
          >
            Delete model
          </button>
        ) : null}
      </div>
    </section>
  );
}
