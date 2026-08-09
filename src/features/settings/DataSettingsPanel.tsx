import { useState, type ChangeEvent } from 'react';
import type { AppDatabase } from '../../domain/model';
import { createBackupPayload, restoreBackupPayload } from '../../domain/backup';
import { IndexedDbGymRepository } from '../../adapters/storage/IndexedDbGymRepository';
import { saveJsonFile } from '../../platform/backupFile';

interface Props { database: AppDatabase; onReset: () => Promise<void>; }

export function DataSettingsPanel({ database, onReset }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    if (exporting) return;
    try {
      setExporting(true);
      setMessage('Preparing backup…');
      const payload = createBackupPayload(database);
      const filename = `my-mettle-lite-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const saved = await saveJsonFile(filename, JSON.stringify(payload, null, 2));
      setMessage(saved ? 'Backup saved.' : null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Backup could not be saved.');
    } finally {
      setExporting(false);
    }
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
        <button className="secondary-action" disabled={exporting} onClick={() => { void exportData(); }}>{exporting ? 'Preparing…' : 'Export JSON backup'}</button>
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
