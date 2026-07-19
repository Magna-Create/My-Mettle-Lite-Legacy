import { useState, type FormEvent } from 'react';
import type { AppDatabase, DaySymbol, Importance } from '../../domain/model';

interface Props {
  database: AppDatabase;
  onAddExercise: (input: {
    name: string;
    day: DaySymbol;
    importance: Importance;
    plannedLoad: number;
    targetReps: number;
    progressionStep: number;
  }) => Promise<void>;
}

export function LibraryPage({ database, onAddExercise }: Props) {
  const [open, setOpen] = useState(false);
  const routine = database.routineVersions.find((item) => item.id === database.currentRoutineVersionId);
  if (!routine) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onAddExercise({
      name: String(form.get('name') ?? ''),
      day: String(form.get('day')) as DaySymbol,
      importance: String(form.get('importance')) as Importance,
      plannedLoad: Number(form.get('plannedLoad')),
      targetReps: Number(form.get('targetReps')),
      progressionStep: Number(form.get('progressionStep')),
    });
    setOpen(false);
  }

  return (
    <main className="page library-page">
      <section className="page-heading library-heading">
        <div>
          <p className="eyebrow">Library · routine v{routine.version}</p>
          <h1>How the training system is constructed.</h1>
        </div>
        <button className="primary-action compact" onClick={() => setOpen(true)}>Add exercise</button>
      </section>

      <section className="routine-board">
        {routine.days.map((day) => (
          <article className="routine-column" key={day.symbol}>
            <header>
              <strong>{day.symbol}</strong>
              <span>{day.symbol === '&' ? 'conditional catch-up' : 'core day'}</span>
            </header>
            {day.slots.length === 0 && <p className="muted">No permanent slots.</p>}
            {day.slots.map((slot) => {
              const exercise = database.exercises.find((item) => item.id === slot.exerciseId);
              return (
                <div className="routine-slot" key={slot.id}>
                  <span className="importance-dot" data-importance={slot.importance} />
                  <div>
                    <strong>{exercise?.name ?? 'Missing exercise'}</strong>
                    <small>{slot.importance} · {slot.plannedLoad} kg · A {slot.prescriptions.A.sets}×{slot.prescriptions.A.repMin}–{slot.prescriptions.A.repMax}</small>
                  </div>
                </div>
              );
            })}
          </article>
        ))}
      </section>

      <section className="paper-card version-card">
        <p className="eyebrow">Version history</p>
        <h2>{database.routineVersions.length} immutable routine version{database.routineVersions.length === 1 ? '' : 's'}</h2>
        <p>Every permanent edit creates a new version rather than silently rewriting previous sessions.</p>
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal form-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <p className="eyebrow">New routine slot</p>
            <h2>Create an exercise</h2>
            <label>Name<input name="name" required autoFocus /></label>
            <div className="form-grid">
              <label>Day<select name="day" defaultValue="ψ"><option>ψ</option><option>φ</option><option>π</option><option>&</option></select></label>
              <label>Importance<select name="importance" defaultValue="core"><option value="principal">Principal</option><option value="core">Core</option><option value="accessory">Accessory</option></select></label>
              <label>Planned load<input name="plannedLoad" type="number" step="0.5" min="0" defaultValue="10" required /></label>
              <label>Target reps<input name="targetReps" type="number" min="1" defaultValue="6" required /></label>
              <label>Progression step<input name="progressionStep" type="number" step="0.5" min="0.5" defaultValue="1" required /></label>
            </div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-action compact" type="submit">Create and version routine</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
