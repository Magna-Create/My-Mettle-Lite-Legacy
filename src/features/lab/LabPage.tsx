import type { AppDatabase } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onActivate: (experimentId: string) => Promise<void>;
  onReject: (experimentId: string) => Promise<void>;
  onPromote: (experimentId: string) => Promise<void>;
}

export function LabPage({ database, onActivate, onReject, onPromote }: Props) {
  const experiments = [...database.experiments].reverse();

  return (
    <main className="page lab-page">
      <section className="page-heading">
        <p className="eyebrow">Lab</p>
        <h1>Turn evidence into a controlled change.</h1>
        <p>Experiments remain temporary until a later exposure produces evidence and you explicitly promote the result.</p>
      </section>

      {experiments.length === 0 ? (
        <section className="paper-card empty-card">
          <h2>No proposal yet.</h2>
          <p>When accumulated evidence supports a useful reversible test, it will appear here for approval.</p>
        </section>
      ) : (
        <section className="experiment-list">
          {experiments.map((experiment) => (
            <article className="experiment-card" key={experiment.id}>
              <header>
                <div>
                  <p className="eyebrow">{experiment.exerciseName}</p>
                  <h2>{experiment.baselineLoad} → {experiment.proposedLoad} kg</h2>
                </div>
                <span className="status-chip">{experiment.status.replaceAll('_', ' ')}</span>
              </header>
              <p>{experiment.hypothesis}</p>
              {experiment.evidenceSummary && <p className="evidence-summary">{experiment.evidenceSummary}</p>}
              <footer>
                {experiment.status === 'proposed' && (
                  <>
                    <button className="primary-action compact" onClick={() => onActivate(experiment.id)}>Run at next exposure</button>
                    <button className="text-button" onClick={() => onReject(experiment.id)}>Dismiss</button>
                  </>
                )}
                {experiment.status === 'active' && <p>Next matching session will use the proposed load while the base routine remains unchanged.</p>}
                {experiment.status === 'ready_for_decision' && (
                  <>
                    <button
                      className="primary-action compact"
                      onClick={() => {
                        if (window.confirm('Promote this tested load into a new permanent routine version?')) {
                          void onPromote(experiment.id);
                        }
                      }}
                    >
                      Promote to base routine
                    </button>
                    <button className="text-button" onClick={() => onReject(experiment.id)}>Keep current baseline</button>
                  </>
                )}
                {experiment.status === 'adopted' && <p>Adopted through an explicit routine version.</p>}
                {experiment.status === 'rejected' && <p>Closed without changing the base routine.</p>}
              </footer>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
