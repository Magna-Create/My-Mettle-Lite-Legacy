import { Capacitor, registerPlugin } from '@capacitor/core';

export interface MaisNativeBreadcrumb {
  capturedAtEpochMs: number;
  component: string;
  stage: string;
  state: string;
  detail?: string | null | undefined;
  processPssBytes: number;
  nativeHeapAllocatedBytes: number;
  javaHeapUsedBytes: number;
  extras?: Record<string, unknown> | undefined;
}

export interface MaisProcessExitRecord {
  timestampEpochMs: number;
  reason: number;
  reasonLabel: string;
  description?: string | null | undefined;
  status: number;
  importance: number;
  pssBytes: number;
  rssBytes: number;
}

export interface MaisDeveloperSnapshot {
  capturedAtEpochMs: number;
  process: {
    pssBytes: number;
    nativeHeapAllocatedBytes: number;
    nativeHeapSizeBytes: number;
    nativeHeapFreeBytes: number;
    javaHeapUsedBytes: number;
    javaHeapCommittedBytes: number;
    javaHeapMaxBytes: number;
  };
  deviceMemory: {
    availableBytes: number;
    totalBytes: number;
    thresholdBytes: number;
    lowMemory: boolean;
  };
  storage: {
    availableBytes: number;
    totalBytes: number;
    sourceModelBytes: number;
    sourceModelFiles: number;
    genieCacheBytes: number;
    genieCacheFiles: number;
  };
  power: {
    powerSaveMode: boolean;
    thermalStatus: number;
    thermalLabel: string;
    batteryPercent?: number | null | undefined;
    batteryTemperatureC?: number | null | undefined;
    charging: boolean;
  };
  lastNativeStage?: MaisNativeBreadcrumb | null | undefined;
  breadcrumbs: MaisNativeBreadcrumb[];
  recentProcessExits: MaisProcessExitRecord[];
}

interface MaisDeveloperToolsPlugin {
  getSnapshot(): Promise<MaisDeveloperSnapshot>;
  clearDiagnostics(): Promise<{ cleared: boolean }>;
}

const nativePlugin = registerPlugin<MaisDeveloperToolsPlugin>('MaisDeveloperTools');

const unavailableSnapshot: MaisDeveloperSnapshot = {
  capturedAtEpochMs: 0,
  process: {
    pssBytes: 0,
    nativeHeapAllocatedBytes: 0,
    nativeHeapSizeBytes: 0,
    nativeHeapFreeBytes: 0,
    javaHeapUsedBytes: 0,
    javaHeapCommittedBytes: 0,
    javaHeapMaxBytes: 0,
  },
  deviceMemory: {
    availableBytes: 0,
    totalBytes: 0,
    thresholdBytes: 0,
    lowMemory: false,
  },
  storage: {
    availableBytes: 0,
    totalBytes: 0,
    sourceModelBytes: 0,
    sourceModelFiles: 0,
    genieCacheBytes: 0,
    genieCacheFiles: 0,
  },
  power: {
    powerSaveMode: false,
    thermalStatus: -1,
    thermalLabel: 'Unavailable',
    batteryPercent: null,
    batteryTemperatureC: null,
    charging: false,
  },
  lastNativeStage: null,
  breadcrumbs: [],
  recentProcessExits: [],
};

export async function readMaisDeveloperSnapshot(): Promise<MaisDeveloperSnapshot> {
  if (!Capacitor.isNativePlatform()) return unavailableSnapshot;
  return nativePlugin.getSnapshot();
}

export async function clearMaisNativeDiagnostics(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await nativePlugin.clearDiagnostics()).cleared;
}
