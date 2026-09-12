/**
 * The sweep drives the Analytics chart, so a bug here draws a confident wrong
 * curve rather than throwing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnnModel } from './annModel';
import {
  SWEEP_SERIES,
  barHeightPct,
  seriesRange,
  sweepThroughput,
} from './throughputSweep';

const model: AnnModel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/model/ann.json', import.meta.url)), 'utf-8')
);

describe('sweepThroughput', () => {
  it('returns the requested number of points, spanning both ends', () => {
    const points = sweepThroughput(model, { min: 124.5, max: 165, steps: 24 });

    expect(points).toHaveLength(24);
    expect(points[0].grainInputTpd).toBeCloseTo(124.5, 6);
    expect(points.at(-1)?.grainInputTpd).toBeCloseTo(165, 6);
  });

  it('increases monotonically in throughput', () => {
    const points = sweepThroughput(model, { steps: 10 });
    for (let i = 1; i < points.length; i++) {
      expect(points[i].grainInputTpd).toBeGreaterThan(points[i - 1].grainInputTpd);
    }
  });

  it('agrees with a direct prediction at the same throughput', () => {
    const [point] = sweepThroughput(model, { min: 145, max: 165, steps: 2 });

    // Same reference values ml/verify.py prints for 145 t/day.
    expect(point.electricityKwh).toBeCloseTo(2614.669379, 4);
    expect(point.distillationSteamKg).toBeCloseTo(96282.846286, 3);
    expect(point.ethanolProductionKl).toBeCloseTo(56.55, 2);
  });

  it('produces finite values for every series', () => {
    const points = sweepThroughput(model, { steps: 12 });

    for (const point of points) {
      for (const series of SWEEP_SERIES) {
        expect(Number.isFinite(point[series.key])).toBe(true);
      }
    }
  });

  it('returns nothing for a degenerate range rather than dividing by zero', () => {
    expect(sweepThroughput(model, { min: 150, max: 150 })).toEqual([]);
    expect(sweepThroughput(model, { min: 165, max: 124 })).toEqual([]);
    expect(sweepThroughput(model, { steps: 1 })).toEqual([]);
  });
});

describe('seriesRange', () => {
  it('finds the min and max of a series', () => {
    const points = sweepThroughput(model, { steps: 10 });
    const range = seriesRange(points, 'distillationSteamKg');

    const values = points.map((p) => p.distillationSteamKg);
    expect(range.min).toBeCloseTo(Math.min(...values), 9);
    expect(range.max).toBeCloseTo(Math.max(...values), 9);
  });

  it('is zeroed for an empty sweep', () => {
    expect(seriesRange([], 'electricityKwh')).toEqual({ min: 0, max: 0 });
  });
});

describe('barHeightPct', () => {
  it('spans 8% to 100% across the range', () => {
    const range = { min: 10, max: 20 };
    expect(barHeightPct(10, range)).toBeCloseTo(8, 6);
    expect(barHeightPct(20, range)).toBeCloseTo(100, 6);
    expect(barHeightPct(15, range)).toBeCloseTo(54, 6);
  });

  it('returns a full bar when every value is identical', () => {
    // Avoids 0/0: a flat series should render as flat, not as NaN height.
    expect(barHeightPct(5, { min: 5, max: 5 })).toBe(100);
  });

  it('never returns a non-finite height', () => {
    const points = sweepThroughput(model, { steps: 8 });
    const range = seriesRange(points, 'co2eIntensityKgPerKl');

    for (const point of points) {
      const height = barHeightPct(point.co2eIntensityKgPerKl, range);
      expect(Number.isFinite(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(8);
      expect(height).toBeLessThanOrEqual(100);
    }
  });
});
