import { Capacitor, registerPlugin } from '@capacitor/core';

export type HealthPermissionScope = 'core' | 'context' | 'supplementary' | 'all';

export interface NativeHealthPermissionGroups {
  core: boolean;
  context: boolean;
  supplementary: boolean;
}

export interface NativeHealthStatus {
  sdkStatus: 'available' | 'update_required' | 'unavailable';
  available: boolean;
  grantedPermissions: string[];
  groups: NativeHealthPermissionGroups;
  readOnly: true;
  directSamsungSdk: boolean;
  samsungDataAvailableThroughHealthConnect: boolean;
}

export interface NativeHealthDevice {
  manufacturer?: string | null;
  model?: string | null;
  type?: number | null;
}

export interface NativeHeartRateSample {
  id: string;
  recordId: string;
  time: string;
  beatsPerMinute: number;
  dataOrigin: string;
  isSamsungHealth: boolean;
  recordingMethod?: number;
  device?: NativeHealthDevice | null;
}

export interface NativeActivitySummary {
  available: boolean;
  steps?: number | null;
  distanceMetres?: number | null;
  dataOrigins?: string[];
  containsSamsungHealth?: boolean;
}

export interface NativeExerciseSession {
  id: string;
  startTime: string;
  endTime: string;
  exerciseType: number;
  title?: string | null;
  notes?: string | null;
  dataOrigin: string;
  isSamsungHealth: boolean;
  device?: NativeHealthDevice | null;
}

export interface NativeHealthInstantRecord {
  id: string;
  type: 'body_fat' | 'basal_metabolic_rate' | 'oxygen_saturation' | 'blood_glucose' | 'vo2_max';
  time: string;
  value: number;
  unit: string;
  dataOrigin: string;
  isSamsungHealth: boolean;
  recordingMethod?: number;
  device?: NativeHealthDevice | null;
  relationToMeal?: number;
  mealType?: number;
  specimenSource?: number;
  measurementMethod?: number;
}

export interface NativeNutritionRecord {
  id: string;
  type: 'nutrition';
  startTime: string;
  endTime: string;
  name?: string | null;
  mealType?: number;
  energyKilocalories?: number | null;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
  dataOrigin: string;
  isSamsungHealth: boolean;
  device?: NativeHealthDevice | null;
}

export interface NativeHealthWindow {
  startTime: string;
  endTime: string;
  capturedAt: string;
  provider: 'health_connect';
  samsungHealthPackage: string;
  grantedPermissions: string[];
  missingPermissions: string[];
  heartRate: NativeHeartRateSample[];
  activity: NativeActivitySummary;
  exerciseSessions: NativeExerciseSession[];
  bodyComposition: NativeHealthInstantRecord[];
  nutrition: NativeNutritionRecord[];
  supplementary: NativeHealthInstantRecord[];
}

interface MaisHealthConnectPlugin {
  getStatus(): Promise<NativeHealthStatus>;
  requestPermissions(options: { scope: HealthPermissionScope }): Promise<{
    completed: boolean;
    grantedPermissions: string[];
    groups: NativeHealthPermissionGroups;
  }>;
  openSettings(): Promise<void>;
  syncWindow(options: {
    startTime: string;
    endTime: string;
    includeContext?: boolean;
    includeSupplementary?: boolean;
  }): Promise<NativeHealthWindow>;
}

const NativeHealthConnect = registerPlugin<MaisHealthConnectPlugin>('MaisHealthConnect');

export function healthConnectIsNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function readHealthConnectStatus(): Promise<NativeHealthStatus> {
  if (!healthConnectIsNative()) {
    return {
      sdkStatus: 'unavailable',
      available: false,
      grantedPermissions: [],
      groups: { core: false, context: false, supplementary: false },
      readOnly: true,
      directSamsungSdk: false,
      samsungDataAvailableThroughHealthConnect: false,
    };
  }
  return NativeHealthConnect.getStatus();
}

export async function requestHealthConnectPermissions(scope: HealthPermissionScope): Promise<NativeHealthStatus> {
  if (!healthConnectIsNative()) throw new Error('Health Connect is only available in the Android app.');
  await NativeHealthConnect.requestPermissions({ scope });
  return NativeHealthConnect.getStatus();
}

export async function openHealthConnectSettings(): Promise<void> {
  if (!healthConnectIsNative()) throw new Error('Health Connect settings are only available in the Android app.');
  await NativeHealthConnect.openSettings();
}

export async function readHealthWindow(options: {
  startTime: string;
  endTime: string;
  includeContext?: boolean;
  includeSupplementary?: boolean;
}): Promise<NativeHealthWindow> {
  if (!healthConnectIsNative()) throw new Error('Health Connect is only available in the Android app.');
  return NativeHealthConnect.syncWindow(options);
}
