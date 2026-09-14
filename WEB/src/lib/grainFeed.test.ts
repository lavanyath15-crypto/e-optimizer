/**
 * The feed-rate conversion is the one link between a reading typed on the
 * Process Monitor and the model's input, so an error here silently shifts every
 * prediction on that screen.
 */

import { describe, expect, it } from 'vitest';
import {
  KG_PER_BUSHEL_CORN,
  bushelsPerHourToTonnesPerDay,
  tonnesPerDayToBushelsPerHour,
} from './grainFeed';
import { PROCESS_DEFAULTS, PROCESS_UNITS, type ProcessValues } from '../data/processUnits';
import {
  DEFAULT_GRAIN_INPUT_TPD,
  GRAIN_INPUT_MAX_TPD,
  GRAIN_INPUT_MIN_TPD,
  refluxOf,
  throughputOf,
} from '../hooks/usePlantInput';

describe('KG_PER_BUSHEL_CORN', () => {
  it('is 56 lb, the legal definition for corn', () => {
    expect(KG_PER_BUSHEL_CORN).toBeCloseTo(25.4012, 4);
  });
});

describe('bushelsPerHourToTonnesPerDay', () => {
  it('converts the dashboard default to its nominal throughput', () => {
    // 242 bu/hr is the milling default, and 147.4 t/day is the throughput used
    // everywhere else. They have to agree or the screens contradict each other.
    expect(bushelsPerHourToTonnesPerDay(242)).toBeCloseTo(147.5, 1);
  });

  it('is zero at zero', () => {
    expect(bushelsPerHourToTonnesPerDay(0)).toBe(0);
  });

  it('scales linearly', () => {
    const single = bushelsPerHourToTonnesPerDay(100);
    expect(bushelsPerHourToTonnesPerDay(200)).toBeCloseTo(single * 2, 9);
  });

  it('round-trips', () => {
    for (const tpd of [124.5, 147.4, 165, 200]) {
      expect(bushelsPerHourToTonnesPerDay(tonnesPerDayToBushelsPerHour(tpd))).toBeCloseTo(tpd, 9);
    }
  });
});

describe('the milling field agrees with the model', () => {
  const milling = PROCESS_UNITS.find((u) => u.id === 'milling')!;
  const feedRate = milling.fields.find((f) => f.key === 'feedRate')!;

  it('is in tonnes per day, the unit the dataset and every screen use', () => {
    // It was in bushels per hour, which made the one figure driving the whole
    // dashboard the only one an operator had to convert in their head.
    expect(feedRate.unit).toBe('t/day');
  });

  it('defaults to the dataset nominal exactly, with no conversion', () => {
    expect(PROCESS_DEFAULTS.milling.feedRate).toBe(147.4);
  });

  it('has a normal band that is the trained range itself', () => {
    expect(feedRate.normalMin).toBe(124.5);
    expect(feedRate.normalMax).toBe(165);
  });

  it('bounds the input at something a plant could run', () => {
    expect(feedRate.min).toBeGreaterThan(0);
    expect(feedRate.max).toBe(400);
  });

  it('exposes the same bounds through the store as the field carries', () => {
    expect(GRAIN_INPUT_MIN_TPD).toBe(feedRate.min);
    expect(GRAIN_INPUT_MAX_TPD).toBe(feedRate.max);
    expect(DEFAULT_GRAIN_INPUT_TPD).toBe(PROCESS_DEFAULTS.milling.feedRate);
  });
});

describe('throughputOf and refluxOf', () => {
  const readings: ProcessValues = {
    milling: { feedRate: 152.4, moisture: 14.2, screenSize: 3.2 },
    liquefaction: { cookTemp: 225.4, ph: 5.65, enzymeDose: 12.5 },
    fermentation: { abv: 14.82, temp: 89.2, durationH: 54 },
    distillation: { steamPressure: 148.5, refluxRatio: 2.3, feedRate: 1420 },
    drying: { throughput: 38.2, outletMoisture: 9.8, inletTemp: 410 },
  };

  it('takes throughput straight from the milling reading', () => {
    // The regression this guards: throughput used to be stored beside the
    // readings, so the advisory card could change one without the other and
    // Overview would show one plant while Carbon computed another. It is now the
    // reading itself, so there is no second copy and no conversion between them.
    expect(throughputOf(readings)).toBe(152.4);
  });

  it('derives reflux from the beer column reading', () => {
    expect(refluxOf(readings)).toBe(2.3);
  });
});
