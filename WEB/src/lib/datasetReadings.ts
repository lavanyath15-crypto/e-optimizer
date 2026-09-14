/**
 * Maps an uploaded export's columns onto the Process Monitor readings.
 *
 * Uploading a historian export and then retyping the same fifteen numbers by
 * hand is work the browser can do. This matches column names against each
 * field, takes the column mean as the operating point for the period, and hands
 * back a proposal the operator confirms rather than applying it silently.
 *
 * Two rules:
 *
 *  - A column has to match a field by name. Nothing is guessed from position or
 *    from the order of the columns, because a wrong guess here would quietly
 *    rewrite the operating point the whole dashboard runs on.
 *  - The mean is used, not the last row. An export covers a period, and the
 *    reading that describes that period is its average, not whichever row
 *    happened to be last.
 */

import {
  PROCESS_UNITS,
  clampToField,
  type ProcessField,
  type ProcessValues,
} from '../data/processUnits';
import type { ColumnStats } from './datasetAnalysis';

interface FieldAliases {
  unitId: string;
  fieldKey: string;
  aliases: string[];
}

/**
 * Column names that identify each reading. Written as bare alphanumerics, so
 * "Grain_Input_tpd", "grain input (tpd)" and "GrainInputTPD" all match.
 */
const FIELD_ALIASES: FieldAliases[] = [
  { unitId: 'milling', fieldKey: 'feedRate', aliases: ['graininputtpd', 'graininput', 'grainfeedrate', 'feedstock', 'corninput', 'grainthroughput', 'throughput', 'grain'] },
  { unitId: 'milling', fieldKey: 'moisture', aliases: ['grainmoisture', 'grainmoisturepct', 'cornmoisture', 'moisturein', 'grainmoisturepercent'] },
  { unitId: 'milling', fieldKey: 'screenSize', aliases: ['screensize', 'screensizemm', 'hammermillscreen', 'grindscreen'] },

  { unitId: 'liquefaction', fieldKey: 'cookTemp', aliases: ['cooktemperature', 'cooktemp', 'jetcookertemp', 'liquefactiontemp', 'cooktempf'] },
  { unitId: 'liquefaction', fieldKey: 'ph', aliases: ['slurryph', 'mashph', 'ph', 'liquefactionph'] },
  { unitId: 'liquefaction', fieldKey: 'enzymeDose', aliases: ['alphaamylasedose', 'amylasedose', 'enzymedose', 'alphaamylase'] },

  { unitId: 'fermentation', fieldKey: 'abv', aliases: ['finalbeerabv', 'beerabv', 'abv', 'alcoholbyvolume', 'ethanolpct'] },
  { unitId: 'fermentation', fieldKey: 'temp', aliases: ['mashtemperature', 'mashtemp', 'fermentationtemp', 'fermtemp'] },
  { unitId: 'fermentation', fieldKey: 'durationH', aliases: ['fermentationtime', 'fermtime', 'fermentationhours', 'fermduration'] },

  { unitId: 'distillation', fieldKey: 'steamPressure', aliases: ['steamheaderpressure', 'steampressure', 'headerpressure', 'steampsi'] },
  { unitId: 'distillation', fieldKey: 'refluxRatio', aliases: ['refluxratio', 'reflux', 'beercolumnreflux'] },
  { unitId: 'distillation', fieldKey: 'feedRate', aliases: ['beerfeedrate', 'beerfeed', 'columnfeedrate', 'beerflow'] },

  { unitId: 'drying', fieldKey: 'throughput', aliases: ['dryerthroughput', 'ddgsthroughput', 'ddgsrate', 'dryerrate'] },
  { unitId: 'drying', fieldKey: 'outletMoisture', aliases: ['ddgsoutletmoisture', 'ddgsmoisture', 'outletmoisture', 'ddgsmoistureout'] },
  { unitId: 'drying', fieldKey: 'inletTemp', aliases: ['dryerinlettemperature', 'dryerinlettemp', 'dryerinlet', 'dryertemp'] },
];

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface SuggestedReading {
  unitId: string;
  unitName: string;
  fieldKey: string;
  label: string;
  unit: string;
  /** The column it came from, so the operator can check the mapping. */
  column: string;
  /** Column mean, clamped to the field's bounds. */
  value: number;
  /** True when the clamp actually moved it, which means the column disagrees. */
  clamped: boolean;
  /** How many rows carried a number for this column. */
  samples: number;
}

export interface ReadingSuggestion {
  readings: SuggestedReading[];
  /** Fields no column matched, so the operator knows what is not covered. */
  unmatched: { unitName: string; label: string }[];
}

function fieldOf(unitId: string, fieldKey: string): { unit: (typeof PROCESS_UNITS)[number]; field: ProcessField } | null {
  const unit = PROCESS_UNITS.find((u) => u.id === unitId);
  const field = unit?.fields.find((f) => f.key === fieldKey);
  return unit && field ? { unit, field } : null;
}

/**
 * Proposes readings from the columns an export actually contains.
 *
 * Columns that are constant, empty or entirely non-numeric are skipped: a column
 * with nothing in it is not a reading.
 */
export function suggestReadings(stats: ColumnStats[]): ReadingSuggestion {
  const byName = new Map<string, ColumnStats>();
  for (const stat of stats) {
    if (stat.count === 0) continue;
    byName.set(normalise(stat.name), stat);
  }

  const readings: SuggestedReading[] = [];
  const unmatched: { unitName: string; label: string }[] = [];

  for (const entry of FIELD_ALIASES) {
    const found = fieldOf(entry.unitId, entry.fieldKey);
    if (!found) continue;

    // First alias that matches wins; they are ordered most specific first, so a
    // column literally called Grain_Input_tpd beats a vague "throughput".
    const match = entry.aliases.map((a) => byName.get(a)).find(Boolean);

    if (!match || !Number.isFinite(match.mean)) {
      unmatched.push({ unitName: found.unit.name, label: found.field.label });
      continue;
    }

    const clampedValue = clampToField(found.field, match.mean);
    readings.push({
      unitId: entry.unitId,
      unitName: found.unit.name,
      fieldKey: entry.fieldKey,
      label: found.field.label,
      unit: found.field.unit,
      column: match.name,
      value: clampedValue,
      clamped: Math.abs(clampedValue - match.mean) > 1e-9,
      samples: match.count,
    });
  }

  return { readings, unmatched };
}

/** Folds a suggestion into a ProcessValues patch ready for applyProcessReadings. */
export function toProcessValues(suggested: SuggestedReading[]): ProcessValues {
  const patch: ProcessValues = {};
  for (const reading of suggested) {
    patch[reading.unitId] = { ...(patch[reading.unitId] ?? {}), [reading.fieldKey]: reading.value };
  }
  return patch;
}
