import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { IndexedDbToolRequestRepository } from '../../adapters/storage/IndexedDbToolRequestRepository';
import {
  MaisToolRequestBroker,
  type MaisToolFallbackPreference,
  type MaisToolRequestState,
} from '../../mais/toolRequestBroker';

interface FormState {
  title: string;
  analyticalQuestion: string;
  missingCapability: string;
  reasonExistingToolsFail: string;
  inputFields: string;
  desiredOutputs: string;
  proposedMethod: string;
  assumptions: string;
  minimumEvidence: string;
  requiredTests: string;
  exampleUse: string;
  fallbackPreference: MaisToolFallbackPreference;
}

function initialForm(): FormState {
  return {
    title: '',
    analyticalQuestion: '',
    missingCapability: '',
    reasonExistingToolsFail: '',
    inputFields: '',
    desiredOutputs: '',
    proposedMethod: '',
    assumptions: '',
    minimumEvidence: '',
    requiredTests: '',
    exampleUse: '',
    fallbackPreference: 'either',
  };
}

function lines(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function monthTitle(key: string): string {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ToolRequestsPanel() {
  const repository = useMemo(() => new IndexedDbToolRequestRepository(), []);
  const [state, setState] = useState<MaisToolRequestState | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then(async (loaded) => {
      const broker = new MaisToolRequestBroker(loaded);
      const pruned = broker.prune();
      await repository.save(pruned);
      if (!cancelled) setState(pruned);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Tool requests could not be loaded.');
    });
    return () => { cancelled = true; };
  }, [repository]);

  async function mutate(operation: (broker: MaisToolRequestBroker) => void | Promise<void>): Promise<void> {
    if (!state) return;
    const broker = new MaisToolRequestBroker(state);
    await operation(broker);
    const next = broker.prune();
    await repository.save(next);
    setState(next);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy('create');
    setError(null);
    setMessage(null);
    try {
      await mutate((broker) => {
        broker.create({
          title: form.title,
          analyticalQuestion: form.analyticalQuestion,
          missingCapability: form.missingCapability,
          reasonExistingToolsFail: form.reasonExistingToolsFail,
          inputFields: lines(form.inputFields),
          desiredOutputs: lines(form.desiredOutputs),
          proposedMethod: form.proposedMethod,
          assumptions: lines(form.assumptions),
          minimumEvidence: lines(form.minimumEvidence),
          requiredTests: lines(form.requiredTests),
          exampleUse: form.exampleUse,
          fallbackPreference: form.fallbackPreference,
        });
      });
      setForm(initialForm());
      setExpanded(false);
      setMessage('Analysis-tool request added to the rolling three-month collection.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The tool request could not be created.');
    } finally {
      setBusy(null);
    }
  }

  async function copy(requestId: string): Promise<void> {
    setBusy(`copy:${requestId}`);
    setError(null);
    setMessage(null);
    try {
      let document = '';
      await mutate((broker) => { document = broker.export(requestId); });
      await navigator.clipboard.writeText(document);
      setMessage('Tool request copied. Paste it into ChatGPT when you are ready to evaluate or implement the capability.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The tool request could not be copied.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(requestId: string): Promise<void> {
    setBusy(`remove:${requestId}`);
    try {
      await mutate((broker) => broker.remove(requestId));
      setMessage('Tool request removed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The tool request could not be removed.');
    } finally {
      setBusy(null);
    }
  }

  const groups = Object.entries((state?.requests ?? []).reduce<Record<string, NonNullable<typeof state>['requests']>>((result, request) => {
    (result[request.monthKey] ??= []).push(request);
    return result;
  }, {})).sort(([left], [right]) => right.localeCompare(left));

  return <section className="paper-card intelligence-research-settings" aria-labelledby="tool-request-title">
    <header className="mais-runtime-header">
      <div><p className="eyebrow">Analysis capability exchange</p><h2 id="tool-request-title">Request a tool</h2></div>
      <span className="status-chip">No cap · 90 days</span>
    </header>
    <p>
      Record an analysis method that MAIS cannot express with its current deterministic toolbox. Requests are grouped by month, remain local, and expire automatically after a rolling three-month window.
    </p>
    <button className="primary-action compact" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Close request form' : 'New tool request'}</button>

    {expanded ? <form className="intelligence-form-grid tool-request-form" onSubmit={(event) => void submit(event)}>
      <label className="span-two"><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Nonlinear heart-rate recovery fit" required /></label>
      <label className="span-two"><span>Analytical question</span><textarea value={form.analyticalQuestion} onChange={(event) => setForm({ ...form, analyticalQuestion: event.target.value })} placeholder="What exact question should this method answer?" required /></label>
      <label className="span-two"><span>Missing capability</span><textarea value={form.missingCapability} onChange={(event) => setForm({ ...form, missingCapability: event.target.value })} placeholder="What operation, model or pipeline is absent?" required /></label>
      <label className="span-two"><span>Why existing tools fail</span><textarea value={form.reasonExistingToolsFail} onChange={(event) => setForm({ ...form, reasonExistingToolsFail: event.target.value })} required /></label>
      <label><span>Input fields</span><textarea value={form.inputFields} onChange={(event) => setForm({ ...form, inputFields: event.target.value })} placeholder="One per line" /></label>
      <label><span>Desired outputs</span><textarea value={form.desiredOutputs} onChange={(event) => setForm({ ...form, desiredOutputs: event.target.value })} placeholder="One per line" /></label>
      <label className="span-two"><span>Proposed method (optional)</span><textarea value={form.proposedMethod} onChange={(event) => setForm({ ...form, proposedMethod: event.target.value })} /></label>
      <label><span>Assumptions</span><textarea value={form.assumptions} onChange={(event) => setForm({ ...form, assumptions: event.target.value })} placeholder="One per line" /></label>
      <label><span>Minimum evidence</span><textarea value={form.minimumEvidence} onChange={(event) => setForm({ ...form, minimumEvidence: event.target.value })} placeholder="One per line" /></label>
      <label className="span-two"><span>Required tests</span><textarea value={form.requiredTests} onChange={(event) => setForm({ ...form, requiredTests: event.target.value })} placeholder="Synthetic known result, sparse data, flat signal…" /></label>
      <label className="span-two"><span>Example use in My Mettle</span><textarea value={form.exampleUse} onChange={(event) => setForm({ ...form, exampleUse: event.target.value })} required /></label>
      <label><span>Preferred fallback</span><select value={form.fallbackPreference} onChange={(event) => setForm({ ...form, fallbackPreference: event.target.value as MaisToolFallbackPreference })}>
        <option value="either">Best judgement</option><option value="new_builtin">Permanent deterministic tool</option><option value="restricted_python">Restricted Python first</option>
      </select></label>
      <button className="primary-action compact" type="submit" disabled={busy !== null}>{busy === 'create' ? 'Saving…' : 'Save request'}</button>
    </form> : null}

    {message ? <p className="mais-framework-note" role="status">{message}</p> : null}
    {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

    {groups.length === 0 ? <div className="settings-empty-state"><strong>No tool requests.</strong><span>Qwen may also add a suggestion when a future investigation exposes a genuine capability gap.</span></div> : <div className="tool-request-months">
      {groups.map(([month, requests]) => <section key={month}>
        <h3>{monthTitle(month)}</h3>
        <div className="intelligence-research-list">
          {[...requests].reverse().map((request) => <article className="intelligence-research-request" key={request.id}>
            <header><div><strong>{request.title}</strong><small>{request.createdBy.replaceAll('_', ' ')} · expires {formatDate(request.expiresAt)}</small></div><span className="status-chip">{request.status}</span></header>
            <p>{request.analyticalQuestion}</p>
            <details><summary>Capability contract</summary><p><strong>Missing:</strong> {request.missingCapability}</p><p><strong>Current gap:</strong> {request.reasonExistingToolsFail}</p><p><strong>Example:</strong> {request.exampleUse}</p></details>
            <div className="mais-runtime-actions">
              <button className="primary-action compact" type="button" disabled={busy !== null} onClick={() => void copy(request.id)}>{busy === `copy:${request.id}` ? 'Copying…' : 'Copy for ChatGPT'}</button>
              <button className="text-button danger-text" type="button" disabled={busy !== null} onClick={() => void remove(request.id)}>Remove</button>
            </div>
          </article>)}
        </div>
      </section>)}
    </div>}
  </section>;
}
