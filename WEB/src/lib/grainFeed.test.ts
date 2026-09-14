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

  it('defaults to the nominal throughput used across the dashboard', () => {
    const tpd = bushelsPerHourToTonnesPerDay(PROCESS_DEFAULTS.milling.feedRate);
    expect(tpd).toBeGreaterThan(145);
    expect(tpd).toBeLessThan(150);
  });

  it('has a normal band that lands inside the trained range', () => {
    // The band used to be 3,000-3,800 bu/hr, about 2,100 t/day: a plant fourteen
    // times the one in the dataset. Submitting it would have pushed the network
    // far outside anything it had seen.
    const low = bushelsPerHourToTonnesPerDay(feedRate.normalMin);
    const high = bushelsPerHourToTonnesPerDay(feedRate.normalMax);

    expect(low).toBeGreaterThanOrEqual(124.5);
    expect(high).toBeLessThanOrEqual(165);
  });

  it('keeps the whole input range within what the model can be asked', () => {
    // The hard bounds on this field are the plant's throughput bounds, because
    // this field *is* the throughput. Capping tonnes downstream instead is what
    // let the bushel reading on screen and the tonnage the rest of the dashboard
    // ran on describe different plants.
    expect(bushelsPerHourToTonnesPerDay(feedRate.min)).toBeGreaterThan(0);
    expect(bushelsPerHourToTonnesPerDay(feedRate.max)).toBeCloseTo(400, 0);
  });

  it('exposes the same bounds through the store as the field carries', () => {
    expect(GRAIN_INPUT_MIN_TPD).toBeCloseTo(bushelsPerHourToTonnesPerDay(feedRate.min), 9);
    expect(GRAIN_INPUT_MAX_TPD).toBeCloseTo(bushelsPerHourToTonnesPerDay(feedRate.max), 9);
    expect(DEFAULT_GRAIN_INPUT_TPD).toBeCloseTo(
      bushelsPerHourToTonnesPerDay(PROCESS_DEFAULTS.milling.feedRate),
      9
    );
  });
});

describe('throughputOf and refluxOf', () => {
  const readings: ProcessValues = {
    milling: { feedRate: 230, moisture: 14.2, screenSize: 3.2 },
    liquefaction: { cookTemp: 225.4, ph: 5.65, enzymeDose: 12.5 },
    fermentation: { abv: 14.82, temp: 89.2, durationH: 54 },
    distillation: { steamPressure: 148.5, refluxRatio: 2.3, feedRate: 1420 },
    drying: { throughput: 38.2, outletMoisture: 9.8, inletTemp: 410 },
  };

  it('derives throughput from the milling feed rate rather than a stored copy', () => {
    // The regression this guards: throughput used to be stored beside the
    // readings, so the advisory card could change one without the other and
    // Overview would show 242 bu/hr while Carbon computed a different tonnage.
    expect(throughputOf(readings)).toBeCloseTo(bushelsPerHourToTonnesPerDay(230), 9);
  });

  it('derives reflux from the beer column reading', () => {
    expect(refluxOf(readings)).toBe(2.3);
  });
});
