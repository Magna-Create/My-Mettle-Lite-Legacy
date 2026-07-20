import type { AppDatabase } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onClose: () => void;
}

export function ProfileSheet({ database, onClose }: Props) {
  const completedSessions = database.sessions.filter((session) => session.status === 'completed').length;
  const activeExperiments = database.experiments.filter((experiment) =>
    ['active', 'ready_for_decision'].includes(experiment.status),
  ).length;

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet profile-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Profile</p>
            <h2>{database.profile.displayName}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close profile">×</button>
        </header>

        <div className="profile-mark" aria-hidden="true">
          {database.profile.displayName.slice(0, 1).toUpperCase()}
        </div>

        <section className="profile-stats" aria-label="Current profile summary">
          <div><span>Units</span><strong>{database.profile.units}</strong></div>
          <div><span>Diet</span><strong>{database.profile.dietaryPreference}</strong></div>
          <div><span>Sessions</span><strong>{completedSessions}</strong></div>
          <div><span>Live tests</span><strong>{activeExperiments}</strong></div>
        </section>

        <section>
          <p className="eyebrow">Body model</p>
          <h3>Calibration in progress</h3>
          <p>The richer personal model lands after the training loop has enough comparable evidence.</p>
        </section>
      </aside>
    </div>
  );
}
