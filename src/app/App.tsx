import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GymAppService } from '../application/GymAppService';
import { IndexedDbGymRepository } from '../adapters/storage/IndexedDbGymRepository';
import type { AppDatabase, DaySymbol, Importance, Mode, SetRecord } from '../domain/model';
import { MODE_PRESENTATION } from '../domain/presentation';
import { BriefPage } from '../features/brief/BriefPage';
import { TrainPage } from '../features/train/TrainPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { LabPage } from '../features/lab/LabPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { ProfileSheet } from '../features/settings/ProfileSheet';

const tabs = ['brief', 'train', 'progress', 'lab', 'library'] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  brief: 'Brief',
  train: 'Train',
  progress: 'Progress',
  lab: 'Lab',
  library: 'Library',
};

export function App() {
  const service = useMemo(() => new GymAppService(new IndexedDbGymRepository()), []);
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const [tab, setTab] = useState<Tab>('brief');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trainProgress, setTrainProgress] = useState({ progress: 0, condensed: false });
  const [error, setError] = useState<string | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const operationQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    void service.initialise().then((initial) => {
      databaseRef.current = initial;
      setDatabase(initial);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'The local database could not be opened.');
    });
  }, [service]);

  function run(operation: (current: AppDatabase) => Promise<AppDatabase>): Promise<void> {
    operationQueue.current = operationQueue.current.then(async () => {
      const current = databaseRef.current;
      if (!current) return;
      try {
        setError(null);
        const next = await operation(current);
        databaseRef.current = next;
        setDatabase(next);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Something went wrong.');
      }
    });
    return operationQueue.current;
  }

  const handleProgressState = useCallback((progress: number, condensed: boolean) => {
    setTrainProgress((current) => (
      current.progress === progress && current.condensed === condensed
        ? current
        : { progress, condensed }
    ));
  }, []);

  if (!database) {
    return <main className="boot-screen"><p className="eyebrow">Opening My Mettle</p><h1>{error ?? 'Preparing…'}</h1></main>;
  }

  const activeSession = database.sessions.find((session) => session.id === database.activeSessionId);
  const showHeaderProgress = tab === 'train' && Boolean(activeSession) && trainProgress.condensed;
  const headerStyle = {
    '--session-progress': `${Math.round(trainProgress.progress * 100)}%`,
  } as CSSProperties;

  return (
    <div className="app-shell">
      <header className={`top-bar ${showHeaderProgress ? 'has-session-progress' : ''}`} style={headerStyle}>
        <span className="top-progress-fill" aria-hidden="true" />
        <button className="wordmark" onClick={() => setTab('brief')} aria-label="Open Brief">
          <span>MY METTLE</span>
        </button>
        <div className="top-actions">
          {activeSession && (
            <button className="active-session-pill" onClick={() => setTab('train')}>
              {activeSession.day} · {MODE_PRESENTATION[activeSession.mode].name}
            </button>
          )}
          <button className="header-icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}>
            <span aria-hidden="true">⚙</span>
          </button>
          <button className="profile-button" aria-label="Open profile" onClick={() => setProfileOpen(true)}>
            {database.profile.displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div>}

      <div className="page-stack">
        <section hidden={tab !== 'brief'}>
          <BriefPage
            database={database}
            onBeginSession={async (day, mode) => {
              await run((current) => service.beginSession(current, day, mode));
              setTab('train');
            }}
          />
        </section>
        <section hidden={tab !== 'train'}>
          <TrainPage
            database={database}
            onGoBrief={() => setTab('brief')}
            onProgressState={handleProgressState}
            onUpdateSet={(sessionId, exerciseId, setId, patch) => run((current) => service.updateSet(current, sessionId, exerciseId, setId, patch))}
            onCompleteExercise={(sessionId, exerciseId) => run((current) => service.completeExercise(current, sessionId, exerciseId))}
            onCompleteSession={async (sessionId) => {
              await run((current) => service.completeSession(current, sessionId));
              setTab('progress');
            }}
          />
        </section>
        <section hidden={tab !== 'progress'}><ProgressPage database={database} /></section>
        <section hidden={tab !== 'lab'}>
          <LabPage
            database={database}
            onActivate={(id) => run((current) => service.activateExperiment(current, id))}
            onReject={(id) => run((current) => service.rejectExperiment(current, id))}
            onPromote={(id) => run((current) => service.promoteExperiment(current, id))}
          />
        </section>
        <section hidden={tab !== 'library'}>
          <LibraryPage
            database={database}
            onAddExercise={(input: { name: string; day: DaySymbol; importance: Importance; plannedLoad: number; targetReps: number; progressionStep: number }) =>
              run((current) => service.addExerciseToRoutine(current, input))
            }
          />
        </section>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {tabs.map((item) => (
          <button key={item} data-active={tab === item} onClick={() => setTab(item)}>
            <span className="nav-glyph" aria-hidden="true">{item === 'brief' ? '◌' : item === 'train' ? '↗' : item === 'progress' ? '∿' : item === 'lab' ? '⌁' : '▦'}</span>
            <span className="nav-label">{tabLabels[item]}</span>
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <SettingsSheet
          database={database}
          onClose={() => setSettingsOpen(false)}
          onReset={async () => {
            const reset = await service.reset();
            databaseRef.current = reset;
            setDatabase(reset);
            setTab('brief');
            setSettingsOpen(false);
          }}
        />
      )}

      {profileOpen && <ProfileSheet database={database} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
