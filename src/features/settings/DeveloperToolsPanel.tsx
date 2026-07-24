import { useEffect, useMemo, useState } from 'react';
import {
  clearMaisNativeDiagnostics,
  readMaisDeveloperSnapshot,
  type MaisDeveloperSnapshot,
} from '../../mais/developerTools';
import {
  readMaisHighPriorityWork,
  subscribeMaisHighPriorityWork,
  type MaisHighPriorityWorkState,
} from '../../mais/highPriorityWork';
import { formatModelBytes } from '../../mais/modelArtifacts';

function formatMaybeBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'Unavailable';
  return formatModelBytes(value);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return `${Math.round(value)}%`;
}

function formatTemperature(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return `${value.toFixed(1)} °C`;
}

function elapsedLabel(state: MaisHighPriorityWorkState, now: number): string {
  if (!state.active || state.startedAtEpochMs === null) return 'Not active';
  const seconds = Math.max(0, Math.round((now - state.startedAtEpochMs) / 1_000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export function DeveloperToolsPanel() {
  const [snapshot, setSnapshot] = useState<MaisDeveloperSnapshot | null>(null);
  const [halt, setHalt] = useState<MaisHighPriorityWorkState>(readMaisHighPriorityWork());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      setSnapshot(await readMaisDeveloperSnapshot());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Native diagnostics could not be read.');
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeMaisHighPriorityWork(setHalt);
    void refresh();
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 1_500);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const diagnosticDocument = useMemo(() => ({
    exportedAt: new Date().toISOString(),
    highPriorityWork: halt,
    native: snapshot,
  }), [halt, snapshot]);

  async function copySnapshot(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticDocument, null, 2));
      setMessage('Diagnostic snapshot copied.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The diagnostic snapshot could not be copied.');
    } finally {
      setBusy(false);
    }
  }

  async function clearDiagnostics(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await clearMaisNativeDiagnostics();
      await refresh();
      setMessage('Persistent native breadcrumbs cleared.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Native breadcrumbs could not be cleared.');
    } finally {
      setBusy(false);
    }
  }

  const breadcrumbs = [...(snapshot?.breadcrumbs ?? [])].reverse().slice(0, 24);
  const exits = snapshot?.recentProcessExits ?? [];

  return (
    <div className="developer-tools-stack">
      <section className="paper-card developer-tools-card">
        <header className="mais-runtime-header">
          <div>
            <p className="eyebrow">Exclusive workload control</p>
            <h2>App halt state</h2>
          </div>
          <span className={`status-chip ${halt.active ? 'is-absent' : 'is-ready'}`}>{halt.active ? 'HALTED' : 'Available'}</span>
        </header>
        <p>
          High-priority native work pauses the MAIS heartbeat, background role execution and competing model operations. Workout storage, navigation and the rest timer remain available.
        </p>
        <dl className="settings-fact-list">
          <div><dt>State</dt><dd>{halt.active ? 'Exclusive task active' : 'No exclusive task'}</dd></div>
          <div><dt>Task</dt><dd>{halt.label ?? 'None'}</dd></div>
          <div><dt>Kind</dt><dd>{halt.kind ?? 'None'}</dd></div>
          <div><dt>Elapsed</dt><dd>{elapsedLabel(halt, now)}</dd></div>
        </dl>
      </section>

      <section className="paper-card developer-tools-card">
        <header className="mais-runtime-header">
          <div>
            <p className="eyebrow">Live device telemetry</p>
            <h2>Resources</h2>
          </div>
          <span className="status-chip is-ready">1.5 s</span>
        </header>
        <div className="developer-metric-grid">
          <article><span>Process PSS</span><strong>{formatMaybeBytes(snapshot?.process.pssBytes)}</strong></article>
          <article><span>Native heap</span><strong>{formatMaybeBytes(snapshot?.process.nativeHeapAllocatedBytes)}</strong></article>
          <article><span>Java heap</span><strong>{formatMaybeBytes(snapshot?.process.javaHeapUsedBytes)}</strong></article>
          <article><span>Memory available</span><strong>{formatMaybeBytes(snapshot?.deviceMemory.availableBytes)}</strong></article>
          <article><span>Thermal state</span><strong>{snapshot?.power.thermalLabel ?? 'Checking'}</strong></article>
          <article><span>Battery temperature</span><strong>{formatTemperature(snapshot?.power.batteryTemperatureC)}</strong></article>
          <article><span>Battery</span><strong>{formatPercent(snapshot?.power.batteryPercent)}</strong></article>
          <article><span>Storage available</span><strong>{formatMaybeBytes(snapshot?.storage.availableBytes)}</strong></article>
        </div>
        <dl className="settings-fact-list">
          <div><dt>Source model store</dt><dd>{formatMaybeBytes(snapshot?.storage.sourceModelBytes)} · {snapshot?.storage.sourceModelFiles ?? 0} files</dd></div>
          <div><dt>GenieX prepared cache</dt><dd>{formatMaybeBytes(snapshot?.storage.genieCacheBytes)} · {snapshot?.storage.genieCacheFiles ?? 0} files</dd></div>
          <div><dt>Low-memory flag</dt><dd>{snapshot?.deviceMemory.lowMemory ? 'Raised' : 'Clear'}</dd></div>
          <div><dt>Power Saver</dt><dd>{snapshot?.power.powerSaveMode ? 'On' : 'Off'}</dd></div>
          <div><dt>Charging</dt><dd>{snapshot?.power.charging ? 'Yes' : 'No'}</dd></div>
        </dl>
      </section>

      <section className="paper-card developer-tools-card">
        <header className="mais-runtime-header">
          <div>
            <p className="eyebrow">Android process history</p>
            <h2>Recent exits</h2>
          </div>
          <span className="status-chip">{exits.length}</span>
        </header>
        {exits.length === 0 ? <p className="mais-runtime-note">No process-exit records are available.</p> : (
          <div className="developer-event-list">
            {exits.map((exit) => (
              <article key={`${exit.timestampEpochMs}-${exit.reason}-${exit.status}`}>
                <header><strong>{exit.reasonLabel}</strong><span>{new Date(exit.timestampEpochMs).toLocaleString()}</span></header>
                <p>{exit.description ?? 'No Android exit description.'}</p>
                <small>PSS {formatMaybeBytes(exit.pssBytes)} · RSS {formatMaybeBytes(exit.rssBytes)} · status {exit.status}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="paper-card developer-tools-card">
        <header className="mais-runtime-header">
          <div>
            <p className="eyebrow">Persistent crash breadcrumbs</p>
            <h2>Native stages</h2>
          </div>
          <span className="status-chip">{snapshot?.breadcrumbs.length ?? 0}</span>
        </header>
        {breadcrumbs.length === 0 ? <p className="mais-runtime-note">No native stages have been recorded yet.</p> : (
          <div className="developer-event-list">
            {breadcrumbs.map((event, index) => (
              <article key={`${event.capturedAtEpochMs}-${event.stage}-${index}`}>
                <header><strong>{event.stage} · {event.state}</strong><span>{new Date(event.capturedAtEpochMs).toLocaleTimeString()}</span></header>
                <p>{event.detail ?? event.component}</p>
                <small>PSS {formatMaybeBytes(event.processPssBytes)} · native {formatMaybeBytes(event.nativeHeapAllocatedBytes)} · Java {formatMaybeBytes(event.javaHeapUsedBytes)}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}
      {message ? <p className="mais-runtime-note" aria-live="polite">{message}</p> : null}
      <div className="mais-runtime-actions">
        <button className="primary-action compact" type="button" disabled={busy} onClick={() => void refresh()}>Refresh now</button>
        <button className="text-button" type="button" disabled={busy || !snapshot} onClick={() => void copySnapshot()}>Copy diagnostic snapshot</button>
        <button className="text-button danger-text" type="button" disabled={busy} onClick={() => void clearDiagnostics()}>Clear breadcrumbs</button>
      </div>
    </div>
  );
}
