/**
 * These corrections sit between the network and every figure on screen, so a
 * mistake here silently shifts the whole dashboard. The first test is the one
 * that matters most: at the default readings nothing may move at all.
 */

import { describe, expect, it } from 'vitest';
import {
  REFERENCE,
  DDGS_TONNES_PER_TONNE_GRAIN,
  applyProcessPhysics,
  fuelFactorForDdgsMoisture,
  latentHeatKjPerKg,
  liquefactionSteamKg,
  steamFactorForAbv,
  steamFactorForPressure,
  unmodelledReadings,
  yieldFactorForMoisture,
} from './processPhysics';
import { PROCESS_DEFAULTS, PROCESS_UNITS, type ProcessValues } from '../data/processUnits';
import { bushelsPerHourToTonnesPerDay } from './grainFeed';
import type { ConsumptionPrediction } from './annModel';

function defaults(): ProcessValues {
  const fresh: ProcessValues = {};
  for (const unit of PROCESS_UNITS) {
    fresh[unit.id] = { ...PROCESS_DEFAULTS[unit.id] };
  }
  return fresh;
}

const NOMINAL_TPD = bushelsPerHourToTonnesPerDay(PROCESS_DEFAULTS.milling.feedRate);

const baseline: ConsumptionPrediction = {
  electricityKwh: 2749,
  distillationSteamKg: 100356,
  dryerFuelMmbtu: 56.7,
};

describe('the reference point', () => {
  it('leaves the network untouched at the default readings', () => {
    // The invariant everything else rests on. If any factor drifts off 1 here,
    // the dashboard stops reproducing the source dataset's own CO2e column and
    // the 0.006% reconciliation the Carbon screen claims becomes false.
    const result = applyProcessPhysics(baseline, NOMINAL_TPD, defaults());

    expect(result.atReference).toBe(true);
    expect(result.adjusted.electricityKwh).toBeCloseTo(baseline.electricityKwh, 9);
    expect(result.adjusted.distillationSteamKg).toBeCloseTo(baseline.distillationSteamKg, 9);
    expect(result.adjusted.dryerFuelMmbtu).toBeCloseTo(baseline.dryerFuelMmbtu, 9);
    expect(result.adjusted.ethanolKl).toBeCloseTo(result.baseline.ethanolKl, 9);
  });

  it('reports every factor as exactly one', () => {
    for (const adjustment of applyProcessPhysics(baseline, NOMINAL_TPD, defaults()).adjustments) {
      expect(adjustment.factor).toBeCloseTo(1, 12);
      expect(adjustment.changePct).toBeCloseTo(0, 10);
    }
  });

  it('takes its reference values from the defaults rather than a second copy', () => {
    expect(REFERENCE.grainMoisturePct).toBe(PROCESS_DEFAULTS.milling.moisture);
    expect(REFERENCE.beerAbvPct).toBe(PROCESS_DEFAULTS.fermentation.abv);
    expect(REFERENCE.steamPressurePsi).toBe(PROCESS_DEFAULTS.distillation.steamPressure);
    expect(REFERENCE.ddgsOutletMoisturePct).toBe(PROCESS_DEFAULTS.drying.outletMoisture);
  });
});

describe('yieldFactorForMoisture', () => {
  it('cuts yield when the grain is wetter than reference', () => {
    // 18.4% against 14.2%: dry matter falls from 85.8% to 81.6%, so 4.9% less.
    expect(yieldFactorForMoisture(18.4)).toBeCloseTo(0.816 / 0.858, 6);
    expect(yieldFactorForMoisture(18.4)).toBeLessThan(1);
  });

  it('raises yield when the grain is drier', () => {
    expect(yieldFactorForMoisture(12)).toBeGreaterThan(1);
  });

  it('tracks dry matter exactly', () => {
    expect(yieldFactorForMoisture(0)).toBeCloseTo(1 / 0.858, 6);
  });
});

describe('steamFactorForAbv', () => {
  it('needs more steam for weaker beer', () => {
    expect(steamFactorForAbv(12)).toBeGreaterThan(1);
    expect(steamFactorForAbv(12)).toBeCloseTo(14.82 / 12, 9);
  });

  it('needs less for stronger beer', () => {
    expect(steamFactorForAbv(16)).toBeLessThan(1);
  });

  it('refuses to divide by zero', () => {
    expect(steamFactorForAbv(0)).toBe(1);
    expect(Number.isFinite(steamFactorForAbv(-3))).toBe(true);
  });
});

describe('latentHeatKjPerKg', () => {
  it('matches steam tables across the header band', () => {
    // Saturated steam: 10 bara is about 2015 kJ/kg, 15 bara about 1947.
    // 130 psig is 9.98 bara, 202 psig is 14.94 bara.
    expect(latentHeatKjPerKg(130)).toBeCloseTo(2015, -1);
    expect(latentHeatKjPerKg(202)).toBeCloseTo(1947, -1);
  });

  it('falls as pressure rises', () => {
    expect(latentHeatKjPerKg(160)).toBeLessThan(latentHeatKjPerKg(140));
  });

  it('stays finite at and below atmospheric', () => {
    expect(Number.isFinite(latentHeatKjPerKg(0))).toBe(true);
    expect(Number.isFinite(latentHeatKjPerKg(-50))).toBe(true);
  });
});

describe('steamFactorForPressure', () => {
  it('needs more kilograms at higher pressure', () => {
    expect(steamFactorForPressure(160)).toBeGreaterThan(1);
    expect(steamFactorForPressure(140)).toBeLessThan(1);
  });

  it('is a small effect across the band, which is worth knowing', () => {
    // Under 1% from 140 to 160 PSI. Shown because it is real, not because it
    // is large.
    expect(Math.abs(steamFactorForPressure(160) - 1)).toBeLessThan(0.01);
  });
});

describe('fuelFactorForDdgsMoisture', () => {
  it('burns more fuel to dry further', () => {
    expect(fuelFactorForDdgsMoisture(8)).toBeGreaterThan(1);
  });

  it('burns less when leaving more water in', () => {
    expect(fuelFactorForDdgsMoisture(12)).toBeLessThan(1);
  });

  it('is a weak lever, because most of the water leaves regardless', () => {
    // Two points of DDGS moisture moves fuel by a couple of percent, not tens.
    // An operator expecting a big saving here should see that it is not there.
    expect(Math.abs(fuelFactorForDdgsMoisture(8) - 1)).toBeLessThan(0.05);
  });
});

describe('liquefactionSteamKg', () => {
  it('lands where a dry mill actually sits', () => {
    const steam = liquefactionSteamKg(NOMINAL_TPD, 14.2, 225.4, 148.5);
    // About 125 GJ/day of cook duty at the nominal point. Together with the
    // network's distillation steam that is roughly 21,500 Btu per gallon of
    // ethanol, inside the 20,000-25,000 a dry mill normally runs.
    expect(steam).toBeGreaterThan(55_000);
    expect(steam).toBeLessThan(70_000);
  });

  it('rises with cook temperature', () => {
    const cool = liquefactionSteamKg(NOMINAL_TPD, 14.2, 215, 148.5);
    const hot = liquefactionSteamKg(NOMINAL_TPD, 14.2, 235, 148.5);
    expect(hot).toBeGreaterThan(cool);
  });

  it('is zero rather than negative below the slurry inlet temperature', () => {
    expect(liquefactionSteamKg(NOMINAL_TPD, 14.2, 50, 148.5)).toBe(0);
  });
});

describe('applyProcessPhysics', () => {
  it('moves steam when the beer comes in weak', () => {
    const readings = defaults();
    readings.fermentation.abv = 12;

    const result = applyProcessPhysics(baseline, NOMINAL_TPD, readings);
    expect(result.atReference).toBe(false);
    expect(result.adjusted.distillationSteamKg).toBeGreaterThan(baseline.distillationSteamKg);
    // Electricity has no path from ABV and must not move.
    expect(result.adjusted.electricityKwh).toBe(baseline.electricityKwh);
  });

  it('moves ethanol when the grain comes in wet', () => {
    const readings = defaults();
    readings.milling.moisture = 18.4;

    const result = applyProcessPhysics(baseline, NOMINAL_TPD, readings);
    expect(result.adjusted.ethanolKl).toBeLessThan(result.baseline.ethanolKl);
    expect(result.adjusted.distillationSteamKg).toBe(baseline.distillationSteamKg);
  });

  it('names the reading behind every correction it makes', () => {
    const result = applyProcessPhysics(baseline, NOMINAL_TPD, defaults());
    for (const adjustment of result.adjustments) {
      expect(adjustment.reading).toMatch(/reference/);
      expect(adjustment.basis.length).toBeGreaterThan(20);
      expect(adjustment.unit).toBeTruthy();
    }
  });
});

describe('cross-checks', () => {
  it('passes on the defaults', () => {
    // They only pass because the sample beer feed rate and dryer throughput
    // were corrected: both described a 2,936 t/day plant, 19.9x this one.
    for (const check of applyProcessPhysics(baseline, NOMINAL_TPD, defaults()).crossChecks) {
      expect(check.ok).toBe(true);
    }
  });

  it('catches a beer feed rate that belongs to a different plant', () => {
    const readings = defaults();
    readings.distillation.feedRate = 1420;

    const check = applyProcessPhysics(baseline, NOMINAL_TPD, readings).crossChecks.find(
      (c) => c.id === 'beer-feed'
    )!;
    expect(check.ok).toBe(false);
    expect(check.deviation).toBeGreaterThan(15);
  });

  it('catches a dryer rate that does not follow the mill', () => {
    const readings = defaults();
    readings.drying.throughput = 38.2;

    const check = applyProcessPhysics(baseline, NOMINAL_TPD, readings).crossChecks.find(
      (c) => c.id === 'ddgs-rate'
    )!;
    expect(check.ok).toBe(false);
  });

  it('derives the DDGS rate from the legal bushel weight', () => {
    expect(DDGS_TONNES_PER_TONNE_GRAIN).toBeCloseTo(17.5 / 56, 12);
  });
});

describe('unmodelledReadings', () => {
  it('names all six, so an operator can see what is not being used', () => {
    const list = unmodelledReadings(defaults());
    expect(list).toHaveLength(6);
    for (const item of list) {
      expect(item.value).toBeTruthy();
      expect(item.reason.length).toBeGreaterThan(20);
    }
  });

  it('accounts for every reading exactly once', () => {
    // Every field on Process Monitor has to land in exactly one of these
    // buckets. Counting totals instead of naming keys is what let cook
    // temperature go missing from this test while the code used it correctly.
    const accountedFor: Record<string, string> = {
      'milling.feedRate': 'drives the network',
      'distillation.refluxRatio': 'selects the distillation scenario',

      'milling.moisture': 'correction: ethanol yield',
      'fermentation.abv': 'correction: distillation steam',
      'distillation.steamPressure': 'correction: distillation steam',
      'drying.outletMoisture': 'correction: dryer fuel',

      'liquefaction.cookTemp': 'drives the liquefaction duty',

      'distillation.feedRate': 'cross-check',
      'drying.throughput': 'cross-check',

      'milling.screenSize': 'unmodelled',
      'liquefaction.ph': 'unmodelled',
      'liquefaction.enzymeDose': 'unmodelled',
      'fermentation.temp': 'unmodelled',
      'fermentation.durationH': 'unmodelled',
      'drying.inletTemp': 'unmodelled',
    };

    const everyField = PROCESS_UNITS.flatMap((u) => u.fields.map((f) => `${u.id}.${f.key}`));

    expect(everyField.sort()).toEqual(Object.keys(accountedFor).sort());

    const unmodelledCount = Object.values(accountedFor).filter((v) => v === 'unmodelled').length;
    expect(unmodelledReadings(defaults())).toHaveLength(unmodelledCount);

    const result = applyProcessPhysics(baseline, NOMINAL_TPD, defaults());
    expect(result.adjustments).toHaveLength(
      Object.values(accountedFor).filter((v) => v.startsWith('correction')).length
    );
    expect(result.crossChecks).toHaveLength(
      Object.values(accountedFor).filter((v) => v === 'cross-check').length
    );
  });

  it('produces a liquefaction duty that responds to the cook temperature reading', () => {
    // The fifteenth reading. It has no entry in `adjustments` because it does
    // not scale a network output; it produces a figure of its own.
    const readings = defaults();
    readings.liquefaction.cookTemp = 235;

    const hotter = applyProcessPhysics(baseline, NOMINAL_TPD, readings).liquefactionSteamKg;
    const nominal = applyProcessPhysics(baseline, NOMINAL_TPD, defaults()).liquefactionSteamKg;
    expect(hotter).toBeGreaterThan(nominal);
  });
});
