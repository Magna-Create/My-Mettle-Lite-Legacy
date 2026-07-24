import { useEffect, useState } from 'react';
import {
  readMaisQairtRuntimeStatus,
  type MaisQairtRuntimeStatus,
} from '../../mais/qairtRuntime';
import { formatModelBytes } from '../../mais/modelArtifacts';

function statusLabel(status: MaisQairtRuntimeStatus | null): string {
  if (!status) return 'Checking';
  if (status.ready) return 'Runtime ready';
  if (status.installed) return 'Runtime incomplete';
  return 'Build assets missing';
}

export function QairtRuntimeImportPanel() {
  const [status, setStatus] = useState<MaisQairtRuntimeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setStatus(await readMaisQairtRuntimeStatus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'QAIRT runtime status could not be read.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="paper-card intelligence-model-import" aria-labelledby="qairt-runtime-title">
      <header className="mais-runtime-header">
        <div>
          <p className="eyebrow">Qualcomm native runtime</p>
          <h2 id="qairt-runtime-title">QAIRT 2.45</h2>
        </div>
        <span className={`status-chip ${status?.ready ? 'is-ready' : 'is-absent'}`}>{statusLabel(status)}</span>
      </header>

      <p>
        Qualcomm’s licensed runtime must be staged into the Android project before Gradle builds this APK. Genie, QNN host libraries, HTP stubs and Hexagon v73 skeletons are then extracted by Android into the app’s protected native-library directory, matching Qualcomm’s ChatApp layout.
      </p>

      <dl className="settings-fact-list">
        <div><dt>Required build</dt><dd>{status?.version ?? '2.45.0.260326154327'}</dd></div>
        <div><dt>Runtime source</dt><dd>Local APK build assets</dd></div>
        <div><dt>JNI bridge</dt><dd>{status?.bridgeLoaded ? 'Loaded' : 'Unavailable'}</dd></div>
        <div><dt>Runtime files</dt><dd>{status ? `${status.arm64Files.length} ARM64 · ${status.hexagonFiles.length} DSP` : 'Checking'}</dd></div>
        <div><dt>Packaged storage</dt><dd>{status?.bytes ? formatModelBytes(status.bytes) : '0 MB'}</dd></div>
      </dl>

      {status?.missing.length ? (
        <p className="mais-runtime-note">
          Missing: {status.missing.join(', ')}. Stage the private QAIRT build-assets ZIP in Termux, rebuild the APK and install it over this version.
        </p>
      ) : null}
      {status?.bridgeError ? <p className="mais-runtime-error">JNI bridge: {status.bridgeError}</p> : null}
      {error ? <p className="mais-runtime-error" role="alert">{error}</p> : null}

      <div className="mais-runtime-actions">
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>{busy ? 'Checking…' : 'Refresh'}</button>
      </div>
    </section>
  );
}
