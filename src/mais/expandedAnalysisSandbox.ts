import { createId } from '../domain/ids';
import {
  DeterministicMaisAnalysisSandbox,
  validateMaisAnalysisProgram,
  type MaisAnalysisInputSnapshot,
  type MaisAnalysisProgram,
  type MaisAnalysisRun,
  type MaisAnalysisSandbox,
} from './analysisSandbox';

export const MAIS_ANALYSIS_RECIPE_V2 = 'MaisAnalysisRecipeV2';
export const MAIS_ANALYSIS_MAX_STEPS = 64;
export const MAIS_ANALYSIS_MAX_RECORDS = 5_000;

export const MAIS_ANALYSIS_V2_OPERATIONS = [
  'filter', 'sort', 'limit', 'select',
  'derive_difference', 'derive_ratio', 'derive_percent_change', 'derive_elapsed_seconds',
  'lag', 'rolling_mean', 'rolling_median',
  'count', 'sum', 'mean', 'weighted_mean', 'median', 'min', 'max',
  'variance', 'standard_deviation', 'quantile', 'interquartile_range',
  'median_absolute_deviation', 'trimmed_mean', 'winsorized_mean', 'coefficient_of_variation',
  'skewness', 'kurtosis', 'covariance', 'pearson', 'spearman', 'correlation_matrix',
  'linear_regression', 'theil_sen_regression', 'paired_difference', 'cohens_d', 'group_statistics',
  'bootstrap_mean_confidence_interval',
  'missingness', 'coverage', 'duplicate_count',
  'slope', 'area_under_curve', 'time_above_threshold', 'threshold_crossing',
  'peak', 'autocorrelation', 'cross_correlation', 'change_points',
] as const;

export type MaisAnalysisV2Operation = (typeof MAIS_ANALYSIS_V2_OPERATIONS)[number];

type Primitive = string | number | boolean | null;
type Row = Record<string, unknown>;

interface FilterCondition {
  field: string;
  equals?: Primitive;
  notEquals?: Primitive;
  oneOf?: Primitive[];
  greaterThan?: number;
  greaterThanOrEqual?: number;
  lessThan?: number;
  lessThanOrEqual?: number;
  exists?: boolean;
}

interface AnalysisStep {
  op: MaisAnalysisV2Operation;
  as: string;
  input?: string;
  field?: string;
  fields?: string[];
  x?: string;
  y?: string;
  weight?: string;
  groupBy?: string | string[];
  conditions?: FilterCondition[];
  direction?: 'ascending' | 'descending';
  limit?: number;
  left?: string;
  right?: string;
  numerator?: string;
  denominator?: string;
  start?: string;
  end?: string;
  offset?: number;
  window?: number;
  quantile?: number;
  trimFraction?: number;
  winsorFraction?: number;
  confidence?: number;
  iterations?: number;
  seed?: number;
  threshold?: number;
  comparison?: 'above' | 'below';
  lag?: number;
  maximumLag?: number;
  sensitivity?: number;
}

interface AnalysisRecipeV2 {
  schema: typeof MAIS_ANALYSIS_RECIPE_V2;
  steps: AnalysisStep[];
}

function isRecord(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const record = value as Row;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`).join(',')}}`;
}

function fingerprint(value: unknown): string {
  const input = canonicalise(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `analysis-v2-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function numbers(rows: Row[], field: string): number[] {
  return rows.flatMap((row) => finite(row[field]) ? [row[field] as number] : []);
}

function pairs(rows: Row[], x: string, y: string): Array<[number, number]> {
  return rows.flatMap((row) => finite(row[x]) && finite(row[y]) ? [[row[x] as number, row[y] as number]] : []);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function quantile(values: number[], probability: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * Math.min(1, Math.max(0, probability));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower]!;
  return ordered[lower]! + (ordered[upper]! - ordered[lower]!) * (position - lower);
}

function variance(values: number[]): number | null {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  return values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
}

function standardDeviation(values: number[]): number | null {
  const value = variance(values);
  return value === null ? null : Math.sqrt(value);
}

function ranks(values: number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const result = new Array<number>(values.length);
  let cursor = 0;
  while (cursor < ordered.length) {
    let end = cursor + 1;
    while (end < ordered.length && ordered[end]!.value === ordered[cursor]!.value) end += 1;
    const rank = (cursor + end - 1) / 2 + 1;
    for (let index = cursor; index < end; index += 1) result[ordered[index]!.index] = rank;
    cursor = end;
  }
  return result;
}

function covariance(values: Array<[number, number]>): number | null {
  if (values.length < 2) return null;
  const xMean = mean(values.map(([x]) => x))!;
  const yMean = mean(values.map(([, y]) => y))!;
  return values.reduce((total, [x, y]) => total + (x - xMean) * (y - yMean), 0) / (values.length - 1);
}

function correlation(values: Array<[number, number]>): number | null {
  if (values.length < 3) return null;
  const cov = covariance(values);
  const xScale = standardDeviation(values.map(([x]) => x));
  const yScale = standardDeviation(values.map(([, y]) => y));
  return cov === null || !xScale || !yScale ? null : cov / (xScale * yScale);
}

function regression(values: Array<[number, number]>): Record<string, number | null> {
  if (values.length < 2) return { slope: null, intercept: null, rSquared: null, n: values.length };
  const xMean = mean(values.map(([x]) => x))!;
  const yMean = mean(values.map(([, y]) => y))!;
  const denominator = values.reduce((total, [x]) => total + (x - xMean) ** 2, 0);
  if (denominator === 0) return { slope: null, intercept: null, rSquared: null, n: values.length };
  const slope = values.reduce((total, [x, y]) => total + (x - xMean) * (y - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const r = correlation(values);
  return { slope, intercept, rSquared: r === null ? null : r ** 2, n: values.length };
}

function theilSen(values: Array<[number, number]>): Record<string, number | null> {
  const slopes: number[] = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const denominator = values[right]![0] - values[left]![0];
      if (denominator !== 0) slopes.push((values[right]![1] - values[left]![1]) / denominator);
      if (slopes.length >= 20_000) break;
    }
    if (slopes.length >= 20_000) break;
  }
  const slope = median(slopes);
  if (slope === null) return { slope: null, intercept: null, n: values.length };
  const intercept = median(values.map(([x, y]) => y - slope * x));
  return { slope, intercept, n: values.length };
}

function matches(row: Row, condition: FilterCondition): boolean {
  const value = row[condition.field];
  if (condition.exists !== undefined && (value !== null && value !== undefined) !== condition.exists) return false;
  if ('equals' in condition && value !== condition.equals) return false;
  if ('notEquals' in condition && value === condition.notEquals) return false;
  if (condition.oneOf && !condition.oneOf.includes(value as Primitive)) return false;
  if (condition.greaterThan !== undefined && (!finite(value) || value <= condition.greaterThan)) return false;
  if (condition.greaterThanOrEqual !== undefined && (!finite(value) || value < condition.greaterThanOrEqual)) return false;
  if (condition.lessThan !== undefined && (!finite(value) || value >= condition.lessThan)) return false;
  if (condition.lessThanOrEqual !== undefined && (!finite(value) || value > condition.lessThanOrEqual)) return false;
  return true;
}

function fieldKey(row: Row, fields: string[]): string {
  return fields.map((field) => JSON.stringify(row[field] ?? null)).join('|');
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function parseRecipe(source: string): { recipe: AnalysisRecipeV2 | null; errors: string[] } {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!isRecord(parsed) || parsed.schema !== MAIS_ANALYSIS_RECIPE_V2 || !Array.isArray(parsed.steps)) {
      return { recipe: null, errors: ['Expanded programmes must be a MaisAnalysisRecipeV2 JSON object.'] };
    }
    if (parsed.steps.length === 0 || parsed.steps.length > MAIS_ANALYSIS_MAX_STEPS) {
      return { recipe: null, errors: [`Analysis recipes require 1-${MAIS_ANALYSIS_MAX_STEPS} steps.`] };
    }
    const aliases = new Set<string>(['input']);
    const errors: string[] = [];
    for (const [index, raw] of parsed.steps.entries()) {
      if (!isRecord(raw) || typeof raw.op !== 'string' || !MAIS_ANALYSIS_V2_OPERATIONS.includes(raw.op as MaisAnalysisV2Operation)) {
        errors.push(`Step ${index + 1} uses an unsupported operation.`);
        continue;
      }
      if (typeof raw.as !== 'string' || !raw.as.trim()) errors.push(`Step ${index + 1} requires a result alias.`);
      else if (aliases.has(raw.as)) errors.push(`Step alias ${raw.as} is duplicated.`);
      else aliases.add(raw.as);
      if (raw.input !== undefined && (typeof raw.input !== 'string' || !aliases.has(raw.input))) errors.push(`Step ${index + 1} references an unavailable input table.`);
    }
    return errors.length ? { recipe: null, errors } : { recipe: parsed as unknown as AnalysisRecipeV2, errors: [] };
  } catch {
    return { recipe: null, errors: ['Expanded analysis source must contain valid JSON.'] };
  }
}

function requireField(step: AnalysisStep, name = 'field'): string {
  const value = step[name as keyof AnalysisStep];
  if (typeof value !== 'string' || !value) throw new Error(`${step.op} requires ${name}.`);
  return value;
}

function tableOperation(step: AnalysisStep, rows: Row[]): Row[] | null {
  if (step.op === 'filter') return rows.filter((row) => (step.conditions ?? []).every((condition) => matches(row, condition)));
  if (step.op === 'sort') {
    const field = requireField(step);
    const direction = step.direction === 'descending' ? -1 : 1;
    return [...rows].sort((left, right) => {
      const a = left[field]; const b = right[field];
      if (a === b) return 0;
      if (a === null || a === undefined) return 1;
      if (b === null || b === undefined) return -1;
      return (a < b ? -1 : 1) * direction;
    });
  }
  if (step.op === 'limit') return rows.slice(0, Math.max(0, Math.floor(step.limit ?? 0)));
  if (step.op === 'select') {
    const fields = step.fields ?? [];
    return rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])));
  }
  if (step.op.startsWith('derive_')) {
    return rows.map((row) => {
      let value: number | null = null;
      if (step.op === 'derive_difference') {
        const left = row[requireField(step, 'left')]; const right = row[requireField(step, 'right')];
        value = finite(left) && finite(right) ? left - right : null;
      } else if (step.op === 'derive_ratio' || step.op === 'derive_percent_change') {
        const numerator = row[requireField(step, 'numerator')]; const denominator = row[requireField(step, 'denominator')];
        value = finite(numerator) && finite(denominator) && denominator !== 0 ? numerator / denominator : null;
        if (value !== null && step.op === 'derive_percent_change') value = (value - 1) * 100;
      } else if (step.op === 'derive_elapsed_seconds') {
        const start = row[requireField(step, 'start')]; const end = row[requireField(step, 'end')];
        const startMs = typeof start === 'string' ? Date.parse(start) : Number.NaN;
        const endMs = typeof end === 'string' ? Date.parse(end) : Number.NaN;
        value = Number.isFinite(startMs) && Number.isFinite(endMs) ? (endMs - startMs) / 1_000 : null;
      }
      return { ...row, [step.as]: value };
    });
  }
  if (step.op === 'lag') {
    const field = requireField(step);
    const offset = Math.max(1, Math.floor(step.offset ?? 1));
    return rows.map((row, index) => ({ ...row, [step.as]: index >= offset ? rows[index - offset]![field] ?? null : null }));
  }
  if (step.op === 'rolling_mean' || step.op === 'rolling_median') {
    const field = requireField(step);
    const width = Math.max(1, Math.floor(step.window ?? 3));
    return rows.map((row, index) => {
      const values = numbers(rows.slice(Math.max(0, index - width + 1), index + 1), field);
      return { ...row, [step.as]: step.op === 'rolling_mean' ? mean(values) : median(values) };
    });
  }
  return null;
}

function summaryOperation(step: AnalysisStep, rows: Row[]): unknown {
  if (step.op === 'count') return rows.length;
  if (step.op === 'missingness') {
    const fields = step.fields ?? [];
    return Object.fromEntries(fields.map((field) => [field, { missing: rows.filter((row) => row[field] === null || row[field] === undefined).length, total: rows.length }]));
  }
  if (step.op === 'coverage') {
    const field = requireField(step);
    const present = rows.filter((row) => row[field] !== null && row[field] !== undefined).length;
    return { present, total: rows.length, fraction: rows.length ? present / rows.length : null };
  }
  if (step.op === 'duplicate_count') {
    const fields = step.fields ?? [];
    const seen = new Set<string>(); let duplicates = 0;
    rows.forEach((row) => { const key = fieldKey(row, fields); if (seen.has(key)) duplicates += 1; else seen.add(key); });
    return { duplicates, unique: seen.size, total: rows.length };
  }
  if (step.op === 'pearson' || step.op === 'covariance' || step.op === 'linear_regression' || step.op === 'theil_sen_regression') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y'));
    if (step.op === 'pearson') return { coefficient: correlation(values), n: values.length };
    if (step.op === 'covariance') return { covariance: covariance(values), n: values.length };
    if (step.op === 'linear_regression') return regression(values);
    return theilSen(values);
  }
  if (step.op === 'spearman') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y'));
    const xRanks = ranks(values.map(([x]) => x)); const yRanks = ranks(values.map(([, y]) => y));
    return { coefficient: correlation(xRanks.map((x, index) => [x, yRanks[index]!])), n: values.length };
  }
  if (step.op === 'correlation_matrix') {
    const fields = step.fields ?? [];
    return Object.fromEntries(fields.map((left) => [left, Object.fromEntries(fields.map((right) => [right, correlation(pairs(rows, left, right))]))]));
  }
  if (step.op === 'paired_difference') {
    const values = pairs(rows, requireField(step, 'left'), requireField(step, 'right')).map(([left, right]) => left - right);
    return { meanDifference: mean(values), medianDifference: median(values), standardDeviation: standardDeviation(values), n: values.length };
  }
  if (step.op === 'cohens_d') {
    const left = numbers(rows, requireField(step, 'left')); const right = numbers(rows, requireField(step, 'right'));
    const pooled = left.length > 1 && right.length > 1
      ? Math.sqrt((((left.length - 1) * (variance(left) ?? 0)) + ((right.length - 1) * (variance(right) ?? 0))) / (left.length + right.length - 2))
      : 0;
    return { effectSize: pooled ? ((mean(left) ?? 0) - (mean(right) ?? 0)) / pooled : null, leftN: left.length, rightN: right.length };
  }
  if (step.op === 'group_statistics') {
    const groupFields = typeof step.groupBy === 'string' ? [step.groupBy] : (step.groupBy ?? []);
    const field = requireField(step);
    const groups = new Map<string, number[]>();
    rows.forEach((row) => { if (finite(row[field])) { const key = fieldKey(row, groupFields); groups.set(key, [...(groups.get(key) ?? []), row[field] as number]); } });
    return Object.fromEntries([...groups.entries()].map(([key, values]) => [key, { n: values.length, mean: mean(values), median: median(values), standardDeviation: standardDeviation(values), min: Math.min(...values), max: Math.max(...values) }]));
  }
  if (step.op === 'weighted_mean') {
    const field = requireField(step); const weight = requireField(step, 'weight');
    const values = rows.flatMap((row) => finite(row[field]) && finite(row[weight]) && (row[weight] as number) > 0 ? [[row[field] as number, row[weight] as number] as [number, number]] : []);
    const totalWeight = values.reduce((total, [, value]) => total + value, 0);
    return { mean: totalWeight ? values.reduce((total, [value, currentWeight]) => total + value * currentWeight, 0) / totalWeight : null, n: values.length, totalWeight };
  }
  if (step.op === 'bootstrap_mean_confidence_interval') {
    const values = numbers(rows, requireField(step));
    const iterations = Math.min(5_000, Math.max(100, Math.floor(step.iterations ?? 1_000)));
    const confidence = Math.min(0.999, Math.max(0.5, step.confidence ?? 0.95));
    const random = seeded(Math.floor(step.seed ?? 1)); const estimates: number[] = [];
    if (values.length) for (let iteration = 0; iteration < iterations; iteration += 1) estimates.push(mean(values.map(() => values[Math.floor(random() * values.length)]!))!);
    const alpha = (1 - confidence) / 2;
    return { mean: mean(values), lower: quantile(estimates, alpha), upper: quantile(estimates, 1 - alpha), confidence, iterations, n: values.length };
  }
  if (step.op === 'slope') return regression(pairs(rows, requireField(step, 'x'), requireField(step, 'y')));
  if (step.op === 'area_under_curve') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y')).sort(([left], [right]) => left - right);
    let area = 0; for (let index = 1; index < values.length; index += 1) area += (values[index]![0] - values[index - 1]![0]) * (values[index]![1] + values[index - 1]![1]) / 2;
    return { area, n: values.length };
  }
  if (step.op === 'time_above_threshold') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y')).sort(([left], [right]) => left - right);
    const threshold = step.threshold ?? 0; let duration = 0;
    for (let index = 1; index < values.length; index += 1) if ((values[index - 1]![1] + values[index]![1]) / 2 > threshold) duration += values[index]![0] - values[index - 1]![0];
    return { duration, threshold, n: values.length };
  }
  if (step.op === 'threshold_crossing') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y')).sort(([left], [right]) => left - right);
    const threshold = step.threshold ?? 0; const above = step.comparison !== 'below';
    const crossing = values.find(([, value]) => above ? value >= threshold : value <= threshold);
    return { x: crossing?.[0] ?? null, y: crossing?.[1] ?? null, threshold, comparison: above ? 'above' : 'below' };
  }
  if (step.op === 'peak') {
    const values = pairs(rows, requireField(step, 'x'), requireField(step, 'y'));
    const peak = values.reduce<[number, number] | null>((best, value) => !best || value[1] > best[1] ? value : best, null);
    return { x: peak?.[0] ?? null, y: peak?.[1] ?? null, n: values.length };
  }
  if (step.op === 'autocorrelation') {
    const values = numbers(rows, requireField(step)); const lag = Math.max(1, Math.floor(step.lag ?? 1));
    return { coefficient: correlation(values.slice(lag).map((value, index) => [values[index]!, value])), lag, n: Math.max(0, values.length - lag) };
  }
  if (step.op === 'cross_correlation') {
    const x = numbers(rows, requireField(step, 'x')); const y = numbers(rows, requireField(step, 'y')); const maxLag = Math.min(50, Math.max(0, Math.floor(step.maximumLag ?? 5)));
    const results: Record<string, number | null> = {};
    for (let lag = -maxLag; lag <= maxLag; lag += 1) {
      const values: Array<[number, number]> = [];
      for (let index = 0; index < Math.min(x.length, y.length); index += 1) { const yIndex = index + lag; if (yIndex >= 0 && yIndex < y.length) values.push([x[index]!, y[yIndex]!]); }
      results[String(lag)] = correlation(values);
    }
    return results;
  }
  if (step.op === 'change_points') {
    const values = numbers(rows, requireField(step)); const sensitivity = Math.max(0.5, step.sensitivity ?? 2); const points: number[] = [];
    const globalScale = standardDeviation(values) ?? 0;
    for (let index = 2; index < values.length - 2; index += 1) {
      const before = mean(values.slice(Math.max(0, index - 3), index))!; const after = mean(values.slice(index, Math.min(values.length, index + 3)))!;
      if (globalScale > 0 && Math.abs(after - before) >= sensitivity * globalScale) points.push(index);
    }
    return { indexes: points, count: points.length, sensitivity, n: values.length };
  }

  const values = numbers(rows, requireField(step));
  if (step.op === 'sum') return values.length ? values.reduce((total, value) => total + value, 0) : null;
  if (step.op === 'mean') return mean(values);
  if (step.op === 'median') return median(values);
  if (step.op === 'min') return values.length ? Math.min(...values) : null;
  if (step.op === 'max') return values.length ? Math.max(...values) : null;
  if (step.op === 'variance') return variance(values);
  if (step.op === 'standard_deviation') return standardDeviation(values);
  if (step.op === 'quantile') return { value: quantile(values, step.quantile ?? 0.5), probability: step.quantile ?? 0.5, n: values.length };
  if (step.op === 'interquartile_range') return { q1: quantile(values, 0.25), q3: quantile(values, 0.75), iqr: (quantile(values, 0.75) ?? 0) - (quantile(values, 0.25) ?? 0), n: values.length };
  if (step.op === 'median_absolute_deviation') { const centre = median(values); return { median: centre, mad: centre === null ? null : median(values.map((value) => Math.abs(value - centre))), n: values.length }; }
  if (step.op === 'trimmed_mean' || step.op === 'winsorized_mean') {
    const fraction = Math.min(0.49, Math.max(0, step.op === 'trimmed_mean' ? (step.trimFraction ?? 0.1) : (step.winsorFraction ?? 0.1)));
    const ordered = [...values].sort((left, right) => left - right); const trim = Math.floor(ordered.length * fraction);
    const transformed = step.op === 'trimmed_mean' ? ordered.slice(trim, ordered.length - trim) : ordered.map((value, index) => index < trim ? ordered[trim]! : index >= ordered.length - trim ? ordered[ordered.length - trim - 1]! : value);
    return { mean: mean(transformed), n: transformed.length, fraction };
  }
  if (step.op === 'coefficient_of_variation') { const average = mean(values); const deviation = standardDeviation(values); return { value: average && deviation !== null ? deviation / Math.abs(average) : null, mean: average, standardDeviation: deviation, n: values.length }; }
  if (step.op === 'skewness') { const average = mean(values); const deviation = standardDeviation(values); return { value: average !== null && deviation ? values.reduce((total, value) => total + ((value - average) / deviation) ** 3, 0) / values.length : null, n: values.length }; }
  if (step.op === 'kurtosis') { const average = mean(values); const deviation = standardDeviation(values); return { excess: average !== null && deviation ? values.reduce((total, value) => total + ((value - average) / deviation) ** 4, 0) / values.length - 3 : null, n: values.length }; }
  throw new Error(`Unsupported expanded operation: ${step.op}`);
}

export class ExpandedMaisAnalysisSandbox implements MaisAnalysisSandbox {
  private readonly legacy = new DeterministicMaisAnalysisSandbox();

  async execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun> {
    if (!program.source.includes(`\"schema\":\"${MAIS_ANALYSIS_RECIPE_V2}\"`) && !program.source.includes(`\"schema\": \"${MAIS_ANALYSIS_RECIPE_V2}\"`)) {
      return this.legacy.execute(program, input);
    }
    const startedAt = new Date().toISOString(); const startedMs = performance.now();
    const errors = validateMaisAnalysisProgram(program);
    if (program.language !== 'javascript_subset') errors.push('Only the deterministic recipe language is executable on-device.');
    if (program.inputSnapshotId !== input.id) errors.push('Programme input snapshot does not match supplied evidence.');
    if (input.records.length > MAIS_ANALYSIS_MAX_RECORDS) errors.push(`Analysis input exceeds ${MAIS_ANALYSIS_MAX_RECORDS} records.`);
    const parsed = parseRecipe(program.source); errors.push(...parsed.errors);
    if (errors.length || !parsed.recipe) return {
      id: createId('mais_analysis_run'), programId: program.id, inputSnapshotId: input.id, status: 'rejected', startedAt,
      completedAt: new Date().toISOString(), output: {}, diagnostics: errors, executionMs: performance.now() - startedMs,
    };

    try {
      const tables = new Map<string, Row[]>([['input', structuredClone(input.records)]]); const results: Record<string, unknown> = {};
      for (const step of parsed.recipe.steps) {
        const rows = tables.get(step.input ?? 'input');
        if (!rows) throw new Error(`${step.op} references an unavailable table.`);
        const table = tableOperation(step, rows);
        if (table) tables.set(step.as, table); else results[step.as] = summaryOperation(step, rows);
      }
      return {
        id: createId('mais_analysis_run'), programId: program.id, inputSnapshotId: input.id, status: 'completed', startedAt,
        completedAt: new Date().toISOString(),
        output: {
          schema: program.outputSchema,
          recipeSchema: MAIS_ANALYSIS_RECIPE_V2,
          results,
          tables: Object.fromEntries([...tables.entries()].filter(([key]) => key !== 'input').map(([key, rows]) => [key, { recordCount: rows.length, preview: rows.slice(0, 5) }])),
          recordCount: input.records.length,
          provenanceRefs: [...input.provenanceRefs],
          inputFingerprint: input.immutableFingerprint,
          programmeFingerprint: fingerprint(parsed.recipe),
        },
        diagnostics: ['Executed through the deterministic MAIS Analysis Recipe V2 language without dynamic code evaluation.'],
        executionMs: performance.now() - startedMs,
      };
    } catch (reason) {
      return {
        id: createId('mais_analysis_run'), programId: program.id, inputSnapshotId: input.id, status: 'failed', startedAt,
        completedAt: new Date().toISOString(), output: {}, diagnostics: [reason instanceof Error ? reason.message : String(reason)], executionMs: performance.now() - startedMs,
      };
    }
  }
}
