import { describe, expect, it } from 'vitest';
import { evaluateRule, type DeploymentWindow } from '../src/services/optimization/evaluate.js';
import { splitBudget } from '../src/services/campaigns.js';

const w = (o: Partial<DeploymentWindow>): DeploymentWindow => ({ spend: 0, clicks: 0, impressions: 0, quotesStarted: 0, policiesSold: 0, revenue: 0, dailyBudget: 10000, ...o });

describe('optimization rules', () => {
  const pause = { ruleType: 'PAUSE_ZERO_QUOTES' as const, spendThreshold: 50000, targetRoas: null, maxCostPerPolicy: null, budgetIncreasePct: 15 };
  const scale = { ruleType: 'SCALE_HIGH_ROAS' as const, spendThreshold: 0, targetRoas: 4, maxCostPerPolicy: null, budgetIncreasePct: 15 };
  const cpa = { ruleType: 'FLAG_HIGH_CPA' as const, spendThreshold: 0, targetRoas: null, maxCostPerPolicy: 60000, budgetIncreasePct: 15 };

  it('pauses when spend ≥ threshold with zero quotes', () => {
    expect(evaluateRule(pause, w({ spend: 50000, quotesStarted: 0 }))?.action).toBe('PAUSE');
    expect(evaluateRule(pause, w({ spend: 49999.99 }))).toBeNull();
    expect(evaluateRule(pause, w({ spend: 90000, quotesStarted: 1 }))).toBeNull();
  });

  it('recommends +15% budget when ROAS beats target', () => {
    const d = evaluateRule(scale, w({ spend: 100000, revenue: 450000, dailyBudget: 20000 }));
    expect(d).toMatchObject({ action: 'INCREASE_BUDGET', suggestedBudget: 23000 });
    expect(evaluateRule(scale, w({ spend: 100000, revenue: 350000 }))).toBeNull();
    expect(evaluateRule(scale, w({ spend: 0, revenue: 0 }))).toBeNull();
  });

  it('flags high cost per policy', () => {
    expect(evaluateRule(cpa, w({ spend: 200000, policiesSold: 2 }))?.action).toBe('FLAG');
    expect(evaluateRule(cpa, w({ spend: 100000, policiesSold: 2 }))).toBeNull();
    expect(evaluateRule(cpa, w({ spend: 70000, policiesSold: 0 }))?.action).toBe('FLAG');
  });
});

describe('budget split', () => {
  it('splits into 2dp amounts that sum exactly to the total', () => {
    const r = splitBudget(100000.01, { FACEBOOK: 33.33, INSTAGRAM: 33.33, GOOGLE_SEARCH: 33.34 });
    expect(r.reduce((s, x) => s + Math.round(x.amount * 100), 0)).toBe(10000001);
  });
  it('rejects splits that do not total 100%', () => {
    expect(() => splitBudget(1000, { FACEBOOK: 50, LINKEDIN: 40 })).toThrow(/100%/);
  });
});
