import type { AppDatabase } from '../../domain/model';
import type { MaisLabProposal } from '../../mais/labProposalState';
import type { MaisSystemSnapshot } from '../../mais/systemState';

interface Props {
  database: AppDatabase;
  maisSnapshot: MaisSystemSnapshot | null;
  onActivate: (experimentId: string) => Promise<void>;
  onReject: (experimentId: string) => Promise<void>;
  onPromote: (experimentId: string) => Promise<void>;
  onRejectPendingProposal: (proposalId: string) => Promise<void>;
}

function proposalForExperiment(proposals: MaisLabProposal[], experimentId: string): MaisLabProposal | undefined {
  return proposals.find((proposal) => proposal.materialisedExperimentId === experimentId || `experiment_${proposal.id}` === experimentId);
}

export function LabPage({ database, maisSnapshot, onActivate, onReject, onPromote, onRejectPendingProposal }: Props) {
  const experiments = [...database.experiments].reverse();
  const proposals = maisSnapshot?.labProposals.proposals ?? [];
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'ready' && !database.experiments.some((experiment) => experiment.id === `experiment_${proposal.id}`));

  return (
    <main className="page lab-page">
      <section className="page-heading">
        <p className="eyebrow">Lab</p>
        <h1>Turn evidence into a controlled change.</h1>
        <p>Experiments remain temporary until later evidence is evaluated and you explicitly promote the result.</p>
      </section>

      {pendingProposals.length > 0 && <section className="experiment-list" aria-label="Pending MAIS proposals">
        {pendingProposals.map((proposal) => <article className="experiment-card" key={proposal.id}>
          <header><div><p className="eyebrow">MAIS proposal · awaiting compatible Lab slot</p><h2>{proposal.title}</h2></div><span className="status-chip">ready</span></header>
          <p>{proposal.summary}</p>
          <p className="evidence-summary">Target {proposal.exerciseId} · proposed load {proposal.proposedLoad} kg · {proposal.provenanceRefs.length} provenance ref{proposal.provenanceRefs.length === 1 ? '' : 's'}.</p>
          {proposal.stopConditions.length > 0 && <p><strong>Stop conditions:</strong> {proposal.stopConditions.join('; ')}</p>}
          <footer><p>This proposal has not altered the routine or created an active test.</p><button className="text-button" onClick={() => onRejectPendingProposal(proposal.id)}>Dismiss proposal</button></footer>
        </article>)}
      </section>}

      {experiments.length === 0 && pendingProposals.length === 0 ? (
        <section className="paper-card empty-card">
          <h2>No proposal yet.</h2>
          <p>When accumulated evidence supports a useful reversible test, it will appear here for approval.</p>
        </section>
      ) : (
        experiments.length > 0 && <section className="experiment-list">
          {experiments.map((experiment) => {
            const sourceProposal = proposalForExperiment(proposals, experiment.id);
            return <article className="experiment-card" key={experiment.id}>
              <header>
                <div>
                  <p className="eyebrow">{sourceProposal ? 'MAIS proposal' : 'Experiment'} · {experiment.exerciseName}</p>
                  <h2>{experiment.baselineLoad} → {experiment.proposedLoad} kg</h2>
                </div>
                <span className="status-chip">{experiment.status.replaceAll('_', ' ')}</span>
              </header>
              <p>{experiment.hypothesis}</p>
              {experiment.evidenceSummary && <p className="evidence-summary">{experiment.evidenceSummary}</p>}
              {sourceProposal && <details><summary>Proposal contract</summary><dl className="metric-list compact-metrics"><div><dt>Source artefact</dt><dd>{sourceProposal.sourceArtifactId}</dd></div><div><dt>Provenance refs</dt><dd>{sourceProposal.provenanceRefs.length}</dd></div><div><dt>Success criteria</dt><dd>{sourceProposal.successCriteria.join('; ') || 'Not specified'}</dd></div><div><dt>Stop conditions</dt><dd>{sourceProposal.stopConditions.join('; ') || 'Not specified'}</dd></div></dl></details>}
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
            </article>;
          })}
        </section>
      )}
    </main>
  );
}
