import { describe, expect, it } from 'vitest';
import { MaisToolRequestBroker, createMaisToolRequestState, normaliseMaisToolRequestState } from '../src/mais/toolRequestBroker';
import { createMaisSystemSnapshot, normaliseMaisSystemSnapshot } from '../src/mais/systemState';

describe('MAIS tool request broker', () => {
  it('creates uncapped requests grouped by month and exports a ChatGPT envelope', () => {
    const broker = new MaisToolRequestBroker(createMaisToolRequestState(), '2026-07-01T00:00:00.000Z');
    for (let index = 0; index < 12; index += 1) {
      broker.create({
        title: `Tool ${index}`,
        analyticalQuestion: `Question ${index}`,
        missingCapability: `Capability ${index}`,
        reasonExistingToolsFail: 'A distinct method is required.',
        exampleUse: 'A concrete My Mettle analysis.',
      }, `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`);
    }
    expect(broker.snapshot().requests).toHaveLength(12);
    expect(new Set(broker.snapshot().requests.map((request) => request.monthKey))).toEqual(new Set(['2026-07']));
    const document = JSON.parse(broker.export(broker.snapshot().requests[0]!.id)) as Record<string, any>;
    expect(document.schema).toBe('MaisToolRequestEnvelopeV1');
    expect(document.instructions).toHaveLength(5);
    expect(document.request.status).toBe('copied');
  });

  it('prunes requests outside the rolling 90-day window', () => {
    const broker = new MaisToolRequestBroker(createMaisToolRequestState(), '2026-01-01T00:00:00.000Z');
    broker.create({
      title: 'Old', analyticalQuestion: 'Old question', missingCapability: 'Old method',
      reasonExistingToolsFail: 'Missing.', exampleUse: 'Old use.',
    }, '2026-01-01T00:00:00.000Z');
    const pruned = normaliseMaisToolRequestState(broker.snapshot(), '2026-04-02T00:00:00.000Z');
    expect(pruned.requests).toHaveLength(0);
    expect(pruned.retentionDays).toBe(90);
  });

  it('migrates persisted research allowance from two to three', () => {
    const snapshot = createMaisSystemSnapshot('2026-07-24T00:00:00.000Z');
    snapshot.research.maxRequestsPerWindow = 2;
    snapshot.research.cooldownDays = 7;
    const normalised = normaliseMaisSystemSnapshot(snapshot);
    expect(normalised.research).toMatchObject({ maxRequestsPerWindow: 3, rollingWindowDays: 30, cooldownDays: 0 });
  });
});
