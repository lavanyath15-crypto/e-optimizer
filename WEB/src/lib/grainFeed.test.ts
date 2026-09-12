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
import { PROCESS_DEFAULTS, PROCESS_UNITS } from '../data/processUnits';

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
    // The hard max still allows extrapolation, which the UI warns about, but it
    // should not allow an absurd figure.
    expect(bushelsPerHourToTonnesPerDay(feedRate.max)).toBeLessThan(1500);
  });
});
