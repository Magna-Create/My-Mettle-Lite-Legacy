import { describe, expect, it } from 'vitest';
import { evaluateMathExpression } from '../src/domain/mathExpression';

describe('calculator input', () => {
  it('resolves unilateral and plate-style formulas', () => {
    expect(evaluateMathExpression('6.5*2')).toBe(13);
    expect(evaluateMathExpression('(20 + 1.25 + 1.25) × 2')).toBe(45);
    expect(evaluateMathExpression('45 ÷ 2')).toBe(22.5);
  });

  it('respects operator precedence and brackets', () => {
    expect(evaluateMathExpression('5 + 2 * 3')).toBe(11);
    expect(evaluateMathExpression('(5 + 2) * 3')).toBe(21);
  });

  it('rejects unsafe or unusable input', () => {
    expect(() => evaluateMathExpression('alert(1)')).toThrow();
    expect(() => evaluateMathExpression('5 / 0')).toThrow('Cannot divide by zero.');
    expect(() => evaluateMathExpression('2 - 5')).toThrow('cannot be negative');
  });
});
