import { useState, type ChangeEvent } from 'react';
import { createBackupPayload } from '../../domain/backup';
import type { AppDatabase, DaySymbol } from '../../domain/model';
import { parseRoutinePack, previewRoutinePack, type ParsedRoutinePack, type RoutinePackPreview } from '../../domain/routinePack';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onImport: (pack: ParsedRoutinePack) => Promise<boolean>;
}

const days: DaySymbol[] = ['ψ', 'φ', 'π', '&'];

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RoutineImportDialog({ database, onClose, onImport }: Props) {
  const [source, setSource] = useState('');
  const [pack, setPack] = useState<ParsedRoutinePack | null>(null);
  const [preview, setPreview] = useState<RoutinePackPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function inspect(value: string) {
    try {
      const parsed = parseRoutinePack(JSON.parse(value) as unknown);
      setPack(parsed);
      setPreview(previewRoutinePack(parsed));
      setMessage(null);
    } catch (reason) {
      setPack(null);
      setPreview(null);
      setMessage(reason instanceof Error ? reason.message : 'Routine pack could not be read.');
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const contents = await file.text();
    setSource(contents);
    inspect(contents);
  }

  async function importPack() {
    if (!pack || !preview) return;
    const warning = preview.duplicateNames.length > 0
      ? ` This pack repeats the name${preview.duplicateNames.length === 1 ? '' : 's'} ${preview.duplicateNames.join(', ')}; check that this is intentional.`
      : '';
    if (!window.confirm(`Replace the current routine with “${preview.name}”? Existing sessions and routine history will remain.${warning}`)) return;

    setBusy(true);
    setMessage('Saving a safety backup…');
    downloadJson(`my-mettle-lite-pre-import-${new Date().toISOString().slice(0, 10)}.json`, createBackupPayload(database));
    setMessage('Importing routine…');
    const succeeded = await onImport(pack);
    setBusy(false);
    if (succeeded) onClose();
    else setMessage('The routine was not imported. Check the error at the top of the app.');
  }

  return <div className="modal-backdrop routine-import-backdrop" onMouseDown={busy ? undefined : onClose}>
    <section className="modal routine-import-dialog" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><p className="eyebrow">Library</p><h2>Import routine</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close routine import" disabled={busy}>×</button>
      </header>

      <p>Paste a versioned My Mettle Routine Pack or choose a JSON file. Import replaces the current routine in one operation while preserving previous routines, workouts and measurements.</p>

      <textarea
        className="routine-import-editor"
        value={source}
        onChange={(event) => { setSource(event.target.value); setPack(null); setPreview(null); setMessage(null); }}
        placeholder={'{\n  "format": "my-mettle-routine-pack",\n  "version": 1,\n  "name": "My routine",\n  "exercises": [],\n  "days": []\n}'}
        spellCheck={false}
        aria-label="Routine pack JSON"
      />

      <div className="data-actions routine-import-actions">
        <label className="secondary-action file-action">Choose JSON<input type="file" accept="application/json,.json" onChange={(event) => { void chooseFile(event); }} disabled={busy} /></label>
        <button className="secondary-action" type="button" onClick={() => inspect(source)} disabled={!source.trim() || busy}>Check pack</button>
      </div>

      {message && <p className="settings-inline-status">{message}</p>}

      {preview && <section className="routine-import-preview">
        <p className="eyebrow">Ready to import</p>
        <h3>{preview.name}</h3>
        <div className="routine-import-summary">
          <span><strong>{preview.exerciseCount}</strong> exercises</span>
          <span><strong>{preview.muscleModelCount}</strong> muscle models</span>
          <span><strong>{preview.slotCount}</strong> routine slots</span>
        </div>
        <div className="routine-import-days">
          {days.map((day) => <span key={day}><strong>{day}</strong>{preview.dayCounts[day]}</span>)}
        </div>
        {preview.duplicateNames.length > 0 && <p className="routine-import-warning">Repeated exercise names: {preview.duplicateNames.join(', ')}. Check that these separate pack entries are intentional before replacing the routine.</p>}
      </section>}

      <footer>
        <button className="secondary-action" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="primary-action compact" type="button" onClick={() => { void importPack(); }} disabled={!pack || busy}>{busy ? 'Importing…' : 'Replace routine'}</button>
      </footer>
    </section>
  </div>;
}
