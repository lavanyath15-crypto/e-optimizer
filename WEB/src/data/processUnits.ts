/**
 * Operator-editable inputs for each stage of the dry-mill ethanol process.
 *
 * `normalMin`/`normalMax` describe the usual operating band and drive the
 * in-band/out-of-band readout. `min`/`max` are the hard bounds accepted by the
 * input itself. Bands are typical dry-mill figures and should be replaced with
 * this plant's validated operating envelope before anyone acts on them.
 */

export interface ProcessField {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  normalMin: number;
  normalMax: number;
  decimals: number;
}

export interface ProcessUnit {
  id: string;
  step: number;
  name: string;
  equipment: string;
  fields: ProcessField[];
}

export const PROCESS_UNITS: ProcessUnit[] = [
  {
    id: 'milling',
    step: 1,
    name: 'Milling',
    equipment: 'Hammermill 1-3',
    fields: [
      // Sized to the plant the model was trained on, not to a typical US dry
      // mill. 3,000-3,800 bu/hr was here before, which works out at roughly
      // 2,100 t/day: a plant fourteen times the 147.4 t/day in the dataset. Now
      // that submitting a reading drives the prediction, that gap would have
      // pushed the network far outside its trained range on the first submit.
      // The band below is the 124.5-165 t/day training range converted.
      { key: 'feedRate', label: 'Grain Feed Rate', unit: 'bu/hr', min: 0, max: 2000, step: 1, normalMin: 205, normalMax: 270, decimals: 0 },
      { key: 'moisture', label: 'Grain Moisture', unit: '%', min: 0, max: 30, step: 0.1, normalMin: 13, normalMax: 15.5, decimals: 1 },
      { key: 'screenSize', label: 'Screen Size', unit: 'mm', min: 1, max: 10, step: 0.1, normalMin: 2.8, normalMax: 4, decimals: 1 },
    ],
  },
  {
    id: 'liquefaction',
    step: 2,
    name: 'Liquefaction',
    equipment: 'Jet Cooker #1',
    fields: [
      { key: 'cookTemp', label: 'Cook Temperature', unit: '°F', min: 100, max: 300, step: 0.1, normalMin: 215, normalMax: 235, decimals: 1 },
      { key: 'ph', label: 'Slurry pH', unit: '', min: 3, max: 9, step: 0.01, normalMin: 5.4, normalMax: 5.9, decimals: 2 },
      { key: 'enzymeDose', label: 'Alpha-Amylase Dose', unit: 'kg/h', min: 0, max: 50, step: 0.1, normalMin: 10, normalMax: 16, decimals: 1 },
    ],
  },
  {
    id: 'fermentation',
    step: 3,
    name: 'Fermentation',
    equipment: 'Tanks F-01..08',
    fields: [
      { key: 'abv', label: 'Final Beer ABV', unit: '%', min: 0, max: 25, step: 0.01, normalMin: 13.5, normalMax: 16, decimals: 2 },
      { key: 'temp', label: 'Mash Temperature', unit: '°F', min: 50, max: 120, step: 0.1, normalMin: 86, normalMax: 92, decimals: 1 },
      { key: 'durationH', label: 'Fermentation Time', unit: 'h', min: 12, max: 96, step: 0.5, normalMin: 48, normalMax: 60, decimals: 1 },
    ],
  },
  {
    id: 'distillation',
    step: 4,
    name: 'Distillation',
    equipment: 'Beer Column C-101',
    fields: [
      { key: 'steamPressure', label: 'Steam Header Pressure', unit: 'PSI', min: 0, max: 300, step: 0.1, normalMin: 140, normalMax: 160, decimals: 1 },
      // Band and default track DISTILLATION_SCENARIOS in lib/distillationEngine.ts,
      // which anchors this column at reflux 2.3 to 3.1. Change them together or the
      // two screens will disagree about what the plant is running.
      { key: 'refluxRatio', label: 'Reflux Ratio', unit: '', min: 0.5, max: 5, step: 0.01, normalMin: 2.3, normalMax: 3.1, decimals: 2 },
      { key: 'feedRate', label: 'Beer Feed Rate', unit: 'GPM', min: 0, max: 3000, step: 10, normalMin: 1300, normalMax: 1550, decimals: 0 },
    ],
  },
  {
    id: 'drying',
    step: 5,
    name: 'Dryers & DDGS',
    equipment: 'RTO & Flash Dryers',
    fields: [
      { key: 'throughput', label: 'Dryer Throughput', unit: 'TPH', min: 0, max: 80, step: 0.1, normalMin: 34, normalMax: 42, decimals: 1 },
      { key: 'outletMoisture', label: 'DDGS Outlet Moisture', unit: '%', min: 0, max: 30, step: 0.1, normalMin: 8, normalMax: 11, decimals: 1 },
      { key: 'inletTemp', label: 'Dryer Inlet Temperature', unit: '°F', min: 100, max: 700, step: 1, normalMin: 380, normalMax: 450, decimals: 0 },
    ],
  },
];

export type ProcessValues = Record<string, Record<string, number>>;

export const PROCESS_DEFAULTS: ProcessValues = {
  // 242 bu/hr is 147.4 t/day, the nominal throughput used across the dashboard.
  milling: { feedRate: 242, moisture: 14.2, screenSize: 3.2 },
  liquefaction: { cookTemp: 225.4, ph: 5.65, enzymeDose: 12.5 },
  fermentation: { abv: 14.82, temp: 89.2, durationH: 54 },
  // refluxRatio matches scenario S4, the current operating point in distillationEngine.
  distillation: { steamPressure: 148.5, refluxRatio: 3.1, feedRate: 1420 },
  drying: { throughput: 38.2, outletMoisture: 9.8, inletTemp: 410 },
};

export function isInBand(field: ProcessField, value: number): boolean {
  return value >= field.normalMin && value <= field.normalMax;
}

/** Clamp to the field's hard bounds so a typo cannot push the UI into nonsense. */
export function clampToField(field: ProcessField, value: number): number {
  if (Number.isNaN(value)) return field.min;
  return Math.min(field.max, Math.max(field.min, value));
}

export function formatValue(field: ProcessField, value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: field.decimals,
    maximumFractionDigits: field.decimals,
  });
}
