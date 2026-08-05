import { useEffect, useRef, useState } from 'react';
import type { ExerciseRecordPatch } from '../../application/Phase2Management';
import type { AppDatabase, ExerciseSetupPhoto, MuscleLoadModel, SessionExercise } from '../../domain/model';
import { normaliseExerciseMemory } from '../../domain/exerciseMemory';
import { calculateExercisePerformance } from '../../domain/rules/performance';
import { entryBasisLabel, getTrackingPresentation, relationshipLabel } from '../../domain/tracking';
import { compressSetupPhoto } from './setupPhoto';

interface Props {
  database: AppDatabase;
  exercise: SessionExercise | null;
  initialSection?: 'info' | 'setup';
  onClose: () => void;
  onUpdateExercise: (exerciseId: string, patch: ExerciseRecordPatch) => Promise<void>;
}

function DetailList({ items, empty }: { items: string[]; empty: string }) {
  return items.length > 0 ? <ul className="exercise-memory-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty}</p>;
}

function MuscleLoadBreakdown({ model, fallback }: { model: MuscleLoadModel | undefined; fallback: string[] }) {
  if (!model) return <DetailList items={fallback} empty="No target muscles saved yet." />;
  return <>
    <ul className="exercise-memory-list muscle-load-list">
      {model.allocations.map((allocation) => <li key={allocation.muscle}><strong>{allocation.muscle} · {Math.round(allocation.proportion * 100)}%</strong><span>{allocation.role}</span></li>)}
    </ul>
    <small>Model confidence {Math.round(model.confidence * 100)}% · {model.basis}</small>
  </>;
}

function isOpenableUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function samePhotos(left: ExerciseSetupPhoto[], right: ExerciseSetupPhoto[]) {
  return left.length === right.length && left.every((photo, index) => photo.id === right[index]?.id);
}

export function ExerciseDetailsOverlay({ database, exercise, initialSection = 'info', onClose, onUpdateExercise }: Props) {
  const record = exercise ? database.exercises.find((candidate) => candidate.id === exercise.exerciseId) : undefined;
  const memory = normaliseExerciseMemory(record?.memory, record?.essentialCue);
  const [setupNotes, setSetupNotes] = useState(memory.setupNotes);
  const [setupPhotos, setSetupPhotos] = useState<ExerciseSetupPhoto[]>(memory.setupPhotos);
  const [videoReferenceUrl, setVideoReferenceUrl] = useState(memory.videoReferenceUrl);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setupSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSetupNotes(memory.setupNotes);
    setSetupPhotos(memory.setupPhotos);
    setVideoReferenceUrl(memory.videoReferenceUrl);
    setSaving(false);
    setProcessingPhoto(false);
    setActivePhotoId(null);
    setError(null);
  }, [exercise?.id, record?.updatedAt]);

  useEffect(() => {
    if (!exercise || initialSection !== 'setup') return;
    const frame = window.requestAnimationFrame(() => setupSectionRef.current?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [exercise?.id, initialSection]);

  if (!exercise) return null;

  const presentation = getTrackingPresentation(exercise.trackingSnapshot, record?.defaultUnit ?? database.profile.units);
  const recent = database.sessions
    .filter((session) => session.status === 'completed' && !session.excludedFromInsights)
    .flatMap((session) => session.exercises.map((candidate) => ({ session, exercise: candidate })))
    .filter((candidate) => candidate.exercise.exerciseId === exercise.exerciseId)
    .sort((left, right) => (right.session.completedAt ?? '').localeCompare(left.session.completedAt ?? ''))
    .slice(0, 4);
  const activePhotoIndex = setupPhotos.findIndex((photo) => photo.id === activePhotoId);
  const activePhoto = activePhotoIndex >= 0 ? setupPhotos[activePhotoIndex]! : null;

  async function saveAndClose() {
    if (saving || processingPhoto) return;
    const nextSetup = setupNotes.trim();
    const nextVideo = videoReferenceUrl.trim();
    const changed = nextSetup !== memory.setupNotes || nextVideo !== memory.videoReferenceUrl || !samePhotos(setupPhotos, memory.setupPhotos);
    if (!record || !changed) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onUpdateExercise(record.id, {
        memory: {
          setupNotes: nextSetup,
          setupPhotos,
          videoReferenceUrl: nextVideo,
        },
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The exercise details could not be saved.');
      setSaving(false);
    }
  }

  async function capturePhoto(file: File | undefined) {
    if (!file || processingPhoto) return;
    if (setupPhotos.length >= 12) {
      setError('This exercise already has the maximum of 12 setup photos.');
      return;
    }
    try {
      setProcessingPhoto(true);
      setError(null);
      const photo = await compressSetupPhoto(file);
      setSetupPhotos((current) => [...current, photo]);
      setActivePhotoId(photo.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The setup photo could not be processed.');
    } finally {
      setProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeActivePhoto() {
    if (!activePhoto) return;
    setSetupPhotos((current) => current.filter((photo) => photo.id !== activePhoto.id));
    setActivePhotoId(null);
  }

  function movePhoto(direction: -1 | 1) {
    if (activePhotoIndex < 0 || setupPhotos.length < 2) return;
    const nextIndex = (activePhotoIndex + direction + setupPhotos.length) % setupPhotos.length;
    setActivePhotoId(setupPhotos[nextIndex]!.id);
  }

  return <div className="modal-backdrop details-backdrop" onMouseDown={() => { void saveAndClose(); }}>
    <section className="exercise-details" role="dialog" aria-modal="true" aria-labelledby="exercise-details-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Exercise information</p><h2 id="exercise-details-title">{exercise.exerciseNameSnapshot}</h2></div><button className="icon-button" type="button" disabled={saving || processingPhoto} onClick={() => { void saveAndClose(); }} aria-label="Save and close exercise details">×</button></header>
      <section className="details-grid">
        <article><span>Tracking</span><strong>{relationshipLabel(exercise.trackingSnapshot.loadRelationship)}</strong><small>{entryBasisLabel(exercise.trackingSnapshot.entryBasis)} · {exercise.trackingSnapshot.metric.replace('_', ' ')}</small></article>
        <article><span>{presentation.progressionLabel}</span><strong>{record?.progressionStep ?? '—'} {record ? presentation.progressionSuffix : ''}</strong><small>{exercise.trackingSnapshot.loadRelationship === 'assistance' ? 'Reduce assistance when promoted.' : 'Applied through progression.'}</small></article>
        <article><span>Fatigue cost</span><strong>{memory.fatigueCost}/5</strong><small>Manual exercise setting.</small></article>
        <article><span>Skill difficulty</span><strong>{memory.skillDifficulty}/5</strong><small>Manual exercise setting.</small></article>
        <article><span>Category</span><strong>{memory.category || 'Not set'}</strong><small>{memory.equipment || 'Equipment not set'}</small></article>
      </section>
      <div className="details-memory-grid">
        <section className="details-section"><p className="eyebrow">Key cues</p><DetailList items={memory.cues} empty="No cues saved yet." /></section>
        <section className="details-section"><p className="eyebrow">Muscle-load model</p><MuscleLoadBreakdown model={record?.muscleLoadModel} fallback={memory.targetMuscles} /></section>
        <section className="details-section"><p className="eyebrow">Common mistakes</p><DetailList items={memory.commonMistakes} empty="No common mistakes saved yet." /></section>
        <section className="details-section"><p className="eyebrow">Substitutions</p><DetailList items={memory.substitutions} empty="No substitutions saved yet." /></section>
      </div>
      <section className="details-section details-edit-section setup-media-section" ref={setupSectionRef}>
        <div className="setup-section-heading"><div><p className="eyebrow">Setup</p><h3>Notes and photos</h3></div><button className="setup-camera-button" type="button" disabled={processingPhoto || setupPhotos.length >= 12} onClick={() => fileInputRef.current?.click()}>{processingPhoto ? 'Compressing…' : 'Take photo'}</button></div>
        <input ref={fileInputRef} className="visually-hidden-file-input" type="file" accept="image/*" capture="environment" onChange={(event) => { void capturePhoto(event.currentTarget.files?.[0]); }} />
        <textarea value={setupNotes} maxLength={4000} onChange={(event) => setSetupNotes(event.target.value)} placeholder="Seat position, grip, stance, attachment, range, or anything needed to reproduce the setup…" />
        {setupPhotos.length > 0 ? <div className="setup-photo-gallery" aria-label="Setup photos">{setupPhotos.map((photo, index) => <button type="button" key={photo.id} onClick={() => setActivePhotoId(photo.id)} aria-label={`Open setup photo ${index + 1}`}><img src={photo.dataUrl} alt="" /><span>{index + 1}</span></button>)}</div> : <p className="muted setup-photo-empty">No setup photos. Images are resized, re-encoded as compressed JPEGs and saved only in the local app database.</p>}
      </section>
      <section className="details-section details-edit-section">
        <p className="eyebrow">Video reference</p>
        <div className="details-video-row"><input type="url" inputMode="url" value={videoReferenceUrl} maxLength={2048} onChange={(event) => setVideoReferenceUrl(event.target.value)} placeholder="https://youtube.com/…" />{isOpenableUrl(videoReferenceUrl) && <a href={videoReferenceUrl.trim()} target="_blank" rel="noreferrer">Open</a>}</div>
        <small>Optional YouTube or video reference. Setup and link changes save when this sheet closes.</small>
      </section>
      <section className="details-section"><p className="eyebrow">Machine / equipment settings</p><p>{memory.machineSettings || 'No equipment settings saved yet.'}</p></section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="details-section"><p className="eyebrow">Recent evidence</p>{recent.length === 0 ? <p className="muted">No included completed history for this movement yet.</p> : <div className="recent-performance-list">{recent.map(({ session, exercise: historic }) => { const performance = calculateExercisePerformance(historic); return <article key={historic.id}><time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(session.completedAt ?? session.startedAt))}</time><strong>{Math.round(performance.primaryTotal)} {performance.primaryUnit}</strong><span>{performance.completedSets}/{historic.prescription.sets} prescribed sets</span></article>; })}</div>}</section>
      <section className="details-section character-placeholder"><p className="eyebrow">Character visual</p><p>Reserved for the dedicated character and generative-visual phase.</p></section>
    </section>
    {activePhoto && <div className="setup-photo-viewer" role="dialog" aria-modal="true" aria-label="Setup photo viewer" onMouseDown={() => setActivePhotoId(null)}><section onMouseDown={(event) => event.stopPropagation()}><header><span>Photo {activePhotoIndex + 1} of {setupPhotos.length}</span><button type="button" className="icon-button" onClick={() => setActivePhotoId(null)} aria-label="Close setup photo">×</button></header><img src={activePhoto.dataUrl} alt={`Setup reference ${activePhotoIndex + 1}`} /><footer><button type="button" onClick={() => movePhoto(-1)}>Previous</button><button type="button" className="photo-delete-button" onClick={removeActivePhoto}>Delete</button><button type="button" onClick={() => movePhoto(1)}>Next</button></footer></section></div>}
  </div>;
}
