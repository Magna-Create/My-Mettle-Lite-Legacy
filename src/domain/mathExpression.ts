const MAX_EXPRESSION_LENGTH = 64;
const MAX_RESULT = 1_000_000;

function normaliseExpression(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-');
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.parseExpression();
    if (this.index !== this.source.length) {
      throw new Error('Check the formula.');
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.consume();
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const operator = this.consume();
      const right = this.parseFactor();
      if (operator === '/' && right === 0) throw new Error('Cannot divide by zero.');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token === '+' || token === '-') {
      this.consume();
      const value = this.parseFactor();
      return token === '-' ? -value : value;
    }
    if (token === '(') {
      this.consume();
      const value = this.parseExpression();
      if (this.consume() !== ')') throw new Error('Close the bracket.');
      return value;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.index;
    let decimalPoints = 0;
    while (this.index < this.source.length) {
      const token = this.source[this.index]!;
      if (token === '.') {
        decimalPoints += 1;
        if (decimalPoints > 1) break;
        this.index += 1;
        continue;
      }
      if (!/[0-9]/.test(token)) break;
      this.index += 1;
    }
    const raw = this.source.slice(start, this.index);
    if (!raw || raw === '.') throw new Error('Enter a number.');
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error('Check the number.');
    return value;
  }

  private peek(): string | undefined {
    return this.source[this.index];
  }

  private consume(): string | undefined {
    const token = this.source[this.index];
    this.index += 1;
    return token;
  }
}

export function evaluateMathExpression(input: string): number {
  const source = normaliseExpression(input);
  if (!source) throw new Error('Enter a value.');
  if (source.length > MAX_EXPRESSION_LENGTH) throw new Error('Formula is too long.');
  if (!/^[0-9.+\-*/()]+$/.test(source)) throw new Error('Use numbers and calculator symbols only.');

  const parsed = new ExpressionParser(source).parse();
  if (!Number.isFinite(parsed)) throw new Error('The formula has no usable result.');
  if (parsed < 0) throw new Error('The result cannot be negative.');
  if (parsed > MAX_RESULT) throw new Error('The result is too large.');

  return Math.round((parsed + Number.EPSILON) * 1_000_000) / 1_000_000;
}
