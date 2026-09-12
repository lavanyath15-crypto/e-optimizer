/**
 * An operator's own file is the least predictable input this project takes, so
 * the parser has to survive bad shapes without throwing on the UI thread, and
 * the summary must never smuggle raw rows out to the model.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnnModel } from './annModel';
import {
  DATASET_LIMITS,
  DatasetError,
  analyseDataset,
  columnStats,
  detectDelimiter,
  detectTimeSpan,
  parseCsv,
  parseDataset,
  pearson,
  qualityFlags,
  summaryForPrompt,
} from './datasetAnalysis';

const model: AnnModel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/model/ann.json', import.meta.url)), 'utf-8')
);

describe('parseCsv', () => {
  it('parses a plain file', () => {
    const parsed = parseCsv('a,b\n1,2\n3,4\n');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles quoted fields containing commas and newlines', () => {
    const parsed = parseCsv('name,note\n"Boiler, B-1","line one\nline two"\n');
    expect(parsed.rows[0]).toEqual(['Boiler, B-1', 'line one\nline two']);
  });

  it('handles escaped quotes', () => {
    const parsed = parseCsv('a\n"say ""hi"""\n');
    expect(parsed.rows[0][0]).toBe('say "hi"');
  });

  it('handles CRLF line endings', () => {
    const parsed = parseCsv('a,b\r\n1,2\r\n');
    expect(parsed.rows).toEqual([['1', '2']]);
  });

  it('ignores a trailing newline rather than emitting a blank row', () => {
    expect(parseCsv('a\n1\n').rows).toHaveLength(1);
    expect(parseCsv('a\n1').rows).toHaveLength(1);
  });

  it('drops entirely blank rows', () => {
    expect(parseCsv('a,b\n1,2\n,\n3,4\n').rows).toHaveLength(2);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsv('')).toThrow(DatasetError);
  });

  it('rejects a header with no data', () => {
    expect(() => parseCsv('a,b\n')).toThrow(/no data rows/i);
  });

  it('rejects absurdly wide files', () => {
    const wide = Array.from({ length: DATASET_LIMITS.columns + 5 }, (_, i) => `c${i}`).join(',');
    expect(() => parseCsv(`${wide}\n${wide}\n`)).toThrow(/columns/);
  });

  it('caps row count and reports what it skipped', () => {
    const rows = Array.from({ length: DATASET_LIMITS.rows + 50 }, (_, i) => `${i}`).join('\n');
    const parsed = parseCsv(`a\n${rows}\n`);

    expect(parsed.rows.length).toBeLessThanOrEqual(DATASET_LIMITS.rows + 1);
    expect(parsed.truncatedRows).toBeGreaterThan(0);
  });
});

describe('columnStats', () => {
  it('computes stats for numeric columns only', () => {
    const parsed = parseCsv('label,value\nalpha,10\nbeta,20\ngamma,30\n');
    const stats = columnStats(parsed.headers, parsed.rows);

    expect(stats.map((s) => s.name)).toEqual(['value']);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(30);
    expect(stats[0].mean).toBeCloseTo(20, 9);
  });

  it('strips thousands separators', () => {
    const parsed = parseCsv('v\n"1,200"\n"2,400"\n');
    const stats = columnStats(parsed.headers, parsed.rows);
    expect(stats[0].mean).toBeCloseTo(1800, 9);
  });

  it('counts a gap in an otherwise populated row, without skewing the mean', () => {
    // A wholly blank line is dropped by the parser: that is a formatting artefact,
    // not a missing reading. A gap in a real row is the case that matters.
    const parsed = parseCsv('v,w\n10,1\n,2\n20,3\n');
    const stats = columnStats(parsed.headers, parsed.rows);
    const v = stats.find((s) => s.name === 'v')!;

    expect(v.count).toBe(2);
    expect(v.missing).toBe(1);
    expect(v.mean).toBeCloseTo(15, 9);
  });

  it('drops a wholly blank line rather than counting it as missing', () => {
    const parsed = parseCsv('v\n10\n\n20\n');
    const stats = columnStats(parsed.headers, parsed.rows);

    expect(parsed.rows).toHaveLength(2);
    expect(stats[0].missing).toBe(0);
  });

  it('ignores a column that is mostly text', () => {
    const parsed = parseCsv('v\nn/a\nn/a\nn/a\n7\n');
    expect(columnStats(parsed.headers, parsed.rows)).toHaveLength(0);
  });
});

describe('analyseDataset', () => {
  const csv = [
    'Date,Grain_Input_tpd,Total_Process_Electricity_kWh,Distillation_Steam_kg,Operator',
    '2026-01-01,147.4,2662,105168,A. Vance',
    '2026-01-02,149.0,2618,98593,A. Vance',
    '2026-01-03,140.1,2543,86767,B. Shah',
    '2026-01-04,139.4,2533,84913,B. Shah',
    '2026-01-05,156.8,3011,106396,A. Vance',
    '2026-01-06,151.2,2740,99120,B. Shah',
    '',
  ].join('\n');

  it('recognises the grain column and scores consumption against the model', () => {
    const summary = analyseDataset('plant.csv', parseCsv(csv), model);

    expect(summary.grainColumn).toBe('Grain_Input_tpd');
    expect(summary.comparisons.map((c) => c.target)).toContain('Distillation_Steam_kg');
    expect(summary.comparisons.map((c) => c.target)).toContain(
      'Total_Process_Electricity_kWh'
    );
  });

  it('produces finite comparison figures', () => {
    const summary = analyseDataset('plant.csv', parseCsv(csv), model);

    for (const c of summary.comparisons) {
      expect(Number.isFinite(c.meanActual)).toBe(true);
      expect(Number.isFinite(c.meanPredicted)).toBe(true);
      expect(Number.isFinite(c.biasPct)).toBe(true);
      expect(Number.isFinite(c.r2)).toBe(true);
    }
  });

  it('warns rather than throws when no grain column exists', () => {
    const summary = analyseDataset('odd.csv', parseCsv('x,y\n1,2\n3,4\n5,6\n'), model);

    expect(summary.comparisons).toEqual([]);
    expect(summary.warnings.join(' ')).toMatch(/grain throughput column/i);
  });

  it('works without a model, just without the comparison', () => {
    const summary = analyseDataset('plant.csv', parseCsv(csv), null);

    expect(summary.comparisons).toEqual([]);
    expect(summary.numericColumns.length).toBeGreaterThan(0);
  });

  it('leaves a text column out of the numeric summary', () => {
    const summary = analyseDataset('plant.csv', parseCsv(csv), model);
    expect(summary.numericColumns.map((c) => c.name)).not.toContain('Operator');
  });
});

describe('summaryForPrompt', () => {
  const csv = [
    'Grain_Input_tpd,Distillation_Steam_kg,Operator',
    '147.4,105168,A. Vance',
    '149.0,98593,A. Vance',
    '140.1,86767,B. Shah',
    '139.4,84913,B. Shah',
    '156.8,106396,A. Vance',
    '151.2,99120,B. Shah',
    '',
  ].join('\n');

  const prompt = summaryForPrompt(analyseDataset('plant.csv', parseCsv(csv), model));

  it('carries the shape of the file and the comparison', () => {
    expect(prompt).toContain('plant.csv');
    expect(prompt).toContain('Rows: 6');
    expect(prompt).toMatch(/bias/i);
  });

  // The whole privacy claim rests on this: statistics go out, rows do not.
  it('does not leak individual row values', () => {
    expect(prompt).not.toContain('105168');
    expect(prompt).not.toContain('A. Vance');
    expect(prompt).not.toContain('B. Shah');
  });

  it('stays small enough for the backend to accept', () => {
    expect(prompt.length).toBeLessThan(6_000);
  });

  it('caps how many columns it lists', () => {
    const many = Array.from({ length: 40 }, (_, i) => `col${i}`).join(',');
    const row = Array.from({ length: 40 }, (_, i) => `${i + 1}`).join(',');
    const wide = summaryForPrompt(
      analyseDataset('wide.csv', parseCsv(`${many}\n${row}\n${row}\n${row}\n`), model)
    );

    expect(wide).toMatch(/further numeric columns/);
  });
});

describe('detectDelimiter', () => {
  it('finds comma, tab, semicolon and pipe', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
    expect(detectDelimiter('a;b;c\n1;2;3\n')).toBe(';');
    expect(detectDelimiter('a|b|c\n1|2|3\n')).toBe('|');
  });

  it('is not fooled by a delimiter inside a quoted header', () => {
    // European export: semicolon separated, comma inside a quoted name.
    expect(detectDelimiter('"Boiler, B-1";steam;temp\n1;2;3\n')).toBe(';');
  });

  it('defaults to comma for a single column', () => {
    expect(detectDelimiter('value\n1\n2\n')).toBe(',');
  });
});

describe('parseDataset', () => {
  it('reads a tab-separated export', () => {
    const parsed = parseDataset('a\tb\n1\t2\n3\t4\n');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('reads a semicolon-separated export', () => {
    const parsed = parseDataset('a;b\n1;2\n');
    expect(parsed.headers).toEqual(['a', 'b']);
  });

  it('reads a JSON array of rows', () => {
    const parsed = parseDataset('[{"a":1,"b":2},{"a":3,"b":4}]', 'x.json');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('reads the common JSON wrapper shapes', () => {
    expect(parseDataset('{"data":[{"a":1}]}').headers).toEqual(['a']);
    expect(parseDataset('{"rows":[{"b":2}]}').headers).toEqual(['b']);
  });

  it('takes the union of keys, so a field missing from row one survives', () => {
    const parsed = parseDataset('[{"a":1},{"a":2,"b":9}]');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows[0]).toEqual(['1', '']);
  });

  it('rejects JSON with no rows', () => {
    expect(() => parseDataset('{"nothing":true}')).toThrow(DatasetError);
    expect(() => parseDataset('[]')).toThrow(DatasetError);
  });

  it('rejects malformed JSON with a clear message', () => {
    expect(() => parseDataset('{ broken', 'x.json')).toThrow(/not valid JSON/i);
  });
});

describe('pearson', () => {
  it('is 1 for a perfect positive relationship', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 9);
  });

  it('is -1 for a perfect inverse relationship', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 9);
  });

  it('is 0 when either side is constant, rather than NaN', () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
    expect(Number.isFinite(pearson([5, 5, 5], [1, 2, 3]))).toBe(true);
  });

  it('is 0 with too few points to mean anything', () => {
    expect(pearson([1], [2])).toBe(0);
  });
});

describe('qualityFlags', () => {
  const base = { count: 100, missing: 0, min: 1, max: 10, mean: 5, stdDev: 2, constant: false };

  it('flags a constant column', () => {
    const flags = qualityFlags([{ ...base, name: 'Setpoint', min: 5, max: 5, constant: true }], 100);
    expect(flags.join(' ')).toMatch(/Constant across every row/);
  });

  it('flags a column with many gaps', () => {
    const flags = qualityFlags([{ ...base, name: 'pH', missing: 40 }], 100);
    expect(flags.join(' ')).toMatch(/missing/i);
  });

  it('flags a negative value in a quantity that cannot go below zero', () => {
    const flags = qualityFlags([{ ...base, name: 'Distillation_Steam_kg', min: -12 }], 100);
    expect(flags.join(' ')).toMatch(/Negative values/);
  });

  it('says nothing about a clean dataset', () => {
    expect(qualityFlags([{ ...base, name: 'Grain_Input_tpd' }], 100)).toEqual([]);
  });
});

describe('detectTimeSpan', () => {
  it('finds the period from a date column', () => {
    const parsed = parseDataset('Date,v\n2026-01-01,1\n2026-01-10,2\n2026-01-05,3\n');
    const span = detectTimeSpan(parsed.headers, parsed.rows);

    expect(span?.column).toBe('Date');
    expect(span?.from).toBe('2026-01-01');
    expect(span?.to).toBe('2026-01-10');
    expect(span?.days).toBe(10);
  });

  it('returns null when there is no date column', () => {
    const parsed = parseDataset('a,b\n1,2\n3,4\n');
    expect(detectTimeSpan(parsed.headers, parsed.rows)).toBeNull();
  });

  it('ignores a date-named column that does not parse', () => {
    const parsed = parseDataset('Date,v\nnot-a-date,1\nalso-not,2\n');
    expect(detectTimeSpan(parsed.headers, parsed.rows)).toBeNull();
  });
});
