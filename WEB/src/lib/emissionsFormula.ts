/**
 * Consumption -> CO2e and energy intensity.
 *
 * The three emission factors below were recovered from
 * Grain_Based_Ethanol_Synthetic_Dataset_2025.xlsx by least squares against its
 * Operational_CO2e_t column (R2 = 0.9999998). Applying them reproduces that
 * column to within 0.006%, which is the rounding in the stored values.
 *
 * They are therefore the dataset's own assumptions, not literature estimates.
 * The fuel factor of 53.0 kg CO2e/MMBtu matches the EPA natural gas factor
 * (53.06), which is what settles the fuel type for this dataset.
 *
 * Note the dataset excludes Liquefaction_Steam_kg from its CO2e figure; only
 * distillation steam is counted. Kept the same here so results stay comparable
 * with the source data.
 */

export const ELECTRICITY_KG_CO2E_PER_KWH = 0.70;
export const DISTILLATION_STEAM_KG_CO2E_PER_KG = 0.06;
export const DRYER_FUEL_KG_CO2E_PER_MMBTU = 53.0;

/** Litres of ethanol per tonne of grain. Constant 390.0 across the dataset. */
export const ETHANOL_YIELD_L_PER_TONNE_GRAIN = 390;

/** MMBtu to kWh, for putting fuel and electricity on one energy basis. */
export const KWH_PER_MMBTU = 293.07;

export interface ConsumptionInput {
  electricityKwh: number;
  distillationSteamKg: number;
  dryerFuelMmbtu: number;
}

export interface EmissionsResult {
  electricityCo2eKg: number;
  steamCo2eKg: number;
  fuelCo2eKg: number;
  totalCo2eKg: number;
  totalCo2eTonnes: number;
  ethanolProductionKl: number;
  co2eIntensityKgPerKl: number;
  electricityIntensityKwhPerKl: number;
  totalEnergyIntensityKwhPerKl: number;
}

/**
 * Ethanol production is not predicted by the network because it is exactly
 * grain input x 0.39 in this dataset (max deviation 0.0012%).
 */
export function ethanolProductionKl(grainInputTpd: number): number {
  return (grainInputTpd * ETHANOL_YIELD_L_PER_TONNE_GRAIN) / 1000;
}

export function computeEmissions(
  consumption: ConsumptionInput,
  grainInputTpd: number
): EmissionsResult {
  const electricityCo2eKg =
    consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH;
  const steamCo2eKg =
    consumption.distillationSteamKg * DISTILLATION_STEAM_KG_CO2E_PER_KG;
  const fuelCo2eKg = consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU;

  const totalCo2eKg = electricityCo2eKg + steamCo2eKg + fuelCo2eKg;
  const production = ethanolProductionKl(grainInputTpd);

  // Fuel is already an energy figure, so it converts directly. Steam is a mass
  // and is left out of the energy intensity rather than guessed at, since this
  // dataset gives no boiler efficiency to convert it with.
  const totalEnergyKwh =
    consumption.electricityKwh + consumption.dryerFuelMmbtu * KWH_PER_MMBTU;

  return {
    electricityCo2eKg,
    steamCo2eKg,
    fuelCo2eKg,
    totalCo2eKg,
    totalCo2eTonnes: totalCo2eKg / 1000,
    ethanolProductionKl: production,
    co2eIntensityKgPerKl: production > 0 ? totalCo2eKg / production : 0,
    electricityIntensityKwhPerKl:
      production > 0 ? consumption.electricityKwh / production : 0,
    totalEnergyIntensityKwhPerKl: production > 0 ? totalEnergyKwh / production : 0,
  };
}
