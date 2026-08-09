import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackupFileResult {
  saved: boolean;
  uri?: string;
}

interface BackupFilePlugin {
  saveJson(options: { filename: string; content: string }): Promise<BackupFileResult>;
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

  const result = await NativeBackupFile.saveJson({ filename, content });
  return result.saved;
}
