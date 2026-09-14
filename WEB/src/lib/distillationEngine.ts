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

// Deliberate difference, not a bug. This module prices steam through reboiler
// duty at the generic natural gas factor above: 2200 kJ/kg x 56.1 kg CO2e/GJ
// works out to ~0.123 kg CO2e per kg of steam. emissionsFormula.ts instead uses
// DISTILLATION_STEAM_KG_CO2E_PER_KG = 0.06, recovered from the source dataset by
// least squares.
//
// They disagree by ~2x because the synthetic dataset was evidently generated
// with a steam factor about half what natural-gas-raised steam normally costs.
// Each is kept for a reason: 0.06 keeps emissionsFormula reproducing the
// dataset's own CO2e column to 0.006%, and 56.1 keeps the scenario comparison
// physically realistic. Because of that, CO2e figures from this module are not
// on the same basis as those from emissionsFormula and must not be summed or
// compared. Both cards say so on screen. Replace both with your plant's
// measured boiler factor and the discrepancy goes away.
export const OPERATING_DAYS_PER_YEAR = 330;

// Grain_Input_tpd -> Ethanol_Production_kL_day, basis 390 L ethanol per tonne grain.
export function grainToEthanolProduction(grainInputTpd: number): number {
  return (grainInputTpd * 390) / 1000;
}

/**
 * Throughput the scenario steam figures were recorded at. The anchor points in
 * DISTILLATION_SCENARIOS are daily steam totals, so they only mean anything
 * against the throughput they were measured at.
 */
export const SCENARIO_ANCHOR_TPD = 147.4;

/**
 * Scales a scenario's daily steam from the anchor throughput to the one being
 * run.
 *
 * Steam is taken as proportional to throughput, which is a first-order
 * assumption: it holds the specific steam figure (kg/kL) constant across
 * throughputs and lets the daily totals and CO2e move. That is the behaviour you
 * want from a screening table, because the choice between scenarios is a
 * question about reflux, not about how much grain is going in. A real column
 * has a fixed reboiler overhead that makes this slightly optimistic at low
 * rates.
 */
function scaleSteamToThroughput(steamKgDay: number, grainInputTpd: number): number {
  return steamKgDay * (grainInputTpd / SCENARIO_ANCHOR_TPD);
}

export function evaluateScenario(
  input: DistillationScenarioInput,
  grainInputTpd: number = SCENARIO_ANCHOR_TPD
): DistillationScenarioResult {
  const ethanolProductionKlDay = grainToEthanolProduction(grainInputTpd);
  const steamKgDay = scaleSteamToThroughput(input.steamKgDay, grainInputTpd);

  const specificSteamKgPerKl =
    ethanolProductionKlDay > 0 ? steamKgDay / ethanolProductionKlDay : 0;
  const reboilerDutyGjDay = (steamKgDay * LATENT_HEAT_KJ_PER_KG) / 1_000_000;
  const co2eKgDay = reboilerDutyGjDay * EMISSION_FACTOR_KG_CO2E_PER_GJ;
  const co2eIntensityKgPerKl =
    ethanolProductionKlDay > 0 ? co2eKgDay / ethanolProductionKlDay : 0;

  const purityOk = input.purityPct >= PURITY_MIN_PCT;
  const recoveryOk = input.recoveryPct >= RECOVERY_MIN_PCT;
  const feasible = purityOk && recoveryOk;

  return {
    ...input,
    // Overrides the anchor figure from `input` with the throughput-scaled one,
    // so every number on the row is on the same basis.
    steamKgDay,
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

/**
 * The scenario the plant is actually sitting on, given the reflux the operator
 * submitted.
 *
 * Carbon worked this out by nearest reflux while AI Optimization assumed S4
 * unconditionally, so submitting 2.30 produced two screens that disagreed about
 * the same reading: one said "closest to S1", the other still labelled S4
 * "(current)" and computed its savings from there. Both now call this.
 */
export function resolveCurrentScenario(
  scenarios: DistillationScenarioResult[],
  refluxRatio: number | null
): DistillationScenarioResult {
  const fallback =
    scenarios.find((s) => s.id === CURRENT_OPERATION_SCENARIO_ID) ?? scenarios[0];
  if (refluxRatio === null || !Number.isFinite(refluxRatio)) return fallback;

  return scenarios.reduce(
    (best, s) =>
      Math.abs(s.refluxRatio - refluxRatio) < Math.abs(best.refluxRatio - refluxRatio) ? s : best,
    fallback
  );
}
