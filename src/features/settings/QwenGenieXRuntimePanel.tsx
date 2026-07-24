import { useEffect, useMemo, useState } from 'react';
import {
  cancelMaisGenieXRun,
  readMaisGenieXStatus,
  runMaisGenieXBaseline,
  subscribeMaisGenieXProgress,
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

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Not recorded';
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)} s`;
}

function metric(value: number | null | undefined, unit?: string | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not reported';
  return `${Number.isInteger(value) ? value : value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
}

export function QwenGenieXRuntimePanel() {
  const artifact = useMemo(() => getMaisModelArtifact(QWEN_ARTIFACT_ID), []);
  const [artifactStatus, setArtifactStatus] = useState<MaisModelArtifactStatus | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MaisGenieXRuntimeStatus | null>(null);
  const [progress, setProgress] = useState<MaisGenieXProgress | null>(null);
  const [result, setResult] = useState<MaisGenieXRunResult | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function runBaseline(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const next = await runMaisGenieXBaseline(artifact);
      setResult(next);
      const [model, runtime] = await Promise.all([
        readMaisModelArtifactStatus(artifact),
        readMaisGenieXStatus(),
      ]);
      setArtifactStatus(model);
      setRuntimeStatus(runtime);
      if (!next.success && next.state !== 'cancelled') setError(next.error ?? 'Qwen did not complete the native baseline.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Qwen native baseline failed.');
      const [model, runtime] = await Promise.all([
        readMaisModelArtifactStatus(artifact),
        readMaisGenieXStatus(),
      ]);
      setArtifactStatus(model);
      setRuntimeStatus(runtime);
    } finally {
      setProgress(null);
      setBusy(false);
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
  const runtimeReady = runtimeStatus?.ready === true;
  const nativeReady = modelReady && runtimeReady;
  const statusText = busy
    ? progress?.state === 'generating' ? 'Thinking & generating' : 'Loading'
    : nativeReady
      ? 'Native runtime ready'
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
        GenieX and its Qualcomm runtime ship inside the normal APK through Maven Central. The Qwen model pack remains separately downloadable, so an app update never requires WSL, a private SDK ZIP or a manual runtime installation.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Model pack</dt><dd>{modelReady ? 'Verified' : artifactStatus?.state ?? 'Checking'}</dd></div>
        <div><dt>Runtime delivery</dt><dd>{runtimeStatus?.distribution === 'maven-central' ? 'Bundled with app' : 'Checking'}</dd></div>
        <div><dt>GenieX Android</dt><dd>{runtimeStatus?.sdkVersion ?? '0.3.5'}</dd></div>
        <div><dt>QAIRT plugin</dt><dd>{runtimeStatus?.runtimeInstalled ? runtimeStatus.runtimeVersion : 'Unavailable'}</dd></div>
        <div><dt>Thinking mode</dt><dd>Enabled</dd></div>
        <div><dt>Context ceiling</dt><dd>12,288 tokens</dd></div>
      </dl>

      {runtimeStatus?.missingModelFiles.length ? (
        <p className="mais-runtime-note">Missing Qwen files: {runtimeStatus.missingModelFiles.join(', ')}</p>
      ) : null}
      {artifactStatus && artifactStatus.state !== 'ready' ? (
        <p className="mais-runtime-note">Run <strong>Verify 12K pack</strong> in the model card before native inference.</p>
      ) : null}
      {runtimeStatus?.bridgeError ? <p className="mais-runtime-error">GenieX: {runtimeStatus.bridgeError}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      {progress ? (
        <p className="mais-runtime-live" aria-live="polite">
          <strong>{progress.state === 'generating' ? 'thinking & generating' : progress.state}</strong>
          <span>NPU · load {formatDuration(progress.loadMs)} · {progress.outputChars} streamed characters</span>
        </p>
      ) : null}

      <div className="mais-runtime-actions">
        {!busy ? (
          <button className="primary-action compact" type="button" disabled={!nativeReady} onClick={() => void runBaseline()}>
            Run Qwen thinking baseline
          </button>
        ) : (
          <button className="text-button danger-text" type="button" onClick={() => void cancelBaseline()}>
            Stop Qwen run
          </button>
        )}
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>

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
        Qwen’s reasoning is used during generation but is not persisted or shown. The supported GenieX stop API is used for cancellation; native destruction remains in the run’s final cleanup path.
      </p>
    </section>
  );
}
