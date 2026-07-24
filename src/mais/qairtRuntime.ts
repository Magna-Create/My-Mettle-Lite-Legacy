import { Capacitor, registerPlugin } from '@capacitor/core';

export interface MaisQairtRuntimeStatus {
  version: string;
  installed: boolean;
  ready: boolean;
  bridgeLoaded: boolean;
  bridgeError?: string | null | undefined;
  arm64Directory: string;
  hexagonDirectory: string;
  arm64Files: string[];
  hexagonFiles: string[];
  missing: string[];
  bytes: number;
}

interface MaisQairtRuntimePlugin {
  getStatus(): Promise<MaisQairtRuntimeStatus>;
  pickAndImport(): Promise<MaisQairtRuntimeStatus>;
  deleteRuntime(): Promise<MaisQairtRuntimeStatus>;
}

const nativePlugin = registerPlugin<MaisQairtRuntimePlugin>('MaisQairtRuntime');

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) throw new Error('QAIRT runtime installation is available in the Android app only.');
}

export async function readMaisQairtRuntimeStatus(): Promise<MaisQairtRuntimeStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      version: '2.45.0.260326154327',
      installed: false,
      ready: false,
      bridgeLoaded: false,
      bridgeError: 'Android native runtime unavailable.',
      arm64Directory: '',
      hexagonDirectory: '',
      arm64Files: [],
      hexagonFiles: [],
      missing: ['Android runtime'],
      bytes: 0,
    };
  }
  return nativePlugin.getStatus();
}

export async function importMaisQairtRuntime(): Promise<MaisQairtRuntimeStatus> {
  requireNative();
  return nativePlugin.pickAndImport();
}

export async function deleteMaisQairtRuntime(): Promise<MaisQairtRuntimeStatus> {
  requireNative();
  return nativePlugin.deleteRuntime();
}
