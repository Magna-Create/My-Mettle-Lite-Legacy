import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GymAppService, type AddExerciseInput } from '../application/GymAppService';
import { addSessionSet, amendHistoricalSet, archiveExercise, discardSession, moveRoutineSlot, removeSessionSet, reorderRoutineSlot, restoreDiscardedSession, setSessionExcluded, updateExerciseRecord, updateRoutineSlot, type ExerciseRecordPatch, type RoutineSlotPatch } from '../application/Phase2Management';
import { saveExerciseReflection } from '../application/ExerciseReflectionManagement';
import { commitRoutineEditDraft, type RoutineEditDraft } from '../application/RoutineEditDraft';
import { removeRoutineSlotWithArchive } from '../application/removeRoutineSlotWithArchive';
import { restoreArchivedExercise } from '../application/restoreArchivedExercise';
import { IndexedDbGymRepository } from '../adapters/storage/IndexedDbGymRepository';
import { IndexedDbMaisRepository } from '../adapters/storage/IndexedDbMaisRepository';
import type { AppDatabase, AppSettings, DaySymbol, Mode, SetRecord } from '../domain/model';
import { NavIcon } from '../components/NavIcon';
import { BriefPage } from '../features/brief/BriefPage';
import { TrainPage } from '../features/train/TrainPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { LabPage } from '../features/lab/LabPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { ProfileSheetV2 } from '../features/settings/ProfileSheetV2';
import { RestTimerOverlay, formatRestTime } from '../features/timer/RestTimerOverlay';
import { useRestTimer } from '../features/timer/useRestTimer';
import { MaisCoordinator } from '../mais/coordinator';
import type { MaisResourceSnapshot } from '../mais/contracts';
import { readMaisResourceSnapshot, subscribeMaisDeviceState } from '../mais/deviceState';
import { createNativeMaisRoleRunner } from '../mais/nativeRoleRunner';
import { deriveMaisResourceMode } from '../mais/resourceGovernor';
import { exportMaisReportCard } from '../mais/reportCard';
import { saveMaisReportCard } from '../mais/reportExport';
import { createDeterministicMaisRoleRunner } from '../mais/simulatedRoleRunner';
import type { MaisSystemSnapshot } from '../mais/systemState';

const tabs = ['brief', 'train', 'progress', 'lab', 'library'] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = { brief: 'Brief', train: 'Train', progress: 'Progress', lab: 'Lab', library: 'Library' };
const fallbackTimerSettings: AppSettings['restTimer'] = { autoStart: true, vibrationEnabled: true, vibrationStrength: 'strong', chimeEnabled: false, backgroundNotificationEnabled: true };
const MAIS_HEARTBEAT_INTERVAL_MS = 15_000;

export function AppV2() {
  const service = useMemo(() => new GymAppService(new IndexedDbGymRepository()), []);
  const mais = useMemo(() => {
    const fallback = createDeterministicMaisRoleRunner();
    return new MaisCoordinator(new IndexedDbMaisRepository(), createNativeMaisRoleRunner(fallback));
  }, []);
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const [maisSnapshot, setMaisSnapshot] = useState<MaisSystemSnapshot | null>(null);
  const [maisResources, setMaisResources] = useState<MaisResourceSnapshot>({
    appVisibility: 'foreground',
    batterySaver: false,
    isCharging: false,
    activeWorkoutInteraction: false,
    capturedAt: new Date().toISOString(),
  });
  const [tab, setTab] = useState<Tab>('brief');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trainProgress, setTrainProgress] = useState({ progress: 0, condensed: false });
  const [routineEditState, setRoutineEditState] = useState({ editing: false, dirty: false });
  const [routineEditDiscardToken, setRoutineEditDiscardToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  const maisReadyRef = useRef(false);
  const restTimer = useRestTimer(database?.settings.restTimer ?? fallbackTimerSettings);

  useEffect(() => {
    void service.initialise().then((initial) => {
      databaseRef.current = initial;
      setDatabase(initial);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'The local database could not be opened.');
    });
  }, [service]);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => Promise<void>) | undefined;

    void (async () => {
      try {
        await mais.initialise();
        maisReadyRef.current = true;
        const resources = await readMaisResourceSnapshot({ activeWorkoutInteraction: Boolean(databaseRef.current?.activeSessionId) });
        const foregrounded = await mais.ingest({ type: resources.appVisibility === 'foreground' ? 'app_foregrounded' : 'app_backgrounded' }, resources.capturedAt);
        if (!cancelled) {
          setMaisSnapshot(foregrounded);
          setMaisResources(resources);
        }
        dispose = await subscribeMaisDeviceState((state) => {
          void (async () => {
            const nextResources: MaisResourceSnapshot = {
              ...state,
              activeWorkoutInteraction: Boolean(databaseRef.current?.activeSessionId),
              userPaused: false,
            };
            const next = await mais.ingest({ type: state.appVisibility === 'foreground' ? 'app_foregrounded' : 'app_backgrounded' }, state.capturedAt);
            if (!cancelled) {
              setMaisResources(nextResources);
              setMaisSnapshot(next);
            }
          })();
        });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'MAIS could not open its local workspace.');
      }
    })();

    return () => {
      cancelled = true;
      maisReadyRef.current = false;
      if (dispose) void dispose();
    };
  }, [mais]);

  useEffect(() => {
    setMaisResources((current) => ({
      ...current,
      activeWorkoutInteraction: Boolean(database?.activeSessionId),
      capturedAt: new Date().toISOString(),
    }));
  }, [database?.activeSessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!maisReadyRef.current) return;
      void (async () => {
        try {
          const resources = await readMaisResourceSnapshot({ activeWorkoutInteraction: Boolean(databaseRef.current?.activeSessionId) });
          setMaisResources(resources);
          setMaisSnapshot(await mais.pulse(resources));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'The MAIS heartbeat failed.');
        }
      })();
    }, MAIS_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [mais]);

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

  function apply(transform: (current: AppDatabase) => AppDatabase): Promise<void> {
    return run((current) => service.persist(transform(current)));
  }

  const handleProgressState = useCallback((progress: number, condensed: boolean) => {
    setTrainProgress((current) => current.progress === progress && current.condensed === condensed ? current : { progress, condensed });
  }, []);

  async function currentMaisResources(): Promise<MaisResourceSnapshot> {
    const resources = await readMaisResourceSnapshot({ activeWorkoutInteraction: Boolean(databaseRef.current?.activeSessionId) });
    setMaisResources(resources);
    return resources;
  }

  async function pulseMaisOnce(): Promise<void> {
    const resources = await currentMaisResources();
    setMaisSnapshot(await mais.pulse(resources));
  }

  async function runMaisDemo(): Promise<void> {
    const eventTime = new Date().toISOString();
    await mais.ingest({
      type: 'session_completed',
      entityRefs: [`synthetic_session_${Date.now()}`],
      payload: { synthetic: true, purpose: 'Phase 3 native role verification' },
    }, eventTime);
    const resources = await currentMaisResources();
    setMaisSnapshot(await mais.runUntilSettled(resources, 8));
  }

  async function clearMais(): Promise<void> {
    setMaisSnapshot(await mais.clear());
  }

  async function exportMaisReport(): Promise<void> {
    try {
      const report = mais.buildReportCard();
      const createdAt = new Date().toISOString();
      const fileName = `my-mettle-mais-report-${createdAt.replaceAll(':', '-').replaceAll('.', '-')}.json`;
      const result = await saveMaisReportCard(fileName, exportMaisReportCard(report));
      window.alert(`MAIS report saved to ${result.location}/${result.fileName}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The MAIS report could not be exported.');
    }
  }

  async function recordCompletedSession(sessionId: string): Promise<void> {
    const occurredAt = new Date().toISOString();
    await mais.ingest({ type: 'session_completed', entityRefs: [sessionId], payload: { sessionId } }, occurredAt);
    const resources = await currentMaisResources();
    setMaisSnapshot(await mais.pulse(resources));
  }

  function navigate(nextTab: Tab) {
    if (tab === 'library' && nextTab !== 'library' && routineEditState.editing) {
      if (routineEditState.dirty && !window.confirm('Discard unfinished routine changes?')) return;
      setRoutineEditDiscardToken((value) => value + 1);
      setRoutineEditState({ editing: false, dirty: false });
    }
    setTab(nextTab);
  }

  if (!database) return <main className="boot-screen"><p className="eyebrow">Opening My Mettle</p><h1>{error ?? 'Preparing…'}</h1></main>;

  const activeSession = database.sessions.find((session) => session.id === database.activeSessionId);
  const completedExercises = activeSession?.exercises.filter((exercise) => exercise.status === 'completed').length ?? 0;
  const showHeaderProgress = tab === 'train' && Boolean(activeSession) && trainProgress.condensed;
  const headerStyle = { '--session-progress': `${Math.round(trainProgress.progress * 100)}%` } as CSSProperties;
  const headerLabel = tab === 'train' && activeSession ? `Train · ${completedExercises}/${activeSession.exercises.length}` : tabLabels[tab];
  const restFocused = Boolean(restTimer.presentationReady && restTimer.state && !restTimer.state.minimized);
  const maisResourceMode = deriveMaisResourceMode(maisResources);

  return <div className={`app-shell ${restFocused ? 'has-rest-focus' : ''}`}>
    <header className={`top-bar ${showHeaderProgress ? 'has-session-progress' : ''}`} style={headerStyle}><span className="top-progress-fill" aria-hidden="true" /><button className="wordmark" onClick={() => navigate('brief')} aria-label="Open Brief"><span>MY METTLE</span></button><div className="header-context">{restTimer.state?.minimized ? <button className={`header-rest-pill ${restTimer.state.completed ? 'is-complete' : ''}`} type="button" onClick={restTimer.expand}><span>{restTimer.state.completed ? 'Ready' : restTimer.state.paused ? 'Paused' : 'Rest'}</span><strong>{formatRestTime(restTimer.state.remainingSeconds)}</strong></button> : <span className="header-page-title">{headerLabel}</span>}</div><div className="top-actions"><button className="header-icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><span aria-hidden="true">⚙</span></button><button className="profile-button" aria-label="Open profile" onClick={() => setProfileOpen(true)}>{database.profile.displayName.slice(0, 1).toUpperCase()}</button></div></header>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div>}
    <div className="page-stack">
      <section hidden={tab !== 'brief'}><BriefPage database={database} onBeginSession={async (day: DaySymbol, mode: Mode) => { await run((current) => service.beginSession(current, day, mode)); setTab('train'); }} /></section>
      <section hidden={tab !== 'train'}><TrainPage database={database} onGoBrief={() => navigate('brief')} onProgressState={handleProgressState} onStartRest={restTimer.start} onAddSet={(sessionId, exerciseId) => apply((current) => addSessionSet(current, sessionId, exerciseId))} onRemoveSet={(sessionId, exerciseId, setId) => apply((current) => removeSessionSet(current, sessionId, exerciseId, setId))} onUpdateExercise={(exerciseId, patch) => apply((current) => updateExerciseRecord(current, exerciseId, patch))} onSaveReflection={(sessionId, exerciseId, input) => apply((current) => saveExerciseReflection(current, sessionId, exerciseId, input))} onUpdateSet={(sessionId, exerciseId, setId, patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>) => run((current) => service.updateSet(current, sessionId, exerciseId, setId, patch))} onCompleteExercise={(sessionId, exerciseId) => run((current) => service.completeExercise(current, sessionId, exerciseId))} onCompleteSession={async (sessionId) => { restTimer.dismiss(); await run((current) => service.completeSession(current, sessionId)); await recordCompletedSession(sessionId); setTab('progress'); }} /></section>
      <section hidden={tab !== 'progress'}><ProgressPage database={database} /></section>
      <section hidden={tab !== 'lab'}><LabPage database={database} onActivate={(id) => run((current) => service.activateExperiment(current, id))} onReject={async (id) => { await run((current) => service.rejectExperiment(current, id)); setMaisSnapshot(await mais.ingest({ type: 'user_rejected_proposal', entityRefs: [id] })); }} onPromote={async (id) => { await run((current) => service.promoteExperiment(current, id)); const routineId = databaseRef.current?.currentRoutineVersionId; if (routineId) setMaisSnapshot(await mais.ingest({ type: 'routine_version_created', entityRefs: [routineId], payload: { sourceExperimentId: id } })); }} /></section>
      <section hidden={tab !== 'library'}><LibraryPage database={database} externalDiscardToken={routineEditDiscardToken} onEditStateChange={setRoutineEditState} onCommitRoutineEdit={(draft: RoutineEditDraft) => apply((current) => commitRoutineEditDraft(current, draft))} onAddExercise={(input: AddExerciseInput) => run((current) => service.addExerciseToRoutine(current, input))} onReorderSlot={(slotId, direction) => apply((current) => reorderRoutineSlot(current, slotId, direction))} onMoveSlot={(slotId, day) => apply((current) => moveRoutineSlot(current, slotId, day))} onRemoveSlot={(slotId) => apply((current) => removeRoutineSlotWithArchive(current, slotId))} onUpdateSlot={(slotId, patch: RoutineSlotPatch) => apply((current) => updateRoutineSlot(current, slotId, patch))} onUpdateExercise={(exerciseId, patch: ExerciseRecordPatch) => apply((current) => updateExerciseRecord(current, exerciseId, patch))} onArchiveExercise={(exerciseId) => apply((current) => archiveExercise(current, exerciseId))} onRestoreExercise={(exerciseId) => apply((current) => restoreArchivedExercise(current, exerciseId))} /></section>
    </div>
    <nav className="bottom-nav" aria-label="Primary navigation">{tabs.map((item) => <button key={item} data-active={tab === item} aria-label={tabLabels[item]} title={tabLabels[item]} onClick={() => navigate(item)}><NavIcon name={item} /></button>)}</nav>
    {settingsOpen && <SettingsSheet database={database} maisSnapshot={maisSnapshot} maisResourceMode={maisResourceMode} onRunMaisDemo={runMaisDemo} onPulseMais={pulseMaisOnce} onClearMais={clearMais} onExportMaisReport={exportMaisReport} onClose={() => setSettingsOpen(false)} onUpdateSettings={(patch) => run((current) => service.updateSettings(current, patch))} onReset={async () => { restTimer.dismiss(); const reset = await service.reset(); databaseRef.current = reset; setDatabase(reset); setTab('brief'); setSettingsOpen(false); }} />}
    {profileOpen && <ProfileSheetV2 database={database} onClose={() => setProfileOpen(false)} onAddMeasurement={(input) => run((current) => service.addBodyMeasurement(current, input))} onAmendSet={(sessionId, exerciseId, setId, patch) => apply((current) => amendHistoricalSet(current, sessionId, exerciseId, setId, patch))} onAddSet={(sessionId, exerciseId) => apply((current) => addSessionSet(current, sessionId, exerciseId))} onRemoveSet={(sessionId, exerciseId, setId) => apply((current) => removeSessionSet(current, sessionId, exerciseId, setId))} onSaveReflection={(sessionId, exerciseId, input) => apply((current) => saveExerciseReflection(current, sessionId, exerciseId, input))} onSetExcluded={(sessionId, excluded) => apply((current) => setSessionExcluded(current, sessionId, excluded))} onDiscardSession={(sessionId) => apply((current) => discardSession(current, sessionId))} onRestoreSession={(sessionId) => apply((current) => restoreDiscardedSession(current, sessionId))} />}
    <RestTimerOverlay state={restTimer.presentationReady ? restTimer.state : null} onPause={restTimer.pause} onResume={restTimer.resume} onAddSeconds={restTimer.addSeconds} onMinimise={restTimer.minimize} onDismiss={restTimer.dismiss} />
  </div>;
}
