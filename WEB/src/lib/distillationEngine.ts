/**
 * Distillation engineering calculations: specific steam consumption, reboiler
 * duty, CO2e, and feasibility screening across a set of reflux scenarios.
 * Scenario inputs (reflux, steam, recovery, purity) are anchor operating
 * points; everything else here is derived, not assumed.
 */

export interface DistillationScenarioInput {
  id: string;
  refluxRatio: number;
  steamKgDay: number;
  recoveryPct: number;
  purityPct: number;
}

export type FeasibilityClass = 'Constraint_Violation' | 'Feasible' | 'Energy_Efficient';

export interface DistillationScenarioResult extends DistillationScenarioInput {
  ethanolProductionKlDay: number;
  specificSteamKgPerKl: number;
  reboilerDutyGjDay: number;
  co2eKgDay: number;
  co2eIntensityKgPerKl: number;
  purityOk: boolean;
  recoveryOk: boolean;
  feasible: boolean;
  classification: FeasibilityClass;
}

// Engineering constants. Swap these for your plant's validated values.
export const PURITY_MIN_PCT = 99.5;
export const RECOVERY_MIN_PCT = 95;
export const LATENT_HEAT_KJ_PER_KG = 2200; // effective steam latent heat
export const EMISSION_FACTOR_KG_CO2E_PER_GJ = 56.1; // standard natural gas combustion factor (IPCC/EPA default)
export const OPERATING_DAYS_PER_YEAR = 330;

// Grain_Input_tpd -> Ethanol_Production_kL_day, basis 390 L ethanol per tonne grain.
export function grainToEthanolProduction(grainInputTpd: number): number {
  return (grainInputTpd * 390) / 1000;
}

const ETHANOL_PRODUCTION_KL_DAY = grainToEthanolProduction(147.4); // ~57.5 kL/day

export function evaluateScenario(input: DistillationScenarioInput): DistillationScenarioResult {
  const ethanolProductionKlDay = ETHANOL_PRODUCTION_KL_DAY;
  const specificSteamKgPerKl = input.steamKgDay / ethanolProductionKlDay;
  const reboilerDutyGjDay = (input.steamKgDay * LATENT_HEAT_KJ_PER_KG) / 1_000_000;
  const co2eKgDay = reboilerDutyGjDay * EMISSION_FACTOR_KG_CO2E_PER_GJ;
  const co2eIntensityKgPerKl = co2eKgDay / ethanolProductionKlDay;

  const purityOk = input.purityPct >= PURITY_MIN_PCT;
  const recoveryOk = input.recoveryPct >= RECOVERY_MIN_PCT;
  const feasible = purityOk && recoveryOk;

  return {
    ...input,
    ethanolProductionKlDay,
    specificSteamKgPerKl,
    reboilerDutyGjDay,
    co2eKgDay,
    co2eIntensityKgPerKl,
    purityOk,
    recoveryOk,
    feasible,
    classification: !feasible ? 'Constraint_Violation' : 'Feasible',
  };
}

/** Marks the lowest-specific-steam feasible scenario as Energy_Efficient. */
export function classifyScenarios(results: DistillationScenarioResult[]): DistillationScenarioResult[] {
  const feasible = results.filter((r) => r.feasible);
  if (feasible.length === 0) return results;

  const best = feasible.reduce((a, b) => (b.specificSteamKgPerKl < a.specificSteamKgPerKl ? b : a));

  return results.map((r) =>
    r.id === best.id ? { ...r, classification: 'Energy_Efficient' as FeasibilityClass } : r
  );
}

export interface ScenarioSavings {
  steamSavedKgDay: number;
  steamSavedPct: number;
  energySavedGjDay: number;
  co2eSavedKgDay: number;
  co2eSavedTonnesYear: number;
}

export function computeSavings(
  baseline: DistillationScenarioResult,
  recommended: DistillationScenarioResult
): ScenarioSavings {
  const steamSavedKgDay = baseline.steamKgDay - recommended.steamKgDay;
  const steamSavedPct = (steamSavedKgDay / baseline.steamKgDay) * 100;
  const energySavedGjDay = baseline.reboilerDutyGjDay - recommended.reboilerDutyGjDay;
  const co2eSavedKgDay = baseline.co2eKgDay - recommended.co2eKgDay;
  const co2eSavedTonnesYear = (co2eSavedKgDay * OPERATING_DAYS_PER_YEAR) / 1000;

  return { steamSavedKgDay, steamSavedPct, energySavedGjDay, co2eSavedKgDay, co2eSavedTonnesYear };
}

// Anchor scenarios: reflux/steam/recovery/purity operating points for the
// distillation column. Current operation is the highest-reflux point (S4).
export const DISTILLATION_SCENARIOS: DistillationScenarioInput[] = [
  { id: 'S1', refluxRatio: 2.3, steamKgDay: 69000, recoveryPct: 93.8, purityPct: 99.42 },
  { id: 'S2', refluxRatio: 2.5, steamKgDay: 72000, recoveryPct: 95.4, purityPct: 99.51 },
  { id: 'S3', refluxRatio: 2.8, steamKgDay: 79000, recoveryPct: 96.5, purityPct: 99.55 },
  { id: 'S4', refluxRatio: 3.1, steamKgDay: 85000, recoveryPct: 97.0, purityPct: 99.6 },
];

export const CURRENT_OPERATION_SCENARIO_ID = 'S4';
