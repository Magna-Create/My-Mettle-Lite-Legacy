import { createId } from '../domain/ids';

export interface MaisStrategyOutcome {
  predictiveAccuracy: number;
  calibration: number;
  informationGain: number;
  trainingOutcome: number;
  userAcceptance: number;
  novelty: number;
  reversibility: number;
  interruptionCost: number;
  computeCost: number;
  scientificSupport: number;
}

export interface MaisStrategyCredit {
  id: string;
  domain: string;
  strategy: string;
  score: number;
  evidenceCount: number;
  successfulCount: number;
  failedCount: number;
  explorationEligible: boolean;
  auditRequired: boolean;
  cooldownUntil?: string | undefined;
  lastUpdatedAt: string;
}

export interface MaisReinforcementEntry {
  id: string;
  taskId: string;
  proposalId?: string | undefined;
  domain: string;
  strategy: string;
  outcome: MaisStrategyOutcome;
  compositeReward: number;
  scoreBefore: number;
  scoreAfter: number;
  recordedAt: string;
  notes: string[];
}

export interface MaisReinforcementState {
  strategies: MaisStrategyCredit[];
  entries: MaisReinforcementEntry[];
  explorationFloor: number;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function clamp(value: number, minimum = -1, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function composite(outcome: MaisStrategyOutcome): number {
  return clamp(
    outcome.predictiveAccuracy * 0.18
    + outcome.calibration * 0.15
    + outcome.informationGain * 0.18
    + outcome.trainingOutcome * 0.12
    + outcome.userAcceptance * 0.12
    + outcome.novelty * 0.08
    + outcome.reversibility * 0.06
    + outcome.scientificSupport * 0.11
    - outcome.interruptionCost * 0.08
    - outcome.computeCost * 0.05,
  );
}

export function createMaisReinforcementState(): MaisReinforcementState {
  return { strategies: [], entries: [], explorationFloor: 0.15 };
}

export class MaisReinforcementLedger {
  private state: MaisReinforcementState;

  constructor(initialState: MaisReinforcementState = createMaisReinforcementState()) {
    this.state = structuredClone(initialState);
  }

  snapshot(): MaisReinforcementState {
    return structuredClone(this.state);
  }

  record(input: {
    taskId: string;
    proposalId?: string | undefined;
    domain: string;
    strategy: string;
    outcome: MaisStrategyOutcome;
    notes?: string[] | undefined;
    now?: string | undefined;
  }): MaisReinforcementEntry {
    const recordedAt = timestamp(input.now);
    let credit = this.state.strategies.find((candidate) => candidate.domain === input.domain && candidate.strategy === input.strategy);
    if (!credit) {
      credit = {
        id: createId('mais_strategy_credit'),
        domain: input.domain,
        strategy: input.strategy,
        score: 0,
        evidenceCount: 0,
        successfulCount: 0,
        failedCount: 0,
        explorationEligible: true,
        auditRequired: false,
        lastUpdatedAt: recordedAt,
      };
      this.state.strategies.push(credit);
    }

    const reward = composite(input.outcome);
    const before = credit.score;
    const learningRate = Math.max(0.12, 0.35 / Math.sqrt(credit.evidenceCount + 1));
    credit.score = clamp(before + learningRate * (reward - before));
    credit.evidenceCount += 1;
    if (reward >= 0.2) credit.successfulCount += 1;
    if (reward <= -0.2) credit.failedCount += 1;
    credit.explorationEligible = true;
    credit.auditRequired = credit.failedCount >= 2 || input.outcome.calibration < -0.4;
    if (reward <= -0.45) credit.cooldownUntil = addDays(recordedAt, 14);
    else if (credit.cooldownUntil && new Date(credit.cooldownUntil) <= new Date(recordedAt)) credit.cooldownUntil = undefined;
    credit.lastUpdatedAt = recordedAt;

    const entry: MaisReinforcementEntry = {
      id: createId('mais_reinforcement'),
      taskId: input.taskId,
      proposalId: input.proposalId,
      domain: input.domain,
      strategy: input.strategy,
      outcome: structuredClone(input.outcome),
      compositeReward: reward,
      scoreBefore: before,
      scoreAfter: credit.score,
      recordedAt,
      notes: [...(input.notes ?? [])],
    };
    this.state.entries.push(entry);
    return structuredClone(entry);
  }

  rank(domain: string, now?: string): MaisStrategyCredit[] {
    const current = new Date(timestamp(now));
    return this.state.strategies
      .filter((strategy) => strategy.domain === domain)
      .map((strategy) => structuredClone(strategy))
      .sort((left, right) => {
        const leftCooling = left.cooldownUntil ? new Date(left.cooldownUntil) > current : false;
        const rightCooling = right.cooldownUntil ? new Date(right.cooldownUntil) > current : false;
        if (leftCooling !== rightCooling) return leftCooling ? 1 : -1;
        return right.score - left.score;
      });
  }

  explorationCandidates(domain: string, now?: string): MaisStrategyCredit[] {
    const current = new Date(timestamp(now));
    return this.state.strategies
      .filter((strategy) => strategy.domain === domain && strategy.explorationEligible)
      .filter((strategy) => !strategy.cooldownUntil || new Date(strategy.cooldownUntil) <= current)
      .filter((strategy) => strategy.score >= -0.6)
      .map((strategy) => structuredClone(strategy));
  }
}
