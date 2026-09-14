/**
 * The plant's current operating point, shared across the dashboard.
 *
 * This began as local state inside PlantAdvisorCard, which meant the rest of the
 * app had no idea it existed: the scenario table screened against a fixed 147.4
 * t/day and the assistant answered every question about 147.4 while telling the
 * operator it could see their throughput.
 *
 * Now there is one operating point and every screen reads it. Readings entered
 * on Process Monitor set it; Carbon, Analytics, AI Optimization and the
 * assistant follow. It also records *where* the figure came from, so those
 * screens can say so rather than presenting a number with no provenance.
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

/** Nominal daily throughput used before the operator sets one. */
export const DEFAULT_GRAIN_INPUT_TPD = 147.4;

/** Range covered by the training data. Outside it the network extrapolates. */
export const TRAINED_MIN_TPD = 124.5;
export const TRAINED_MAX_TPD = 165.0;

/** Hard bounds on the input itself, so a typo cannot push the UI into nonsense. */
export const GRAIN_INPUT_MIN_TPD = 1;
export const GRAIN_INPUT_MAX_TPD = 400;

const STORAGE_KEY = 'eoptimizer-plant-input';
/** The earlier key, when this held a bare number. Read once, then superseded. */
const LEGACY_STORAGE_KEY = 'eoptimizer-grain-input';

export type InputSource = 'default' | 'process-monitor' | 'advisor';

/** unit id -> field key -> value, matching PROCESS_DEFAULTS in data/processUnits. */
export type SubmittedReadings = Record<string, Record<string, number>>;

export interface ProcessReadings {
  grainInputTpd: number;
  /** Beer column reflux, used to place the plant against the screened scenarios. */
  refluxRatio?: number;
  /**
   * Every reading as submitted. Overview shows these on its stage tiles, which
   * were hardcoded sample values before and contradicted whatever the operator
   * had actually entered two screens away.
   */
  readings?: SubmittedReadings;
}

export interface PlantInput {
  grainInputTpd: number;
  /** Null until readings are submitted on Process Monitor. */
  refluxRatio: number | null;
  /** Every submitted reading, or null while still on the nominal default. */
  readings: SubmittedReadings | null;
  /** Where the current figure came from. */
  source: InputSource;
  /** When it was last set, for display. Null while still on the default. */
  updatedAt: string | null;
  /** True when the current value sits outside the network's training range. */
  isExtrapolating: boolean;

  /** Used by the advisory card, which only sets throughput. */
  setGrainInputTpd: (value: number) => void;
  /** Used by Process Monitor when readings are submitted. */
  applyProcessReadings: (readings: ProcessReadings) => void;
}

interface StoredState {
  grainInputTpd: number;
  refluxRatio: number | null;
  readings: SubmittedReadings | null;
  source: InputSource;
  updatedAt: string | null;
}

const PlantInputContext = createContext<PlantInput | null>(null);

function clamp(value: number): number {
  return Math.min(GRAIN_INPUT_MAX_TPD, Math.max(GRAIN_INPUT_MIN_TPD, value));
}

const DEFAULT_STATE: StoredState = {
  grainInputTpd: DEFAULT_GRAIN_INPUT_TPD,
  refluxRatio: null,
  readings: null,
  source: 'default',
  updatedAt: null,
};

function readStored(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const grain = Number(parsed.grainInputTpd);
      if (Number.isFinite(grain)) {
        return {
          grainInputTpd: clamp(grain),
          refluxRatio: Number.isFinite(Number(parsed.refluxRatio))
            ? Number(parsed.refluxRatio)
            : null,
          readings:
            parsed.readings && typeof parsed.readings === 'object' ? parsed.readings : null,
          source: parsed.source ?? 'default',
          updatedAt: parsed.updatedAt ?? null,
        };
      }
    }

    // Migration: earlier builds stored a bare number under a different key.
    const legacy = Number.parseFloat(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '');
    if (Number.isFinite(legacy)) {
      return { ...DEFAULT_STATE, grainInputTpd: clamp(legacy) };
    }
  } catch {
    // Corrupt or unavailable storage falls back to the default.
  }

  return DEFAULT_STATE;
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

  const setGrainInputTpd = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    setState((prev) => ({
      ...prev,
      grainInputTpd: clamp(value),
      source: 'advisor',
      updatedAt: stamp(),
    }));
  }, []);

  const applyProcessReadings = useCallback((readings: ProcessReadings) => {
    if (!Number.isFinite(readings.grainInputTpd)) return;
    setState((prev) => ({
      grainInputTpd: clamp(readings.grainInputTpd),
      refluxRatio: Number.isFinite(readings.refluxRatio ?? NaN)
        ? (readings.refluxRatio as number)
        : prev.refluxRatio,
      readings: readings.readings ?? prev.readings,
      source: 'process-monitor',
      updatedAt: stamp(),
    }));
  }, []);

  const value = useMemo<PlantInput>(
    () => ({
      ...state,
      isExtrapolating:
        state.grainInputTpd < TRAINED_MIN_TPD || state.grainInputTpd > TRAINED_MAX_TPD,
      setGrainInputTpd,
      applyProcessReadings,
    }),
    [state, setGrainInputTpd, applyProcessReadings]
  );

  return <PlantInputContext.Provider value={value}>{children}</PlantInputContext.Provider>;
}

export function usePlantInput(): PlantInput {
  const context = useContext(PlantInputContext);
  if (!context) {
    throw new Error('usePlantInput must be used inside a PlantInputProvider');
  }
  return context;
}

/** One sentence describing where the current figure came from. */
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
