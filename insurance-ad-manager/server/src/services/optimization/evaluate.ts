import type { OptimizationRuleType, RecommendationAction } from '@prisma/client';
import { round2 } from '../../lib/money.js';

export interface RuleConfig {
  ruleType: OptimizationRuleType;
  spendThreshold: number | null;
  targetRoas: number | null;
  maxCostPerPolicy: number | null;
  budgetIncreasePct: number;
}

export interface DeploymentWindow {
  spend: number;
  clicks: number;
  impressions: number;
  quotesStarted: number;
  policiesSold: number;
  revenue: number;
  dailyBudget: number;
}

export interface RuleDecision {
  action: RecommendationAction;
  reason: string;
  suggestedBudget: number | null;
}

/** Pure rule evaluation — no DB, unit-testable. Returns null when the rule doesn't fire. */
export function evaluateRule(rule: RuleConfig, w: DeploymentWindow, fmt: (n: number) => string = (n) => n.toFixed(2)): RuleDecision | null {
  const threshold = rule.spendThreshold ?? 0;
  switch (rule.ruleType) {
    case 'PAUSE_ZERO_QUOTES':
      if (w.spend >= threshold && threshold > 0 && w.quotesStarted === 0)
        return { action: 'PAUSE', reason: `Spent ${fmt(w.spend)} (≥ ${fmt(threshold)}) with 0 quotes started.`, suggestedBudget: null };
      return null;
    case 'SCALE_HIGH_ROAS': {
      if (!rule.targetRoas || w.spend <= 0 || w.spend < threshold) return null;
      const roas = w.revenue / w.spend;
      if (roas >= rule.targetRoas)
        return {
          action: 'INCREASE_BUDGET',
          reason: `Policy ROAS ${roas.toFixed(2)}x beats target ${rule.targetRoas.toFixed(2)}x. Raise daily budget ${rule.budgetIncreasePct}%.`,
          suggestedBudget: round2(w.dailyBudget * (1 + rule.budgetIncreasePct / 100)),
        };
      return null;
    }
    case 'FLAG_HIGH_CPA': {
      if (!rule.maxCostPerPolicy || w.spend < threshold) return null;
      if (w.policiesSold === 0 && w.spend > rule.maxCostPerPolicy)
        return { action: 'FLAG', reason: `Spent ${fmt(w.spend)} with no policies sold (max cost/policy ${fmt(rule.maxCostPerPolicy)}).`, suggestedBudget: null };
      if (w.policiesSold > 0 && w.spend / w.policiesSold > rule.maxCostPerPolicy)
        return { action: 'FLAG', reason: `Cost per policy ${fmt(w.spend / w.policiesSold)} exceeds max ${fmt(rule.maxCostPerPolicy)}.`, suggestedBudget: null };
      return null;
    }
  }
}
