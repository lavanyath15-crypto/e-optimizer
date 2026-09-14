/**
 * Turns the rest of the Process Monitor readings into figures, using process
 * engineering rather than the network.
 *
 * The trained network has one input: grain throughput. That is not a limitation
 * anyone can code around, because nothing else in the source dataset carries
 * signal. So the other readings are handled the only honest way available: with
 * first-principles relationships, each one stated, each one a *correction to the
 * network's baseline* rather than a replacement for it.
 *
 * Two rules hold everything here together.
 *
 * 1. Every correction is a ratio against the reference operating point the
 *    network was trained at. At the default readings every factor is exactly 1
 *    and the dashboard reproduces the network's own output, so the 0.006%
 *    reconciliation with the source dataset's CO2e column still holds. There is
 *    a test pinning that.
 *
 * 2. A reading with no defensible coefficient gets none. Six of the fifteen
 *    readings are recorded and shown but do not move a number, and the screens
 *    say so by name. Inventing a sensitivity for slurry pH would be exactly the
 *    fake figure this is meant to remove.
 *
 * Sanity check on the magnitudes: at the default readings this puts distillation
 * at 220 GJ/day and liquefaction at 125 GJ/day, 345 GJ/day of process heat
 * across 15,200 gal/day of ethanol. That is about 21,500 Btu/gal, inside the
 * 20,000-25,000 Btu/gal a dry mill normally runs. The physics and the network
 * agree without being fitted to each other.
 */

import { PROCESS_DEFAULTS, type ProcessValues } from '../data/processUnits';
import type { ConsumptionPrediction } from './annModel';
import { ETHANOL_YIELD_L_PER_TONNE_GRAIN } from './emissionsFormula';

// ---------------------------------------------------------------------------
// Constants, each with the reason it has the value it has.
// ---------------------------------------------------------------------------

/** Corn is 56 lb/bushel by legal definition; DDGS yield is ~17.5 lb/bushel. */
export const DDGS_TONNES_PER_TONNE_GRAIN = 17.5 / 56;

/** US gallon in litres, exactly. */
export const LITRES_PER_GALLON = 3.785411784;

/** Dry-mill slurry is run at about 30% dissolved and suspended solids. */
export const SLURRY_SOLIDS_FRACTION = 0.3;

/**
 * Specific heat of corn mash, kJ/kg.K. A 30% solids slurry is 0.7 water at 4.18
 * and 0.3 carbohydrate solids at about 1.6, so 0.7(4.18) + 0.3(1.6) = 3.41.
 */
export const MASH_CP_KJ_PER_KG_K = 3.41;

/** Slurry make-up water temperature before the jet cooker, degrees C. */
export const SLURRY_INLET_TEMP_C = 20;

/**
 * Moisture of the centrifuge cake entering the dryer. 65% is typical for wet
 * cake off a decanter before the DDGS dryer.
 */
export const WET_CAKE_MOISTURE_FRACTION = 0.65;

/**
 * Latent heat of saturated steam, kJ/kg, as a log fit to steam tables:
 * hfg = 2381.3 - 159.1 ln(P_bara). Within about 1% from 5 to 20 bar absolute,
 * and better than 0.2% across the 140-160 PSI header band where it is actually
 * used. It is only ever applied as a ratio against the reference pressure, so
 * the residual error largely cancels.
 */
export function latentHeatKjPerKg(gaugePsi: number): number {
  const barAbsolute = gaugePsi * 0.0689476 + 1.01325;
  return 2381.3 - 159.1 * Math.log(Math.max(barAbsolute, 1.02));
}

// ---------------------------------------------------------------------------
// The reference operating point: the default readings. Every factor below is 1
// here, by construction.
// ---------------------------------------------------------------------------

export const REFERENCE = {
  grainMoisturePct: PROCESS_DEFAULTS.milling.moisture,
  cookTempF: PROCESS_DEFAULTS.liquefaction.cookTemp,
  beerAbvPct: PROCESS_DEFAULTS.fermentation.abv,
  steamPressurePsi: PROCESS_DEFAULTS.distillation.steamPressure,
  ddgsOutletMoisturePct: PROCESS_DEFAULTS.drying.outletMoisture,
} as const;

const fahrenheitToCelsius = (f: number) => ((f - 32) * 5) / 9;

/** Water carried per unit of bone-dry solids at a given moisture fraction. */
const moistureRatio = (fraction: number) => fraction / (1 - fraction);

// ---------------------------------------------------------------------------
// The individual relationships.
// ---------------------------------------------------------------------------

/**
 * Ethanol comes from starch, and starch is in the dry matter. Grain bought wet
 * carries less of it per tonne, so the yield constant only holds at the
 * reference moisture.
 */
export function yieldFactorForMoisture(moisturePct: number): number {
  return (1 - moisturePct / 100) / (1 - REFERENCE.grainMoisturePct / 100);
}

/**
 * The beer column strips water off ethanol, so the steam it needs scales with
 * how much water there is per litre of product: weaker beer, more steam. To
 * first order that is inversely proportional to ABV.
 */
export function steamFactorForAbv(abvPct: number): number {
  if (abvPct <= 0) return 1;
  return REFERENCE.beerAbvPct / abvPct;
}

/**
 * Higher header pressure means hotter steam with *less* latent heat in every
 * kilogram, so the same reboiler duty takes more kilograms of it.
 */
export function steamFactorForPressure(gaugePsi: number): number {
  return latentHeatKjPerKg(REFERENCE.steamPressurePsi) / latentHeatKjPerKg(gaugePsi);
}

/**
 * Dryer fuel is spent evaporating water. What matters is how much water comes
 * off per unit of dry solids, which is set by the cake going in and the DDGS
 * coming out. Drying further costs more, but less than people expect: most of
 * the water is gone before the last few points of moisture.
 */
export function fuelFactorForDdgsMoisture(outletMoisturePct: number): number {
  const cake = moistureRatio(WET_CAKE_MOISTURE_FRACTION);
  const evaporatedAt = (pct: number) => cake - moistureRatio(pct / 100);

  const reference = evaporatedAt(REFERENCE.ddgsOutletMoisturePct);
  if (reference <= 0) return 1;
  return evaporatedAt(outletMoisturePct) / reference;
}

/**
 * Heat to bring the mash from make-up water temperature to the cook setpoint.
 *
 * This is a real and large load: about a third of the plant's process heat. It
 * is reported on its own and deliberately kept *out* of the CO2e ledger, because
 * the source dataset excludes its Liquefaction_Steam_kg column from the CO2e it
 * reports. Folding it in would break the reconciliation the ledger claims.
 */
export function liquefactionSteamKg(
  grainInputTpd: number,
  grainMoisturePct: number,
  cookTempF: number,
  steamPressurePsi: number
): number {
  const dryGrainKg = grainInputTpd * 1000 * (1 - grainMoisturePct / 100);
  const mashKg = dryGrainKg / SLURRY_SOLIDS_FRACTION;
  const deltaK = fahrenheitToCelsius(cookTempF) - SLURRY_INLET_TEMP_C;
  if (deltaK <= 0) return 0;

  const dutyKj = mashKg * MASH_CP_KJ_PER_KG_K * deltaK;
  return dutyKj / latentHeatKjPerKg(steamPressurePsi);
}

// ---------------------------------------------------------------------------
// Assembling it.
// ---------------------------------------------------------------------------

export interface Adjustment {
  id: string;
  /** The stage this reading came from, for grouping on screen. */
  unit: string;
  /** What the operator entered, formatted. */
  reading: string;
  /** Which predicted figure it moves. */
  target: 'Ethanol' | 'Distillation steam' | 'Dryer fuel';
  factor: number;
  /** Signed percentage change, for display. */
  changePct: number;
  /** Why this relationship exists. One sentence. */
  basis: string;
}

export interface CrossCheck {
  id: string;
  label: string;
  entered: string;
  implied: string;
  /** Fractional difference, entered against implied. */
  deviation: number;
  ok: boolean;
  note: string;
}

export interface UnmodelledReading {
  unit: string;
  label: string;
  value: string;
  reason: string;
}

export interface PhysicsResult {
  /** What the network predicted from throughput alone, before any reading. */
  baseline: ConsumptionPrediction & { ethanolKl: number };
  /** After the readings are applied. */
  adjusted: ConsumptionPrediction & { ethanolKl: number };
  adjustments: Adjustment[];
  crossChecks: CrossCheck[];
  /** Liquefaction duty, outside the CO2e ledger's scope. See above. */
  liquefactionSteamKg: number;
  /** True when every factor is 1, i.e. the readings are at the reference point. */
  atReference: boolean;
}

const pct = (factor: number) => (factor - 1) * 100;

/**
 * Applies the readings to the network's prediction.
 *
 * Order does not matter: every factor multiplies an independent target.
 */
export function applyProcessPhysics(
  baseline: ConsumptionPrediction,
  grainInputTpd: number,
  readings: ProcessValues
): PhysicsResult {
  const moisture = readings.milling.moisture;
  const cookTemp = readings.liquefaction.cookTemp;
  const abv = readings.fermentation.abv;
  const pressure = readings.distillation.steamPressure;
  const beerGpm = readings.distillation.feedRate;
  const ddgsMoisture = readings.drying.outletMoisture;
  const ddgsTph = readings.drying.throughput;

  const yieldFactor = yieldFactorForMoisture(moisture);
  const abvFactor = steamFactorForAbv(abv);
  const pressureFactor = steamFactorForPressure(pressure);
  const fuelFactor = fuelFactorForDdgsMoisture(ddgsMoisture);

  const baselineEthanolKl = (grainInputTpd * ETHANOL_YIELD_L_PER_TONNE_GRAIN) / 1000;
  const adjustedEthanolKl = baselineEthanolKl * yieldFactor;

  const adjustments: Adjustment[] = [
    {
      id: 'moisture-yield',
      unit: 'Milling',
      reading: `Grain moisture ${moisture.toFixed(1)}% against ${REFERENCE.grainMoisturePct}% reference`,
      target: 'Ethanol',
      factor: yieldFactor,
      changePct: pct(yieldFactor),
      basis:
        'Ethanol comes from the starch in the dry matter, so wetter grain carries less of it per tonne.',
    },
    {
      id: 'abv-steam',
      unit: 'Fermentation',
      reading: `Beer ABV ${abv.toFixed(2)}% against ${REFERENCE.beerAbvPct}% reference`,
      target: 'Distillation steam',
      factor: abvFactor,
      changePct: pct(abvFactor),
      basis:
        'The column strips water off ethanol, so weaker beer means more water per litre of product and more steam to boil it.',
    },
    {
      id: 'pressure-steam',
      unit: 'Distillation',
      reading: `Header pressure ${pressure.toFixed(1)} PSI against ${REFERENCE.steamPressurePsi} PSI reference`,
      target: 'Distillation steam',
      factor: pressureFactor,
      changePct: pct(pressureFactor),
      basis:
        'Higher pressure steam carries less latent heat per kilogram, so the same reboiler duty takes more kilograms of it.',
    },
    {
      id: 'ddgs-fuel',
      unit: 'Dryers & DDGS',
      reading: `DDGS outlet moisture ${ddgsMoisture.toFixed(1)}% against ${REFERENCE.ddgsOutletMoisturePct}% reference`,
      target: 'Dryer fuel',
      factor: fuelFactor,
      changePct: pct(fuelFactor),
      basis:
        'Dryer fuel evaporates water, so what counts is the water removed per tonne of dry solids.',
    },
  ];

  // Cross-checks. These do not change a number; they say when two readings
  // describe different plants. Both of these caught a real error: the sample
  // beer feed rate and dryer throughput were sized for a 2,936 t/day plant.
  const impliedBeerGpm =
    abv > 0
      ? (adjustedEthanolKl * 1000) / (abv / 100) / LITRES_PER_GALLON / 1440
      : 0;
  const impliedDdgsTph = (grainInputTpd * DDGS_TONNES_PER_TONNE_GRAIN) / 24;

  const deviation = (entered: number, implied: number) =>
    implied > 0 ? (entered - implied) / implied : 0;

  const beerDeviation = deviation(beerGpm, impliedBeerGpm);
  const ddgsDeviation = deviation(ddgsTph, impliedDdgsTph);

  const crossChecks: CrossCheck[] = [
    {
      id: 'beer-feed',
      label: 'Beer feed rate against grain and ABV',
      entered: `${beerGpm.toFixed(0)} GPM`,
      implied: `${impliedBeerGpm.toFixed(0)} GPM`,
      deviation: beerDeviation,
      ok: Math.abs(beerDeviation) <= 0.15,
      note: 'Beer flow is fixed by how much ethanol you make and how strong it is. A large gap means one of the three readings is wrong.',
    },
    {
      id: 'ddgs-rate',
      label: 'Dryer throughput against grain',
      entered: `${ddgsTph.toFixed(2)} TPH`,
      implied: `${impliedDdgsTph.toFixed(2)} TPH`,
      deviation: ddgsDeviation,
      ok: Math.abs(ddgsDeviation) <= 0.15,
      note: 'A bushel of corn leaves about 17.5 lb of DDGS, so the dryer rate follows the mill rate.',
    },
  ];

  const adjusted = {
    electricityKwh: baseline.electricityKwh,
    distillationSteamKg: baseline.distillationSteamKg * abvFactor * pressureFactor,
    dryerFuelMmbtu: baseline.dryerFuelMmbtu * fuelFactor,
    ethanolKl: adjustedEthanolKl,
  };

  return {
    baseline: { ...baseline, ethanolKl: baselineEthanolKl },
    adjusted,
    adjustments,
    crossChecks,
    liquefactionSteamKg: liquefactionSteamKg(grainInputTpd, moisture, cookTemp, pressure),
    atReference: adjustments.every((a) => Math.abs(a.factor - 1) < 1e-12),
  };
}

/**
 * The readings that are recorded and shown but do not move a number, with the
 * reason in each case. Listing these by name is the point: an operator should be
 * able to see which of their inputs the dashboard is actually using.
 */
export function unmodelledReadings(readings: ProcessValues): UnmodelledReading[] {
  return [
    {
      unit: 'Milling',
      label: 'Screen size',
      value: `${readings.milling.screenSize.toFixed(1)} mm`,
      reason:
        'Grind fineness does change mill power and starch conversion, but no coefficient for it can be recovered from the source data.',
    },
    {
      unit: 'Liquefaction',
      label: 'Slurry pH',
      value: readings.liquefaction.ph.toFixed(2),
      reason: 'Sets enzyme activity, which this project does not model.',
    },
    {
      unit: 'Liquefaction',
      label: 'Alpha-amylase dose',
      value: `${readings.liquefaction.enzymeDose.toFixed(1)} kg/h`,
      reason: 'An operating cost, not an energy input. Nothing here prices enzyme.',
    },
    {
      unit: 'Fermentation',
      label: 'Mash temperature',
      value: `${readings.fermentation.temp.toFixed(1)} °F`,
      reason:
        'Drives the fermenter cooling load, and there is no chiller in the model to carry it.',
    },
    {
      unit: 'Fermentation',
      label: 'Fermentation time',
      value: `${readings.fermentation.durationH.toFixed(1)} h`,
      reason: 'Sets tank turns rather than consumption at a given throughput.',
    },
    {
      unit: 'Dryers & DDGS',
      label: 'Dryer inlet temperature',
      value: `${readings.drying.inletTemp.toFixed(0)} °F`,
      reason:
        'Affects dryer efficiency, but the efficiency curve for this dryer is not in the data.',
    },
  ];
}
