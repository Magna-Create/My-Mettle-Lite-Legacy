import { describe, expect, it } from 'vitest';
import { createMaisAnalysisInput, type MaisAnalysisProgram } from '../src/mais/analysisSandbox';
import { ExpandedMaisAnalysisSandbox } from '../src/mais/expandedAnalysisSandbox';

function programme(inputId: string, steps: Record<string, unknown>[]): MaisAnalysisProgram {
  return {
    id: 'programme_v2',
    language: 'javascript_subset',
    source: JSON.stringify({ schema: 'MaisAnalysisRecipeV2', steps }),
    inputSnapshotId: inputId,
    outputSchema: 'MaisAnalysisResultV2',
    permittedLibraries: ['statistics'],
    createdByTaskId: 'task_v2',
    createdAt: '2026-07-24T01:00:00.000Z',
  };
}

describe('expanded MAIS analysis sandbox', () => {
  it('composes filtering, derived fields and robust statistics', async () => {
    const input = createMaisAnalysisInput('RowsV2', [
      { kind: 'set', load: 40, priorLoad: 38, recovery: 20 },
      { kind: 'set', load: 42, priorLoad: 40, recovery: 24 },
      { kind: 'set', load: 44, priorLoad: 42, recovery: 29 },
      { kind: 'note', load: null, priorLoad: null, recovery: null },
    ], ['session_1']);
    const result = await new ExpandedMaisAnalysisSandbox().execute(programme(input.id, [
      { op: 'filter', conditions: [{ field: 'kind', equals: 'set' }], as: 'sets' },
      { op: 'derive_difference', input: 'sets', left: 'load', right: 'priorLoad', as: 'loadIncrease' },
      { op: 'median', input: 'loadIncrease', field: 'loadIncrease', as: 'medianIncrease' },
      { op: 'theil_sen_regression', input: 'sets', x: 'load', y: 'recovery', as: 'robustTrend' },
      { op: 'spearman', input: 'sets', x: 'load', y: 'recovery', as: 'rankRelationship' },
    ]), input);
    expect(result.status).toBe('completed');
    const results = result.output.results as Record<string, unknown>;
    expect(results.medianIncrease).toBe(2);
    expect(results.robustTrend).toMatchObject({ slope: 2.25, n: 3 });
    expect((results.rankRelationship as { coefficient: number }).coefficient).toBeCloseTo(1, 10);
  });

  it('executes deterministic bootstrap and time-series tools', async () => {
    const input = createMaisAnalysisInput('SignalRowsV2', [
      { seconds: 0, bpm: 100 },
      { seconds: 10, bpm: 110 },
      { seconds: 20, bpm: 130 },
      { seconds: 30, bpm: 120 },
      { seconds: 40, bpm: 105 },
    ], ['heart_record']);
    const result = await new ExpandedMaisAnalysisSandbox().execute(programme(input.id, [
      { op: 'peak', x: 'seconds', y: 'bpm', as: 'peak' },
      { op: 'area_under_curve', x: 'seconds', y: 'bpm', as: 'area' },
      { op: 'time_above_threshold', x: 'seconds', y: 'bpm', threshold: 115, as: 'above115' },
      { op: 'bootstrap_mean_confidence_interval', field: 'bpm', iterations: 250, seed: 7, as: 'meanInterval' },
    ]), input);
    expect(result.status).toBe('completed');
    const results = result.output.results as Record<string, any>;
    expect(results.peak).toMatchObject({ x: 20, y: 130 });
    expect(results.area.area).toBe(4625);
    expect(results.above115.duration).toBe(20);
    expect(results.meanInterval).toMatchObject({ mean: 113, iterations: 250, n: 5 });
  });

  it('retains V1 compatibility', async () => {
    const input = createMaisAnalysisInput('RowsV1', [{ value: 2 }, { value: 4 }], ['rows']);
    const legacy: MaisAnalysisProgram = {
      ...programme(input.id, []),
      source: JSON.stringify({ schema: 'MaisAnalysisRecipeV1', operations: [{ op: 'mean', field: 'value', as: 'average' }] }),
    };
    const result = await new ExpandedMaisAnalysisSandbox().execute(legacy, input);
    expect(result.status).toBe('completed');
    expect(result.output.results).toEqual({ average: 3 });
  });
});
