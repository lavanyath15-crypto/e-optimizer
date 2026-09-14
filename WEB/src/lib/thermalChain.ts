/**
 * Steam -> thermal energy -> fuel -> CO2e, done as the physical chain it is.
 *
 * The dashboard used to price steam with a single factor of 0.06 kg CO2e per kg
 * of steam, recovered from the source dataset by least squares. It reproduced
 * that dataset's own CO2e column to 0.006%, which is why it was kept.
 *
 * It is not physically possible. Working it backwards:
 *
 *   steam at a 148.5 PSI header carries 1.996 MJ/kg of latent heat
 *   natural gas emits 0.05023 kg CO2e/MJ (EPA, 53.0 kg/MMBtu)
 *   0.06 kg CO2e/kg steam therefore implies a boiler efficiency of 167%
 *
 * A boiler cannot return more heat than the fuel carries. The dataset is
 * synthetic and its steam factor is simply wrong, so reproducing it faithfully
 * meant reproducing an impossible plant. This module replaces that single factor
 * with the four steps it was standing in for, each of which can be checked:
 *
 *   1. steam mass  -> thermal energy, via latent heat at the header pressure
 *   2. thermal     -> fuel input, via boiler efficiency
 *   3. fuel input  -> CO2e, via the fuel's emission factor
 *
 * At 80% boiler efficiency that comes to 0.125 kg CO2e/kg of steam, about 2.1x
 * the dataset figure. The independent check is the total: this puts the plant at
 * 19,962 Btu per gallon of ethanol, against the 20,000-25,000 a dry mill
 * actually runs. The chain lands where the industry does; the old factor did not.
 */

import { latentHeatKjPerKg } from './processPhysics';

// --- Unit conversions. Exact where the definition is exact. ---

/** International Table Btu. 1 MMBtu = 1,055,055.85 J exactly. */
export const MJ_PER_MMBTU = 1055.05585;
/** 1 kWh = 3.6 MJ exactly. */
export const MJ_PER_KWH = 3.6;
/** US gallons per kilolitre, for the Btu/gal cross-check engineers expect. */
export const GALLONS_PER_KL = 264.172052;
export const BTU_PER_MJ = 947.817;

/**
 * Boiler efficiency, higher heating value basis.
 *
 * 80% is the conservative end of a modern gas package boiler with an economiser
 * (typically 80-85% HHV). It is the one assumption in this chain that the source
 * data cannot supply, so it is named here rather than buried in a factor.
 * Replace it with your own boiler's measured efficiency.
 */
export const BOILER_EFFICIENCY = 0.80;

/** EPA natural gas combustion factor, 53.0 kg CO2e/MMBtu, expressed per MJ. */
export const NG_KG_CO2E_PER_MMBTU = 53.0;
export const NG_KG_CO2E_PER_MJ = NG_KG_CO2E_PER_MMBTU / MJ_PER_MMBTU;

export interface SteamChain {
  /** Heat delivered to the process, MJ. */
  thermalMj: number;
  /** Fuel that had to be burnt to deliver it, MJ. */
  fuelMj: number;
  co2eKg: number;
  /** Latent heat used, kJ/kg, which depends on the header pressure. */
  latentHeatKjPerKg: number;
  /** Effective kg CO2e per kg of steam, for comparison against a flat factor. */
  effectiveFactorKgPerKg: number;
}

/** Step 1 to 3, for a mass of steam raised at a given header pressure. */
export function steamChain(
  steamKg: number,
  headerPsi: number,
  boilerEfficiency: number = BOILER_EFFICIENCY
): SteamChain {
  const hfg = latentHeatKjPerKg(headerPsi);
  const thermalMj = (steamKg * hfg) / 1000;
  const efficiency = boilerEfficiency > 0 ? boilerEfficiency : BOILER_EFFICIENCY;
  const fuelMj = thermalMj / efficiency;
  const co2eKg = fuelMj * NG_KG_CO2E_PER_MJ;

  return {
    thermalMj,
    fuelMj,
    co2eKg,
    latentHeatKjPerKg: hfg,
    effectiveFactorKgPerKg: steamKg > 0 ? co2eKg / steamKg : 0,
  };
}

/**
 * The boiler efficiency a flat kg-CO2e-per-kg-steam factor implies.
 *
 * Above 1.0 the factor describes a boiler returning more heat than its fuel
 * carries, which is the finding that retired the dataset's 0.06.
 */
export function impliedBoilerEfficiency(
  flatFactorKgCo2ePerKgSteam: number,
  headerPsi: number
): number {
  if (flatFactorKgCo2ePerKgSteam <= 0) return Infinity;
  const thermalMjPerKg = latentHeatKjPerKg(headerPsi) / 1000;
  return (thermalMjPerKg * NG_KG_CO2E_PER_MJ) / flatFactorKgCo2ePerKgSteam;
}

export interface EnergyBalance {
  electricityMj: number;
  /** Fuel burnt to raise the process steam, not the heat delivered by it. */
  steamFuelMj: number;
  dryerFuelMj: number;
  /** Primary energy into the plant, MJ/day. */
  totalMj: number;
  /** The headline intensity, GJ per kL of ethanol. */
  gjPerKl: number;
  /** The same number in the unit a US dry mill quotes. */
  btuPerGallon: number;
}

/**
 * Primary energy across the plant, on one basis.
 *
 * Steam enters as the *fuel* burnt to raise it rather than the heat it delivers,
 * because that is what the plant actually buys and what the CO2e is charged on.
 * The previous energy intensity left steam out altogether -- it was in kWh/kL
 * and the dataset gave no boiler efficiency to convert a steam mass with -- so
 * the largest thermal load on the site was missing from the headline figure.
 */
export function energyBalance(input: {
  electricityKwh: number;
  steamKg: number;
  headerPsi: number;
  dryerFuelMmbtu: number;
  ethanolKl: number;
  boilerEfficiency?: number;
}): EnergyBalance {
  const electricityMj = input.electricityKwh * MJ_PER_KWH;
  const steamFuelMj = steamChain(input.steamKg, input.headerPsi, input.boilerEfficiency).fuelMj;
  const dryerFuelMj = input.dryerFuelMmbtu * MJ_PER_MMBTU;
  const totalMj = electricityMj + steamFuelMj + dryerFuelMj;

  return {
    electricityMj,
    steamFuelMj,
    dryerFuelMj,
    totalMj,
    gjPerKl: input.ethanolKl > 0 ? totalMj / 1000 / input.ethanolKl : 0,
    btuPerGallon:
      input.ethanolKl > 0 ? (totalMj / input.ethanolKl / GALLONS_PER_KL) * BTU_PER_MJ : 0,
  };
}
