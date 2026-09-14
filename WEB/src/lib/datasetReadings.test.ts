/**
 * This writes straight into the operating point the whole dashboard runs on, so
 * a wrong mapping here is worse than no mapping at all.
 */

import { describe, expect, it } from 'vitest';
import { suggestReadings, toProcessValues } from './datasetReadings';
import type { ColumnStats } from './datasetAnalysis';
import { PROCESS_UNITS } from '../data/processUnits';

const col = (name: string, mean: number, count = 100): ColumnStats => ({
  name,
  count,
  missing: 0,
  min: mean,
  max: mean,
  mean,
  stdDev: 0,
  constant: true,
});

describe('suggestReadings', () => {
  it('matches the dataset\'s own column names', () => {
    const { readings } = suggestReadings([col('Grain_Input_tpd', 152.4)]);
    const grain = readings.find((r) => r.fieldKey === 'feedRate' && r.unitId === 'milling')!;

    expect(grain.value).toBeCloseTo(152.4, 6);
    expect(grain.column).toBe('Grain_Input_tpd');
    expect(grain.unit).toBe('t/day');
  });

  it('ignores punctuation and case in the header', () => {
    for (const header of ['grain input (tpd)', 'GRAININPUT', 'Grain-Input_TPD']) {
      const { readings } = suggestReadings([col(header, 140)]);
      expect(readings.some((r) => r.fieldKey === 'feedRate')).toBe(true);
    }
  });

  it('takes the mean, because an export covers a period', () => {
    const stats: ColumnStats = { ...col('Final_Beer_ABV', 14.2), min: 13, max: 15.4 };
    const { readings } = suggestReadings([stats]);
    expect(readings.find((r) => r.fieldKey === 'abv')!.value).toBeCloseTo(14.2, 6);
  });

  it('reports what no column covered', () => {
    const { readings, unmatched } = suggestReadings([col('Grain_Input_tpd', 150)]);
    const total = PROCESS_UNITS.reduce((n, u) => n + u.fields.length, 0);

    expect(readings).toHaveLength(1);
    expect(unmatched).toHaveLength(total - 1);
    expect(unmatched.every((u) => u.label && u.unitName)).toBe(true);
  });

  it('clamps an out-of-range column and says it did', () => {
    // A column in the wrong unit is the likeliest cause, and silently writing a
    // 4,000 t/day plant would be worse than flagging it.
    const { readings } = suggestReadings([col('Grain_Input_tpd', 4000)]);
    const grain = readings.find((r) => r.fieldKey === 'feedRate')!;

    expect(grain.clamped).toBe(true);
    expect(grain.value).toBe(400);
  });

  it('skips a column with no numbers in it', () => {
    const { readings } = suggestReadings([col('Grain_Input_tpd', NaN, 0)]);
    expect(readings).toHaveLength(0);
  });

  it('prefers the specific column name over a vague one', () => {
    // "throughput" could be the mill or the dryer. An explicit Grain_Input_tpd
    // in the same file has to win.
    const { readings } = suggestReadings([col('throughput', 999), col('Grain_Input_tpd', 150)]);
    const grain = readings.find((r) => r.unitId === 'milling' && r.fieldKey === 'feedRate')!;
    expect(grain.column).toBe('Grain_Input_tpd');
  });

  it('keeps the two feedRate fields apart', () => {
    // milling.feedRate and distillation.feedRate share a key. Mapping a beer
    // flow onto the grain input would silently move the whole dashboard.
    const { readings } = suggestReadings([
      col('Grain_Input_tpd', 150),
      col('Beer_Feed_Rate', 72),
    ]);

    expect(readings.find((r) => r.unitId === 'milling' && r.fieldKey === 'feedRate')!.value).toBe(150);
    expect(readings.find((r) => r.unitId === 'distillation' && r.fieldKey === 'feedRate')!.value).toBe(72);
  });
});

describe('toProcessValues', () => {
  it('groups readings by unit for applyProcessReadings', () => {
    const { readings } = suggestReadings([
      col('Grain_Input_tpd', 150),
      col('Grain_Moisture', 14.8),
      col('Reflux_Ratio', 2.6),
    ]);

    const patch = toProcessValues(readings);
    expect(patch.milling).toEqual({ feedRate: 150, moisture: 14.8 });
    expect(patch.distillation).toEqual({ refluxRatio: 2.6 });
    expect(patch.fermentation).toBeUndefined();
  });
});
