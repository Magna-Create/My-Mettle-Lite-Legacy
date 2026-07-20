import { useMemo, useState } from 'react';
import type { AppDatabase, SetRecord } from '../../domain/model';
import { MODE_PRESENTATION } from '../../domain/presentation';
import { SetEntryRow } from '../../components/SetEntryRow';

interface Props {
  database: AppDatabase;
  onClose: () => void;
  onAmendSet: (
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
    patch: Partial<Pick<SetRecord, 'load' | 'reps' | 'durationSeconds' | 'distanceMetres' | 'note'>>,
  ) => Promise<void>;
  onAddSet: (sessionId: string, sessionExerciseId: string) => Promise<void>;
  onRemoveSet: (sessionId: string, sessionExerciseId: string, setId: string) => Promise<void>;
  onSetExcluded: (sessionId: string, excluded: boolean) => Promise<void>;
  onDiscard: (sessionId: string) => Promise<void>;
  onRestore: (sessionId: string) => Promise<void>;
}

function sessionDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function SessionHistoryOverlay({
  database,
  onClose,
  onAmendSet,
  onAddSet,
  onRemoveSet,
  onSetExcluded,
  onDiscard,
  onRestore,
}: Props) {
  const sessions = useMemo(
    () => [...database.sessions]
      .filter((session) => session.status !== 'active')
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    [database.sessions],
  );
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  return (
    <div className="modal-backdrop history-backdrop" onMouseDown={onClose}>
      <section className="session-history-surface" role="dialog" aria-modal="true" aria-labelledby="session-history-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Profile</p>
            <h2 id="session-history-title">Session history</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close session history">×</button>
        </header>

        <div className="session-history-layout">
          <nav className="session-history-list" aria-label="Recorded sessions">
            {sessions.length === 0 && <p className="muted">No finished sessions yet.</p>}
            {sessions.map((session) => (
              <button key={session.id} type="button" data-active={session.id === selectedId} onClick={() => setSelectedId(session.id)}>
                <span><strong>{session.day} · {MODE_PRESENTATION[session.mode].name}</strong><small>{sessionDate(session.startedAt)}</small></span>
                <i data-status={session.status}>{session.status === 'discarded' ? 'Discarded' : session.excludedFromInsights ? 'Excluded' : session.status}</i>
              </button>
            ))}
          </nav>

          <div className="session-history-detail">
            {!selected ? (
              <div className="history-empty"><p className="eyebrow">No selection</p><h3>Choose a session.</h3></div>
            ) : (
              <>
                <header className="history-session-header">
                  <div>
                    <p className="eyebrow">{selected.status}</p>
                    <h3>{selected.day} · {MODE_PRESENTATION[selected.mode].name}</h3>
                    <p>{sessionDate(selected.completedAt ?? selected.startedAt)}{selected.editedAt ? ` · edited ${sessionDate(selected.editedAt)}` : ''}</p>
                  </div>
                  {selected.bodyweightSnapshotKg !== null && <span>{selected.bodyweightSnapshotKg.toFixed(1)} kg snapshot</span>}
                </header>

                {selected.exercises.map((exercise) => (
                  <article className="history-exercise-card" key={exercise.id}>
                    <header><div><p className="eyebrow">{exercise.importanceSnapshot}</p><h4>{exercise.exerciseNameSnapshot}</h4></div><span>{exercise.sets.length} sets</span></header>
                    <div className="set-table history-set-table">
                      {exercise.sets.map((set) => (
                        <SetEntryRow
                          key={set.id}
                          set={set}
                          tracking={exercise.trackingSnapshot}
                          bodyweightKg={exercise.bodyweightSnapshotKg}
                          readOnly={selected.status === 'discarded'}
                          onChange={(patch) => { void onAmendSet(selected.id, exercise.id, set.id, patch); }}
                          onRemove={selected.status === 'discarded' ? undefined : () => {
                            if (window.confirm(`Remove set ${set.setIndex + 1} from this session?`)) void onRemoveSet(selected.id, exercise.id, set.id);
                          }}
                        />
                      ))}
                    </div>
                    {selected.status !== 'discarded' && (
                      <button className="add-set-button history-add-set" type="button" onClick={() => { void onAddSet(selected.id, exercise.id); }}>＋ Add set</button>
                    )}
                  </article>
                ))}

                <section className="history-management">
                  {selected.status !== 'discarded' ? (
                    <>
                      <label className="settings-toggle">
                        <span><strong>Exclude from Progress and Lab</strong><small>Keep the raw session without using it as training evidence.</small></span>
                        <input type="checkbox" checked={selected.excludedFromInsights ?? false} onChange={(event) => { void onSetExcluded(selected.id, event.target.checked); }} />
                      </label>
                      <button className="danger-action" type="button" onClick={() => {
                        if (window.confirm('Discard this session? It will stop counting toward cycle and evidence calculations.')) void onDiscard(selected.id);
                      }}>Discard session</button>
                    </>
                  ) : (
                    <button className="secondary-action" type="button" onClick={() => { void onRestore(selected.id); }}>Restore session</button>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}