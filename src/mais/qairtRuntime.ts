import { Capacitor, registerPlugin } from '@capacitor/core';

export interface MaisQairtRuntimeStatus {
  version: string;
  source: 'apk-build-assets';
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
}

const nativePlugin = registerPlugin<MaisQairtRuntimePlugin>('MaisQairtRuntime');

export async function readMaisQairtRuntimeStatus(): Promise<MaisQairtRuntimeStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      version: '2.45.0.260326154327',
      source: 'apk-build-assets',
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
