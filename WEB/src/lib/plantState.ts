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
import { applyProcessPhysics } from './processPhysics';
import type { ProcessValues } from '../data/processUnits';

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
  options?: {
    refluxRatio?: number;
    scenarios?: DistillationScenarioResult[];
    /**
     * The operator's other readings. Supplied, the figures sent to the model are
     * the corrected ones the screens show. Without this the assistant answered
     * questions about the network's raw output while the operator was looking at
     * numbers up to 14% away from it.
     */
    readings?: ProcessValues;
  }
): PlantState {
  const baseline = predictConsumption(model, grainInputTpd);
  const physics = options?.readings
    ? applyProcessPhysics(baseline, grainInputTpd, options.readings)
    : null;

  const consumption = physics
    ? {
        electricityKwh: physics.adjusted.electricityKwh,
        distillationSteamKg: physics.adjusted.distillationSteamKg,
        dryerFuelMmbtu: physics.adjusted.dryerFuelMmbtu,
      }
    : baseline;

  const emissions = computeEmissions(consumption, grainInputTpd, physics?.adjusted.ethanolKl);

  // Screened at the same throughput as the predictions above, so the figures the
  // LLM receives are all on one basis.
  const scenarios =
    options?.scenarios ??
    classifyScenarios(
      DISTILLATION_SCENARIOS.map((scenario) => evaluateScenario(scenario, grainInputTpd))
    );
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
