import { useEffect, useMemo, useState } from 'react';
import {
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
      if (!next.success) setError(next.error ?? 'Qwen did not complete the native baseline.');
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

  const modelReady = artifactStatus?.state === 'ready' && artifactStatus.verified;
  const runtimeReady = runtimeStatus?.ready === true;
  const nativeReady = modelReady && runtimeReady;
  const statusText = busy
    ? progress?.state === 'generating' ? 'Generating' : 'Loading'
    : nativeReady
      ? 'Native runtime ready'
      : modelReady
        ? 'QAIRT setup required'
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
        This is the operational benchmark for the complete Qwen GenieX pack. It creates the Qualcomm dialog, generates one bounded local response, records profiler and process-memory data, then unloads the model.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Model pack</dt><dd>{modelReady ? 'Verified' : artifactStatus?.state ?? 'Checking'}</dd></div>
        <div><dt>QAIRT runtime</dt><dd>{runtimeStatus?.runtimeInstalled ? 'Installed' : 'Missing'}</dd></div>
        <div><dt>JNI bridge</dt><dd>{runtimeStatus?.bridgeLoaded ? 'Loaded' : 'Unavailable'}</dd></div>
        <div><dt>Context ceiling</dt><dd>12,288 tokens</dd></div>
      </dl>

      {runtimeStatus?.missingModelFiles.length ? (
        <p className="mais-runtime-note">Missing Qwen files: {runtimeStatus.missingModelFiles.join(', ')}</p>
      ) : null}
      {artifactStatus && artifactStatus.state !== 'ready' ? (
        <p className="mais-runtime-note">Run <strong>Verify 12K pack</strong> in the model card before native inference.</p>
      ) : null}
      {runtimeStatus?.bridgeError ? <p className="mais-runtime-error">JNI bridge: {runtimeStatus.bridgeError}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      {progress ? (
        <p className="mais-runtime-live" aria-live="polite">
          <strong>{progress.state}</strong>
          <span>NPU · load {formatDuration(progress.loadMs)} · {progress.outputChars} final characters</span>
        </p>
      ) : null}

      <div className="mais-runtime-actions">
        <button className="primary-action compact" type="button" disabled={!nativeReady || busy} onClick={() => void runBaseline()}>
          {busy ? 'Qwen running…' : 'Run Qwen NPU baseline'}
        </button>
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>

      {result ? (
        <article className={`mais-runtime-result is-${result.state}`}>
          <header>
            <strong>{result.success ? 'Completed' : 'Failed'} · NPU</strong>
            <span>{new Date(result.completedAtEpochMs).toLocaleString()}</span>
          </header>
          <dl>
            <div><dt>Model load</dt><dd>{formatDuration(result.loadMs)}</dd></div>
            <div><dt>First callback</dt><dd>{formatDuration(result.firstChunkLatencyMs)}</dd></div>
            <div><dt>Generation</dt><dd>{formatDuration(result.generationMs)}</dd></div>
            <div><dt>Unload</dt><dd>{formatDuration(result.unloadMs)}</dd></div>
            <div><dt>Total</dt><dd>{formatDuration(result.totalMs)}</dd></div>
            <div><dt>Peak PSS</dt><dd>{formatModelBytes(result.peakPssBytes)}</dd></div>
            <div><dt>TTFT profiler</dt><dd>{metric(result.profile.timeToFirstTokenMs, result.profile.timeToFirstTokenMsUnit)}</dd></div>
            <div><dt>Decode rate</dt><dd>{metric(result.profile.tokenGenerationRate, result.profile.tokenGenerationRateUnit)}</dd></div>
            <div><dt>Prefill rate</dt><dd>{metric(result.profile.promptProcessingRate, result.profile.promptProcessingRateUnit)}</dd></div>
            <div><dt>Generated tokens</dt><dd>{metric(result.profile.generatedTokens)}</dd></div>
          </dl>
          {result.finalOutput ? <blockquote>{result.finalOutput}</blockquote> : null}
          {result.error ? <p className="mais-runtime-error">{result.error}</p> : null}
        </article>
      ) : null}

      <p className="mais-runtime-note">
        Cancellation remains disabled until Qualcomm’s exact dialog-signal ABI is verified. This avoids freeing native handles while the NPU is active.
      </p>
    </section>
  );
}
