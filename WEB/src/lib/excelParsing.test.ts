import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelWorkbook } from './datasetAnalysis';
import { generateProcessTemplate } from './excelTemplate';
import { suggestReadings, toProcessValues } from './datasetReadings';
import { columnStats } from './datasetAnalysis';

describe('Excel Parsing and Template Generation', () => {
  it('generates a valid .xlsx template and parses it back', async () => {
    const templateBlob = generateProcessTemplate();
    const arrayBuffer = await templateBlob.arrayBuffer();

    const parsed = parseExcelWorkbook(arrayBuffer, 'template.xlsx');

    expect(parsed.headers.length).toBeGreaterThan(5);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(1);

    const stats = columnStats(parsed.headers, parsed.rows);
    const suggestion = suggestReadings(stats);

    expect(suggestion.readings.length).toBeGreaterThanOrEqual(10);

    const grainReading = suggestion.readings.find(
      (r) => r.unitId === 'milling' && r.fieldKey === 'feedRate'
    );
    expect(grainReading).toBeDefined();
    expect(grainReading?.value).toBeCloseTo(147.4, 1);
  });

  it('correctly parses custom multi-row tabular Excel data', () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Grain_Input_tpd', 'Grain_Moisture', 'Reflux_Ratio', 'Final_Beer_ABV'];
    const rows = [
      [150.0, 14.5, 2.7, 14.8],
      [152.0, 14.2, 2.8, 15.0],
      [148.0, 14.0, 2.6, 14.6],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Readings');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const parsed = parseExcelWorkbook(buffer, 'test.xlsx');

    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toHaveLength(3);

    const stats = columnStats(parsed.headers, parsed.rows);
    const suggestion = suggestReadings(stats);

    const values = toProcessValues(suggestion.readings);
    expect(values.milling?.feedRate).toBeCloseTo(150.0, 1);
    expect(values.distillation?.refluxRatio).toBeCloseTo(2.7, 1);
    expect(values.fermentation?.abv).toBeCloseTo(14.8, 1);
  });
});
