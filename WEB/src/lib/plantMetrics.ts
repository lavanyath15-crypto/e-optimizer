/**
 * Builds the Overview headline figures from the model and the formulas.
 *
 * Everything here is computed. The previous version was a hardcoded array
 * ('4,850 gal/hr', 'Carbon Intensity Score 52.4 gCO2e/MJ') that never moved and
 * had no connection to the pipeline running two screens away.
 *
 * Note what is deliberately absent: a lifecycle carbon intensity in gCO2e/MJ.
 * This project measures operational energy only, so converting its figure to
 * that basis would read around 8.8 gCO2e/MJ against an industry range of 50-70,
 * which is a unit error dressed up as an achievement. Operational CO2e
 * intensity is reported in its own units instead.
 */

import type { PlantMetric } from '../types';
import type { ConsumptionPrediction, AnnModel } from './annModel';
import type { EmissionsResult } from './emissionsFormula';

export function buildPlantMetrics(
  consumption: ConsumptionPrediction,
  emissions: EmissionsResult,
  model: AnnModel
): PlantMetric[] {
  const r2 = model.testR2;

  return [
    {
      id: 'production',
      label: 'Ethanol Production',
      value: emissions.ethanolProductionKl,
      unit: 'kL/day',
      decimals: 2,
      // Grain input x 0.39 exactly in this dataset, so it is a formula rather
      // than something the network had to learn.
      r2: null,
      hint: 'Formula: grain input x 390 L/t',
    },
    {
      id: 'electricity',
      label: 'Process Electricity',
      value: consumption.electricityKwh,
      unit: 'kWh/day',
      decimals: 0,
      r2: r2['Total_Process_Electricity_kWh'] ?? null,
      hint: 'Predicted by the network',
    },
    {
      id: 'steam',
      label: 'Distillation Steam',
      value: consumption.distillationSteamKg,
      unit: 'kg/day',
      decimals: 0,
      r2: r2['Distillation_Steam_kg'] ?? null,
      hint: 'Predicted by the network',
    },
    {
      id: 'fuel',
      label: 'DDGS Dryer Fuel',
      value: consumption.dryerFuelMmbtu,
      unit: 'MMBtu/day',
      decimals: 1,
      r2: r2['DDGS_Dryer_Fuel_MMBtu'] ?? null,
      hint: 'Predicted by the network',
    },
    {
      id: 'co2e-intensity',
      label: 'Operational CO2e Intensity',
      value: emissions.co2eIntensityKgPerKl,
      unit: 'kg CO2e/kL',
      decimals: 1,
      r2: null,
      hint: 'Plant operations only, not a lifecycle CI',
    },
    {
      id: 'energy-intensity',
      label: 'Energy Intensity',
      value: emissions.totalEnergyIntensityKwhPerKl,
      unit: 'kWh/kL',
      decimals: 1,
      r2: null,
      hint: 'Electricity plus dryer fuel',
    },
    {
      id: 'co2e-total',
      label: 'Total Operational CO2e',
      value: emissions.totalCo2eTonnes,
      unit: 't/day',
      decimals: 2,
      r2: null,
      hint: 'Electricity, steam and dryer fuel',
    },
  ];
}

/** Formats a metric for display. Kept next to the builder so they stay in step. */
export function formatMetricValue(metric: PlantMetric): string {
  return metric.value.toLocaleString(undefined, {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
}

/** Below this the dashboard says so rather than showing the number plainly. */
export const WEAK_R2_THRESHOLD = 0.5;

export function isWeak(metric: PlantMetric): boolean {
  return metric.r2 !== null && metric.r2 < WEAK_R2_THRESHOLD;
}
