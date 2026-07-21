import type { MaisResourceMode } from '../../mais/contracts';
import type { MaisSystemSnapshot } from '../../mais/systemState';

interface Props {
  snapshot: MaisSystemSnapshot | null;
  resourceMode: MaisResourceMode;
  onRunDemo: () => Promise<void>;
  onPulse: () => Promise<void>;
  onClear: () => Promise<void>;
  onExportReport: () => void;
}

export function MaisActivityPanel({ snapshot, resourceMode, onRunDemo, onPulse, onClear, onExportReport }: Props) {
  if (!snapshot) {
    return <section className="paper-card mais-activity"><p className="eyebrow">MAIS Activity</p><h2>Opening intelligence workspace…</h2></section>;
  }

  const recentTasks = [...snapshot.heart.tasks].reverse().slice(0, 6);
  const recentDiagnostics = [...snapshot.diagnostics].reverse().slice(0, 8);
  const lastDecision = snapshot.lastPulseDecision;

  return (
    <section className="paper-card mais-activity">
      <header className="mais-activity-header">
        <div>
          <p className="eyebrow">MAIS Activity · Phase 3A</p>
          <h2>Heartbeat and framework console</h2>
        </div>
        <span className="status-chip">{resourceMode}</span>
      </header>

      <div className="mais-metric-grid">
        <div><span>Events</span><strong>{snapshot.heart.events.length}</strong></div>
        <div><span>Tasks</span><strong>{snapshot.heart.tasks.length}</strong></div>
        <div><span>Checkpoints</span><strong>{snapshot.heart.checkpoints.length}</strong></div>
        <div><span>Artefacts</span><strong>{snapshot.heart.artifacts.length}</strong></div>
        <div><span>Proposals</span><strong>{snapshot.capabilities.proposals.length}</strong></div>
        <div><span>Model leases</span><strong>{snapshot.models.leases.length}</strong></div>
      </div>

      <p className="mais-last-decision">
        <strong>{lastDecision?.action ?? 'idle'}</strong>
        <span>{lastDecision?.reason ?? 'No heartbeat has run yet.'}</span>
      </p>

      <div className="mais-console-actions">
        <button className="primary-action compact" type="button" onClick={() => void onRunDemo()}>Run synthetic heartbeat</button>
        <button className="text-button" type="button" onClick={() => void onPulse()}>Pulse once</button>
        <button className="text-button" type="button" onClick={onExportReport}>Export report card</button>
        <button className="text-button" type="button" onClick={() => { if (window.confirm('Clear the separate MAIS framework database? Training data will not be touched.')) void onClear(); }}>Clear MAIS state</button>
      </div>

      <details>
        <summary>Task ledger</summary>
        {recentTasks.length === 0 ? <p>No tasks yet.</p> : <ol className="mais-ledger">
          {recentTasks.map((task) => <li key={task.id}><strong>{task.status}</strong><span>{task.goal}</span><small>step {Math.min(task.currentStepIndex + 1, task.steps.length)}/{task.steps.length} · priority {task.priority.toFixed(2)}</small></li>)}
        </ol>}
      </details>

      <details>
        <summary>Diagnostics</summary>
        {recentDiagnostics.length === 0 ? <p>No diagnostics yet.</p> : <ol className="mais-ledger">
          {recentDiagnostics.map((diagnostic) => <li key={diagnostic.id}><strong>{diagnostic.severity}</strong><span>{diagnostic.message}</span><small>{diagnostic.category} · {new Date(diagnostic.recordedAt).toLocaleString()}</small></li>)}
        </ol>}
      </details>

      <p className="mais-framework-note">This console is intentionally plain. It exposes framework state for testing; it is not the final Lab interface.</p>
    </section>
  );
}
