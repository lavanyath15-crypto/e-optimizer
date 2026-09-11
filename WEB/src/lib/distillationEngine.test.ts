/**
 * The screening logic decides which reflux setting the dashboard recommends and
 * what the LLM is told to justify, so the constraint handling and the throughput
 * scaling both need to hold.
 */

import { describe, expect, it } from 'vitest';
import {
  DISTILLATION_SCENARIOS,
  CURRENT_OPERATION_SCENARIO_ID,
  SCENARIO_ANCHOR_TPD,
  PURITY_MIN_PCT,
  RECOVERY_MIN_PCT,
  evaluateScenario,
  classifyScenarios,
  computeSavings,
  grainToEthanolProduction,
} from './distillationEngine';

const evaluateAll = (tpd: number = SCENARIO_ANCHOR_TPD) =>
  classifyScenarios(DISTILLATION_SCENARIOS.map((s) => evaluateScenario(s, tpd)));

describe('constraint screening', () => {
  it('rejects S1, which misses both limits', () => {
    const s1 = DISTILLATION_SCENARIOS.find((s) => s.id === 'S1')!;
    const result = evaluateScenario(s1);

    expect(s1.purityPct).toBeLessThan(PURITY_MIN_PCT);
    expect(s1.recoveryPct).toBeLessThan(RECOVERY_MIN_PCT);
    expect(result.feasible).toBe(false);
    expect(result.classification).toBe('Constraint_Violation');
  });

  it('accepts a scenario that clears both limits', () => {
    const s2 = DISTILLATION_SCENARIOS.find((s) => s.id === 'S2')!;
    const result = evaluateScenario(s2);

    expect(result.purityOk).toBe(true);
    expect(result.recoveryOk).toBe(true);
    expect(result.feasible).toBe(true);
  });

  it('fails a scenario that meets purity but misses recovery', () => {
    const result = evaluateScenario({
      id: 'X',
      refluxRatio: 2.4,
      steamKgDay: 70000,
      recoveryPct: RECOVERY_MIN_PCT - 0.1,
      purityPct: PURITY_MIN_PCT + 0.1,
    });

    expect(result.purityOk).toBe(true);
    expect(result.recoveryOk).toBe(false);
    expect(result.feasible).toBe(false);
  });
});

describe('classifyScenarios', () => {
  it('recommends the lowest-steam scenario that is feasible, not the lowest overall', () => {
    const results = evaluateAll();
    const recommended = results.find((r) => r.classification === 'Energy_Efficient');

    // S1 uses less steam than S2 but violates both limits, so S2 must win.
    expect(recommended?.id).toBe('S2');
    const s1 = results.find((r) => r.id === 'S1')!;
    expect(s1.steamKgDay).toBeLessThan(recommended!.steamKgDay);
  });

  it('marks exactly one scenario as recommended', () => {
    const recommended = evaluateAll().filter(
      (r) => r.classification === 'Energy_Efficient'
    );
    expect(recommended).toHaveLength(1);
  });

  it('recommends nothing when every scenario violates a limit', () => {
    const allBad = DISTILLATION_SCENARIOS.map((s) =>
      evaluateScenario({ ...s, purityPct: 0 })
    );
    const results = classifyScenarios(allBad);

    expect(results.every((r) => r.classification === 'Constraint_Violation')).toBe(true);
  });

  it('still treats the current operating point as feasible', () => {
    const current = evaluateAll().find((r) => r.id === CURRENT_OPERATION_SCENARIO_ID)!;
    expect(current.feasible).toBe(true);
  });
});

describe('throughput scaling', () => {
  it('holds specific steam constant as throughput changes', () => {
    // The choice between scenarios is about reflux, not about how much grain is
    // going in, so kg steam per kL must not drift with throughput.
    const atAnchor = evaluateAll(SCENARIO_ANCHOR_TPD);
    const atHigh = evaluateAll(165);
    const atLow = evaluateAll(124.5);

    for (let i = 0; i < atAnchor.length; i++) {
      expect(atHigh[i].specificSteamKgPerKl).toBeCloseTo(
        atAnchor[i].specificSteamKgPerKl,
        6
      );
      expect(atLow[i].specificSteamKgPerKl).toBeCloseTo(
        atAnchor[i].specificSteamKgPerKl,
        6
      );
    }
  });

  it('scales daily steam and CO2e with throughput', () => {
    const anchor = evaluateScenario(DISTILLATION_SCENARIOS[3], SCENARIO_ANCHOR_TPD);
    const doubled = evaluateScenario(DISTILLATION_SCENARIOS[3], SCENARIO_ANCHOR_TPD * 2);

    expect(doubled.steamKgDay).toBeCloseTo(anchor.steamKgDay * 2, 6);
    expect(doubled.co2eKgDay).toBeCloseTo(anchor.co2eKgDay * 2, 6);
  });

  it('does not change which scenario is recommended', () => {
    for (const tpd of [124.5, 147.4, 165, 200]) {
      const recommended = evaluateAll(tpd).find(
        (r) => r.classification === 'Energy_Efficient'
      );
      expect(recommended?.id).toBe('S2');
    }
  });

  it('defaults to the anchor throughput', () => {
    const explicit = evaluateScenario(DISTILLATION_SCENARIOS[0], SCENARIO_ANCHOR_TPD);
    const implicit = evaluateScenario(DISTILLATION_SCENARIOS[0]);
    expect(implicit.steamKgDay).toBeCloseTo(explicit.steamKgDay, 9);
  });

  it('survives zero throughput without producing NaN', () => {
    const result = evaluateScenario(DISTILLATION_SCENARIOS[0], 0);

    expect(result.ethanolProductionKlDay).toBe(0);
    expect(Number.isFinite(result.specificSteamKgPerKl)).toBe(true);
    expect(Number.isFinite(result.co2eIntensityKgPerKl)).toBe(true);
  });
});

describe('computeSavings', () => {
  it('reports the gap between the current point and the recommendation', () => {
    const results = evaluateAll();
    const baseline = results.find((r) => r.id === CURRENT_OPERATION_SCENARIO_ID)!;
    const recommended = results.find((r) => r.classification === 'Energy_Efficient')!;
    const savings = computeSavings(baseline, recommended);

    expect(savings.steamSavedKgDay).toBeCloseTo(13000, 6);
    expect(savings.steamSavedPct).toBeCloseTo((13000 / 85000) * 100, 6);
    expect(savings.co2eSavedTonnesYear).toBeGreaterThan(0);
  });

  it('reports no saving when baseline and recommendation match', () => {
    const [only] = evaluateAll();
    const savings = computeSavings(only, only);

    expect(savings.steamSavedKgDay).toBe(0);
    expect(savings.steamSavedPct).toBe(0);
    expect(savings.co2eSavedTonnesYear).toBe(0);
  });
});

describe('grainToEthanolProduction', () => {
  it('matches the 390 L per tonne basis used elsewhere', () => {
    expect(grainToEthanolProduction(147.4)).toBeCloseTo(57.486, 3);
  });
});
