/**
 * Reads an operator's own plant export and works out what can be said about it.
 *
 * Two deliberate choices shape this file.
 *
 * First, parsing happens in the browser. The file never leaves the machine; only
 * the derived summary is sent anywhere. A plant's production history is
 * commercially sensitive and there is no reason for a chat endpoint to hold it.
 *
 * Second, the summary is statistics, not rows. Sending thousands of readings to
 * a language model would cost a fortune in tokens, blow the context, and get you
 * an answer about whichever rows happened to survive truncation. Aggregates are
 * both cheaper and more honest: the model gets the whole file's shape rather
 * than an arbitrary window of it.
 *
 * Where the export contains columns the trained network recognises, their real
 * figures are scored against its predictions. That comparison is the useful part
 * and it is arithmetic, not the model's opinion.
 */

import { predictConsumption, type AnnModel } from './annModel';

export const DATASET_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  rows: 20_000,
  columns: 120,
  /** Columns reported individually. Beyond this only the count is mentioned. */
  reportedColumns: 14,
} as const;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Rows present in the file beyond the parse cap, if any. */
  truncatedRows: number;
}

export class DatasetError extends Error {}

/**
 * Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF.
 *
 * Hand-rolled rather than pulled in, because a CSV dependency is a lot of bytes
 * for one screen and the format's awkward parts are only the quoting rules.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let truncatedRows = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };

  const endRow = () => {
    endField();
    // Skip the blank row a trailing newline produces.
    if (row.length > 1 || row[0] !== '') {
      if (rows.length < DATASET_LIMITS.rows + 1) rows.push(row);
      else truncatedRows += 1;
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }

  if (field !== '' || row.length > 0) endRow();

  if (rows.length === 0) throw new DatasetError('That file has no rows in it.');

  const headers = rows[0].map((h) => h.trim());
  if (headers.length > DATASET_LIMITS.columns) {
    throw new DatasetError(
      `That file has ${headers.length} columns, more than the ${DATASET_LIMITS.columns} this can handle.`
    );
  }

  const body = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (body.length === 0) throw new DatasetError('That file has a header but no data rows.');

  return { headers, rows: body, truncatedRows };
}

export interface ColumnStats {
  name: string;
  count: number;
  missing: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  // Strips thousands separators and stray currency/unit decoration.
  const cleaned = raw.trim().replace(/,/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function columnStats(headers: string[], rows: string[][]): ColumnStats[] {
  return headers
    .map((name, index) => {
      const values: number[] = [];
      let missing = 0;

      for (const row of rows) {
        const value = toNumber(row[index]);
        if (value === null) missing += 1;
        else values.push(value);
      }

      // A column that is mostly text is a label, not a measurement.
      if (values.length < rows.length * 0.5 || values.length === 0) return null;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length - 1);

      return {
        name,
        count: values.length,
        missing,
        min: Math.min(...values),
        max: Math.max(...values),
        mean,
        stdDev: Math.sqrt(variance),
      };
    })
    .filter((stats): stats is ColumnStats => stats !== null);
}

/* -------------------------------------------------------------------------- */
/* Matching an export's columns to what the network knows                      */
/* -------------------------------------------------------------------------- */

interface KnownColumn {
  target: string;
  label: string;
  unit: string;
  aliases: string[];
}

const KNOWN_COLUMNS: KnownColumn[] = [
  {
    target: 'Grain_Input_tpd',
    label: 'Grain input',
    unit: 't/day',
    aliases: ['graininputtpd', 'graininput', 'grain', 'feedstock', 'corninput', 'throughput'],
  },
  {
    target: 'Total_Process_Electricity_kWh',
    label: 'Process electricity',
    unit: 'kWh/day',
    aliases: ['totalprocesselectricitykwh', 'processelectricity', 'electricity', 'power', 'kwh'],
  },
  {
    target: 'Distillation_Steam_kg',
    label: 'Distillation steam',
    unit: 'kg/day',
    aliases: ['distillationsteamkg', 'distillationsteam', 'steam', 'steamkg'],
  },
  {
    target: 'DDGS_Dryer_Fuel_MMBtu',
    label: 'Dryer fuel',
    unit: 'MMBtu/day',
    aliases: ['ddgsdryerfuelmmbtu', 'dryerfuel', 'fuel', 'mmbtu', 'gas'],
  },
];

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Exact alias first, then substring, so `Distillation_Steam_kg` beats `Steam`. */
function matchColumn(known: KnownColumn, stats: ColumnStats[]): ColumnStats | null {
  const exact = stats.find((s) => known.aliases.includes(normalise(s.name)));
  if (exact) return exact;

  return (
    stats.find((s) => known.aliases.some((alias) => normalise(s.name).includes(alias))) ?? null
  );
}

export interface ModelComparison {
  target: string;
  label: string;
  unit: string;
  matchedColumn: string;
  meanActual: number;
  meanPredicted: number;
  /** Positive means the plant uses more than the model expects. */
  biasPct: number;
  meanAbsErrorPct: number;
  /** How much of their variance the model explains. Can be negative. */
  r2: number;
}

export interface DatasetSummary {
  fileName: string;
  rowCount: number;
  columnCount: number;
  truncatedRows: number;
  numericColumns: ColumnStats[];
  grainColumn: string | null;
  comparisons: ModelComparison[];
  warnings: string[];
}

function compare(
  model: AnnModel,
  grainValues: number[],
  actual: number[],
  index: 0 | 1 | 2,
  known: KnownColumn,
  matchedColumn: string
): ModelComparison | null {
  const predicted = grainValues.map((grain) => {
    const c = predictConsumption(model, grain);
    return [c.electricityKwh, c.distillationSteamKg, c.dryerFuelMmbtu][index];
  });

  const meanActual = actual.reduce((s, v) => s + v, 0) / actual.length;
  if (meanActual === 0) return null;

  const meanPredicted = predicted.reduce((s, v) => s + v, 0) / predicted.length;

  const ssRes = actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0);
  const ssTot = actual.reduce((s, v) => s + (v - meanActual) ** 2, 0);

  const meanAbsError =
    actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / actual.length;

  return {
    target: known.target,
    label: known.label,
    unit: known.unit,
    matchedColumn,
    meanActual,
    meanPredicted,
    biasPct: ((meanActual - meanPredicted) / meanActual) * 100,
    meanAbsErrorPct: (meanAbsError / meanActual) * 100,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
  };
}

export function analyseDataset(
  fileName: string,
  parsed: ParsedCsv,
  model: AnnModel | null
): DatasetSummary {
  const stats = columnStats(parsed.headers, parsed.rows);
  const warnings: string[] = [];

  if (parsed.truncatedRows > 0) {
    warnings.push(
      `Only the first ${DATASET_LIMITS.rows.toLocaleString()} rows were read; ${parsed.truncatedRows.toLocaleString()} were ignored.`
    );
  }
  if (stats.length === 0) {
    warnings.push('No numeric columns were found, so there is nothing to compute from.');
  }

  const grainKnown = KNOWN_COLUMNS[0];
  const grainStats = matchColumn(grainKnown, stats);
  const comparisons: ModelComparison[] = [];

  if (!grainStats) {
    warnings.push(
      'No grain throughput column was recognised, so the figures could not be scored against the model. Name it Grain_Input_tpd to enable that.'
    );
  } else if (model) {
    const grainIndex = parsed.headers.indexOf(grainStats.name);

    for (let i = 1; i < KNOWN_COLUMNS.length; i++) {
      const known = KNOWN_COLUMNS[i];
      const matched = matchColumn(known, stats);
      if (!matched) continue;

      const columnIndex = parsed.headers.indexOf(matched.name);
      const grainValues: number[] = [];
      const actual: number[] = [];

      // Only rows where both sides are present can be compared.
      for (const row of parsed.rows) {
        const grain = toNumber(row[grainIndex]);
        const value = toNumber(row[columnIndex]);
        if (grain === null || value === null) continue;
        grainValues.push(grain);
        actual.push(value);
      }

      if (grainValues.length < 5) continue;

      const result = compare(model, grainValues, actual, (i - 1) as 0 | 1 | 2, known, matched.name);
      if (result) comparisons.push(result);
    }

    if (comparisons.length === 0) {
      warnings.push(
        'A grain column was found but no consumption columns were, so nothing could be scored.'
      );
    }
  }

  return {
    fileName,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    truncatedRows: parsed.truncatedRows,
    numericColumns: stats,
    grainColumn: grainStats?.name ?? null,
    comparisons,
    warnings,
  };
}

const round = (value: number, dp = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(dp)) : 0;

/**
 * The compact form sent to the model.
 *
 * Kept small on purpose: a handful of lines per column rather than the file.
 */
export function summaryForPrompt(summary: DatasetSummary): string {
  const lines: string[] = [
    `File: ${summary.fileName}`,
    `Rows: ${summary.rowCount}, columns: ${summary.columnCount}`,
    '',
    'Column statistics (min / max / mean / sd):',
  ];

  for (const column of summary.numericColumns.slice(0, DATASET_LIMITS.reportedColumns)) {
    lines.push(
      `  ${column.name}: ${round(column.min)} / ${round(column.max)} / ${round(column.mean)} / ${round(column.stdDev)}` +
        (column.missing > 0 ? ` (${column.missing} missing)` : '')
    );
  }

  const hidden = summary.numericColumns.length - DATASET_LIMITS.reportedColumns;
  if (hidden > 0) lines.push(`  ...and ${hidden} further numeric columns`);

  if (summary.comparisons.length > 0) {
    lines.push('', 'Measured against the trained consumption model:');
    for (const c of summary.comparisons) {
      lines.push(
        `  ${c.label} (${c.matchedColumn}): actual mean ${round(c.meanActual, 1)} ${c.unit}, ` +
          `model predicts ${round(c.meanPredicted, 1)}, ` +
          `bias ${c.biasPct >= 0 ? '+' : ''}${round(c.biasPct, 1)}%, ` +
          `mean abs error ${round(c.meanAbsErrorPct, 1)}%, R2 ${round(c.r2, 3)}`
      );
    }
    lines.push(
      '',
      'Bias above zero means the plant consumes more than the model expects for its throughput.'
    );
  }

  if (summary.warnings.length > 0) {
    lines.push('', 'Caveats:');
    for (const warning of summary.warnings) lines.push(`  - ${warning}`);
  }

  return lines.join('\n');
}
