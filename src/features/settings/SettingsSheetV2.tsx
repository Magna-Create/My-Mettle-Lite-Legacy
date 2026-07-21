import { useState } from 'react';
import type { AppDatabase, AppSettings } from '../../domain/model';
import type { MaisResourceMode } from '../../mais/contracts';
import type { MaisSystemSnapshot } from '../../mais/systemState';
import { MaisActivityPanel } from '../lab/MaisActivityPanel';
import { MaisRuntimeLabPanel } from '../lab/MaisRuntimeLabPanel';
import { DataSettingsPanel } from './DataSettingsPanel';
import { EmbeddingGemmaImportPanel } from './EmbeddingGemmaImportPanel';
import { TimerSettingsPanel } from './TimerSettingsPanel';
import './intelligence-settings.css';

interface Props {
  database: AppDatabase;
  maisSnapshot: MaisSystemSnapshot | null;
  maisResourceMode: MaisResourceMode;
  onClose: () => void;
  onReset: () => Promise<void>;
  onUpdateSettings: (patch: { restTimer?: Partial<AppSettings['restTimer']> }) => Promise<void>;
  onRunMaisDemo: () => Promise<void>;
  onPulseMais: () => Promise<void>;
  onClearMais: () => Promise<void>;
  onExportMaisReport: () => void;
}

type Screen = 'root' | 'workout' | 'timer' | 'intelligence' | 'models' | 'activity' | 'data';

const titles: Record<Screen, string> = {
  root: 'Settings',
  workout: 'Workout',
  timer: 'Rest timer',
  intelligence: 'Intelligence',
  models: 'Local models',
  activity: 'Activity & diagnostics',
  data: 'Data',
};

const parentScreen: Record<Exclude<Screen, 'root'>, Screen> = {
  workout: 'root',
  timer: 'workout',
  intelligence: 'root',
  models: 'intelligence',
  activity: 'intelligence',
  data: 'root',
};

function Row({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button className="settings-navigation-row" type="button" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><i>›</i></button>;
}

export function SettingsSheetV2({
  database,
  maisSnapshot,
  maisResourceMode,
  onClose,
  onReset,
  onUpdateSettings,
  onRunMaisDemo,
  onPulseMais,
  onClearMais,
  onExportMaisReport,
}: Props) {
  const [screen, setScreen] = useState<Screen>('root');
  const wide = screen === 'models' || screen === 'activity';

  return <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
    <aside className={`settings-sheet ${wide ? 'is-intelligence-wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
      <header><div className="settings-title-row">{screen !== 'root' && <button className="settings-back-button" type="button" onClick={() => setScreen(parentScreen[screen])} aria-label="Back">‹</button>}<div><p className="eyebrow">Settings</p><h2>{titles[screen]}</h2></div></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">×</button></header>

      {screen === 'root' && <nav className="settings-navigation">
        <Row title="Workout" detail="Rest timer and workout behaviour" onClick={() => setScreen('workout')} />
        <Row title="Intelligence" detail="Local models, routing and diagnostics" onClick={() => setScreen('intelligence')} />
        <Row title="Data" detail="Export, restore and reset" onClick={() => setScreen('data')} />
      </nav>}

      {screen === 'workout' && <nav className="settings-navigation">
        <Row title="Rest timer" detail="Automatic start, background alarm, sound and vibration" onClick={() => setScreen('timer')} />
      </nav>}

      {screen === 'intelligence' && <nav className="settings-navigation">
        <Row title="Local models" detail="Install, import, benchmark and remove model artefacts" onClick={() => setScreen('models')} />
        <Row title="Activity & diagnostics" detail="Heartbeat, role execution, task ledger and report export" onClick={() => setScreen('activity')} />
      </nav>}

      {screen === 'timer' && <TimerSettingsPanel timer={database.settings.restTimer} onUpdate={(patch) => onUpdateSettings({ restTimer: patch })} />}
      {screen === 'models' && <div className="intelligence-settings-stack"><EmbeddingGemmaImportPanel /><MaisRuntimeLabPanel /></div>}
      {screen === 'activity' && <MaisActivityPanel snapshot={maisSnapshot} resourceMode={maisResourceMode} onRunDemo={onRunMaisDemo} onPulse={onPulseMais} onClear={onClearMais} onExportReport={onExportMaisReport} />}
      {screen === 'data' && <DataSettingsPanel database={database} onReset={onReset} />}
    </aside>
  </div>;
}
