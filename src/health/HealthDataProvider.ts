import type {
  BodyMeasurement,
  HealthObservation,
  HealthPermissionState,
  Session,
} from '../domain/model';

export interface HealthReadWindow {
  startTime: string;
  endTime: string;
}

export interface HealthWriteConflict {
  externalRecordId: string;
  provider: 'health_connect' | 'samsung_health';
  startTime: string;
  endTime: string;
  title?: string;
}

export interface HealthWriteResult {
  clientRecordId: string;
  writtenAt: string;
}

/**
 * Native adapters implement this boundary. Product logic should not import a
 * vendor SDK directly. The web-only Phase 2 build intentionally has no live
 * provider implementation yet.
 */
export interface HealthDataProvider {
  readonly kind: 'health_connect' | 'samsung_health';
  availability(): Promise<'available' | 'unavailable'>;
  permissionState(): Promise<HealthPermissionState>;
  requestPermissions(): Promise<HealthPermissionState>;
  readObservations(window: HealthReadWindow): Promise<HealthObservation[]>;
  readMeasurements(window: HealthReadWindow): Promise<BodyMeasurement[]>;
  findExerciseConflicts(session: Session): Promise<HealthWriteConflict[]>;
  writeSession(session: Session): Promise<HealthWriteResult>;
  writeMeasurement(measurement: BodyMeasurement): Promise<HealthWriteResult>;
}

/** Stable ownership key used for idempotent Health Connect writes. */
export function healthClientRecordId(sessionId: string): string {
  return `my-mettle:session:${sessionId}`;
}
