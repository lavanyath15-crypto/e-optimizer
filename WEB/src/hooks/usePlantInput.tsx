/**
 * The plant's operating point: every reading the operator has entered, and the
 * figures derived from them. One store, read by every section.
 *
 * This used to hold a bare throughput number while Process Monitor kept the
 * readings themselves in its own component state under a second localStorage
 * key. That split is what made sections disagree:
 *
 *  - Process Monitor owned the readings, so they vanished from everywhere else
 *    the moment you did anything but submit.
 *  - The advisory card's throughput box wrote straight to the shared number,
 *    leaving the milling feed rate behind. Overview then showed 242 bu/hr while
 *    Carbon computed at a completely different tonnage.
 *  - Reflux was published as a separate field, so one screen could be told about
 *    a reading the other never saw.
 *
 * Now `readings` is the only stored state. Throughput and reflux are *derived*
 * from it, never stored alongside it, so they cannot drift out of step with the
 * numbers on the Process Monitor screen.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  PROCESS_UNITS,
  PROCESS_DEFAULTS,
  clampToField,
  type ProcessValues,
} from '../data/processUnits';
import {
  bushelsPerHourToTonnesPerDay,
  tonnesPerDayToBushelsPerHour,
} from '../lib/grainFeed';

/** The unit and field that drive the model. Named once, used everywhere. */
export const THROUGHPUT_UNIT_ID = 'milling';
export const THROUGHPUT_FIELD_KEY = 'feedRate';
export const REFLUX_UNIT_ID = 'distillation';
export const REFLUX_FIELD_KEY = 'refluxRatio';

/** Range covered by the training data. Outside it the network extrapolates. */
export const TRAINED_MIN_TPD = 124.5;
export const TRAINED_MAX_TPD = 165.0;

/**
 * Hard bounds on throughput. These are enforced on the *feed rate field*, not on
 * the derived figure, so the bushel reading on screen and the tonnage every
 * other screen runs on are always the same operating point.
 */
export const GRAIN_INPUT_MIN_TPD = bushelsPerHourToTonnesPerDay(
  PROCESS_UNITS.find((u) => u.id === THROUGHPUT_UNIT_ID)!.fields.find(
    (f) => f.key === THROUGHPUT_FIELD_KEY
  )!.min
);
export const GRAIN_INPUT_MAX_TPD = bushelsPerHourToTonnesPerDay(
  PROCESS_UNITS.find((u) => u.id === THROUGHPUT_UNIT_ID)!.fields.find(
    (f) => f.key === THROUGHPUT_FIELD_KEY
  )!.max
);

/** Throughput before the operator has entered anything, from the defaults. */
export const DEFAULT_GRAIN_INPUT_TPD = bushelsPerHourToTonnesPerDay(
  PROCESS_DEFAULTS[THROUGHPUT_UNIT_ID][THROUGHPUT_FIELD_KEY]
);

const STORAGE_KEY = 'eoptimizer-plant-readings';
/** Keys from earlier builds, read once so a returning operator keeps their work. */
const LEGACY_PLANT_INPUT_KEY = 'eoptimizer-plant-input';
const LEGACY_PROCESS_INPUTS_KEY = 'eoptimizer-process-inputs';
const LEGACY_GRAIN_KEY = 'eoptimizer-grain-input';

export type InputSource = 'default' | 'process-monitor' | 'advisor';

export type { ProcessValues };

export interface PlantInput {
  /**
   * Every reading, always populated. Defaults until the operator submits, which
   * is why no screen needs a null branch or a hardcoded fallback.
   */
  readings: ProcessValues;
  /** True once the operator has entered readings of their own. */
  hasSubmitted: boolean;
  /** Derived from the milling feed rate. Never stored separately. */
  grainInputTpd: number;
  /** Derived from the beer column reading. Never stored separately. */
  refluxRatio: number;
  /** Where the current operating point came from. */
  source: InputSource;
  updatedAt: string | null;
  /** True when throughput sits outside the network's training range. */
  isExtrapolating: boolean;

  /** Process Monitor, on submit. Merges over whatever is already held. */
  applyProcessReadings: (values: ProcessValues) => void;
  /**
   * The advisory card's throughput box. Writes *back* into the milling feed
   * rate, so changing it here changes the reading Process Monitor shows.
   */
  setGrainInputTpd: (tonnesPerDay: number) => void;
}

interface StoredState {
  readings: ProcessValues;
  hasSubmitted: boolean;
  source: InputSource;
  updatedAt: string | null;
}

const PlantInputContext = createContext<PlantInput | null>(null);

function defaultReadings(): ProcessValues {
  const fresh: ProcessValues = {};
  for (const unit of PROCESS_UNITS) {
    fresh[unit.id] = { ...PROCESS_DEFAULTS[unit.id] };
  }
  return fresh;
}

/**
 * Merges a partial, possibly stale reading set over the defaults, clamping every
 * value to its field. A field added in a later release therefore arrives with a
 * sensible default rather than as undefined, and a corrupt stored value cannot
 * put the dashboard into nonsense.
 */
function mergeReadings(base: ProcessValues, incoming: unknown): ProcessValues {
  const merged = defaultReadings();
  for (const unit of PROCESS_UNITS) {
    for (const field of unit.fields) {
      const fromBase = base?.[unit.id]?.[field.key];
      if (typeof fromBase === 'number' && Number.isFinite(fromBase)) {
        merged[unit.id][field.key] = clampToField(field, fromBase);
      }

      const raw = (incoming as ProcessValues | undefined)?.[unit.id]?.[field.key];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        merged[unit.id][field.key] = clampToField(field, raw);
      }
    }
  }
  return merged;
}

const DEFAULT_STATE: StoredState = {
  readings: defaultReadings(),
  hasSubmitted: false,
  source: 'default',
  updatedAt: null,
};

function readStored(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      return {
        readings: mergeReadings(defaultReadings(), parsed.readings),
        hasSubmitted: parsed.hasSubmitted === true,
        source: parsed.source ?? 'default',
        updatedAt: parsed.updatedAt ?? null,
      };
    }

    // Migration. Earlier builds stored the readings and the throughput apart;
    // the readings win, and the throughput is folded back into the feed rate so
    // a returning operator sees the same tonnage they left with.
    const legacyReadings = localStorage.getItem(LEGACY_PROCESS_INPUTS_KEY);
    const legacyInput = localStorage.getItem(LEGACY_PLANT_INPUT_KEY);
    if (legacyReadings || legacyInput) {
      let readings = mergeReadings(
        defaultReadings(),
        legacyReadings ? JSON.parse(legacyReadings) : undefined
      );

      const parsedInput = legacyInput
        ? (JSON.parse(legacyInput) as { grainInputTpd?: number; source?: InputSource })
        : undefined;
      const legacyTpd = Number(
        parsedInput?.grainInputTpd ?? localStorage.getItem(LEGACY_GRAIN_KEY)
      );

      if (Number.isFinite(legacyTpd) && parsedInput?.source === 'advisor') {
        readings = writeThroughput(readings, legacyTpd);
      }

      // Derived once, so the two cannot disagree. Reading them apart let an
      // operator who had only the readings key come back to a dashboard that
      // said "From your Process Monitor readings" while hasSubmitted was false,
      // which hides the very cards that sentence is promising.
      const source: InputSource =
        parsedInput?.source ?? (legacyReadings ? 'process-monitor' : 'default');

      return {
        readings,
        hasSubmitted: source !== 'default',
        source,
        updatedAt: null,
      };
    }
  } catch {
    // Corrupt or unavailable storage falls back to the defaults.
  }

  // Fresh readings rather than DEFAULT_STATE's own object, so nothing the
  // provider does later can reach back into a module-level constant.
  return { ...DEFAULT_STATE, readings: defaultReadings() };
}

/**
 * Puts a tonnes-per-day figure back into the feed rate field it is derived from.
 *
 * Rounded to the field's own precision so the store holds a reading an operator
 * could have typed. Without it, entering 150 t/day on the advisory card left
 * 246.05163190276514 bu/hr sitting in the Process Monitor input.
 */
function writeThroughput(readings: ProcessValues, tonnesPerDay: number): ProcessValues {
  const unit = PROCESS_UNITS.find((u) => u.id === THROUGHPUT_UNIT_ID)!;
  const field = unit.fields.find((f) => f.key === THROUGHPUT_FIELD_KEY)!;
  const scale = 10 ** field.decimals;
  const bushels = Math.round(tonnesPerDayToBushelsPerHour(tonnesPerDay) * scale) / scale;

  return {
    ...readings,
    [THROUGHPUT_UNIT_ID]: {
      ...readings[THROUGHPUT_UNIT_ID],
      [THROUGHPUT_FIELD_KEY]: clampToField(field, bushels),
    },
  };
}

/** Throughput implied by a reading set. The one conversion, in one place. */
export function throughputOf(readings: ProcessValues): number {
  return bushelsPerHourToTonnesPerDay(readings[THROUGHPUT_UNIT_ID][THROUGHPUT_FIELD_KEY]);
}

/** Beer column reflux from a reading set. */
export function refluxOf(readings: ProcessValues): number {
  return readings[REFLUX_UNIT_ID][REFLUX_FIELD_KEY];
}

export function PlantInputProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode: values still work for this session.
    }
  }, [state]);

  const stamp = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const applyProcessReadings = useCallback((values: ProcessValues) => {
    setState((prev) => ({
      readings: mergeReadings(prev.readings, values),
      hasSubmitted: true,
      source: 'process-monitor',
      updatedAt: stamp(),
    }));
  }, []);

  const setGrainInputTpd = useCallback((tonnesPerDay: number) => {
    if (!Number.isFinite(tonnesPerDay)) return;
    setState((prev) => ({
      readings: writeThroughput(prev.readings, tonnesPerDay),
      hasSubmitted: true,
      source: 'advisor',
      updatedAt: stamp(),
    }));
  }, []);

  const value = useMemo<PlantInput>(() => {
    const grainInputTpd = throughputOf(state.readings);

    return {
      readings: state.readings,
      hasSubmitted: state.hasSubmitted,
      grainInputTpd,
      refluxRatio: refluxOf(state.readings),
      source: state.source,
      updatedAt: state.updatedAt,
      isExtrapolating: grainInputTpd < TRAINED_MIN_TPD || grainInputTpd > TRAINED_MAX_TPD,
      applyProcessReadings,
      setGrainInputTpd,
    };
  }, [state, applyProcessReadings, setGrainInputTpd]);

  return <PlantInputContext.Provider value={value}>{children}</PlantInputContext.Provider>;
}

export function usePlantInput(): PlantInput {
  const context = useContext(PlantInputContext);
  if (!context) {
    throw new Error('usePlantInput must be used inside a PlantInputProvider');
  }
  return context;
}

/** One sentence describing where the current operating point came from. */
export function describeSource(source: InputSource, updatedAt: string | null): string {
  switch (source) {
    case 'process-monitor':
      return `From your Process Monitor readings${updatedAt ? `, submitted at ${updatedAt}` : ''}`;
    case 'advisor':
      return `Set on the AI Optimization screen${updatedAt ? ` at ${updatedAt}` : ''}`;
    default:
      return 'Nominal default. Submit readings on Process Monitor to use your own';
  }
}
