import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { AppDatabase, DaySymbol, RoutineSlot } from '../../domain/model';
import {
  isRoutineEditDraftDirty,
  locateDraftSlot,
  moveRoutineDraftSlot,
  removeRoutineDraftSlot,
  type RoutineEditDraft,
} from '../../application/RoutineEditDraft';
import { getTrackingPresentation, presetFromTracking, TRACKING_PRESET_LABELS } from '../../domain/tracking';
import { routineEditHaptic } from './routineEditHaptics';

export const ROUTINE_EDIT_STORAGE_KEY_V2 = 'my-mettle:routine-edit-draft:v1';

interface EditState { editing: boolean; dirty: boolean; }
interface Props {
  database: AppDatabase;
  initialDraft: RoutineEditDraft;
  externalDiscardToken: number;
  onStateChange: (state: EditState) => void;
  onCommit: (draft: RoutineEditDraft) => Promise<void>;
  onExit: () => void;
}
interface DragState {
  pointerId: number;
  slotId: string;
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  originDraft: RoutineEditDraft;
}
interface UndoEntry { draft: RoutineEditDraft; message: string; }

const dayLabels: Record<DaySymbol, string> = { 'ψ': 'core day', 'φ': 'core day', 'π': 'core day', '&': 'conditional catch-up' };
const days: DaySymbol[] = ['ψ', 'φ', 'π', '&'];

function sameStructure(left: RoutineEditDraft, right: RoutineEditDraft) {
  return left.days.length === right.days.length && left.days.every((day, dayIndex) => {
    const other = right.days[dayIndex];
    return other?.symbol === day.symbol
      && other.slots.length === day.slots.length
      && day.slots.every((slot, index) => other.slots[index]?.id === slot.id);
  });
}

function moveDescription(database: AppDatabase, slot: RoutineSlot, targetDay: DaySymbol) {
  const exercise = database.exercises.find((candidate) => candidate.id === slot.exerciseId);
  return `Moved ${exercise?.name ?? 'exercise'} to ${targetDay}`;
}

function insertionIndex(
  draft: RoutineEditDraft,
  movingSlotId: string,
  targetDay: DaySymbol,
  targetSlotId: string | null,
  placeAfter: boolean,
) {
  const lane = draft.days.find((day) => day.symbol === targetDay);
  if (!lane) return 0;
  const slots = lane.slots.filter((slot) => slot.id !== movingSlotId);
  if (!targetSlotId) return slots.length;
  const index = slots.findIndex((slot) => slot.id === targetSlotId);
  return index < 0 ? slots.length : index + (placeAfter ? 1 : 0);
}

function autoScroll(clientY: number) {
  const edge = 118;
  if (clientY < edge) {
    window.scrollBy(0, -Math.ceil(18 * ((edge - clientY) / edge)));
  } else if (clientY > window.innerHeight - edge) {
    window.scrollBy(0, Math.ceil(18 * ((clientY - (window.innerHeight - edge)) / edge)));
  }
}

export function RoutineEditModeV2({ database, initialDraft, externalDiscardToken, onStateChange, onCommit, onExit }: Props) {
  const [draft, setDraftState] = useState<RoutineEditDraft>(initialDraft);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const [menuSlotId, setMenuSlotId] = useState<string | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  const dragRef = useRef(drag);
  const dirtyRef = useRef(false);
  const onExitRef = useRef(onExit);
  const closingHistoryRef = useRef(false);
  const lastTargetRef = useRef<string | null>(null);
  const previousDiscardToken = useRef(externalDiscardToken);
  const dirty = isRoutineEditDraftDirty(database, draft);
  const currentRoutine = database.routineVersions.find((routine) => routine.id === draft.baseRoutineVersionId);

  function setDraft(next: RoutineEditDraft) {
    draftRef.current = next;
    setDraftState(next);
  }
  function setDrag(next: DragState | null) {
    dragRef.current = next;
    setDragState(next);
  }

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  useEffect(() => {
    onStateChange({ editing: true, dirty });
    localStorage.setItem(ROUTINE_EDIT_STORAGE_KEY_V2, JSON.stringify(draft));
  }, [dirty, draft, onStateChange]);

  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, []);

  useEffect(() => {
    window.history.pushState({ myMettleRoutineEdit: true }, '');
    const handleBack = () => {
      if (closingHistoryRef.current) {
        closingHistoryRef.current = false;
        return;
      }
      if (dirtyRef.current) {
        setDiscardPrompt(true);
        window.history.pushState({ myMettleRoutineEdit: true }, '');
      } else {
        onStateChange({ editing: false, dirty: false });
        onExitRef.current();
      }
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [onStateChange]);

  function leaveEditor() {
    localStorage.removeItem(ROUTINE_EDIT_STORAGE_KEY_V2);
    onStateChange({ editing: false, dirty: false });
    if (window.history.state?.myMettleRoutineEdit) {
      closingHistoryRef.current = true;
      window.history.back();
    }
    onExitRef.current();
  }

  useEffect(() => {
    if (externalDiscardToken === previousDiscardToken.current) return;
    previousDiscardToken.current = externalDiscardToken;
    leaveEditor();
  }, [externalDiscardToken]);

  const exerciseById = useMemo(() => new Map(database.exercises.map((exercise) => [exercise.id, exercise])), [database.exercises]);
  const draggedSlot = drag ? locateDraftSlot(draft, drag.slotId).slot : null;
  const draggedExercise = draggedSlot ? exerciseById.get(draggedSlot.exerciseId) : null;

  function pushUndo(previous: RoutineEditDraft, message: string) {
    setUndoStack((stack) => [...stack.slice(-19), { draft: previous, message }]);
    setUndoMessage(message);
  }

  function applyDraftChange(next: RoutineEditDraft, message: string) {
    if (sameStructure(draftRef.current, next)) return;
    pushUndo(draftRef.current, message);
    setDraft(next);
    routineEditHaptic('place');
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, slotId: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    const card = event.currentTarget.closest<HTMLElement>('[data-edit-card]');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const location = locateDraftSlot(draftRef.current, slotId);
    lastTargetRef.current = `${location.day.symbol}:${location.index}`;
    setMenuSlotId(null);
    setDrag({
      pointerId: event.pointerId,
      slotId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      originDraft: structuredClone(draftRef.current),
    });
    routineEditHaptic('lift');
  }

  useEffect(() => {
    if (!drag) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';

    const move = (event: PointerEvent) => {
      const currentDrag = dragRef.current;
      if (!currentDrag || event.pointerId !== currentDrag.pointerId) return;
      event.preventDefault();
      autoScroll(event.clientY);
      setDrag({ ...currentDrag, clientX: event.clientX, clientY: event.clientY });

      const elements = document.elementsFromPoint(event.clientX, event.clientY) as HTMLElement[];
      const rail = elements.find((element) => element.dataset.editRailDay);
      const lane = elements.find((element) => element.dataset.editDay);
      const targetCard = elements.find((element) => element.dataset.editSlot && element.dataset.editSlot !== currentDrag.slotId);
      const targetDay = (rail?.dataset.editRailDay ?? lane?.dataset.editDay ?? targetCard?.dataset.editCardDay) as DaySymbol | undefined;
      if (!targetDay || !days.includes(targetDay)) return;

      const targetSlotId = rail ? null : targetCard?.dataset.editSlot ?? null;
      let placeAfter = false;
      if (targetCard) {
        const rect = targetCard.getBoundingClientRect();
        placeAfter = event.clientY > rect.top + rect.height / 2;
      }
      const currentDraft = draftRef.current;
      const targetIndex = insertionIndex(currentDraft, currentDrag.slotId, targetDay, targetSlotId, placeAfter);
      const key = `${targetDay}:${targetIndex}`;
      if (lastTargetRef.current === key) return;

      const previousDay = locateDraftSlot(currentDraft, currentDrag.slotId).day.symbol;
      const next = moveRoutineDraftSlot(currentDraft, currentDrag.slotId, targetDay, targetIndex);
      if (sameStructure(currentDraft, next)) return;
      lastTargetRef.current = key;
      setDraft(next);
      routineEditHaptic(previousDay === targetDay ? 'shuffle' : 'change_day');
    };

    const finish = (event: PointerEvent) => {
      const currentDrag = dragRef.current;
      if (!currentDrag || event.pointerId !== currentDrag.pointerId) return;
      const currentDraft = draftRef.current;
      if (!sameStructure(currentDrag.originDraft, currentDraft)) {
        const location = locateDraftSlot(currentDraft, currentDrag.slotId);
        pushUndo(currentDrag.originDraft, moveDescription(database, location.slot, location.day.symbol));
        routineEditHaptic('place');
      }
      setDrag(null);
      lastTargetRef.current = null;
    };

    const cancel = (event: PointerEvent) => {
      const currentDrag = dragRef.current;
      if (!currentDrag || event.pointerId !== currentDrag.pointerId) return;
      setDraft(currentDrag.originDraft);
      setDrag(null);
      lastTargetRef.current = null;
      routineEditHaptic('reject');
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [Boolean(drag), database]);

  function moveFromMenu(slotId: string, targetDay: DaySymbol, targetIndex: number) {
    const slot = locateDraftSlot(draftRef.current, slotId).slot;
    applyDraftChange(moveRoutineDraftSlot(draftRef.current, slotId, targetDay, targetIndex), moveDescription(database, slot, targetDay));
    setMenuSlotId(null);
  }

  function removeFromDraft(slotId: string) {
    const slot = locateDraftSlot(draftRef.current, slotId).slot;
    const exercise = exerciseById.get(slot.exerciseId);
    applyDraftChange(removeRoutineDraftSlot(draftRef.current, slotId), `Removed ${exercise?.name ?? 'exercise'} from the draft`);
    setMenuSlotId(null);
  }

  function undo() {
    const entry = undoStack.at(-1);
    if (!entry) return;
    setDraft(entry.draft);
    setUndoStack((stack) => stack.slice(0, -1));
    setUndoMessage(null);
    routineEditHaptic('place');
  }

  function requestCancel() {
    if (dirtyRef.current) setDiscardPrompt(true);
    else leaveEditor();
  }

  async function save() {
    if (!dirtyRef.current) { leaveEditor(); return; }
    try {
      setSaving(true);
      await onCommit(draftRef.current);
      routineEditHaptic('place');
      leaveEditor();
    } finally {
      setSaving(false);
    }
  }

  if (!currentRoutine) return null;

  return <main className="page routine-edit-page">
    <div className="routine-edit-atmosphere" aria-hidden="true" />
    <header className="routine-edit-toolbar">
      <button className="text-button" type="button" onClick={requestCancel}>Cancel</button>
      <div><p className="eyebrow">Routine v{currentRoutine.version} · draft</p><strong>Editing routine</strong><small>Applies to future sessions.</small></div>
      <button className="primary-action compact" type="button" disabled={saving} onClick={() => { void save(); }}>{saving ? 'Saving…' : 'Done'}</button>
    </header>

    {drag && <nav className="routine-destination-rail" aria-label="Move exercise to day"><span>Move to</span>{days.map((day) => <button key={day} type="button" data-edit-rail-day={day}>{day}</button>)}</nav>}

    <section className="routine-edit-lanes" aria-label="Routine editor">
      {draft.days.map((day) => <article className="routine-edit-lane" key={day.symbol} data-edit-day={day.symbol}>
        <header><div><strong>{day.symbol}</strong><span>{dayLabels[day.symbol]}</span></div><small>{day.slots.length} exercise{day.slots.length === 1 ? '' : 's'}</small></header>
        <div className={`routine-edit-slot-list ${day.slots.length === 0 ? 'is-empty' : ''}`}>
          {day.slots.length === 0 && <div className="routine-empty-drop">Drop an exercise here</div>}
          {day.slots.map((slot) => {
            const exercise = exerciseById.get(slot.exerciseId);
            if (!exercise) return null;
            const presentation = getTrackingPresentation(exercise.tracking, exercise.defaultUnit);
            const isDragging = drag?.slotId === slot.id;
            return <article className={`routine-edit-card ${isDragging ? 'is-dragging-source' : ''}`} key={slot.id} data-edit-card data-edit-slot={slot.id} data-edit-card-day={day.symbol}>
              <span className="importance-dot" data-importance={slot.importance} />
              <div className="routine-edit-card-copy"><strong>{exercise.name}</strong><small>{slot.importance} · {presentation.requiresStartingValue ? `${presentation.valueLabel} ${slot.plannedLoad} ${presentation.valueSuffix}` : TRACKING_PRESET_LABELS[presetFromTracking(exercise.tracking)]} · A {slot.prescriptions.A.sets}×{slot.prescriptions.A.repMin}–{slot.prescriptions.A.repMax}</small></div>
              <button className="routine-edit-overflow" type="button" onClick={() => setMenuSlotId(slot.id)} aria-label={`Move or remove ${exercise.name}`}>•••</button>
              <button className="routine-drag-handle" type="button" aria-label={`Drag ${exercise.name}`} onPointerDown={(event) => beginDrag(event, slot.id)}><span aria-hidden="true">≡</span></button>
            </article>;
          })}
        </div>
      </article>)}
    </section>

    {drag && draggedSlot && draggedExercise && <div className="routine-drag-ghost" style={{ '--drag-x': `${drag.clientX - drag.offsetX}px`, '--drag-y': `${drag.clientY - drag.offsetY}px`, '--drag-width': `${drag.width}px`, '--drag-height': `${drag.height}px` } as CSSProperties}><span className="importance-dot" data-importance={draggedSlot.importance} /><div><strong>{draggedExercise.name}</strong><small>{draggedSlot.importance}</small></div><span>≡</span></div>}

    {undoMessage && <div className="routine-edit-undo" role="status"><span>{undoMessage}</span><button type="button" onClick={undo}>Undo</button></div>}

    {menuSlotId && (() => {
      const location = locateDraftSlot(draft, menuSlotId);
      const exercise = exerciseById.get(location.slot.exerciseId);
      const laneWithoutMoving = location.day.slots.filter((slot) => slot.id !== menuSlotId);
      return <div className="modal-backdrop routine-edit-menu-backdrop" onMouseDown={() => setMenuSlotId(null)}><section className="routine-edit-menu" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Edit placement</p><h3>{exercise?.name}</h3></div><button className="icon-button" type="button" onClick={() => setMenuSlotId(null)}>×</button></header>
        <div className="routine-edit-menu-actions">
          <button type="button" disabled={location.index === 0} onClick={() => moveFromMenu(menuSlotId, location.day.symbol, Math.max(0, location.index - 1))}>Move up</button>
          <button type="button" disabled={location.index === location.day.slots.length - 1} onClick={() => moveFromMenu(menuSlotId, location.day.symbol, Math.min(laneWithoutMoving.length, location.index + 1))}>Move down</button>
          {days.filter((day) => day !== location.day.symbol).map((day) => <button key={day} type="button" onClick={() => moveFromMenu(menuSlotId, day, draft.days.find((candidate) => candidate.symbol === day)?.slots.length ?? 0)}>Move to {day}</button>)}
          <button className="danger-text" type="button" onClick={() => removeFromDraft(menuSlotId)}>Remove from routine</button>
        </div>
      </section></div>;
    })()}

    {discardPrompt && <div className="modal-backdrop routine-discard-backdrop"><section className="modal routine-discard-dialog"><p className="eyebrow">Unfinished edit</p><h2>Discard routine changes?</h2><p>The current routine remains untouched.</p><footer><button className="secondary-action" type="button" onClick={() => setDiscardPrompt(false)}>Keep editing</button><button className="danger-action" type="button" onClick={leaveEditor}>Discard</button></footer></section></div>}
  </main>;
}
