import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { MaisAppVisibility, MaisResourceSnapshot } from './contracts';

interface NativeMaisDeviceState {
  appVisibility: MaisAppVisibility;
  batterySaver: boolean;
  isCharging: boolean;
  availableMemoryMb?: number | undefined;
  capturedAt: string;
}

interface MaisDeviceStatePlugin {
  getState(): Promise<NativeMaisDeviceState>;
  addListener(eventName: 'stateChange', listener: (state: NativeMaisDeviceState) => void): Promise<PluginListenerHandle>;
}

const NativeDeviceState = registerPlugin<MaisDeviceStatePlugin>('MaisDeviceState');

function browserState(): NativeMaisDeviceState {
  const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    appVisibility: document.visibilityState === 'hidden' ? 'background' : 'foreground',
    batterySaver: false,
    isCharging: false,
    availableMemoryMb: deviceMemoryGb ? deviceMemoryGb * 1024 : undefined,
    capturedAt: new Date().toISOString(),
  };
}

export async function readMaisResourceSnapshot(options: {
  activeWorkoutInteraction?: boolean;
  userPaused?: boolean;
} = {}): Promise<MaisResourceSnapshot> {
  let device: NativeMaisDeviceState;
  if (Capacitor.isNativePlatform()) {
    try {
      device = await NativeDeviceState.getState();
    } catch {
      device = browserState();
    }
  } else {
    device = browserState();
  }

  return {
    ...device,
    activeWorkoutInteraction: Boolean(options.activeWorkoutInteraction),
    userPaused: Boolean(options.userPaused),
    capturedAt: device.capturedAt || new Date().toISOString(),
  };
}

export async function subscribeMaisDeviceState(
  listener: (state: NativeMaisDeviceState) => void,
): Promise<() => Promise<void>> {
  if (Capacitor.isNativePlatform()) {
    const handle = await NativeDeviceState.addListener('stateChange', listener);
    return async () => handle.remove();
  }

  const onVisibility = () => listener(browserState());
  document.addEventListener('visibilitychange', onVisibility);
  return async () => {
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
