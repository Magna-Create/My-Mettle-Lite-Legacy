import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackupFileResult {
  saved: boolean;
  uri?: string;
  sizeBytes?: number;
}

interface StagedBackupResult {
  token: string;
  sizeBytes: number;
}

interface BackupFilePlugin {
  stageJson(options: { content: string }): Promise<StagedBackupResult>;
  saveStaged(options: { filename: string; token: string }): Promise<BackupFileResult>;
}

const NativeBackupFile = registerPlugin<BackupFilePlugin>('BackupFile');

function saveInBrowser(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function saveJsonFile(filename: string, content: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    saveInBrowser(filename, content);
    return true;
  }

  // Keep the large JSON payload out of the ActivityResult call. Lite backups can
  // contain base64 setup photos, so retaining the whole payload while Android's
  // document picker is open can put unnecessary pressure on the activity/process.
  const staged = await NativeBackupFile.stageJson({ content });
  const result = await NativeBackupFile.saveStaged({ filename, token: staged.token });
  return result.saved;
}
