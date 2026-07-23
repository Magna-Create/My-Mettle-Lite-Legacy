import { useEffect, useMemo, useState } from 'react';
import {
  readNativeMaisEmbeddingStatus,
  runNativeMaisEmbeddingProbe,
  type MaisEmbeddingProbeResult,
  type MaisEmbeddingRuntimeStatus,
} from '../../mais/embeddingRuntime';
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
  const [runtimeStatus, setRuntimeStatus] = useState<MaisEmbeddingRuntimeStatus | null>(null);
  const [probe, setProbe] = useState<MaisEmbeddingProbeResult | null>(null);
  const [busyArtifactId, setBusyArtifactId] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus(): Promise<void> {
    if (!modelArtifact) return;
    const [model, tokenizer, runtime] = await Promise.all([
      readMaisModelArtifactStatus(modelArtifact),
      readMaisModelArtifactStatus(tokenizerArtifact),
      readNativeMaisEmbeddingStatus(),
    ]);
    setModelStatus(model);
    setTokenizerStatus(tokenizer);
    setRuntimeStatus(runtime);
  }

  useEffect(() => {
    void refreshStatus().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'EmbeddingGemma status could not be read.'));
  }, [modelArtifact, tokenizerArtifact]);

  if (!modelArtifact) return null;

  async function run(
    artifact: MaisModelArtifactDefinition,
    setStatus: (status: MaisModelArtifactStatus) => void,
    operation: () => Promise<MaisModelArtifactStatus>,
  ): Promise<void> {
    setBusyArtifactId(artifact.artifactId);
    setError(null);
    setProbe(null);
    try {
      setStatus(await operation());
      await refreshStatus();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The model operation failed.';
      if (message !== 'Model import cancelled.') setError(message);
    } finally {
      setBusyArtifactId(null);
    }
  }

  async function runProbe(): Promise<void> {
    setProbing(true);
    setError(null);
    try {
      const result = await runNativeMaisEmbeddingProbe();
      setProbe(result);
      setRuntimeStatus(await readNativeMaisEmbeddingStatus());
      if (!result.success) setError(result.error ?? 'EmbeddingGemma did not complete the probe.');
    } finally {
      setProbing(false);
    }
  }

  const modelReady = modelStatus?.state === 'ready';
  const tokenizerReady = tokenizerStatus?.state === 'ready';
  const runtimeReady = runtimeStatus?.ready ?? false;
  const overallLabel = modelReady && tokenizerReady
    ? runtimeReady ? 'Runtime ready' : 'Files ready'
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
        Import the generic seq512 model and its SentencePiece tokenizer. The Qualcomm SM8750 AOT file is not compatible with the current localagents-rag wrapper and is intentionally rejected here rather than failing with a null native model.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Runtime path</dt><dd>{runtimeStatus?.backend ?? 'localagents-rag CPU'}</dd></div>
        <div><dt>Acceleration</dt><dd>{runtimeStatus?.acceleratorClaim ?? 'CPU/XNNPACK candidate'}</dd></div>
        <div><dt>Embedding window</dt><dd>512 tokens</dd></div>
        <div><dt>Stored dimensions</dt><dd>256 of {runtimeStatus?.sourceDimensions ?? 768}</dd></div>
        <div><dt>Files ready</dt><dd>{Number(modelReady) + Number(tokenizerReady)}/2</dd></div>
      </dl>

      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      <div className="intelligence-import-files">
        <FileRow
          artifact={modelArtifact}
          status={modelStatus}
          busy={busyArtifactId === modelArtifact.artifactId}
          importLabel="generic seq512 .tflite file"
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

      <section className="intelligence-import-file">
        <header><div><strong>Semantic retrieval probe</strong><small>Embeds two documents and one query, then verifies that the matching training passage ranks above an unrelated nutrition passage.</small></div>{probe && <span className={`status-chip ${probe.success && probe.margin > 0 ? 'is-ready' : 'is-failed'}`}>{probe.success && probe.margin > 0 ? 'Passed' : 'Review'}</span>}</header>
        {probe && <dl className="settings-fact-list"><div><dt>Matching score</dt><dd>{probe.matchingScore.toFixed(4)}</dd></div><div><dt>Unrelated score</dt><dd>{probe.unrelatedScore.toFixed(4)}</dd></div><div><dt>Margin</dt><dd>{probe.margin.toFixed(4)}</dd></div><div><dt>Document pass</dt><dd>{probe.documentTotalMs} ms</dd></div><div><dt>Query pass</dt><dd>{probe.queryTotalMs} ms</dd></div></dl>}
        <div className="mais-runtime-actions"><button className="primary-action compact" type="button" disabled={!runtimeReady || probing} onClick={() => void runProbe()}>{probing ? 'Running probe…' : 'Run retrieval probe'}</button></div>
      </section>
    </section>
  );
}
