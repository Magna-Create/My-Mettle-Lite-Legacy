# Phase 2C — Library Edit Mode

Status: implementation candidate on `agent/phase-2c-library-edit-mode`.

This phase turns Library from an append-only routine overview into a dependable structural editor while preserving immutable routine history and active-session snapshots.

## Product contract

Normal Library mode is for understanding the routine. Edit mode is for physically rearranging it.

### Normal mode

- Preserve the calm horizontal overview.
- Exercise titles are informational, not a second management trigger.
- Ellipsis is the sole route to detailed exercise management.
- Ordering arrows are not visible.
- `Add exercise` and `Edit routine` are distinct actions.

### Edit mode

- Replace narrow horizontal columns with full-width stacked day lanes for ψ, φ, π and &.
- Show a sticky `Cancel / Editing routine / Done` toolbar.
- State that changes apply to future sessions.
- Hide Add Exercise and detailed exercise management while a structural draft is open.
- Introduce controlled visual energy through depth, warm edge light, subtle particles and responsive card movement rather than warning colours or excessive copy.

## Structural transaction

Edit mode operates on a local `RoutineEditDraft` copied from the current routine version.

- Drag, fallback movement and removal modify only the draft.
- The draft is mirrored into local storage after each change.
- `Done` validates the whole draft and creates exactly one immutable routine version.
- `Cancel` discards the draft.
- A structurally unchanged draft creates no routine version.
- Any exercise removed from its final occurrence in the resulting active routine is archived.
- Exercises with another active occurrence remain unarchived.
- Historical routine versions and sessions are never rewritten.
- An active workout remains a frozen snapshot and is unaffected by routine editing.

## Drag interaction

- Dragging begins only from a dedicated handle.
- The lifted card becomes a floating ghost while its proposed position remains visible as an insertion gap.
- Vertical movement reorders within a day.
- Horizontal/cross-lane movement moves between days.
- A temporary ψ / φ / π / & destination rail appears during drag.
- Empty day lanes remain substantial drop targets.
- Pointer tracking is attached at window level so dragging survives React reparenting between lanes.
- Movement near the viewport edges scrolls the routine editor.
- Nearby cards animate into their proposed positions before release.

## Haptics

Haptics are deliberately differentiated:

- Pickup: short, crisp pulse.
- Slot shuffle: softer micro-pattern, throttled to avoid buzzing when the pointer jitters.
- Entering a different day: slightly firmer transition pattern.
- Final placement: crisp confirmation pattern.
- Cancelled/invalid drag: dull rejection pattern.

The visual interaction remains understandable when vibration is unavailable or disabled.

## Recovery and exit protection

- A compatible unfinished draft is offered when Library is reopened.
- A draft whose base routine version no longer matches the current routine is discarded rather than applied.
- Hotbar navigation and the wordmark ask before discarding dirty changes.
- Android Back opens the same discard decision rather than silently leaving.
- Browser/process exit preserves the recovery draft.

## Undo and fallback controls

A compact Undo surface restores the draft state before the latest reorder, move or removal.

The edit-mode overflow sheet provides an accessibility and alpha fallback:

- Move up
- Move down
- Move to ψ
- Move to φ
- Move to π
- Move to &
- Remove from routine

There is no drag-to-delete target.

## Device test checklist

1. Enter and leave Edit mode without changes; confirm no new version is created.
2. Reorder several exercises and press Done; confirm only one new routine version.
3. Move ψ → π and π → &.
4. Drop into an empty day.
5. Test long-page edge scrolling while dragging.
6. Confirm pickup, shuffle, day-change and placement haptics feel distinct but restrained.
7. Undo a reorder, cross-day move and removal.
8. Use fallback move controls without dragging.
9. Remove the last active occurrence and confirm the exercise appears in Archive after Done.
10. Remove one of multiple occurrences and confirm the exercise remains active.
11. Press Cancel with and without changes.
12. Attempt hotbar navigation and wordmark navigation with dirty changes.
13. Press Android Back with dirty changes.
14. Kill and reopen the app mid-edit; continue the recovered draft.
15. Create a newer routine version, then confirm an older recovery draft is not applied.
16. Edit the routine during an active workout and confirm the current session is unchanged.
17. Verify normal Library mode has no arrows and the title is not a management trigger.
18. Verify ellipsis still opens the full exercise-management surface.
19. Verify reduced-motion mode remains functional and legible.
