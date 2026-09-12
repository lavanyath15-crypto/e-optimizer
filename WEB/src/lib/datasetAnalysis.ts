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
export const SUPPORTED_DELIMITERS = [',', '\t', ';', '|'] as const;

/**
 * Works out the separator from the header line.
 *
 * Historians export whatever their locale prefers: comma in the US, semicolon
 * across much of Europe (where the comma is the decimal point), tab from most
 * SCADA exports. Guessing is better than making the operator convert the file.
 *
 * The header is used rather than the whole file because it is the one line
 * guaranteed to have a value in every column.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, 10_000).split(/\r?\n/).find((line) => line.trim() !== '');
  if (!firstLine) return ',';

  let best = ',';
  let bestCount = 0;

  for (const candidate of SUPPORTED_DELIMITERS) {
    // Counted outside quotes, so a comma inside "Boiler, B-1" does not win.
    let count = 0;
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === candidate) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

export function parseCsv(text: string, delimiter = ','): ParsedCsv {
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
    else if (char === delimiter) endField();
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

/**
 * JSON exports, as an array of row objects.
 *
 * Also accepts the common wrapper shapes ({ data: [...] }, { rows: [...] }),
 * because that is what most historian REST endpoints hand back.
 */
export function parseJsonRows(text: string): ParsedCsv {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DatasetError('That file is not valid JSON.');
  }

  const container = value as Record<string, unknown> | unknown[];
  const array = Array.isArray(container)
    ? container
    : (['data', 'rows', 'records', 'results'] as const)
        .map((key) => (container as Record<string, unknown>)?.[key])
        .find(Array.isArray);

  if (!Array.isArray(array) || array.length === 0) {
    throw new DatasetError('That JSON has no array of rows in it.');
  }

  const objects = array.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)
  );
  if (objects.length === 0) {
    throw new DatasetError('That JSON array does not contain row objects.');
  }

  // Union of keys, so a field missing from the first row is not lost. Order
  // follows first appearance, which keeps the original column order.
  const headers: string[] = [];
  for (const row of objects.slice(0, 200)) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  if (headers.length > DATASET_LIMITS.columns) {
    throw new DatasetError(
      `That file has ${headers.length} fields, more than the ${DATASET_LIMITS.columns} this can handle.`
    );
  }

  const capped = objects.slice(0, DATASET_LIMITS.rows);
  return {
    headers,
    rows: capped.map((row) =>
      headers.map((key) => {
        const cell = row[key];
        return cell === null || cell === undefined ? '' : String(cell);
      })
    ),
    truncatedRows: objects.length - capped.length,
  };
}

/**
 * One entry point for whatever the operator has.
 *
 * Dispatches on content rather than the extension, because exports are routinely
 * named .txt or .dat regardless of what is inside them.
 */
export function parseDataset(text: string, fileName = ''): ParsedCsv {
  const trimmed = text.trimStart();

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || /\.json$/i.test(fileName)) {
    return parseJsonRows(text);
  }

  return parseCsv(text, detectDelimiter(text));
}

export interface ColumnStats {
  name: string;
  count: number;
  missing: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  /** True when every value is identical: a constant carries no information. */
  constant: boolean;
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

      const stdDev = Math.sqrt(variance);
      const min = Math.min(...values);
      const max = Math.max(...values);

      return {
        name,
        count: values.length,
        missing,
        min,
        max,
        mean,
        stdDev,
        constant: max === min,
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

/* -------------------------------------------------------------------------- */
/* Correlations and data quality                                               */
/* -------------------------------------------------------------------------- */

/** Pearson r. Returns 0 when either side is constant, where r is undefined. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;

  const meanX = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - meanX;
    const b = ys[i] - meanY;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }

  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

export interface Correlation {
  column: string;
  against: string;
  r: number;
}

/**
 * Every numeric column scored against each recognised consumption column.
 *
 * This is the part an operator cannot easily do themselves, and it is the whole
 * reason for uploading: it says which of their levers actually move consumption.
 * The project's own dataset found nothing above |r| = 0.19 outside throughput.
 * Their plant may differ, and that would be the finding.
 */
export function findCorrelations(
  headers: string[],
  rows: string[][],
  targets: { name: string; index: number }[]
): Correlation[] {
  const results: Correlation[] = [];

  for (const target of targets) {
    for (let col = 0; col < headers.length; col++) {
      if (col === target.index) continue;

      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of rows) {
        const x = toNumber(row[col]);
        const y = toNumber(row[target.index]);
        if (x === null || y === null) continue;
        xs.push(x);
        ys.push(y);
      }

      if (xs.length < 10) continue;

      const r = pearson(xs, ys);
      if (Number.isFinite(r) && r !== 0) {
        results.push({ column: headers[col], against: target.name, r });
      }
    }
  }

  // Strongest first, sign ignored: a strong negative is as interesting.
  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

/** Column-level problems worth telling an engineer about before they act. */
export function qualityFlags(stats: ColumnStats[], rowCount: number): string[] {
  const flags: string[] = [];

  const constants = stats.filter((s) => s.constant).map((s) => s.name);
  if (constants.length > 0) {
    flags.push(
      `Constant across every row, so they cannot explain anything: ${constants.slice(0, 6).join(', ')}${
        constants.length > 6 ? ` and ${constants.length - 6} more` : ''
      }.`
    );
  }

  const gappy = stats.filter((s) => s.missing > rowCount * 0.1);
  if (gappy.length > 0) {
    flags.push(
      `More than 10% of readings missing: ${gappy
        .slice(0, 6)
        .map((s) => `${s.name} (${Math.round((s.missing / rowCount) * 100)}%)`)
        .join(', ')}.`
    );
  }

  const negative = stats.filter((s) => s.min < 0 && /steam|fuel|energy|electric|flow|rate/i.test(s.name));
  if (negative.length > 0) {
    flags.push(
      `Negative values in a quantity that should not go below zero: ${negative
        .map((s) => s.name)
        .join(', ')}. Likely a sensor fault or a sign convention.`
    );
  }

  return flags;
}

/** First column that parses as dates, with the span it covers. */
export function detectTimeSpan(
  headers: string[],
  rows: string[][]
): { column: string; from: string; to: string; days: number } | null {
  for (let col = 0; col < headers.length; col++) {
    if (!/date|time|day|stamp/i.test(headers[col])) continue;

    const times = rows
      .map((row) => Date.parse(row[col] ?? ''))
      .filter((t) => Number.isFinite(t));

    if (times.length < rows.length * 0.8 || times.length === 0) continue;

    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      column: headers[col],
      from: new Date(min).toISOString().slice(0, 10),
      to: new Date(max).toISOString().slice(0, 10),
      days: Math.max(1, Math.round((max - min) / 86_400_000) + 1),
    };
  }

  return null;
}

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
  /** Strongest column-to-consumption relationships found in their data. */
  correlations: Correlation[];
  /** Column-level problems worth knowing before acting on any of it. */
  qualityFlags: string[];
  timeSpan: { column: string; from: string; to: string; days: number } | null;
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

  // Correlate every column against whichever consumption columns were found.
  // Limited to the strongest handful so the prompt stays small.
  const targets = KNOWN_COLUMNS.slice(1)
    .map((known) => matchColumn(known, stats))
    .filter((s): s is ColumnStats => s !== null)
    .map((s) => ({ name: s.name, index: parsed.headers.indexOf(s.name) }));

  const correlations =
    targets.length > 0 ? findCorrelations(parsed.headers, parsed.rows, targets).slice(0, 10) : [];

  return {
    fileName,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    truncatedRows: parsed.truncatedRows,
    numericColumns: stats,
    grainColumn: grainStats?.name ?? null,
    comparisons,
    correlations,
    qualityFlags: qualityFlags(stats, parsed.rows.length),
    timeSpan: detectTimeSpan(parsed.headers, parsed.rows),
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
  ];

  if (summary.timeSpan) {
    lines.push(
      `Period: ${summary.timeSpan.from} to ${summary.timeSpan.to} (${summary.timeSpan.days} days, from ${summary.timeSpan.column})`
    );
  }

  lines.push('', 'Column statistics (min / max / mean / sd):');

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

  if (summary.correlations.length > 0) {
    lines.push(
      '',
      'Strongest correlations found in this dataset (Pearson r):'
    );
    for (const c of summary.correlations) {
      lines.push(`  ${c.column} vs ${c.against}: r = ${round(c.r, 3)}`);
    }
    lines.push(
      'For reference, in the synthetic dataset the model was trained on, nothing except throughput exceeded |r| = 0.19.'
    );
  }

  if (summary.qualityFlags.length > 0) {
    lines.push('', 'Data quality:');
    for (const flag of summary.qualityFlags) lines.push(`  - ${flag}`);
  }

  if (summary.warnings.length > 0) {
    lines.push('', 'Caveats:');
    for (const warning of summary.warnings) lines.push(`  - ${warning}`);
  }

  return lines.join('\n');
}
