import { useEffect, useMemo, useState } from 'react';
import {
  deleteMaisModelArtifact,
  formatModelBytes,
  getEmbeddingGemmaTokenizerArtifact,
  getMaisModelArtifacts,
  importMaisModelArtifact,
  readMaisModelArtifactStatus,
  verifyMaisModelArtifact,
  type MaisModelArtifactDefinition,
  type MaisModelArtifactStatus,
} from '../../mais/modelArtifacts';

function fileStateLabel(status: MaisModelArtifactStatus | null): string {
  if (!status) return 'Checking';
  if (status.state === 'ready') return 'Ready';
  if (status.state === 'unverified') return 'Verification required';
  if (status.state === 'verifying') return 'Verifying';
  if (status.state === 'failed') return 'Import failed';
  return 'Missing';
}

interface FileRowProps {
  artifact: MaisModelArtifactDefinition;
  status: MaisModelArtifactStatus | null;
  busy: boolean;
  importLabel: string;
  onImport: () => void;
  onVerify: () => void;
  onDelete: () => void;
}

function FileRow({ artifact, status, busy, importLabel, onImport, onVerify, onDelete }: FileRowProps) {
  return (
    <article className="intelligence-import-file">
      <header>
        <div><strong>{artifact.displayName}</strong><small>{artifact.fileName} · about {formatModelBytes(artifact.approximateBytes)}</small></div>
        <span className={`status-chip is-${status?.state ?? 'checking'}`}>{fileStateLabel(status)}</span>
      </header>
      {status?.actualSha256 ? <p className="mais-model-digest"><strong>Device SHA-256</strong><span>{status.actualSha256}</span></p> : null}
      <div className="mais-runtime-actions">
        <button className="primary-action compact" type="button" disabled={busy} onClick={onImport}>
          {busy ? 'Importing…' : status?.state === 'ready' ? `Replace ${importLabel}` : `Select ${importLabel}`}
        </button>
        {status?.state === 'unverified' ? <button className="text-button" type="button" disabled={busy} onClick={onVerify}>Verify installed file</button> : null}
        {status?.installed ? <button className="text-button danger-text" type="button" disabled={busy} onClick={onDelete}>Delete</button> : null}
      </div>
    </article>
  );
}

export function EmbeddingGemmaImportPanel() {
  const modelArtifact = useMemo(
    () => getMaisModelArtifacts().find((candidate) => candidate.modelId === 'google.embeddinggemma') ?? null,
    [],
  );
  const tokenizerArtifact = useMemo(() => getEmbeddingGemmaTokenizerArtifact(), []);
  const [modelStatus, setModelStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [tokenizerStatus, setTokenizerStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [busyArtifactId, setBusyArtifactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelArtifact) return;
    void Promise.all([
      readMaisModelArtifactStatus(modelArtifact),
      readMaisModelArtifactStatus(tokenizerArtifact),
    ]).then(([model, tokenizer]) => {
      setModelStatus(model);
      setTokenizerStatus(tokenizer);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'EmbeddingGemma status could not be read.'));
  }, [modelArtifact, tokenizerArtifact]);

  if (!modelArtifact) return null;

  async function run(
    artifact: MaisModelArtifactDefinition,
    setStatus: (status: MaisModelArtifactStatus) => void,
    operation: () => Promise<MaisModelArtifactStatus>,
  ): Promise<void> {
    setBusyArtifactId(artifact.artifactId);
    setError(null);
    try {
      setStatus(await operation());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The model operation failed.';
      if (message !== 'Model import cancelled.') setError(message);
    } finally {
      setBusyArtifactId(null);
    }
  }

  const modelReady = modelStatus?.state === 'ready';
  const tokenizerReady = tokenizerStatus?.state === 'ready';
  const overallLabel = modelReady && tokenizerReady
    ? 'Ready for runtime integration'
    : modelReady
      ? 'Tokenizer required'
      : 'Setup incomplete';

  return (
    <section className="paper-card intelligence-model-import" aria-labelledby="embeddinggemma-import-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Semantic memory</p>
          <h2 id="embeddinggemma-import-title">EmbeddingGemma</h2>
        </div>
        <span className={`status-chip ${modelReady && tokenizerReady ? 'is-ready' : 'is-absent'}`}>{overallLabel}</span>
      </header>

      <p>
        EmbeddingGemma needs both the Qualcomm SM8750 model and its SentencePiece tokenizer. My Mettle copies each selected file into private app storage; the originals remain untouched.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Model backend</dt><dd>NPU · CPU fallback</dd></div>
        <div><dt>Embedding window</dt><dd>512 tokens</dd></div>
        <div><dt>Files ready</dt><dd>{Number(modelReady) + Number(tokenizerReady)}/2</dd></div>
      </dl>

      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      <div className="intelligence-import-files">
        <FileRow
          artifact={modelArtifact}
          status={modelStatus}
          busy={busyArtifactId === modelArtifact.artifactId}
          importLabel=".tflite file"
          onImport={() => void run(modelArtifact, setModelStatus, () => importMaisModelArtifact(modelArtifact))}
          onVerify={() => void run(modelArtifact, setModelStatus, () => verifyMaisModelArtifact(modelArtifact))}
          onDelete={() => {
            if (window.confirm('Delete the imported EmbeddingGemma model from My Mettle?')) {
              void run(modelArtifact, setModelStatus, () => deleteMaisModelArtifact(modelArtifact));
            }
          }}
        />
        <FileRow
          artifact={tokenizerArtifact}
          status={tokenizerStatus}
          busy={busyArtifactId === tokenizerArtifact.artifactId}
          importLabel="sentencepiece.model"
          onImport={() => void run(tokenizerArtifact, setTokenizerStatus, () => importMaisModelArtifact(tokenizerArtifact))}
          onVerify={() => void run(tokenizerArtifact, setTokenizerStatus, () => verifyMaisModelArtifact(tokenizerArtifact))}
          onDelete={() => {
            if (window.confirm('Delete the imported EmbeddingGemma tokenizer from My Mettle?')) {
              void run(tokenizerArtifact, setTokenizerStatus, () => deleteMaisModelArtifact(tokenizerArtifact));
            }
          }}
        />
      </div>
    </section>
  );
}
