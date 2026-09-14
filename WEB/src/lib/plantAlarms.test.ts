/**
 * Alarms are the one place the dashboard tells an operator something is wrong,
 * so a stale or invented one is worse than none at all.
 */

import { describe, expect, it } from 'vitest';
import { deriveAlarms } from './plantAlarms';
import { PROCESS_DEFAULTS, PROCESS_UNITS, type ProcessValues } from '../data/processUnits';

function defaults(): ProcessValues {
  const fresh: ProcessValues = {};
  for (const unit of PROCESS_UNITS) {
    fresh[unit.id] = { ...PROCESS_DEFAULTS[unit.id] };
  }
  return fresh;
}

describe('deriveAlarms', () => {
  it('raises nothing when every reading is inside its band', () => {
    expect(deriveAlarms(defaults())).toEqual([]);
  });

  it('raises the reading the operator actually entered', () => {
    // The regression this guards: Overview listed a centrifuge vibration warning
    // and a beer well sensor fault from mockData, neither of which could change
    // when the operator entered a moisture two and a half points over band.
    const readings = defaults();
    readings.milling.moisture = 18.4;

    const alarms = deriveAlarms(readings);
    expect(alarms).toHaveLength(1);
    expect(alarms[0].title).toBe('Grain Moisture above band');
    expect(alarms[0].currentValue).toBe('18.4 %');
    expect(alarms[0].threshold).toBe('13.0 to 15.5 %');
    expect(alarms[0].unitId).toBe('milling');
  });

  it('names the direction, not just the fact', () => {
    const readings = defaults();
    readings.fermentation.abv = 11;

    const [alarm] = deriveAlarms(readings);
    expect(alarm.title).toBe('Final Beer ABV below band');
    expect(alarm.deviation).toBeCloseTo(2.5, 9);
  });

  it('calls a small excursion a warning and a large one critical', () => {
    // Moisture band is 13 to 15.5, so 2.5 wide. A quarter of that is 0.625.
    const small = defaults();
    small.milling.moisture = 15.9; // 0.4 over
    expect(deriveAlarms(small)[0].severity).toBe('warning');

    const large = defaults();
    large.milling.moisture = 17; // 1.5 over
    expect(deriveAlarms(large)[0].severity).toBe('critical');
  });

  it('puts the worst first', () => {
    const readings = defaults();
    readings.milling.moisture = 15.9; // warning
    readings.fermentation.abv = 5; // far below, critical

    const alarms = deriveAlarms(readings);
    expect(alarms).toHaveLength(2);
    expect(alarms[0].severity).toBe('critical');
    expect(alarms[0].fieldKey).toBe('abv');
  });

  it('ignores a missing or non-finite reading rather than alarming on it', () => {
    const readings = defaults();
    // @ts-expect-error deliberately corrupt, as stored JSON can be
    readings.drying.inletTemp = null;
    expect(deriveAlarms(readings)).toEqual([]);
  });
});
