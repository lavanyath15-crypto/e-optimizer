/**
 * The chain that replaced a single, impossible steam factor. Every step here is
 * checkable against a steam table or a unit definition, which is the point.
 */

import { describe, expect, it } from 'vitest';
import {
  BOILER_EFFICIENCY,
  MJ_PER_KWH,
  MJ_PER_MMBTU,
  NG_KG_CO2E_PER_MJ,
  energyBalance,
  impliedBoilerEfficiency,
  steamChain,
} from './thermalChain';
import { DISTILLATION_STEAM_KG_CO2E_PER_KG } from './emissionsFormula';

describe('unit conversions', () => {
  it('uses the exact definitions', () => {
    expect(MJ_PER_KWH).toBe(3.6);
    expect(MJ_PER_MMBTU).toBeCloseTo(1055.05585, 5);
  });

  it('puts the EPA natural gas factor on a per-MJ basis', () => {
    expect(NG_KG_CO2E_PER_MJ).toBeCloseTo(0.05023, 5);
  });
});

describe('impliedBoilerEfficiency', () => {
  it('shows the dataset factor to be physically impossible', () => {
    // This is the finding that retired the flat 0.06 factor: it describes a
    // boiler returning two thirds more heat than its fuel carries.
    const implied = impliedBoilerEfficiency(DISTILLATION_STEAM_KG_CO2E_PER_KG, 148.5);
    expect(implied).toBeGreaterThan(1.6);
    expect(implied).toBeLessThan(1.75);
  });

  it('returns a plausible efficiency for a plausible factor', () => {
    const implied = impliedBoilerEfficiency(0.125, 148.5);
    expect(implied).toBeGreaterThan(0.75);
    expect(implied).toBeLessThan(0.85);
  });
});

describe('steamChain', () => {
  const chain = steamChain(100_356, 148.5);

  it('converts mass to thermal energy at the header latent heat', () => {
    expect(chain.latentHeatKjPerKg).toBeCloseTo(1996, 0);
    expect(chain.thermalMj).toBeCloseTo((100_356 * 1996) / 1000, -2);
  });

  it('burns more fuel than it delivers heat', () => {
    expect(chain.fuelMj).toBeGreaterThan(chain.thermalMj);
    expect(chain.fuelMj).toBeCloseTo(chain.thermalMj / BOILER_EFFICIENCY, 6);
  });

  it('lands on a possible effective factor, unlike the one it replaced', () => {
    expect(chain.effectiveFactorKgPerKg).toBeCloseTo(0.125, 3);
    expect(chain.effectiveFactorKgPerKg).toBeGreaterThan(DISTILLATION_STEAM_KG_CO2E_PER_KG);
  });

  it('needs more fuel at a higher header pressure for the same mass', () => {
    // Higher pressure steam carries less latent heat per kg, so a kilogram of it
    // is worth less heat and the plant needs more of it -- but a fixed mass at
    // higher pressure carries less energy, so its fuel charge is lower.
    expect(steamChain(100_000, 160).fuelMj).toBeLessThan(steamChain(100_000, 140).fuelMj);
  });

  it('is zero at zero and never divides by a zero efficiency', () => {
    expect(steamChain(0, 148.5).co2eKg).toBe(0);
    expect(Number.isFinite(steamChain(1000, 148.5, 0).co2eKg)).toBe(true);
  });
});

describe('energyBalance', () => {
  const balance = energyBalance({
    electricityKwh: 2749,
    steamKg: 100_356,
    headerPsi: 148.5,
    dryerFuelMmbtu: 56.7,
    ethanolKl: 57.54,
  });

  it('lands where a dry mill actually runs', () => {
    // The independent check on the whole chain. A US dry mill runs 20,000 to
    // 25,000 Btu per gallon of ethanol. Nothing here was fitted to that number.
    expect(balance.btuPerGallon).toBeGreaterThan(19_000);
    expect(balance.btuPerGallon).toBeLessThan(25_000);
  });

  it('reports the headline in GJ/kL', () => {
    expect(balance.gjPerKl).toBeCloseTo(5.56, 1);
  });

  it('includes steam, which the old kWh/kL intensity left out entirely', () => {
    expect(balance.steamFuelMj).toBeGreaterThan(balance.electricityMj);
    expect(balance.steamFuelMj).toBeGreaterThan(balance.dryerFuelMj);
    expect(balance.totalMj).toBeCloseTo(
      balance.electricityMj + balance.steamFuelMj + balance.dryerFuelMj,
      6
    );
  });

  it('is zero rather than infinite when nothing is produced', () => {
    const none = energyBalance({
      electricityKwh: 100,
      steamKg: 100,
      headerPsi: 148.5,
      dryerFuelMmbtu: 1,
      ethanolKl: 0,
    });
    expect(none.gjPerKl).toBe(0);
    expect(none.btuPerGallon).toBe(0);
  });
});
