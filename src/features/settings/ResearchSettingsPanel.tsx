import { useRef, useState } from 'react';
import type { MaisResearchState } from '../../mais/researchBroker';

interface Props {
  research: MaisResearchState;
  onExportRequest: (requestId: string) => Promise<void>;
  onImportReport: (content: string) => Promise<void>;
  onRejectRequest: (requestId: string) => Promise<void>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function budgetUsed(research: MaisResearchState): number {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - research.rollingWindowDays);
  return research.requests.filter((request) => request.status !== 'rejected' && new Date(request.createdAt) >= windowStart).length;
}

export function ResearchSettingsPanel({ research, onExportRequest, onImportReport, onRejectRequest }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const used = budgetUsed(research);
  const remaining = Math.max(0, research.maxRequestsPerWindow - used);
  const requests = [...research.requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  async function run(key: string, operation: () => Promise<void>, success: string): Promise<void> {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The research operation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function importSelected(file: File | undefined): Promise<void> {
    if (!file) return;
    await run('import', async () => onImportReport(await file.text()), 'Research report imported and queued for local integration.');
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <section className="paper-card intelligence-research-settings" aria-labelledby="research-settings-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Manual external research</p>
          <h2 id="research-settings-title">Research requests</h2>
        </div>
        <span className="status-chip">{remaining}/{research.maxRequestsPerWindow} remaining</span>
      </header>

      <p>
        My Mettle may prepare up to three focused requests per rolling 30 days. You export one to ChatGPT, then import the completed cited JSON report here.
      </p>

      <div className="mais-runtime-actions">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void importSelected(event.target.files?.[0])}
        />
        <button className="primary-action compact" type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          {busy === 'import' ? 'Importing…' : 'Import completed report'}
        </button>
      </div>

      {message ? <p className="mais-framework-note" role="status">{message}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      {requests.length === 0 ? (
        <div className="settings-empty-state">
          <strong>No research request.</strong>
          <span>Local evidence must first expose a decision that cannot be resolved responsibly on-device.</span>
        </div>
      ) : (
        <div className="intelligence-research-list">
          {requests.map((request) => (
            <article className="intelligence-research-request" key={request.id}>
              <header>
                <div>
                  <strong>{request.topic}</strong>
                  <small>Created {formatDate(request.createdAt)} · expires {formatDate(request.expiresAt)}</small>
                </div>
                <span className="status-chip">{request.status.replaceAll('_', ' ')}</span>
              </header>
              <p>{request.decisionBlocked}</p>
              <details>
                <summary>{request.questions.length} research question{request.questions.length === 1 ? '' : 's'}</summary>
                <ol className="mais-ledger">
                  {request.questions.map((question, index) => (
                    <li key={`${request.id}-${index}`}><strong>{question.question}</strong><span>{question.whyItMatters}</span></li>
                  ))}
                </ol>
              </details>
              <div className="mais-runtime-actions">
                {request.status === 'awaiting_user_export' ? (
                  <button
                    className="primary-action compact"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run(`export:${request.id}`, () => onExportRequest(request.id), 'Research dossier saved to Downloads.')}
                  >
                    {busy === `export:${request.id}` ? 'Exporting…' : 'Export for ChatGPT'}
                  </button>
                ) : null}
                {['awaiting_user_export', 'exported'].includes(request.status) ? (
                  <button
                    className="text-button danger-text"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm('Reject this research request?')) {
                        void run(`reject:${request.id}`, () => onRejectRequest(request.id), 'Research request rejected.');
                      }
                    }}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {research.reports.length > 0 ? (
        <details>
          <summary>{research.reports.length} imported report{research.reports.length === 1 ? '' : 's'}</summary>
          <ol className="mais-ledger">
            {[...research.reports].reverse().map((report) => (
              <li key={report.id}>
                <strong>{report.summary}</strong>
                <span>{report.claims.length} claims · {report.sources.length} cited sources</span>
                <small>Imported {formatDate(report.importedAt)} · expires {formatDate(report.expiresAt)}</small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
