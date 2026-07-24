export const MAIS_ANALYSIS_CONTEXT_BENCHMARK_SIZES = [48, 96, 160, 256] as const;

export interface MaisAnalysisContextBenchmarkResult {
  recordLimit: number;
  includedRecords: number;
  omittedRecords: number;
  characterCount: number;
  estimatedTokens: number;
  fieldCount: number;
  recordKinds: string[];
  largestRecordCharacters: number;
}

function recordKind(record: Record<string, unknown>): string {
  return typeof record.recordKind === 'string' ? record.recordKind : 'unknown';
}

export function benchmarkMaisAnalysisContext(
  records: Record<string, unknown>[],
  sizes: readonly number[] = MAIS_ANALYSIS_CONTEXT_BENCHMARK_SIZES,
): MaisAnalysisContextBenchmarkResult[] {
  return sizes.map((recordLimit) => {
    const selected = records.slice(-Math.max(1, Math.floor(recordLimit)));
    const payload = JSON.stringify({
      schema: 'MaisAnalysisContextBenchmarkV1',
      recordCount: selected.length,
      recordKinds: [...new Set(selected.map(recordKind))],
      availableFields: [...new Set(selected.flatMap((record) => Object.keys(record)))].sort(),
      records: selected,
    });
    const recordSizes = selected.map((record) => JSON.stringify(record).length);
    return {
      recordLimit,
      includedRecords: selected.length,
      omittedRecords: Math.max(0, records.length - selected.length),
      characterCount: payload.length,
      estimatedTokens: Math.ceil(payload.length / 4),
      fieldCount: [...new Set(selected.flatMap((record) => Object.keys(record)))].length,
      recordKinds: [...new Set(selected.map(recordKind))],
      largestRecordCharacters: recordSizes.length ? Math.max(...recordSizes) : 0,
    };
  });
}

export function selectLargestAnalysisContextWithinBudget(
  results: MaisAnalysisContextBenchmarkResult[],
  tokenBudget: number,
): MaisAnalysisContextBenchmarkResult | null {
  return [...results]
    .filter((result) => result.estimatedTokens <= tokenBudget)
    .sort((left, right) => right.includedRecords - left.includedRecords)[0] ?? null;
}
