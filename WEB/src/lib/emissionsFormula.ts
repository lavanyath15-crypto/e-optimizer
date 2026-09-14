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

import { steamChain, energyBalance, BOILER_EFFICIENCY } from './thermalChain';

export const ELECTRICITY_KG_CO2E_PER_KWH = 0.70;
/**
 * Retired as a calculation input, kept as the comparison point.
 *
 * This was recovered from the source dataset and reproduced its CO2e column to
 * 0.006%, but it implies a boiler efficiency of 167%. Steam is now costed
 * through lib/thermalChain.ts, which burns fuel to raise it like a real plant.
 */
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
  /** Heat delivered by the process steam, MJ/day. */
  steamThermalMj: number;
  /** Fuel burnt to raise it, MJ/day. Higher than the heat delivered. */
  steamFuelMj: number;
  /** Effective kg CO2e per kg of steam from the chain, for comparison. */
  steamEffectiveFactor: number;
  /** Primary energy intensity, the headline figure. */
  energyIntensityGjPerKl: number;
  /** The same number in the unit a US dry mill quotes. */
  energyIntensityBtuPerGal: number;
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

/**
 * @param ethanolKlOverride Production corrected for grain moisture, when the
 *   operator's readings supply it. The plain grain x 0.39 only holds at the
 *   reference moisture, because the yield tracks dry matter. Omitted, this
 *   behaves exactly as it always did.
 */
export function computeEmissions(
  consumption: ConsumptionInput,
  grainInputTpd: number,
  ethanolKlOverride?: number,
  /** Header pressure the steam is raised at. Sets its latent heat. */
  headerPsi: number = 148.5,
  boilerEfficiency: number = BOILER_EFFICIENCY
): EmissionsResult {
  const electricityCo2eKg =
    consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH;
  // Steam through the physical chain rather than a flat factor. See
  // lib/thermalChain.ts for why the flat factor could not stay.
  const steam = steamChain(consumption.distillationSteamKg, headerPsi, boilerEfficiency);
  const steamCo2eKg = steam.co2eKg;
  const fuelCo2eKg = consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU;

  const totalCo2eKg = electricityCo2eKg + steamCo2eKg + fuelCo2eKg;
  const production =
    ethanolKlOverride !== undefined && Number.isFinite(ethanolKlOverride)
      ? ethanolKlOverride
      : ethanolProductionKl(grainInputTpd);

  // Every stream on one basis, steam included. The old intensity was kWh/kL and
  // left steam out entirely because the dataset gave no boiler efficiency to
  // convert a mass with -- so the largest thermal load on site was missing from
  // the headline number. thermalChain names that efficiency instead.
  const balance = energyBalance({
    electricityKwh: consumption.electricityKwh,
    steamKg: consumption.distillationSteamKg,
    headerPsi,
    dryerFuelMmbtu: consumption.dryerFuelMmbtu,
    ethanolKl: production,
    boilerEfficiency,
  });
  const totalEnergyKwh =
    consumption.electricityKwh + consumption.dryerFuelMmbtu * KWH_PER_MMBTU;

  return {
    steamThermalMj: steam.thermalMj,
    steamFuelMj: steam.fuelMj,
    steamEffectiveFactor: steam.effectiveFactorKgPerKg,
    energyIntensityGjPerKl: balance.gjPerKl,
    energyIntensityBtuPerGal: balance.btuPerGallon,
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
