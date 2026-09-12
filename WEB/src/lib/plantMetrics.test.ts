/**
 * The Overview headline figures. These replaced a hardcoded array, so the point
 * of these tests is that every value now traces back to the model or a formula.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { predictConsumption, type AnnModel } from './annModel';
import { computeEmissions } from './emissionsFormula';
import { buildPlantMetrics, formatMetricValue, isWeak } from './plantMetrics';

const model: AnnModel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/model/ann.json', import.meta.url)), 'utf-8')
);

const at = (tpd: number) => {
  const consumption = predictConsumption(model, tpd);
  return buildPlantMetrics(consumption, computeEmissions(consumption, tpd), model);
};

describe('buildPlantMetrics', () => {
  it('produces a numeric value for every metric', () => {
    for (const metric of at(147.4)) {
      expect(typeof metric.value).toBe('number');
      expect(Number.isFinite(metric.value)).toBe(true);
    }
  });

  it('moves with throughput', () => {
    const low = at(130);
    const high = at(160);

    const production = (m: ReturnType<typeof at>) =>
      m.find((x) => x.id === 'production')!.value;

    expect(production(high)).toBeGreaterThan(production(low));
  });

  it('matches the formulas it claims to use', () => {
    const metrics = at(145);
    const consumption = predictConsumption(model, 145);
    const emissions = computeEmissions(consumption, 145);

    expect(metrics.find((m) => m.id === 'production')!.value).toBeCloseTo(
      emissions.ethanolProductionKl,
      9
    );
    expect(metrics.find((m) => m.id === 'electricity')!.value).toBeCloseTo(
      consumption.electricityKwh,
      9
    );
    expect(metrics.find((m) => m.id === 'co2e-intensity')!.value).toBeCloseTo(
      emissions.co2eIntensityKgPerKl,
      9
    );
  });

  it('carries R2 only for values the network predicts', () => {
    const metrics = at(147.4);
    const byId = (id: string) => metrics.find((m) => m.id === id)!;

    // Predicted, so they carry their own prediction error.
    expect(byId('electricity').r2).toBeCloseTo(0.6944, 4);
    expect(byId('steam').r2).toBeCloseTo(0.3756, 4);
    expect(byId('fuel').r2).toBeCloseTo(0.1755, 4);

    // Derived by formula, so an R2 would be meaningless.
    expect(byId('production').r2).toBeNull();
    expect(byId('co2e-intensity').r2).toBeNull();
    expect(byId('energy-intensity').r2).toBeNull();
  });

  it('never reports a lifecycle carbon intensity', () => {
    // The pipeline measures operational energy only. A gCO2e/MJ figure here
    // would be a scope error that reads as an achievement.
    for (const metric of at(147.4)) {
      expect(metric.unit).not.toMatch(/gCO2e\s*\/\s*MJ/i);
    }

    const intensity = at(147.4).find((m) => m.id === 'co2e-intensity')!;
    expect(intensity.unit).toBe('kg CO2e/kL');
    expect(intensity.label.toLowerCase()).toContain('operational');
  });
});

describe('isWeak', () => {
  it('flags the two weak predictions and not the strong one', () => {
    const metrics = at(147.4);
    const byId = (id: string) => metrics.find((m) => m.id === id)!;

    expect(isWeak(byId('electricity'))).toBe(false);
    expect(isWeak(byId('steam'))).toBe(true);
    expect(isWeak(byId('fuel'))).toBe(true);
  });

  it('never flags a formula-derived metric', () => {
    const metrics = at(147.4).filter((m) => m.r2 === null);
    expect(metrics.every((m) => !isWeak(m))).toBe(true);
  });
});

describe('formatMetricValue', () => {
  it('honours each metric decimal count', () => {
    const metrics = at(147.4);
    expect(formatMetricValue(metrics.find((m) => m.id === 'production')!)).toMatch(/\.\d{2}$/);
    expect(formatMetricValue(metrics.find((m) => m.id === 'electricity')!)).not.toMatch(/\./);
  });
});
