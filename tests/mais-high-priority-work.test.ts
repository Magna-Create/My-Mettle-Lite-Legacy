import { describe, expect, it } from 'vitest';
import {
  acquireMaisHighPriorityWork,
  isMaisHighPriorityWorkActive,
  readMaisHighPriorityWork,
  subscribeMaisHighPriorityWork,
  withMaisHighPriorityWork,
} from '../src/mais/highPriorityWork';

describe('MAIS high-priority workload halt', () => {
  it('publishes an exclusive halt lease and returns to idle after release', () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeMaisHighPriorityWork((state) => states.push(state.active));
    const lease = acquireMaisHighPriorityWork('model-load', 'Loading a model');

    expect(isMaisHighPriorityWorkActive()).toBe(true);
    expect(readMaisHighPriorityWork().label).toBe('Loading a model');
    expect(() => acquireMaisHighPriorityWork('model-generation', 'Competing run')).toThrow(/already active/i);

    lease.release();
    lease.release();
    unsubscribe();

    expect(isMaisHighPriorityWorkActive()).toBe(false);
    expect(states).toEqual([false, true, false]);
  });

  it('always releases the halt lease when an operation fails', async () => {
    await expect(withMaisHighPriorityWork('model-import', 'Preparing model', async () => {
      throw new Error('failure');
    })).rejects.toThrow('failure');

    expect(readMaisHighPriorityWork().active).toBe(false);
  });
});
