import { useState, type ChangeEvent } from 'react';
import type { AppDatabase } from '../../domain/model';
import { createBackupPayload, restoreBackupPayload } from '../../domain/backup';
import { IndexedDbGymRepository } from '../../adapters/storage/IndexedDbGymRepository';

interface Props { database: AppDatabase; onReset: () => Promise<void>; }

export function DataSettingsPanel({ database, onReset }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  function exportData() {
    const payload = createBackupPayload(database);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `my-mettle-lite-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setMessage('Checking backup…');
      const restored = restoreBackupPayload(JSON.parse(await file.text()) as unknown);
      if (!window.confirm(`Restore ${file.name}? Current local data will be replaced.`)) {
        setMessage(null);
        return;
      }
      await new IndexedDbGymRepository().save(restored);
      window.location.reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Backup could not be restored.');
    }
  }

  return <>
    <section className="settings-detail-section">
      <p className="eyebrow">Backup</p>
      <h3>Move the complete local record</h3>
      <p>Includes routines, sessions, measurements and exercise memory in a versioned migration file.</p>
      <div className="data-actions">
        <button className="secondary-action" onClick={exportData}>Export JSON backup</button>
        <label className="secondary-action file-action">Restore JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importData(event); }} /></label>
      </div>
      {message && <p className="settings-inline-status">{message}</p>}
    </section>
    <section className="settings-detail-section danger-zone">
      <p className="eyebrow">Reset</p>
      <h3>Restore the seed routine</h3>
      <p>Clears every local record. Export first when the data matters.</p>
      <button className="danger-action" onClick={() => { if (window.confirm('Reset every local My Mettle record?')) void onReset(); }}>Reset local data</button>
    </section>
  </>;
}
