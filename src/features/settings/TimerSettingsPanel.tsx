import { useState } from 'react';
import type { AppSettings, VibrationStrength } from '../../domain/model';
import { requestNativeTimerPermissions } from '../../native/RestTimerNotifications';

interface Props {
  timer: AppSettings['restTimer'];
  onUpdate: (patch: Partial<AppSettings['restTimer']>) => Promise<void>;
}

export function TimerSettingsPanel({ timer, onUpdate }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  async function requestPermissions() {
    setMessage('Opening Android permission controls…');
    try {
      const result = await requestNativeTimerPermissions();
      setMessage(result.notifications && result.exactAlarm
        ? 'Background timer permissions are ready.'
        : 'Grant notifications and Alarms & reminders, then return to My Mettle.');
    } catch {
      setMessage('Permission controls could not be opened on this device.');
    }
  }

  return <section className="settings-detail-section">
    <div className="settings-list">
      <label className="settings-toggle"><span><strong>Start automatically</strong><small>Begin after a set is completed.</small></span><input type="checkbox" checked={timer.autoStart} onChange={(event) => { void onUpdate({ autoStart: event.target.checked }); }} /></label>
      <label className="settings-toggle"><span><strong>Background timer</strong><small>Use an Android alarm and notification outside My Mettle.</small></span><input type="checkbox" checked={timer.backgroundNotificationEnabled ?? true} onChange={(event) => { void onUpdate({ backgroundNotificationEnabled: event.target.checked }); if (event.target.checked) void requestPermissions(); }} /></label>
      <label className="settings-toggle"><span><strong>Completion vibration</strong><small>Vibrate in-app and through Android.</small></span><input type="checkbox" checked={timer.vibrationEnabled} onChange={(event) => { void onUpdate({ vibrationEnabled: event.target.checked }); }} /></label>
      <label className="settings-select-row"><span><strong>Vibration strength</strong><small>Very strong uses a longer, denser pattern.</small></span><select value={timer.vibrationStrength} disabled={!timer.vibrationEnabled} onChange={(event) => { void onUpdate({ vibrationStrength: event.target.value as VibrationStrength }); }}><option value="low">Low</option><option value="medium">Medium</option><option value="strong">Strong</option><option value="very_strong">Very strong</option></select></label>
      <label className="settings-toggle"><span><strong>Completion chime</strong><small>Android uses the notification sound while backgrounded.</small></span><input type="checkbox" checked={timer.chimeEnabled} onChange={(event) => { void onUpdate({ chimeEnabled: event.target.checked }); }} /></label>
    </div>
    <button className="secondary-action permission-action" type="button" onClick={() => { void requestPermissions(); }}>Open timer permissions</button>
    {message && <p className="settings-inline-status">{message}</p>}
  </section>;
}
