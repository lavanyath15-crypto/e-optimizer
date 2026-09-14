/**
 * Electricity and dryer fuel are still priced by the factors recovered from the
 * source dataset. Steam is not: its recovered factor implied a boiler efficiency
 * of 167%, so it now goes through the physical chain in lib/thermalChain.ts.
 *
 * These tests therefore no longer reproduce the dataset's own CO2e column, and
 * that is the point. They check the chain instead, and pin the impossibility
 * that retired the old factor.
 */

import { describe, expect, it } from 'vitest';
import {
  computeEmissions,
  ethanolProductionKl,
  ELECTRICITY_KG_CO2E_PER_KWH,
  DISTILLATION_STEAM_KG_CO2E_PER_KG,
  DRYER_FUEL_KG_CO2E_PER_MMBTU,
  KWH_PER_MMBTU,
} from './emissionsFormula';
import { steamChain, impliedBoilerEfficiency } from './thermalChain';

describe('ethanolProductionKl', () => {
  it('applies the 390 L per tonne basis', () => {
    expect(ethanolProductionKl(147.4)).toBeCloseTo(57.486, 3);
    expect(ethanolProductionKl(100)).toBeCloseTo(39, 6);
  });

  it('is zero at zero throughput', () => {
    expect(ethanolProductionKl(0)).toBe(0);
  });
});

describe('computeEmissions', () => {
  const consumption = {
    electricityKwh: 2614.669379,
    distillationSteamKg: 96282.846286,
    dryerFuelMmbtu: 53.520339,
  };

  it('prices electricity and dryer fuel by their recovered factors', () => {
    const result = computeEmissions(consumption, 145);

    expect(result.electricityCo2eKg).toBeCloseTo(
      consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH,
      6
    );
    expect(result.fuelCo2eKg).toBeCloseTo(
      consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU,
      6
    );
  });

  it('prices steam through the chain, not the flat factor', () => {
    const result = computeEmissions(consumption, 145);
    const chain = steamChain(consumption.distillationSteamKg, 148.5);

    expect(result.steamCo2eKg).toBeCloseTo(chain.co2eKg, 6);
    // Well above what the retired factor produced, because that factor was
    // charging the plant for less fuel than the heat it delivered.
    expect(result.steamCo2eKg).toBeGreaterThan(
      consumption.distillationSteamKg * DISTILLATION_STEAM_KG_CO2E_PER_KG
    );
  });

  it('records why the flat steam factor was retired', () => {
    // A boiler cannot return more heat than its fuel carries. This is the whole
    // justification for the chain, so it is pinned rather than left in a comment.
    expect(impliedBoilerEfficiency(DISTILLATION_STEAM_KG_CO2E_PER_KG, 148.5)).toBeGreaterThan(1);
  });

  it('totals the three parts and converts to tonnes', () => {
    const result = computeEmissions(consumption, 145);
    const expected =
      result.electricityCo2eKg + result.steamCo2eKg + result.fuelCo2eKg;

    expect(result.totalCo2eKg).toBeCloseTo(expected, 6);
    expect(result.totalCo2eTonnes).toBeCloseTo(expected / 1000, 9);
  });

  it('turns the verify.py reference consumption into intensity for 145 t/day', () => {
    // The consumption fixture above is what ml/verify.py prints for grain input
    // 145.0. verify.py stops there, so the intensity is derived here rather than
    // quoted from it.
    const result = computeEmissions(consumption, 145);

    const expectedKg =
      consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH +
      steamChain(consumption.distillationSteamKg, 148.5).co2eKg +
      consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU;

    expect(result.ethanolProductionKl).toBeCloseTo(56.55, 2);
    expect(result.totalCo2eKg).toBeCloseTo(expectedKg, 6);
    expect(result.co2eIntensityKgPerKl).toBeCloseTo(expectedKg / 56.55, 6);

    // Pinned so a change to any factor has to be a deliberate edit here too.
    // It was 184.68 while steam was priced by the impossible flat factor.
    expect(result.co2eIntensityKgPerKl).toBeCloseTo(295.94, 1);
  });

  it('keeps the legacy kWh/kL figure free of steam', () => {
    // Retained only for continuity with the old headline. The figure that
    // matters now is energyIntensityGjPerKl, which does include steam.
    const result = computeEmissions(consumption, 145);
    const expectedKwh =
      consumption.electricityKwh + consumption.dryerFuelMmbtu * KWH_PER_MMBTU;

    expect(result.totalEnergyIntensityKwhPerKl).toBeCloseTo(
      expectedKwh / result.ethanolProductionKl,
      6
    );
  });

  it('returns zero intensities rather than dividing by zero', () => {
    const result = computeEmissions(consumption, 0);

    expect(result.ethanolProductionKl).toBe(0);
    expect(result.co2eIntensityKgPerKl).toBe(0);
    expect(result.electricityIntensityKwhPerKl).toBe(0);
    expect(result.totalEnergyIntensityKwhPerKl).toBe(0);
    // The absolute CO2e still stands: burning fuel at zero output is still
    // emitting, and hiding that would be the wrong call.
    expect(result.totalCo2eKg).toBeGreaterThan(0);
  });
});
