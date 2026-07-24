import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AppDatabase } from '../../domain/model';
import {
  openHealthConnectSettings,
  readHealthConnectStatus,
  requestHealthConnectPermissions,
  type HealthPermissionScope,
  type NativeHealthStatus,
} from '../../health/healthConnect';
import { HealthEvidenceService } from '../../health/healthSyncService';
import type { MaisHealthEvidenceSnapshot, MaisManualBodyCompositionRecord } from '../../health/healthEvidence';

interface Props {
  database: AppDatabase;
}

interface ManualForm {
  recordedAt: string;
  bodyFatPercent: string;
  basalMetabolicRateKcal: string;
  skeletalMuscleMassKg: string;
  leanMassKg: string;
  visceralFatRating: string;
  weightKg: string;
  source: MaisManualBodyCompositionRecord['source'];
  sourceLabel: string;
  note: string;
}

function localDateTimeValue(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function initialForm(): ManualForm {
  return {
    recordedAt: localDateTimeValue(),
    bodyFatPercent: '',
    basalMetabolicRateKcal: '',
    skeletalMuscleMassKg: '',
    leanMassKg: '',
    visceralFatRating: '',
    weightKg: '',
    source: 'gym_bia',
    sourceLabel: '',
    note: '',
  };
}

function numeric(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function PermissionRow({
  title,
  detail,
  granted,
  scope,
  busy,
  onRequest,
}: {
  title: string;
  detail: string;
  granted: boolean;
  scope: HealthPermissionScope;
  busy: boolean;
  onRequest: (scope: HealthPermissionScope) => Promise<void>;
}) {
  return <div className="settings-navigation-row is-static">
    <span><strong>{title}</strong><small>{detail}</small></span>
    <button className="text-button" type="button" disabled={busy || granted} onClick={() => void onRequest(scope)}>
      {granted ? 'Enabled' : 'Enable'}
    </button>
  </div>;
}

export function HealthEvidenceSettingsPanel({ database }: Props) {
  const service = useMemo(() => new HealthEvidenceService(), []);
  const [status, setStatus] = useState<NativeHealthStatus | null>(null);
  const [snapshot, setSnapshot] = useState<MaisHealthEvidenceSnapshot | null>(null);
  const [includeSupplementary, setIncludeSupplementary] = useState(false);
  const [form, setForm] = useState<ManualForm>(initialForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([readHealthConnectStatus(), service.load()])
      .then(([nextStatus, nextSnapshot]) => {
        if (cancelled) return;
        setStatus(nextStatus);
        setSnapshot(nextSnapshot);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Health evidence could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [service]);

  async function run(key: string, operation: () => Promise<void>, success?: string): Promise<void> {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await operation();
      if (success) setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The health operation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function request(scope: HealthPermissionScope): Promise<void> {
    await run(`permission:${scope}`, async () => {
      setStatus(await requestHealthConnectPermissions(scope));
    }, 'Health Connect permissions updated.');
  }

  async function sync(): Promise<void> {
    await run('sync', async () => {
      const result = await service.syncRecentSessions(database, {
        includeContext: true,
        includeSupplementary,
        maximumSessions: 12,
      });
      setSnapshot(result.snapshot);
    }, 'Recent workout windows imported and reprocessed.');
  }

  async function submitManual(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run('manual', async () => {
      setSnapshot(await service.addManualBodyComposition({
        recordedAt: new Date(form.recordedAt).toISOString(),
        bodyFatPercent: numeric(form.bodyFatPercent),
        basalMetabolicRateKcal: numeric(form.basalMetabolicRateKcal),
        skeletalMuscleMassKg: numeric(form.skeletalMuscleMassKg),
        leanMassKg: numeric(form.leanMassKg),
        visceralFatRating: numeric(form.visceralFatRating),
        weightKg: numeric(form.weightKg),
        source: form.source,
        sourceLabel: form.sourceLabel,
        note: form.note,
      }));
      setForm(initialForm());
    }, 'Body-composition reading saved as timestamped evidence.');
  }

  const latestSessions = [...(snapshot?.sessionEvidence ?? [])].reverse().slice(0, 5);
  const manualRecords = [...(snapshot?.manualBodyComposition ?? [])].reverse().slice(0, 8);
  const samsungRecords = snapshot?.observations.filter((record) => record.dataOrigin === 'com.sec.android.app.shealth').length ?? 0;

  return <div className="intelligence-settings-stack">
    <section className="paper-card" aria-labelledby="health-connect-title">
      <header className="mais-runtime-header">
        <div><p className="eyebrow">Read-only evidence source</p><h2 id="health-connect-title">Health Connect</h2></div>
        <span className="status-chip">{status?.sdkStatus.replaceAll('_', ' ') ?? 'checking'}</span>
      </header>
      <p>
        My Mettle reads selected records from Health Connect. Samsung Health remains visible as the originating app, while My Mettle's own workout timestamps anchor session, exercise and set analysis.
      </p>
      <div className="settings-navigation compact-settings-list">
        <PermissionRow
          title="Training signal"
          detail="Heart rate, steps, walking distance and exercise-session cross-checks"
          granted={Boolean(status?.groups.core)}
          scope="core"
          busy={busy !== null}
          onRequest={request}
        />
        <PermissionRow
          title="Body & nutrition context"
          detail="Body fat, BMR and nutrition records when another app supplies them"
          granted={Boolean(status?.groups.context)}
          scope="context"
          busy={busy !== null}
          onRequest={request}
        />
        <PermissionRow
          title="Supplementary records"
          detail="Oxygen saturation, blood glucose and VO₂ max; never treated as primary training evidence"
          granted={Boolean(status?.groups.supplementary)}
          scope="supplementary"
          busy={busy !== null}
          onRequest={request}
        />
      </div>
      <label className="settings-toggle-row">
        <span><strong>Include supplementary data during sync</strong><small>Off by default. Missing records never reduce confidence or readiness.</small></span>
        <input type="checkbox" checked={includeSupplementary} onChange={(event) => setIncludeSupplementary(event.target.checked)} />
      </label>
      <div className="mais-runtime-actions">
        <button className="primary-action compact" type="button" disabled={busy !== null || !status?.available || !status.groups.core} onClick={() => void sync()}>
          {busy === 'sync' ? 'Syncing…' : 'Sync recent workouts'}
        </button>
        <button className="text-button" type="button" disabled={busy !== null || !status?.available} onClick={() => void run('settings', openHealthConnectSettings)}>
          Health Connect settings
        </button>
      </div>
      <div className="mais-stat-grid">
        <div><strong>{snapshot?.observations.length ?? 0}</strong><span>stored records</span></div>
        <div><strong>{samsungRecords}</strong><span>from Samsung Health</span></div>
        <div><strong>{snapshot?.sessionEvidence.length ?? 0}</strong><span>linked sessions</span></div>
        <div><strong>{snapshot?.lastSyncedAt ? formatDate(snapshot.lastSyncedAt) : 'Never'}</strong><span>last sync</span></div>
      </div>
      {message ? <p className="mais-framework-note" role="status">{message}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}
    </section>

    <section className="paper-card" aria-labelledby="body-composition-title">
      <header className="mais-runtime-header">
        <div><p className="eyebrow">Manual evidence</p><h2 id="body-composition-title">Body & composition</h2></div>
        <span className="status-chip">{snapshot?.manualBodyComposition.length ?? 0} readings</span>
      </header>
      <p>Record gym BIA or other measurements without allowing Samsung Health values to overwrite them. Trends remain separated by source and method.</p>
      <form className="intelligence-form-grid" onSubmit={(event) => void submitManual(event)}>
        <label><span>Measured at</span><input type="datetime-local" value={form.recordedAt} onChange={(event) => setForm({ ...form, recordedAt: event.target.value })} required /></label>
        <label><span>Source</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as ManualForm['source'] })}>
          <option value="gym_bia">Gym BIA machine</option><option value="home_scale">Home scales</option><option value="samsung_device">Samsung device</option><option value="dexa">DEXA</option><option value="manual_estimate">Manual estimate</option><option value="other">Other</option>
        </select></label>
        <label><span>Body fat %</span><input inputMode="decimal" value={form.bodyFatPercent} onChange={(event) => setForm({ ...form, bodyFatPercent: event.target.value })} /></label>
        <label><span>BMR kcal/day</span><input inputMode="decimal" value={form.basalMetabolicRateKcal} onChange={(event) => setForm({ ...form, basalMetabolicRateKcal: event.target.value })} /></label>
        <label><span>Skeletal muscle kg</span><input inputMode="decimal" value={form.skeletalMuscleMassKg} onChange={(event) => setForm({ ...form, skeletalMuscleMassKg: event.target.value })} /></label>
        <label><span>Lean mass kg</span><input inputMode="decimal" value={form.leanMassKg} onChange={(event) => setForm({ ...form, leanMassKg: event.target.value })} /></label>
        <label><span>Visceral-fat rating</span><input inputMode="decimal" value={form.visceralFatRating} onChange={(event) => setForm({ ...form, visceralFatRating: event.target.value })} /></label>
        <label><span>Weight kg (optional)</span><input inputMode="decimal" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} /></label>
        <label className="span-two"><span>Machine/source label</span><input value={form.sourceLabel} onChange={(event) => setForm({ ...form, sourceLabel: event.target.value })} placeholder="e.g. Gym floor InBody" /></label>
        <label className="span-two"><span>Conditions or note</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Hydration, recent meal, post-workout, clothing…" /></label>
        <button className="primary-action compact" type="submit" disabled={busy !== null}>{busy === 'manual' ? 'Saving…' : 'Save reading'}</button>
      </form>
      {manualRecords.length ? <ol className="mais-ledger">
        {manualRecords.map((record) => <li key={record.id}>
          <strong>{record.bodyFatPercent !== undefined ? `${record.bodyFatPercent}% body fat` : 'Body-composition reading'}{record.basalMetabolicRateKcal !== undefined ? ` · ${record.basalMetabolicRateKcal} kcal BMR` : ''}</strong>
          <span>{record.source.replaceAll('_', ' ')}{record.sourceLabel ? ` · ${record.sourceLabel}` : ''}</span>
          <small>{formatDate(record.recordedAt)}</small>
          <button className="text-button danger-text" type="button" disabled={busy !== null} onClick={() => void run(`delete:${record.id}`, async () => setSnapshot(await service.deleteManualBodyComposition(record.id)), 'Reading removed.')}>Remove</button>
        </li>)}
      </ol> : null}
    </section>

    <section className="paper-card" aria-labelledby="health-link-title">
      <header className="mais-runtime-header"><div><p className="eyebrow">Derived evidence</p><h2 id="health-link-title">Workout linkage</h2></div></header>
      {latestSessions.length === 0 ? <div className="settings-empty-state"><strong>No linked session yet.</strong><span>Enable core access and sync after Samsung Health has received the watch measurements.</span></div> : <ol className="mais-ledger">
        {latestSessions.map((session) => <li key={session.id}>
          <strong>{formatDate(session.completedAt)}</strong>
          <span>{session.heartRateSampleCount} HR samples · {Math.round(session.heartRateCoverage * 100)}% coverage · {session.setResponses.length} set estimates</span>
          <small>Avg {session.averageHeartRate === null ? '—' : `${Math.round(session.averageHeartRate)} bpm`} · peak {session.peakHeartRate === null ? '—' : `${Math.round(session.peakHeartRate)} bpm`}</small>
        </li>)}
      </ol>}
    </section>
  </div>;
}
