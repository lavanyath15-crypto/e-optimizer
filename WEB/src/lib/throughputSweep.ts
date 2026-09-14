/**
 * Runs the network across a range of throughputs.
 *
 * The Analytics screen used to plot a fixed 22-point array that looked like a
 * 30-day trend and was not connected to anything. There is no historian to draw
 * a real trend from, so inventing one was the only way to fill that chart.
 *
 * This is the real curve the project can actually produce: how predicted
 * consumption and the derived intensities respond to grain throughput. It is a
 * sensitivity sweep rather than a time series, which is both honest and more
 * useful, since throughput is the one lever the data shows any signal for.
 */

import { predictConsumption, type AnnModel } from './annModel';
import { computeEmissions } from './emissionsFormula';
import { applyProcessPhysics } from './processPhysics';
import type { ProcessValues } from '../data/processUnits';

export interface SweepPoint {
  grainInputTpd: number;
  ethanolProductionKl: number;
  electricityKwh: number;
  distillationSteamKg: number;
  dryerFuelMmbtu: number;
  co2eIntensityKgPerKl: number;
  totalEnergyIntensityKwhPerKl: number;
}

export type SweepMetric = keyof Omit<SweepPoint, 'grainInputTpd'>;

export interface SeriesDefinition {
  key: SweepMetric;
  label: string;
  unit: string;
  decimals: number;
  /** Held-out R2 key when the series comes straight from the network. */
  r2Target?: string;
}

export const SWEEP_SERIES: SeriesDefinition[] = [
  {
    key: 'distillationSteamKg',
    label: 'Distillation Steam',
    unit: 'kg/day',
    decimals: 0,
    r2Target: 'Distillation_Steam_kg',
  },
  {
    key: 'electricityKwh',
    label: 'Process Electricity',
    unit: 'kWh/day',
    decimals: 0,
    r2Target: 'Total_Process_Electricity_kWh',
  },
  {
    key: 'co2eIntensityKgPerKl',
    label: 'CO2e Intensity',
    unit: 'kg CO2e/kL',
    decimals: 1,
  },
  {
    key: 'totalEnergyIntensityKwhPerKl',
    label: 'Energy Intensity',
    unit: 'kWh/kL',
    decimals: 1,
  },
];

/**
 * `steps` points inclusive of both ends.
 *
 * Defaults span the training range. Outside it the network extrapolates, which
 * is exactly where a chart would mislead most, so callers have to opt in.
 *
 * `readings` holds the operator's other entries at their current values while
 * throughput is swept, so the curve describes the plant they are running rather
 * than the reference one. Without it this chart plotted the raw network while
 * every other screen showed the corrected figures, and the operator's own
 * throughput landed above the top of the axis: the exact disagreement between
 * screens this dashboard is supposed to have stopped having.
 */
export function sweepThroughput(
  model: AnnModel,
  options: { min?: number; max?: number; steps?: number; readings?: ProcessValues } = {}
): SweepPoint[] {
  const { min = 124.5, max = 165, steps = 24, readings } = options;

  if (steps < 2 || max <= min) return [];

  const points: SweepPoint[] = [];
  const stride = (max - min) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const grainInputTpd = min + stride * i;
    const baseline = predictConsumption(model, grainInputTpd);

    const physics = readings
      ? applyProcessPhysics(baseline, grainInputTpd, readings)
      : null;

    const consumption = physics
      ? {
          electricityKwh: physics.adjusted.electricityKwh,
          distillationSteamKg: physics.adjusted.distillationSteamKg,
          dryerFuelMmbtu: physics.adjusted.dryerFuelMmbtu,
        }
      : baseline;

    const emissions = computeEmissions(
      consumption,
      grainInputTpd,
      physics?.adjusted.ethanolKl
    );

    points.push({
      grainInputTpd,
      ethanolProductionKl: emissions.ethanolProductionKl,
      electricityKwh: consumption.electricityKwh,
      distillationSteamKg: consumption.distillationSteamKg,
      dryerFuelMmbtu: consumption.dryerFuelMmbtu,
      co2eIntensityKgPerKl: emissions.co2eIntensityKgPerKl,
      totalEnergyIntensityKwhPerKl: emissions.totalEnergyIntensityKwhPerKl,
    });
  }

  return points;
}

export interface SeriesRange {
  min: number;
  max: number;
}

export function seriesRange(points: SweepPoint[], key: SweepMetric): SeriesRange {
  if (points.length === 0) return { min: 0, max: 0 };

  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const value = point[key];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/**
 * Height as a percentage for a bar chart.
 *
 * Scaled between the series min and max rather than from zero. These curves vary
 * by a few percent across the range, so a zero-based axis would render every bar
 * the same height and show nothing. A floor of 8% keeps the smallest bar
 * visible, and the axis labels state the range so the scaling is not a trick.
 */
export function barHeightPct(value: number, range: SeriesRange): number {
  const span = range.max - range.min;
  if (span <= 0) return 100;
  return 8 + ((value - range.min) / span) * 92;
}
