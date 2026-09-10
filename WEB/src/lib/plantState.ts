/**
 * Builds the plant-figures payload sent to the LLM, so the advisory card and
 * the assistant chat both describe the same plant rather than drifting apart.
 */

import { AnnModel, predictConsumption } from './annModel';
import { computeEmissions } from './emissionsFormula';
import type { PlantState, DistillationScenarioPayload } from '@backend/recommend.js';
import {
  DISTILLATION_SCENARIOS,
  CURRENT_OPERATION_SCENARIO_ID,
  evaluateScenario,
  classifyScenarios,
  DistillationScenarioResult,
} from './distillationEngine';

/** Nominal daily throughput used when nothing else is specified. */
export const DEFAULT_GRAIN_INPUT_TPD = 147.4;

export function toScenarioPayload(
  scenarios: DistillationScenarioResult[]
): DistillationScenarioPayload[] {
  return scenarios.map((s) => ({
    id: s.id,
    refluxRatio: s.refluxRatio,
    specificSteamKgPerKl: s.specificSteamKgPerKl,
    recoveryPct: s.recoveryPct,
    purityPct: s.purityPct,
    feasible: s.feasible,
    recommended: s.classification === 'Energy_Efficient',
  }));
}

export function buildPlantState(
  model: AnnModel,
  grainInputTpd: number,
  options?: { refluxRatio?: number; scenarios?: DistillationScenarioResult[] }
): PlantState {
  const consumption = predictConsumption(model, grainInputTpd);
  const emissions = computeEmissions(consumption, grainInputTpd);

  const scenarios =
    options?.scenarios ?? classifyScenarios(DISTILLATION_SCENARIOS.map(evaluateScenario));
  const currentReflux =
    options?.refluxRatio ??
    scenarios.find((s) => s.id === CURRENT_OPERATION_SCENARIO_ID)?.refluxRatio;

  return {
    grainInputTpd,
    electricityKwh: consumption.electricityKwh,
    distillationSteamKg: consumption.distillationSteamKg,
    dryerFuelMmbtu: consumption.dryerFuelMmbtu,
    ethanolProductionKl: emissions.ethanolProductionKl,
    co2eIntensityKgPerKl: emissions.co2eIntensityKgPerKl,
    totalEnergyIntensityKwhPerKl: emissions.totalEnergyIntensityKwhPerKl,
    refluxRatio: currentReflux,
    distillationScenarios: toScenarioPayload(scenarios),
  };
}
