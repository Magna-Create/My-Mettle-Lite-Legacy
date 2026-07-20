import type { AppDatabase } from '../../domain/model';
import type { GymRepository } from './GymRepository';

export class InMemoryGymRepository implements GymRepository {
  constructor(private state: AppDatabase | null = null) {}

  async load(): Promise<AppDatabase | null> {
    return this.state ? structuredClone(this.state) : null;
  }

  async save(database: AppDatabase): Promise<void> {
    this.state = structuredClone(database);
  }

  async clear(): Promise<void> {
    this.state = null;
  }
}
