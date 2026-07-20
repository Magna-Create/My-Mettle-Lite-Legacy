import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AddExerciseInput } from '../../application/GymAppService';
import type { ExerciseRecordPatch, RoutineSlotPatch } from '../../application/Phase2Management';
import {
  createRoutineEditDraft,
  isRoutineEditDraftDirty,
  parseRoutineEditDraft,
  type RoutineEditDraft,
} from '../../application/RoutineEditDraft';
import type { AppDatabase, DaySymbol } from '../../domain/model';
import { LibraryPageV2 } from './LibraryPageV2';
import { ROUTINE_EDIT_STORAGE_KEY, RoutineEditMode } from './RoutineEditMode';

interface EditState { editing: boolean; dirty: boolean; }

interface Props {
  database: AppDatabase;
  externalDiscardToken: number;
  onEditStateChange: (state: EditState) => void;
  onCommitRoutineEdit: (draft: RoutineEditDraft) => Promise<void>;
  onAddExercise: (input: AddExerciseInput) => Promise<void>;
  onReorderSlot: (slotId: string, direction: -1 | 1) => Promise<void>;
  onMoveSlot: (slotId: string, day: DaySymbol) => Promise<void>;
  onRemoveSlot: (slotId: string) => Promise<void>;
  onUpdateSlot: (slotId: string, patch: RoutineSlotPatch) => Promise<void>;
  onUpdateExercise: (exerciseId: string, patch: ExerciseRecordPatch) => Promise<void>;
  onArchiveExercise: (exerciseId: string) => Promise<void>;
  onRestoreExercise: (exerciseId: string) => Promise<void>;
}

export function LibraryPageV4(props: Props) {
  const [editDraft, setEditDraft] = useState<RoutineEditDraft | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<RoutineEditDraft | null>(null);
  const [headingTarget, setHeadingTarget] = useState<Element | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const { database, onEditStateChange } = props;
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);

  useEffect(() => () => onEditStateChange({ editing: false, dirty: false }), [onEditStateChange]);

  useEffect(() => {
    if (editDraft) return;
    const root = shellRef.current;
    if (!root) return;
    setHeadingTarget(root.querySelector('.library-heading'));
    root.querySelectorAll<HTMLButtonElement>('.routine-slot-content').forEach((button) => {
      button.disabled = true;
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.classList.add('routine-title-static');
    });
  }, [database.currentRoutineVersionId, editDraft]);

  if (!routine) return null;

  function beginEdit() {
    const stored = localStorage.getItem(ROUTINE_EDIT_STORAGE_KEY);
    const recovered = stored ? parseRoutineEditDraft(stored, database.currentRoutineVersionId) : null;
    if (recovered && isRoutineEditDraftDirty(database, recovered)) {
      setRecoveryDraft(recovered);
      return;
    }
    localStorage.removeItem(ROUTINE_EDIT_STORAGE_KEY);
    setEditDraft(createRoutineEditDraft(database));
  }

  if (editDraft) {
    return <RoutineEditMode
      database={database}
      initialDraft={editDraft}
      externalDiscardToken={props.externalDiscardToken}
      onStateChange={props.onEditStateChange}
      onCommit={props.onCommitRoutineEdit}
      onExit={() => setEditDraft(null)}
    />;
  }

  return <div className="library-v4-shell" ref={shellRef}>
    <LibraryPageV2
      database={database}
      onAddExercise={props.onAddExercise}
      onReorderSlot={props.onReorderSlot}
      onMoveSlot={props.onMoveSlot}
      onRemoveSlot={props.onRemoveSlot}
      onUpdateSlot={props.onUpdateSlot}
      onUpdateExercise={props.onUpdateExercise}
      onArchiveExercise={props.onArchiveExercise}
      onRestoreExercise={props.onRestoreExercise}
    />

    {headingTarget && createPortal(
      <div className="library-edit-portal"><button className="secondary-action compact" type="button" onClick={beginEdit}>Edit routine</button></div>,
      headingTarget,
    )}

    {recoveryDraft && <div className="modal-backdrop routine-recovery-backdrop"><section className="modal routine-recovery-dialog">
      <p className="eyebrow">Unfinished routine</p>
      <h2>Continue editing?</h2>
      <p>The recovered draft is based on routine v{routine.version}.</p>
      <footer>
        <button className="secondary-action" type="button" onClick={() => { localStorage.removeItem(ROUTINE_EDIT_STORAGE_KEY); setRecoveryDraft(null); setEditDraft(createRoutineEditDraft(database)); }}>Discard</button>
        <button className="primary-action compact" type="button" onClick={() => { setEditDraft(recoveryDraft); setRecoveryDraft(null); }}>Continue</button>
      </footer>
    </section></div>}
  </div>;
}
