import { useEffect, useMemo, useState } from 'react';
import {
  cancelMaisGenieXRun,
  clearMaisGenieXPreparedModel,
  prepareMaisGenieXModel,
  readMaisGenieXStatus,
  runMaisGenieXBaseline,
  subscribeMaisGenieXProgress,
  type MaisGenieXPrepareResult,
  type MaisGenieXProgress,
  type MaisGenieXRunResult,
  type MaisGenieXRuntimeStatus,
} from '../../mais/genieXRuntime';
import {
  formatModelBytes,
  getMaisModelArtifact,
  readMaisModelArtifactStatus,
  type MaisModelArtifactStatus,
} from '../../mais/modelArtifacts';

const QWEN_ARTIFACT_ID = 'qwen.qwen3-4b.geniex-qairt.w4a16.sm8750.ctx12288';
type Operation = 'prepare' | 'run' | 'clear' | null;

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Not recorded';
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)} s`;
}

function metric(value: number | null | undefined, unit?: string | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not reported';
  return `${Number.isInteger(value) ? value : value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
}

function progressLabel(progress: MaisGenieXProgress | null, operation: Operation): string {
  if (progress?.state === 'importing') return 'Importing local bundle';
  if (progress?.state === 'initialising') return 'Initialising NPU runtime';
  if (progress?.state === 'loading') return 'Loading NPU model';
  if (progress?.state === 'generating') return 'Thinking & generating';
  if (operation === 'prepare') return 'Preparing model';
  if (operation === 'clear') return 'Clearing cache';
  return 'Working';
}

export function QwenGenieXRuntimePanel() {
  const artifact = useMemo(() => getMaisModelArtifact(QWEN_ARTIFACT_ID), []);
  const [artifactStatus, setArtifactStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MaisGenieXRuntimeStatus | null>(null);
  const [progress, setProgress] = useState<MaisGenieXProgress | null>(null);
  const [prepareResult, setPrepareResult] = useState<MaisGenieXPrepareResult | null>(null);
  const [result, setResult] = useState<MaisGenieXRunResult | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    const [model, runtime] = await Promise.all([
      readMaisModelArtifactStatus(artifact),
      readMaisGenieXStatus(),
    ]);
    setArtifactStatus(model);
    setRuntimeStatus(runtime);
    setResult(runtime.lastResult ?? null);
  }

  useEffect(() => {
    let disposed = false;
    let disposeListener: (() => Promise<void>) | undefined;
    void (async () => {
      await refresh();
      disposeListener = await subscribeMaisGenieXProgress((event) => {
        if (!disposed) setProgress(event);
      });
    })().catch((reason: unknown) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : 'Qwen native runtime could not initialise.');
    });
    return () => {
      disposed = true;
      if (disposeListener) void disposeListener();
    };
  }, []);

  async function prepareModel(): Promise<void> {
    setOperation('prepare');
    setError(null);
    setPrepareResult(null);
    try {
      const next = await prepareMaisGenieXModel(artifact);
      setPrepareResult(next);
      if (!next.success) setError(next.error ?? 'GenieX did not prepare the Qwen model.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Qwen model preparation failed.');
      await refresh();
    } finally {
      setProgress(null);
      setOperation(null);
    }
  }

  async function runBaseline(): Promise<void> {
    setOperation('run');
    setError(null);
    setResult(null);
    try {
      const next = await runMaisGenieXBaseline(artifact);
      setResult(next);
      await refresh();
      if (!next.success && next.state !== 'cancelled') setError(next.error ?? 'Qwen did not complete the native baseline.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Qwen native baseline failed.');
      await refresh();
    } finally {
      setProgress(null);
      setOperation(null);
    }
  }

  async function clearPreparedModel(): Promise<void> {
    setOperation('clear');
    setError(null);
    try {
      await clearMaisGenieXPreparedModel(artifact);
      setPrepareResult(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The prepared Qwen cache could not be cleared.');
    } finally {
      setOperation(null);
    }
  }

  async function cancelBaseline(): Promise<void> {
    try {
      const cancellation = await cancelMaisGenieXRun();
      if (!cancellation.requested && cancellation.reason) setError(cancellation.reason);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Qwen cancellation failed.');
    }
  }

  const modelReady = artifactStatus?.state === 'ready' && artifactStatus.verified;
  const runtimeInstalled = runtimeStatus?.runtimeInstalled === true;
  const modelPrepared = runtimeStatus?.modelPrepared === true;
  const nativeReady = modelReady && runtimeInstalled && modelPrepared;
  const busy = operation !== null;
  const statusText = busy
    ? progressLabel(progress, operation)
    : nativeReady
      ? 'Prepared & ready'
      : modelReady && runtimeInstalled
        ? 'Preparation required'
        : modelReady
          ? 'Bundled GenieX unavailable'
          : 'Verified model pack required';

  return (
    <section className="paper-card intelligence-model-import" aria-labelledby="qwen-native-runtime-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Measured native inference</p>
          <h2 id="qwen-native-runtime-title">Qwen3-4B · 12K · NPU</h2>
        </div>
        <span className={`status-chip ${nativeReady ? 'is-ready' : 'is-absent'}`}>{statusText}</span>
      </header>

      <p>
        The verified download, GenieX local import and NPU model load are now separate stages. Each preparation or inference task acquires the app-wide halt lease before native work begins, pausing the MAIS heartbeat and competing intelligence work.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Source model pack</dt><dd>{modelReady ? 'Verified' : artifactStatus?.state ?? 'Checking'}</dd></div>
        <div><dt>Runtime delivery</dt><dd>{runtimeStatus?.distribution === 'maven-central' ? 'Bundled with app' : 'Checking'}</dd></div>
        <div><dt>GenieX Android</dt><dd>{runtimeStatus?.sdkVersion ?? '0.3.5'}</dd></div>
        <div><dt>QAIRT plugin</dt><dd>{runtimeInstalled ? runtimeStatus?.runtimeVersion : 'Unavailable'}</dd></div>
        <div><dt>Prepared cache</dt><dd>{modelPrepared ? 'Ready' : 'Not prepared'}</dd></div>
        <div><dt>Source storage</dt><dd>{formatModelBytes(runtimeStatus?.sourceBundleBytes ?? 0)}</dd></div>
        <div><dt>GenieX cache storage</dt><dd>{formatModelBytes(runtimeStatus?.cachedBundleBytes ?? 0)}</dd></div>
        <div><dt>Thinking mode</dt><dd>Enabled</dd></div>
        <div><dt>Context ceiling</dt><dd>12,288 tokens</dd></div>
      </dl>

      {runtimeStatus?.lastNativeStage ? (
        <p className="mais-runtime-note">
          Last native stage: <strong>{runtimeStatus.lastNativeStage.stage} · {runtimeStatus.lastNativeStage.state}</strong>
          {runtimeStatus.lastNativeStage.detail ? ` — ${runtimeStatus.lastNativeStage.detail}` : ''}
        </p>
      ) : null}
      {runtimeStatus?.missingModelFiles.length ? (
        <p className="mais-runtime-note">Missing Qwen files: {runtimeStatus.missingModelFiles.join(', ')}</p>
      ) : null}
      {artifactStatus && artifactStatus.state !== 'ready' ? (
        <p className="mais-runtime-note">Run <strong>Verify 12K pack</strong> in the model card before native preparation.</p>
      ) : null}
      {runtimeStatus?.bridgeError ? <p className="mais-runtime-error">GenieX: {runtimeStatus.bridgeError}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      {progress ? (
        <p className="mais-runtime-live" aria-live="polite">
          <strong>{progressLabel(progress, operation)}</strong>
          <span>NPU · load {formatDuration(progress.loadMs)} · {progress.outputChars} streamed characters</span>
        </p>
      ) : null}

      <div className="mais-runtime-actions">
        {!busy && !modelPrepared ? (
          <button className="primary-action compact" type="button" disabled={!modelReady || !runtimeInstalled} onClick={() => void prepareModel()}>
            Prepare Qwen for GenieX
          </button>
        ) : null}
        {!busy && modelPrepared ? (
          <button className="primary-action compact" type="button" disabled={!nativeReady} onClick={() => void runBaseline()}>
            Run Qwen thinking baseline
          </button>
        ) : null}
        {operation === 'run' ? (
          <button className="text-button danger-text" type="button" onClick={() => void cancelBaseline()}>
            Stop Qwen run
          </button>
        ) : null}
        {busy && operation !== 'run' ? <button className="text-button" type="button" disabled>{progressLabel(progress, operation)}…</button> : null}
        {!busy && modelPrepared ? <button className="text-button danger-text" type="button" onClick={() => void clearPreparedModel()}>Clear prepared cache</button> : null}
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>

      {prepareResult ? (
        <article className={`mais-runtime-result is-${prepareResult.state}`}>
          <header>
            <strong>{prepareResult.success ? 'Preparation completed' : 'Preparation failed'}</strong>
            <span>{formatDuration(prepareResult.totalMs)}</span>
          </header>
          <dl>
            <div><dt>Local import performed</dt><dd>{prepareResult.imported ? 'Yes' : 'Existing cache reused'}</dd></div>
            <div><dt>Source bundle</dt><dd>{formatModelBytes(prepareResult.sourceBundleBytes)}</dd></div>
            <div><dt>Prepared cache</dt><dd>{formatModelBytes(prepareResult.cachedBundleBytes)}</dd></div>
          </dl>
          {prepareResult.error ? <p className="mais-runtime-error">{prepareResult.error}</p> : null}
        </article>
      ) : null}

      {result ? (
        <article className={`mais-runtime-result is-${result.state}`}>
          <header>
            <strong>{result.state === 'completed' ? 'Completed' : result.state === 'cancelled' ? 'Cancelled' : 'Failed'} · NPU · Thinking</strong>
            <span>{new Date(result.completedAtEpochMs).toLocaleString()}</span>
          </header>
          <dl>
            <div><dt>Model load</dt><dd>{formatDuration(result.loadMs)}</dd></div>
            <div><dt>First token</dt><dd>{formatDuration(result.firstChunkLatencyMs)}</dd></div>
            <div><dt>Generation</dt><dd>{formatDuration(result.generationMs)}</dd></div>
            <div><dt>Unload</dt><dd>{formatDuration(result.unloadMs)}</dd></div>
            <div><dt>Total</dt><dd>{formatDuration(result.totalMs)}</dd></div>
            <div><dt>Peak PSS</dt><dd>{formatModelBytes(result.peakPssBytes)}</dd></div>
            <div><dt>Thinking observed</dt><dd>{result.thinkingObserved ? 'Yes' : 'Not reported'}</dd></div>
            <div><dt>Thinking characters</dt><dd>{result.thinkingCharacters}</dd></div>
            <div><dt>Reasoning transcript</dt><dd>{result.reasoningContentStored ? 'Stored' : 'Not stored'}</dd></div>
            <div><dt>TTFT profiler</dt><dd>{metric(result.profile.timeToFirstTokenMs, 'ms')}</dd></div>
            <div><dt>Decode rate</dt><dd>{metric(result.profile.tokenGenerationRate, result.profile.tokenGenerationRateUnit)}</dd></div>
            <div><dt>Prefill rate</dt><dd>{metric(result.profile.promptProcessingRate, result.profile.promptProcessingRateUnit)}</dd></div>
            <div><dt>Generated tokens</dt><dd>{metric(result.profile.generatedTokens)}</dd></div>
            <div><dt>Stop reason</dt><dd>{result.profile.stopReason ?? 'Not reported'}</dd></div>
          </dl>
          {result.finalOutput ? <blockquote>{result.finalOutput}</blockquote> : null}
          {result.error ? <p className="mais-runtime-error">{result.error}</p> : null}
        </article>
      ) : null}

      <p className="mais-runtime-note">
        Persistent native breadcrumbs and Android process-exit reasons are available under Settings → Developer tools after a restart, including cases where the process dies before the native call can return an error.
      </p>
    </section>
  );
}
