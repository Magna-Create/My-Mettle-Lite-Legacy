import type { AppDatabase } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onReset: () => Promise<void>;
}

export function SettingsSheet({ database, onClose, onReset }: Props) {
  function exportData() {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gym-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Settings</p><h2>Development controls</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></header>
        <section>
          <h3>Local data</h3>
          <p>Phase 1 stores the complete domain state in IndexedDB through a repository boundary. Android SQLite is the next infrastructure adapter.</p>
          <button className="secondary-action" onClick={exportData}>Export JSON backup</button>
        </section>
        <section>
          <h3>Reset prototype</h3>
          <p>Clears local development data and restores the seeded routine.</p>
          <button
            className="danger-action"
            onClick={() => {
              if (window.confirm('Reset every local Phase 1 record?')) void onReset();
            }}
          >Reset local data</button>
        </section>
      </aside>
    </div>
  );
}
