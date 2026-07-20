import { useState } from 'react';
import type { AppDatabase, AppSettings } from '../../domain/model';
import { DataSettingsPanel } from './DataSettingsPanel';
import { TimerSettingsPanel } from './TimerSettingsPanel';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onReset: () => Promise<void>;
  onUpdateSettings: (patch: { restTimer?: Partial<AppSettings['restTimer']> }) => Promise<void>;
}

type Screen = 'root' | 'workout' | 'timer' | 'data';
const titles: Record<Screen, string> = { root: 'Settings', workout: 'Workout', timer: 'Rest timer', data: 'Data' };

function Row({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button className="settings-navigation-row" type="button" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><i>›</i></button>;
}

export function SettingsSheetV2({ database, onClose, onReset, onUpdateSettings }: Props) {
  const [screen, setScreen] = useState<Screen>('root');
  const backTarget: Screen = screen === 'timer' ? 'workout' : 'root';

  return <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}>
    <aside className="settings-sheet" onMouseDown={(event) => event.stopPropagation()}>
      <header><div className="settings-title-row">{screen !== 'root' && <button className="settings-back-button" type="button" onClick={() => setScreen(backTarget)} aria-label="Back">‹</button>}<div><p className="eyebrow">Settings</p><h2>{titles[screen]}</h2></div></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">×</button></header>

      {screen === 'root' && <nav className="settings-navigation">
        <Row title="Workout" detail="Rest timer and workout behaviour" onClick={() => setScreen('workout')} />
        <Row title="Data" detail="Export, restore and reset" onClick={() => setScreen('data')} />
      </nav>}

      {screen === 'workout' && <nav className="settings-navigation">
        <Row title="Rest timer" detail="Automatic start, background alarm, sound and vibration" onClick={() => setScreen('timer')} />
      </nav>}

      {screen === 'timer' && <TimerSettingsPanel timer={database.settings.restTimer} onUpdate={(patch) => onUpdateSettings({ restTimer: patch })} />}
      {screen === 'data' && <DataSettingsPanel database={database} onReset={onReset} />}
    </aside>
  </div>;
}
