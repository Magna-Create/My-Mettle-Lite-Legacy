import { useState } from 'react';
import type { AppDatabase, AppSettings, VibrationStrength } from '../../domain/model';
import { requestNativeTimerPermissions } from '../../native/RestTimerNotifications';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onReset: () => Promise<void>;
  onUpdateSettings: (patch: { restTimer?: Partial<AppSettings['restTimer']> }) => Promise<void>;
}

type SettingsScreen = 'root' | 'workout' | 'timer' | 'units' | 'notifications' | 'data' | 'accessibility' | 'about';

const titles: Record<SettingsScreen, string> = {
  root: 'Settings',
  workout: 'Workout',
  timer: 'Rest timer',
  units: 'Units & measurements',
  notifications: 'Notifications & feedback',
  data: 'Data',
  accessibility: 'Accessibility',
  about: 'About & diagnostics',
};

function SettingsRow({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button className="settings-navigation-row" type="button" onClick={onClick}>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <i aria-hidden="true">›</i>
    </button>
  );
}

export function SettingsSheet({ database, onClose, onReset, onUpdateSettings }: Props) {
  const [screen, setScreen] = useState<SettingsScreen>('root');
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const timer = database.settings.restTimer;

  function exportData() {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `my-mettle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function requestPermissions() {
    setPermissionMessage('Opening Android permission controls…');
    try {
      const result = await requestNativeTimerPermissions();
      setPermissionMessage(result.notifications && result.exactAlarm
        ? 'Background timer permissions are ready.'
        : 'Grant notifications and Alarms & reminders, then return to My Mettle.');
    } catch {
      setPermissionMessage('Permission controls could not be opened on this device.');
    }
  }

  function header() {
    return (
      <header>
        <div className="settings-title-row">
          {screen !== 'root' && <button className="settings-back-button" type="button" onClick={() => setScreen(screen === 'timer' ? 'workout' : 'root')} aria-label="Back">‹</button>}
          <div><p className="eyebrow">Settings</p><h2>{titles[screen]}</h2></div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close settings">×</button>
      </header>
    );
  }

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
      <aside className="settings-sheet" onMouseDown={(event) => event.stopPropagation()}>
        {header()}

        {screen === 'root' && (
          <nav className="settings-navigation" aria-label="Settings groups">
            <SettingsRow title="Workout" detail="Rest timer, set entry and session behaviour" onClick={() => setScreen('workout')} />
            <SettingsRow title="Units & measurements" detail={`${database.profile.units.toUpperCase()} · body history`} onClick={() => setScreen('units')} />
            <SettingsRow title="Notifications & feedback" detail="Sound, vibration and Android delivery" onClick={() => setScreen('notifications')} />
            <SettingsRow title="Data" detail="Export, restore and reset" onClick={() => setScreen('data')} />
            <SettingsRow title="Accessibility" detail="Motion and interaction preferences" onClick={() => setScreen('accessibility')} />
            <SettingsRow title="About & diagnostics" detail="Build state and health foundation" onClick={() => setScreen('about')} />
          </nav>
        )}

        {screen === 'workout' && (
          <nav className="settings-navigation" aria-label="Workout settings">
            <SettingsRow title="Rest timer" detail="Automatic start, background alarm, sound and vibration" onClick={() => setScreen('timer')} />
            <div className="settings-disabled-row"><span><strong>Set entry</strong><small>Additional-set visibility and input behaviour will attach here.</small></span></div>
            <div className="settings-disabled-row"><span><strong>Session behaviour</strong><small>Completion and interruption preferences will attach here.</small></span></div>
          </nav>
        )}

        {screen === 'timer' && (
          <section className="settings-detail-section">
            <div className="settings-list">
              <label className="settings-toggle">
                <span><strong>Start automatically</strong><small>Begin after a set is completed.</small></span>
                <input type="checkbox" checked={timer.autoStart} onChange={(event) => { void onUpdateSettings({ restTimer: { autoStart: event.target.checked } }); }} />
              </label>
              <label className="settings-toggle">
                <span><strong>Background timer</strong><small>Use an Android alarm and notification outside My Mettle.</small></span>
                <input
                  type="checkbox"
                  checked={timer.backgroundNotificationEnabled ?? true}
                  onChange={(event) => {
                    void onUpdateSettings({ restTimer: { backgroundNotificationEnabled: event.target.checked } });
                    if (event.target.checked) void requestPermissions();
                  }}
                />
              </label>
              <label className="settings-toggle">
                <span><strong>Completion vibration</strong><small>Vibrate in-app and through the Android timer alert.</small></span>
                <input type="checkbox" checked={timer.vibrationEnabled} onChange={(event) => { void onUpdateSettings({ restTimer: { vibrationEnabled: event.target.checked } }); }} />
              </label>
              <label className="settings-select-row">
                <span><strong>Vibration strength</strong><small>Very strong uses a longer, denser pulse pattern.</small></span>
                <select
                  value={timer.vibrationStrength}
                  disabled={!timer.vibrationEnabled}
                  onChange={(event) => { void onUpdateSettings({ restTimer: { vibrationStrength: event.target.value as VibrationStrength } }); }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="strong">Strong</option>
                  <option value="very_strong">Very strong</option>
                </select>
              </label>
              <label className="settings-toggle">
                <span><strong>Completion chime</strong><small>Fun in-app tone; Android uses the timer notification sound while backgrounded.</small></span>
                <input type="checkbox" checked={timer.chimeEnabled} onChange={(event) => { void onUpdateSettings({ restTimer: { chimeEnabled: event.target.checked } }); }} />
              </label>
            </div>
            <button className="secondary-action permission-action" type="button" onClick={() => { void requestPermissions(); }}>Open timer permissions</button>
            {permissionMessage && <p className="settings-inline-status" role="status">{permissionMessage}</p>}
          </section>
        )}

        {screen === 'units' && (
          <section className="settings-detail-section">
            <p className="eyebrow">Current system</p>
            <h3>{database.profile.units === 'kg' ? 'Kilograms' : 'Pounds'}</h3>
            <p>Exercise tracking can still represent assistance, bodyweight, per-hand and per-side entry independently of this display unit.</p>
            <p className="muted">Unit switching and conversion-safe history management will be completed here rather than mixed into every exercise screen.</p>
          </section>
        )}

        {screen === 'notifications' && (
          <section className="settings-detail-section">
            <h3>Android delivery</h3>
            <p>Rest completion can use notifications, vibration and exact alarms. This personal build assumes those permissions can be granted.</p>
            <button className="secondary-action" type="button" onClick={() => { void requestPermissions(); }}>Open permission controls</button>
            {permissionMessage && <p className="settings-inline-status" role="status">{permissionMessage}</p>}
          </section>
        )}

        {screen === 'data' && (
          <>
            <section className="settings-detail-section">
              <p className="eyebrow">Backup</p>
              <h3>Export the complete local record</h3>
              <p>Includes routines, sessions, measurements, exercise memory and health provenance.</p>
              <button className="secondary-action" onClick={exportData}>Export JSON backup</button>
            </section>
            <section className="settings-detail-section danger-zone">
              <p className="eyebrow">Reset</p>
              <h3>Restore the seed routine</h3>
              <p>Clears local development data. This cannot be undone without a backup.</p>
              <button className="danger-action" onClick={() => { if (window.confirm('Reset every local My Mettle record?')) void onReset(); }}>Reset local data</button>
            </section>
          </>
        )}

        {screen === 'accessibility' && (
          <section className="settings-detail-section">
            <h3>System preferences respected</h3>
            <p>Reduced Motion is already detected from Android/browser preferences. Explicit in-app motion controls will live here as the cinematic layer develops.</p>
          </section>
        )}

        {screen === 'about' && (
          <section className="settings-detail-section">
            <p className="eyebrow">Local alpha</p>
            <h3>Phase 2 parity build</h3>
            <p>The complete domain state remains offline in IndexedDB. Health Connect read/write support is reserved for Phase 3; provider state, ownership and stable export identifiers already exist.</p>
            <div className="settings-status-row"><span>Health provider</span><strong>{database.healthIntegration.provider === 'none' ? 'Not connected' : database.healthIntegration.provider.replace('_', ' ')}</strong></div>
            <div className="settings-status-row"><span>Schema</span><strong>v{database.schemaVersion}</strong></div>
          </section>
        )}
      </aside>
    </div>
  );
}