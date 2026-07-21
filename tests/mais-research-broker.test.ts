import { describe, expect, it } from 'vitest';
import {
  createMaisResearchState,
  MaisResearchBroker,
  parseMaisResearchReportEnvelope,
  type MaisResearchReportEnvelope,
} from '../src/mais/researchBroker';

function requestInput(index: number) {
  return {
    topic: `Training question ${index}`,
    decisionBlocked: `Decision ${index}`,
    localContextSummary: `Local evidence ${index}`,
    questions: [{ question: `What does the evidence say about ${index}?`, whyItMatters: `It changes decision ${index}.` }],
    preferredEvidence: ['systematic reviews', 'controlled trials'],
    requiredOutputSchema: 'MaisResearchReportV1',
    freshness: 'current' as const,
    expectedValue: 0.8,
    createdByTaskId: `task_${index}`,
  };
}

describe('MAIS manual research broker', () => {
  it('allows three fulfilled requests in a rolling 30-day window and blocks the fourth', () => {
    const broker = new MaisResearchBroker(createMaisResearchState());
    for (let index = 1; index <= 3; index += 1) {
      const request = broker.request(requestInput(index), `2026-07-0${index}T00:00:00.000Z`);
      broker.importReport({
        requestId: request.id,
        summary: `Report ${index}`,
        claims: [{ claim: `Claim ${index}`, confidence: 'moderate', sourceCitations: [`citation-${index}`], limitations: [] }],
        sources: [{ title: `Source ${index}`, publisher: 'Journal', accessedAt: `2026-07-0${index}T01:00:00.000Z`, citation: `citation-${index}` }],
        producedAt: `2026-07-0${index}T01:00:00.000Z`,
        expiresAt: `2026-10-0${index}T01:00:00.000Z`,
      }, `2026-07-0${index}T02:00:00.000Z`);
    }
    expect(() => broker.request(requestInput(4), '2026-07-10T00:00:00.000Z')).toThrow(/budget is exhausted/i);
  });

  it('exports an exact ChatGPT hand-off envelope and marks the request exported', () => {
    const broker = new MaisResearchBroker();
    const request = broker.request(requestInput(1), '2026-07-01T00:00:00.000Z');
    const exported = JSON.parse(broker.export(request.id, '2026-07-01T01:00:00.000Z')) as Record<string, unknown>;
    expect(exported.schema).toBe('MaisResearchDossierV1');
    expect(exported.instructions).toEqual(expect.arrayContaining([expect.stringMatching(/cite every material claim/i)]));
    expect(exported.responseTemplate).toMatchObject({
      schema: 'MaisResearchReportV1',
      report: { requestId: request.id, claims: [], sources: [] },
    });
    expect(broker.snapshot().requests[0]?.status).toBe('exported');
  });

  it('imports only reports whose claims resolve to listed citations', () => {
    const broker = new MaisResearchBroker();
    const request = broker.request(requestInput(1), '2026-07-01T00:00:00.000Z');
    broker.export(request.id, '2026-07-01T01:00:00.000Z');
    const envelope: MaisResearchReportEnvelope = {
      schema: 'MaisResearchReportV1',
      report: {
        requestId: request.id,
        summary: 'Longer rest generally preserves multi-set output in trained participants.',
        claims: [{
          claim: 'Longer rest may improve later-set performance.',
          confidence: 'moderate',
          sourceCitations: ['Smith 2025'],
          limitations: ['Population differs from the user.'],
        }],
        sources: [{
          title: 'Rest interval review',
          publisher: 'Sports Science Journal',
          publishedAt: '2025-01-01T00:00:00.000Z',
          accessedAt: '2026-07-01T02:00:00.000Z',
          citation: 'Smith 2025',
        }],
        producedAt: '2026-07-01T02:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
    };
    const imported = broker.importEnvelope(JSON.stringify(envelope), '2026-07-01T03:00:00.000Z');
    expect(imported.claims[0]?.sourceCitations).toEqual(['Smith 2025']);
    expect(broker.snapshot()).toMatchObject({
      requests: [{ id: request.id, status: 'fulfilled' }],
      reports: [{ requestId: request.id }],
    });
  });

  it('rejects uncited, unknown-citation and invalid-expiry reports', () => {
    const broker = new MaisResearchBroker();
    const request = broker.request(requestInput(1), '2026-07-01T00:00:00.000Z');
    const base = {
      requestId: request.id,
      summary: 'Summary',
      sources: [{ title: 'Study', publisher: 'Journal', accessedAt: '2026-07-01T01:00:00.000Z', citation: 'Known' }],
      producedAt: '2026-07-01T01:00:00.000Z',
      expiresAt: '2026-08-01T01:00:00.000Z',
    };
    expect(() => broker.importReport({ ...base, claims: [{ claim: 'Claim', confidence: 'low' as const, sourceCitations: [], limitations: [] }] })).toThrow(/requires at least one citation/i);
    expect(() => broker.importReport({ ...base, claims: [{ claim: 'Claim', confidence: 'low' as const, sourceCitations: ['Missing'], limitations: [] }] })).toThrow(/not present/i);
    expect(() => broker.importReport({
      ...base,
      claims: [{ claim: 'Claim', confidence: 'low' as const, sourceCitations: ['Known'], limitations: [] }],
      expiresAt: '2026-06-01T00:00:00.000Z',
    })).toThrow(/expiry/i);
  });

  it('parses only the expected response schema', () => {
    expect(() => parseMaisResearchReportEnvelope('{"schema":"Other"}')).toThrow(/unsupported/i);
  });
});
