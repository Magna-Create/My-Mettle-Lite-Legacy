import type { AppDatabase } from '../../domain/model';

export interface GymRepository {
  load(): Promise<AppDatabase | null>;
  save(database: AppDatabase): Promise<void>;
  clear(): Promise<void>;
}
