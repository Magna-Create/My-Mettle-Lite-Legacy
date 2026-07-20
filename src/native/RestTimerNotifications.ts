import { Capacitor, registerPlugin } from '@capacitor/core';
import type { VibrationStrength } from '../domain/model';

interface NativeRestTimerPlugin {
  schedule(options: {
    endsAt: number;
    exerciseName: string;
    vibrationStrength: VibrationStrength;
    vibrationEnabled: boolean;
    chimeEnabled: boolean;
  }): Promise<void>;
  cancel(): Promise<void>;
  requestTimerPermissions(): Promise<{ exactAlarm: boolean; notifications: boolean }>;
}

const plugin = registerPlugin<NativeRestTimerPlugin>('RestTimerNotifications');

export async function scheduleNativeRestTimer(options: {
  endsAt: number;
  exerciseName: string;
  vibrationStrength: VibrationStrength;
  vibrationEnabled: boolean;
  chimeEnabled: boolean;
}) {
  if (!Capacitor.isNativePlatform()) return;
  await plugin.schedule(options);
}

export async function cancelNativeRestTimer() {
  if (!Capacitor.isNativePlatform()) return;
  await plugin.cancel();
}

export async function requestNativeTimerPermissions() {
  if (!Capacitor.isNativePlatform()) return { exactAlarm: false, notifications: false };
  return plugin.requestTimerPermissions();
}