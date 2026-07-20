import { useCallback, useEffect, useRef, useState } from 'react';
import type { RestTimerSettings, VibrationStrength } from '../../domain/model';
import { cancelNativeRestTimer, scheduleNativeRestTimer } from '../../native/RestTimerNotifications';

const STORAGE_KEY = 'my-mettle:rest-timer:v3';
const PRESENTATION_DELAY_MS = 1000;

export interface RestTimerStart {
  exerciseId: string;
  exerciseName: string;
  seconds: number;
}

export interface RestTimerState {
  exerciseId: string;
  exerciseName: string;
  totalSeconds: number;
  remainingSeconds: number;
  endsAt: number | null;
  paused: boolean;
  minimized: boolean;
  completed: boolean;
}

function restoredTimer(): RestTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('my-mettle:rest-timer:v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestTimerState;
    if (!parsed || typeof parsed.remainingSeconds !== 'number') return null;
    if (!parsed.paused && parsed.endsAt) {
      const remainingSeconds = Math.max(0, Math.ceil((parsed.endsAt - Date.now()) / 1000));
      return {
        ...parsed,
        remainingSeconds,
        completed: remainingSeconds === 0,
        paused: remainingSeconds === 0,
        endsAt: remainingSeconds === 0 ? null : parsed.endsAt,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
    oscillator.addEventListener('ended', () => { void context.close(); });
  } catch {
    // Sound is optional and may be blocked by the WebView.
  }
}

function vibrationPattern(strength: VibrationStrength): number[] {
  if (strength === 'low') return [180, 120, 220];
  if (strength === 'medium') return [300, 120, 350];
  if (strength === 'very_strong') return [650, 100, 650, 100, 900];
  return [480, 110, 520, 110, 700];
}

function signalCompletion(settings: RestTimerSettings) {
  if (settings.vibrationEnabled && navigator.vibrate) {
    navigator.vibrate(vibrationPattern(settings.vibrationStrength));
  }
  if (settings.chimeEnabled) playChime();
}

export function useRestTimer(settings: RestTimerSettings) {
  const restoredPresentationRef = useRef(false);
  const [state, setState] = useState<RestTimerState | null>(() => {
    const restored = restoredTimer();
    restoredPresentationRef.current = Boolean(restored);
    return restored;
  });
  const [presentationReady, setPresentationReady] = useState(restoredPresentationRef.current);
  const presentationTimeoutRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);

  function clearPresentationTimeout() {
    if (presentationTimeoutRef.current !== null) {
      window.clearTimeout(presentationTimeoutRef.current);
      presentationTimeoutRef.current = null;
    }
  }

  useEffect(() => () => clearPresentationTimeout(), []);

  useEffect(() => {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('my-mettle:rest-timer:v2');
    }
  }, [state]);

  useEffect(() => {
    if (!settings.backgroundNotificationEnabled || !state) {
      void cancelNativeRestTimer();
      return;
    }
    if (state.completed) return;
    if (state.paused || !state.endsAt) {
      void cancelNativeRestTimer();
      return;
    }
    void scheduleNativeRestTimer({
      endsAt: state.endsAt,
      exerciseName: state.exerciseName,
      vibrationStrength: settings.vibrationStrength,
      vibrationEnabled: settings.vibrationEnabled,
      chimeEnabled: settings.chimeEnabled,
    });
  }, [
    state?.endsAt,
    state?.paused,
    state?.completed,
    state?.exerciseName,
    settings.backgroundNotificationEnabled,
    settings.vibrationStrength,
    settings.vibrationEnabled,
    settings.chimeEnabled,
  ]);

  useEffect(() => {
    if (!state || state.paused || state.completed || !state.endsAt) return;
    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((state.endsAt! - Date.now()) / 1000));
      setState((current) => current
        ? {
            ...current,
            remainingSeconds,
            completed: remainingSeconds === 0,
            paused: remainingSeconds === 0,
            endsAt: remainingSeconds === 0 ? null : current.endsAt,
          }
        : null);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [state?.endsAt, state?.paused, state?.completed]);

  useEffect(() => {
    if (!state?.completed) {
      notifiedRef.current = false;
      return;
    }
    setPresentationReady(true);
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    signalCompletion(settings);
  }, [state?.completed, settings]);

  const start = useCallback((input: RestTimerStart) => {
    if (!settings.autoStart || input.seconds <= 0) return;
    clearPresentationTimeout();
    notifiedRef.current = false;
    setPresentationReady(false);
    setState({
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      totalSeconds: input.seconds,
      remainingSeconds: input.seconds,
      endsAt: Date.now() + input.seconds * 1000,
      paused: false,
      minimized: false,
      completed: false,
    });
    presentationTimeoutRef.current = window.setTimeout(() => {
      setPresentationReady(true);
      presentationTimeoutRef.current = null;
    }, PRESENTATION_DELAY_MS);
  }, [settings.autoStart]);

  const pause = useCallback(() => {
    setState((current) => current ? { ...current, paused: true, endsAt: null } : null);
  }, []);

  const resume = useCallback(() => {
    setState((current) => current && !current.completed
      ? { ...current, paused: false, endsAt: Date.now() + current.remainingSeconds * 1000 }
      : current);
  }, []);

  const addSeconds = useCallback((seconds: number) => {
    setState((current) => {
      if (!current) return null;
      const remainingSeconds = current.remainingSeconds + seconds;
      return {
        ...current,
        totalSeconds: current.totalSeconds + seconds,
        remainingSeconds,
        completed: false,
        paused: current.paused,
        endsAt: current.paused ? null : Date.now() + remainingSeconds * 1000,
      };
    });
  }, []);

  const minimize = useCallback(() => {
    clearPresentationTimeout();
    setPresentationReady(true);
    setState((current) => current ? { ...current, minimized: true } : null);
  }, []);

  const expand = useCallback(() => {
    setPresentationReady(true);
    setState((current) => current ? { ...current, minimized: false } : null);
  }, []);

  const dismiss = useCallback(() => {
    clearPresentationTimeout();
    setPresentationReady(false);
    navigator.vibrate?.(0);
    void cancelNativeRestTimer();
    setState(null);
  }, []);

  return { state, presentationReady, start, pause, resume, addSeconds, minimize, expand, dismiss };
}
