/**
 * The emission factors are the project's headline claim: applying them
 * reproduces the source dataset's own CO2e column to within 0.006%. ml/verify.py
 * proves that against the spreadsheet in Python. These prove the TypeScript that
 * actually runs in the browser agrees with it.
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

  it('splits CO2e by the three recovered factors', () => {
    const result = computeEmissions(consumption, 145);

    expect(result.electricityCo2eKg).toBeCloseTo(
      consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH,
      6
    );
    expect(result.steamCo2eKg).toBeCloseTo(
      consumption.distillationSteamKg * DISTILLATION_STEAM_KG_CO2E_PER_KG,
      6
    );
    expect(result.fuelCo2eKg).toBeCloseTo(
      consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU,
      6
    );
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
    // 145.0. verify.py stops there, so the intensity is derived here from the
    // same three factors rather than quoted from it.
    const result = computeEmissions(consumption, 145);

    const expectedKg =
      consumption.electricityKwh * ELECTRICITY_KG_CO2E_PER_KWH +
      consumption.distillationSteamKg * DISTILLATION_STEAM_KG_CO2E_PER_KG +
      consumption.dryerFuelMmbtu * DRYER_FUEL_KG_CO2E_PER_MMBTU;

    expect(result.ethanolProductionKl).toBeCloseTo(56.55, 2);
    expect(result.totalCo2eKg).toBeCloseTo(expectedKg, 6);
    expect(result.co2eIntensityKgPerKl).toBeCloseTo(expectedKg / 56.55, 6);

    // Pinned so a change to any factor has to be a deliberate edit here too.
    expect(result.co2eIntensityKgPerKl).toBeCloseTo(184.682888, 5);
  });

  it('leaves steam out of the energy intensity', () => {
    // The dataset gives no boiler efficiency to convert steam mass into energy,
    // so it is deliberately excluded rather than guessed at.
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
