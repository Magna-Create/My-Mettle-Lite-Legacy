import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GymAppService, type AddExerciseInput } from '../application/GymAppService';
import { beginLiteSession, completeLiteSession } from '../application/LiteSessionService';
import { addSessionSet, amendHistoricalSet, archiveExercise, discardSession, moveRoutineSlot, removeSessionSet, reorderRoutineSlot, restoreDiscardedSession, setSessionExcluded, updateExerciseRecord, updateRoutineSlot, type ExerciseRecordPatch, type RoutineSlotPatch } from '../application/Phase2Management';
import { saveExerciseReflection } from '../application/ExerciseReflectionManagement';
import { commitRoutineEditDraft, type RoutineEditDraft } from '../application/RoutineEditDraft';
import { removeRoutineSlotWithArchive } from '../application/removeRoutineSlotWithArchive';
import { restoreArchivedExercise } from '../application/restoreArchivedExercise';
import { IndexedDbGymRepository } from '../adapters/storage/IndexedDbGymRepository';
import type { AppDatabase, AppSettings, DaySymbol, Mode, SetRecord } from '../domain/model';
import { applyRoutinePack, type ParsedRoutinePack } from '../domain/routinePack';
import { NavIcon } from '../components/NavIcon';
import { BriefPage } from '../features/brief/BriefPage';
import { TrainPage } from '../features/train/TrainPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { ProfileSheetV2 } from '../features/settings/ProfileSheetV2';
import { RestTimerOverlay, formatRestTime } from '../features/timer/RestTimerOverlay';
import { useRestTimer } from '../features/timer/useRestTimer';

const tabs = ['brief', 'train', 'library'] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = { brief: 'Home', train: 'Train', library: 'Library' };
const fallbackTimerSettings: AppSettings['restTimer'] = { autoStart: true, vibrationEnabled: true, vibrationStrength: 'strong', chimeEnabled: false, backgroundNotificationEnabled: true };

export function AppV2() {
  const service = useMemo(() => new GymAppService(new IndexedDbGymRepository()), []);
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const [tab, setTab] = useState<Tab>('brief');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trainProgress, setTrainProgress] = useState({ progress: 0, condensed: false });
  const [routineEditState, setRoutineEditState] = useState({ editing: false, dirty: false });
  const [routineEditDiscardToken, setRoutineEditDiscardToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  const restTimer = useRestTimer(database?.settings.restTimer ?? fallbackTimerSettings);

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

  async function runAndConfirm(operation: (current: AppDatabase) => Promise<AppDatabase>): Promise<boolean> {
    let succeeded = false;
    await run(async (current) => {
      const next = await operation(current);
      succeeded = true;
      return next;
    });
    return succeeded;
  }

  function apply(transform: (current: AppDatabase) => AppDatabase): Promise<void> {
    return run((current) => service.persist(transform(current)));
  }

  async function importRoutine(pack: ParsedRoutinePack): Promise<boolean> {
    return runAndConfirm((current) => service.persist(applyRoutinePack(current, pack)));
  }

  async function startSession(day: DaySymbol, mode: Mode): Promise<void> {
    const succeeded = await runAndConfirm((current) => service.persist(beginLiteSession(current, day, mode)));
    if (succeeded) setTab('train');
  }

  async function finishSession(sessionId: string): Promise<void> {
    restTimer.dismiss();
    const succeeded = await runAndConfirm((current) => service.persist(completeLiteSession(current, sessionId)));
    if (succeeded) setTab('brief');
  }

  const handleProgressState = useCallback((progress: number, condensed: boolean) => {
    setTrainProgress((current) => current.progress === progress && current.condensed === condensed ? current : { progress, condensed });
  }, []);

  function navigate(nextTab: Tab) {
    if (tab === 'library' && nextTab !== 'library' && routineEditState.editing) {
      if (routineEditState.dirty && !window.confirm('Discard unfinished routine changes?')) return;
      setRoutineEditDiscardToken((value) => value + 1);
      setRoutineEditState({ editing: false, dirty: false });
    }
    setTab(nextTab);
  }

  if (!database) return <main className="boot-screen"><p className="eyebrow">Opening My Mettle Lite</p><h1>{error ?? 'Preparing…'}</h1></main>;

  const activeSession = database.sessions.find((session) => session.id === database.activeSessionId);
  const completedExercises = activeSession?.exercises.filter((exercise) => exercise.status === 'completed').length ?? 0;
  const showHeaderProgress = tab === 'train' && Boolean(activeSession) && trainProgress.condensed;
  const headerStyle = { '--session-progress': `${Math.round(trainProgress.progress * 100)}%` } as CSSProperties;
  const headerLabel = tab === 'train' && activeSession ? `Train · ${completedExercises}/${activeSession.exercises.length}` : tabLabels[tab];
  const restFocused = Boolean(restTimer.presentationReady && restTimer.state && !restTimer.state.minimized);

  return <div className={`app-shell ${restFocused ? 'has-rest-focus' : ''}`}>
    <header className={`top-bar ${showHeaderProgress ? 'has-session-progress' : ''}`} style={headerStyle}>
      <span className="top-progress-fill" aria-hidden="true" />
      <button className="wordmark" onClick={() => navigate('brief')} aria-label="Open Home"><span>MY METTLE</span></button>
      <div className="header-context">
        {restTimer.state?.minimized
          ? <button className={`header-rest-pill ${restTimer.state.completed ? 'is-complete' : ''}`} type="button" onClick={restTimer.expand}><span>{restTimer.state.completed ? 'Ready' : restTimer.state.paused ? 'Paused' : 'Rest'}</span><strong>{formatRestTime(restTimer.state.remainingSeconds)}</strong></button>
          : <span className="header-page-title">{headerLabel}</span>}
      </div>
      <div className="top-actions">
        <button className="header-icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><span aria-hidden="true">⚙</span></button>
        <button className="profile-button" aria-label="Open profile" onClick={() => setProfileOpen(true)}>{database.profile.displayName.slice(0, 1).toUpperCase()}</button>
      </div>
    </header>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div>}
    <div className="page-stack">
      <section hidden={tab !== 'brief'}><BriefPage database={database} onBeginSession={startSession} /></section>
      <section hidden={tab !== 'train'}><TrainPage database={database} onGoBrief={() => navigate('brief')} onProgressState={handleProgressState} onStartRest={restTimer.start} onAddSet={(sessionId, exerciseId) => apply((current) => addSessionSet(current, sessionId, exerciseId))} onRemoveSet={(sessionId, exerciseId, setId) => apply((current) => removeSessionSet(current, sessionId, exerciseId, setId))} onUpdateExercise={(exerciseId, patch) => apply((current) => updateExerciseRecord(current, exerciseId, patch))} onSaveReflection={(sessionId, exerciseId, input) => apply((current) => saveExerciseReflection(current, sessionId, exerciseId, input))} onUpdateSet={(sessionId, exerciseId, setId, patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>) => run((current) => service.updateSet(current, sessionId, exerciseId, setId, patch))} onCompleteExercise={(sessionId, exerciseId) => run((current) => service.completeExercise(current, sessionId, exerciseId))} onCompleteSession={finishSession} /></section>
      <section hidden={tab !== 'library'}><LibraryPage database={database} externalDiscardToken={routineEditDiscardToken} onEditStateChange={setRoutineEditState} onCommitRoutineEdit={(draft: RoutineEditDraft) => apply((current) => commitRoutineEditDraft(current, draft))} onImportRoutine={importRoutine} onAddExercise={(input: AddExerciseInput) => run((current) => service.addExerciseToRoutine(current, input))} onReorderSlot={(slotId, direction) => apply((current) => reorderRoutineSlot(current, slotId, direction))} onMoveSlot={(slotId, day) => apply((current) => moveRoutineSlot(current, slotId, day))} onRemoveSlot={(slotId) => apply((current) => removeRoutineSlotWithArchive(current, slotId))} onUpdateSlot={(slotId, patch: RoutineSlotPatch) => apply((current) => updateRoutineSlot(current, slotId, patch))} onUpdateExercise={(exerciseId, patch: ExerciseRecordPatch) => apply((current) => updateExerciseRecord(current, exerciseId, patch))} onArchiveExercise={(exerciseId) => apply((current) => archiveExercise(current, exerciseId))} onRestoreExercise={(exerciseId) => apply((current) => restoreArchivedExercise(current, exerciseId))} /></section>
    </div>
    <nav className="bottom-nav" aria-label="Primary navigation">{tabs.map((item) => <button key={item} data-active={tab === item} aria-label={tabLabels[item]} title={tabLabels[item]} onClick={() => navigate(item)}><NavIcon name={item} /></button>)}</nav>
    {settingsOpen && <SettingsSheet database={database} onClose={() => setSettingsOpen(false)} onUpdateSettings={(patch) => run((current) => service.updateSettings(current, patch))} onReset={async () => { restTimer.dismiss(); const reset = await service.reset(); databaseRef.current = reset; setDatabase(reset); setTab('brief'); setSettingsOpen(false); }} />}
    {profileOpen && <ProfileSheetV2 database={database} onClose={() => setProfileOpen(false)} onAddMeasurement={(input) => run((current) => service.addBodyMeasurement(current, input))} onAmendSet={(sessionId, exerciseId, setId, patch) => apply((current) => amendHistoricalSet(current, sessionId, exerciseId, setId, patch))} onAddSet={(sessionId, exerciseId) => apply((current) => addSessionSet(current, sessionId, exerciseId))} onRemoveSet={(sessionId, exerciseId, setId) => apply((current) => removeSessionSet(current, sessionId, exerciseId, setId))} onSaveReflection={(sessionId, exerciseId, input) => apply((current) => saveExerciseReflection(current, sessionId, exerciseId, input))} onSetExcluded={(sessionId, excluded) => apply((current) => setSessionExcluded(current, sessionId, excluded))} onDiscardSession={(sessionId) => apply((current) => discardSession(current, sessionId))} onRestoreSession={(sessionId) => apply((current) => restoreDiscardedSession(current, sessionId))} />}
    <RestTimerOverlay state={restTimer.presentationReady ? restTimer.state : null} onPause={restTimer.pause} onResume={restTimer.resume} onAddSeconds={restTimer.addSeconds} onMinimise={restTimer.minimize} onDismiss={restTimer.dismiss} />
  </div>;
}
