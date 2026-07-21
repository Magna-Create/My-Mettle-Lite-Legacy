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

interface ExecutionSummary {
  source: string;
  modelId?: string | undefined;
  intendedModelId?: string | undefined;
  backend?: string | undefined;
  reason?: string | undefined;
  totalMs?: number | undefined;
}

function executionFrom(content: Record<string, unknown>): ExecutionSummary | null {
  const value = content.execution;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.source !== 'string') return null;
  return {
    source: record.source,
    modelId: typeof record.modelId === 'string' ? record.modelId : undefined,
    intendedModelId: typeof record.intendedModelId === 'string' ? record.intendedModelId : undefined,
    backend: typeof record.backend === 'string' ? record.backend : undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
    totalMs: typeof record.totalMs === 'number' ? record.totalMs : undefined,
  };
}

function executionLabel(execution: ExecutionSummary | null): string {
  if (!execution) return 'Legacy / unlabelled';
  if (execution.source === 'local_model') {
    const backend = execution.backend ? ` · ${execution.backend.toUpperCase()}` : '';
    const time = typeof execution.totalMs === 'number' ? ` · ${(execution.totalMs / 1_000).toFixed(2)} s` : '';
    return `${execution.modelId ?? 'local model'}${backend}${time}`;
  }
  return `${execution.intendedModelId ?? 'local model'} · deterministic fallback`;
}

export function MaisActivityPanel({ snapshot, resourceMode, onRunDemo, onPulse, onClear, onExportReport }: Props) {
  if (!snapshot) {
    return <section className="paper-card mais-activity"><p className="eyebrow">MAIS Activity</p><h2>Opening intelligence workspace…</h2></section>;
  }

  const recentTasks = [...snapshot.heart.tasks].reverse().slice(0, 6);
  const recentDiagnostics = [...snapshot.diagnostics].reverse().slice(0, 8);
  const recentExecutions = [...snapshot.heart.artifacts]
    .reverse()
    .map((artifact) => ({ artifact, execution: executionFrom(artifact.content) }))
    .filter(({ execution }) => Boolean(execution))
    .slice(0, 8);
  const lastDecision = snapshot.lastPulseDecision;

  return (
    <section className="paper-card mais-activity">
      <header className="mais-activity-header">
        <div>
          <p className="eyebrow">MAIS Activity · Phase 3B</p>
          <h2>Heartbeat and runtime console</h2>
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

      <details open={recentExecutions.length > 0}>
        <summary>Role execution</summary>
        {recentExecutions.length === 0 ? <p>No labelled role executions yet.</p> : <ol className="mais-ledger">
          {recentExecutions.map(({ artifact, execution }) => <li key={artifact.id}>
            <strong>{artifact.createdBy}</strong>
            <span>{executionLabel(execution)}</span>
            <small>{artifact.kind} · {new Date(artifact.createdAt).toLocaleString()}</small>
            {execution?.source === 'deterministic_fallback' && execution.reason && <small>{execution.reason}</small>}
          </li>)}
        </ol>}
      </details>

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

      <p className="mais-framework-note">This console is deliberately plain. It exposes real/fallback role execution for development; Phase 3.5 will replace it with the final intelligence interface.</p>
    </section>
  );
}
