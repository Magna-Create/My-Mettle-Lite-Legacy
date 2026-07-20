import type { AppDatabase, AppSettings } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onReset: () => Promise<void>;
  onUpdateSettings: (patch: { restTimer?: Partial<AppSettings['restTimer']> }) => Promise<void>;
}

export function SettingsSheet({ database, onClose, onReset, onUpdateSettings }: Props) {
  function exportData() {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `my-mettle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const timer = database.settings.restTimer;

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">Settings</p><h2>General</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <section>
          <p className="eyebrow">Rest timer</p>
          <div className="settings-list">
            <label className="settings-toggle">
              <span><strong>Start automatically</strong><small>Begin after a set value is logged.</small></span>
              <input type="checkbox" checked={timer.autoStart} onChange={(event) => { void onUpdateSettings({ restTimer: { autoStart: event.target.checked } }); }} />
            </label>
            <label className="settings-toggle">
              <span><strong>Completion vibration</strong><small>Strong phone alert when rest ends.</small></span>
              <input type="checkbox" checked={timer.vibrationEnabled} onChange={(event) => { void onUpdateSettings({ restTimer: { vibrationEnabled: event.target.checked } }); }} />
            </label>
            <label className="settings-select-row">
              <span><strong>Vibration strength</strong><small>Used when completion vibration is on.</small></span>
              <select value={timer.vibrationStrength} disabled={!timer.vibrationEnabled} onChange={(event) => { void onUpdateSettings({ restTimer: { vibrationStrength: event.target.value as 'standard' | 'strong' } }); }}>
                <option value="standard">Standard</option>
                <option value="strong">Strong</option>
              </select>
            </label>
            <label className="settings-toggle">
              <span><strong>Completion chime</strong><small>Optional short sound alongside vibration.</small></span>
              <input type="checkbox" checked={timer.chimeEnabled} onChange={(event) => { void onUpdateSettings({ restTimer: { chimeEnabled: event.target.checked } }); }} />
            </label>
          </div>
        </section>

        <section>
          <p className="eyebrow">Health data</p>
          <h3>Provider foundation ready</h3>
          <p>Health Connect read/write support lands in Phase 3. This build already stores provider state, source ownership and stable export identifiers without pretending a native connection exists.</p>
          <div className="settings-status-row"><span>Provider</span><strong>{database.healthIntegration.provider === 'none' ? 'Not connected' : database.healthIntegration.provider.replace('_', ' ')}</strong></div>
        </section>

        <section>
          <p className="eyebrow">Local data</p>
          <h3>Offline by default</h3>
          <p>The complete domain state, measurement history and health provenance remain in the local IndexedDB repository.</p>
          <button className="secondary-action" onClick={exportData}>Export JSON backup</button>
        </section>

        <section>
          <p className="eyebrow">Reset</p>
          <h3>Restore the seed routine</h3>
          <p>Clears local development data. This cannot be undone without a backup.</p>
          <button
            className="danger-action"
            onClick={() => {
              if (window.confirm('Reset every local My Mettle record?')) void onReset();
            }}
          >Reset local data</button>
        </section>
      </aside>
    </div>
  );
}
