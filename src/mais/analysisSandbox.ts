import { createId } from '../domain/ids';

export interface MaisAnalysisInputSnapshot {
  id: string;
  createdAt: string;
  schema: string;
  records: Record<string, unknown>[];
  provenanceRefs: string[];
  immutableFingerprint: string;
}

export interface MaisAnalysisProgram {
  id: string;
  language: 'python_subset' | 'javascript_subset';
  source: string;
  inputSnapshotId: string;
  outputSchema: string;
  permittedLibraries: string[];
  createdByTaskId: string;
  createdAt: string;
}

export interface MaisAnalysisRun {
  id: string;
  programId: string;
  inputSnapshotId: string;
  status: 'validated' | 'completed' | 'rejected' | 'failed';
  startedAt: string;
  completedAt?: string | undefined;
  output: Record<string, unknown>;
  diagnostics: string[];
  executionMs: number;
}

export interface MaisAnalysisSandbox {
  execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun>;
}

export type MaisAnalysisOperation =
  | { op: 'count'; as: string; filter?: MaisAnalysisFilter | undefined }
  | { op: 'sum' | 'mean' | 'median' | 'min' | 'max' | 'standard_deviation'; field: string; as: string; filter?: MaisAnalysisFilter | undefined }
  | { op: 'pearson'; x: string; y: string; as: string; filter?: MaisAnalysisFilter | undefined }
  | { op: 'linear_regression'; x: string; y: string; as: string; filter?: MaisAnalysisFilter | undefined }
  | { op: 'group_mean'; groupBy: string; field: string; as: string; filter?: MaisAnalysisFilter | undefined }
  | { op: 'trimmed_mean'; field: string; trimFraction: number; as: string; filter?: MaisAnalysisFilter | undefined };

export interface MaisAnalysisFilter {
  field: string;
  equals?: string | number | boolean | null | undefined;
  oneOf?: Array<string | number | boolean | null> | undefined;
  greaterThanOrEqual?: number | undefined;
  lessThanOrEqual?: number | undefined;
}

export interface MaisAnalysisRecipeV1 {
  schema: 'MaisAnalysisRecipeV1';
  operations: MaisAnalysisOperation[];
}

const PROHIBITED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(fetch|XMLHttpRequest|WebSocket)\b/, 'network access'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'direct persistence access'],
  [/\b(require|process|Deno)\b/, 'host runtime access'],
  [/\b(eval|Function)\s*\(/, 'dynamic code execution'],
  [/\b(java|android|navigator)\b/i, 'device or Android API access'],
  [/\b(fs|path|os|subprocess|socket|requests)\b/, 'filesystem, process or network libraries'],
];

const allowedOperationNames = new Set<MaisAnalysisOperation['op']>([
  'count',
  'sum',
  'mean',
  'median',
  'min',
  'max',
  'standard_deviation',
  'pearson',
  'linear_regression',
  'group_mean',
  'trimmed_mean',
]);

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`).join(',')}}`;
}

function fingerprint(value: unknown): string {
  const input = canonicalise(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `analysis-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function namedResult(value: unknown): value is { as: string } {
  return isRecord(value) && typeof value.as === 'string' && value.as.trim().length > 0;
}

function parseRecipe(source: string): { recipe: MaisAnalysisRecipeV1 | null; errors: string[] } {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!isRecord(parsed) || parsed.schema !== 'MaisAnalysisRecipeV1' || !Array.isArray(parsed.operations)) {
      return { recipe: null, errors: ['Executable JavaScript-subset programmes must be a MaisAnalysisRecipeV1 JSON object.'] };
    }
    if (parsed.operations.length === 0) return { recipe: null, errors: ['Analysis recipe requires at least one operation.'] };
    if (parsed.operations.length > 32) return { recipe: null, errors: ['Analysis recipe exceeds the 32-operation limit.'] };
    const aliases = new Set<string>();
    const errors: string[] = [];
    for (const [index, operation] of parsed.operations.entries()) {
      if (!isRecord(operation) || typeof operation.op !== 'string' || !allowedOperationNames.has(operation.op as MaisAnalysisOperation['op'])) {
        errors.push(`Operation ${index + 1} is unsupported.`);
        continue;
      }
      if (!namedResult(operation)) {
        errors.push(`Operation ${index + 1} requires a result alias.`);
        continue;
      }
      if (aliases.has(operation.as)) errors.push(`Result alias ${operation.as} is duplicated.`);
      aliases.add(operation.as);
      if (operation.op !== 'count' && operation.op !== 'pearson' && operation.op !== 'linear_regression' && operation.op !== 'group_mean' && typeof operation.field !== 'string') {
        errors.push(`Operation ${operation.as} requires a field.`);
      }
      if ((operation.op === 'pearson' || operation.op === 'linear_regression') && (typeof operation.x !== 'string' || typeof operation.y !== 'string')) {
        errors.push(`Operation ${operation.as} requires x and y fields.`);
      }
      if (operation.op === 'group_mean' && (typeof operation.groupBy !== 'string' || typeof operation.field !== 'string')) {
        errors.push(`Operation ${operation.as} requires groupBy and field.`);
      }
      if (operation.op === 'trimmed_mean' && (!finiteNumber(operation.trimFraction) || operation.trimFraction < 0 || operation.trimFraction >= 0.5)) {
        errors.push(`Operation ${operation.as} has an invalid trimFraction.`);
      }
    }
    return errors.length ? { recipe: null, errors } : { recipe: parsed as unknown as MaisAnalysisRecipeV1, errors: [] };
  } catch {
    return { recipe: null, errors: ['Executable JavaScript-subset programmes must contain valid JSON.'] };
  }
}

function matchesFilter(record: Record<string, unknown>, filter?: MaisAnalysisFilter): boolean {
  if (!filter) return true;
  const value = record[filter.field];
  if ('equals' in filter && value !== filter.equals) return false;
  if (filter.oneOf && !filter.oneOf.includes(value as string | number | boolean | null)) return false;
  if (filter.greaterThanOrEqual !== undefined && (!finiteNumber(value) || value < filter.greaterThanOrEqual)) return false;
  if (filter.lessThanOrEqual !== undefined && (!finiteNumber(value) || value > filter.lessThanOrEqual)) return false;
  return true;
}

function numericValues(records: Record<string, unknown>[], field: string): number[] {
  return records.flatMap((record) => finiteNumber(record[field]) ? [record[field] as number] : []);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
}

function standardDeviation(values: number[]): number | null {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pairedValues(records: Record<string, unknown>[], xField: string, yField: string): Array<[number, number]> {
  return records.flatMap((record) => finiteNumber(record[xField]) && finiteNumber(record[yField])
    ? [[record[xField] as number, record[yField] as number] as [number, number]]
    : []);
}

function pearson(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 3) return null;
  const xMean = mean(pairs.map(([x]) => x))!;
  const yMean = mean(pairs.map(([, y]) => y))!;
  const numerator = pairs.reduce((total, [x, y]) => total + (x - xMean) * (y - yMean), 0);
  const xScale = Math.sqrt(pairs.reduce((total, [x]) => total + (x - xMean) ** 2, 0));
  const yScale = Math.sqrt(pairs.reduce((total, [, y]) => total + (y - yMean) ** 2, 0));
  return xScale === 0 || yScale === 0 ? null : numerator / (xScale * yScale);
}

function linearRegression(pairs: Array<[number, number]>): Record<string, number | null> {
  if (pairs.length < 2) return { slope: null, intercept: null, rSquared: null, n: pairs.length };
  const xMean = mean(pairs.map(([x]) => x))!;
  const yMean = mean(pairs.map(([, y]) => y))!;
  const denominator = pairs.reduce((total, [x]) => total + (x - xMean) ** 2, 0);
  if (denominator === 0) return { slope: null, intercept: null, rSquared: null, n: pairs.length };
  const slope = pairs.reduce((total, [x, y]) => total + (x - xMean) * (y - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const correlation = pearson(pairs);
  return { slope, intercept, rSquared: correlation === null ? null : correlation ** 2, n: pairs.length };
}

function executeOperation(operation: MaisAnalysisOperation, sourceRecords: Record<string, unknown>[]): unknown {
  const records = sourceRecords.filter((record) => matchesFilter(record, operation.filter));
  if (operation.op === 'count') return records.length;
  if (operation.op === 'pearson') return { coefficient: pearson(pairedValues(records, operation.x, operation.y)), n: pairedValues(records, operation.x, operation.y).length };
  if (operation.op === 'linear_regression') return linearRegression(pairedValues(records, operation.x, operation.y));
  if (operation.op === 'group_mean') {
    const groups = new Map<string, number[]>();
    for (const record of records) {
      const groupValue = record[operation.groupBy];
      const numeric = record[operation.field];
      if (!finiteNumber(numeric) || !['string', 'number', 'boolean'].includes(typeof groupValue)) continue;
      const key = String(groupValue);
      groups.set(key, [...(groups.get(key) ?? []), numeric]);
    }
    return Object.fromEntries([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => [key, { mean: mean(values), n: values.length }]));
  }

  const values = numericValues(records, operation.field);
  if (operation.op === 'sum') return values.length ? values.reduce((total, value) => total + value, 0) : null;
  if (operation.op === 'mean') return mean(values);
  if (operation.op === 'median') return median(values);
  if (operation.op === 'min') return values.length ? Math.min(...values) : null;
  if (operation.op === 'max') return values.length ? Math.max(...values) : null;
  if (operation.op === 'standard_deviation') return standardDeviation(values);
  const ordered = [...values].sort((left, right) => left - right);
  const trim = Math.floor(ordered.length * operation.trimFraction);
  const trimmed = ordered.slice(trim, ordered.length - trim);
  return { mean: mean(trimmed), n: trimmed.length, trimmedPerSide: trim };
}

export function createMaisAnalysisInput(
  schema: string,
  records: Record<string, unknown>[],
  provenanceRefs: string[],
  now = new Date().toISOString(),
): MaisAnalysisInputSnapshot {
  const immutable = { schema, records, provenanceRefs };
  return {
    id: createId('mais_analysis_input'),
    createdAt: now,
    schema,
    records: structuredClone(records),
    provenanceRefs: [...provenanceRefs],
    immutableFingerprint: fingerprint(immutable),
  };
}

export function validateMaisAnalysisProgram(program: MaisAnalysisProgram): string[] {
  const errors: string[] = [];
  if (!program.source.trim()) errors.push('Analysis programme is empty.');
  if (!program.outputSchema.trim()) errors.push('Analysis programme requires an output schema.');
  if (program.source.length > 30_000) errors.push('Analysis programme exceeds the Phase 3 source limit.');
  for (const [pattern, label] of PROHIBITED_PATTERNS) {
    if (pattern.test(program.source)) errors.push(`Analysis programme requests prohibited ${label}.`);
  }
  const allowed = program.language === 'python_subset'
    ? new Set(['math', 'statistics', 'numpy', 'pandas'])
    : new Set(['math', 'statistics']);
  for (const library of program.permittedLibraries) {
    if (!allowed.has(library)) errors.push(`Library ${library} is not approved for ${program.language}.`);
  }
  return errors;
}

function commonValidation(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): string[] {
  const errors = validateMaisAnalysisProgram(program);
  const currentFingerprint = fingerprint({ schema: input.schema, records: input.records, provenanceRefs: input.provenanceRefs });
  if (currentFingerprint !== input.immutableFingerprint) errors.push('Analysis input changed after snapshot creation.');
  if (program.inputSnapshotId !== input.id) errors.push('Programme input snapshot does not match supplied evidence.');
  if (input.records.length > 5_000) errors.push('Analysis input exceeds the 5,000-record execution limit.');
  return errors;
}

export class DeterministicMaisAnalysisSandbox implements MaisAnalysisSandbox {
  async execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun> {
    const startedAt = new Date().toISOString();
    const startedMs = performance.now();
    const errors = commonValidation(program, input);
    if (program.language !== 'javascript_subset') errors.push('Only the deterministic JavaScript subset is executable on-device.');
    const parsed = parseRecipe(program.source);
    errors.push(...parsed.errors);

    if (errors.length > 0 || !parsed.recipe) {
      return {
        id: createId('mais_analysis_run'),
        programId: program.id,
        inputSnapshotId: input.id,
        status: 'rejected',
        startedAt,
        completedAt: new Date().toISOString(),
        output: {},
        diagnostics: errors,
        executionMs: performance.now() - startedMs,
      };
    }

    try {
      const results: Record<string, unknown> = {};
      for (const operation of parsed.recipe.operations) results[operation.as] = executeOperation(operation, input.records);
      return {
        id: createId('mais_analysis_run'),
        programId: program.id,
        inputSnapshotId: input.id,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        output: {
          schema: program.outputSchema,
          recipeSchema: parsed.recipe.schema,
          results,
          recordCount: input.records.length,
          provenanceRefs: [...input.provenanceRefs],
          inputFingerprint: input.immutableFingerprint,
          programmeFingerprint: fingerprint(parsed.recipe),
        },
        diagnostics: ['Executed through the deterministic MAIS analysis subset without dynamic code evaluation.'],
        executionMs: performance.now() - startedMs,
      };
    } catch (reason) {
      return {
        id: createId('mais_analysis_run'),
        programId: program.id,
        inputSnapshotId: input.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        output: {},
        diagnostics: [reason instanceof Error ? reason.message : String(reason)],
        executionMs: performance.now() - startedMs,
      };
    }
  }
}

export class SimulatedMaisAnalysisSandbox implements MaisAnalysisSandbox {
  async execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun> {
    const startedAt = new Date().toISOString();
    const errors = commonValidation(program, input);

    if (errors.length > 0) {
      return {
        id: createId('mais_analysis_run'),
        programId: program.id,
        inputSnapshotId: input.id,
        status: 'rejected',
        startedAt,
        completedAt: new Date().toISOString(),
        output: {},
        diagnostics: errors,
        executionMs: 0,
      };
    }

    return {
      id: createId('mais_analysis_run'),
      programId: program.id,
      inputSnapshotId: input.id,
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      output: {
        simulator: true,
        outputSchema: program.outputSchema,
        recordCount: input.records.length,
        provenanceRefs: input.provenanceRefs,
        programmeFingerprint: fingerprint(program.source),
      },
      diagnostics: ['Simulator validated the programme without executing model-generated code.'],
      executionMs: 0,
    };
  }
}
