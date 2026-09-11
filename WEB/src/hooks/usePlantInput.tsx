/**
 * The plant's current grain throughput, shared across the dashboard.
 *
 * This used to be local state inside PlantAdvisorCard, which meant the rest of
 * the app had no idea it existed. The scenario table screened against a fixed
 * 147.4 t/day and the assistant answered questions about 147.4 t/day no matter
 * what had been typed in, while telling the operator it could see their
 * throughput. One number, one place, everything reads from here.
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

const STORAGE_KEY = 'eoptimizer-grain-input';

export interface PlantInput {
  grainInputTpd: number;
  setGrainInputTpd: (value: number) => void;
  /** True when the current value sits outside the network's training range. */
  isExtrapolating: boolean;
}

const PlantInputContext = createContext<PlantInput | null>(null);

function clamp(value: number): number {
  return Math.min(GRAIN_INPUT_MAX_TPD, Math.max(GRAIN_INPUT_MIN_TPD, value));
}

function readStored(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_GRAIN_INPUT_TPD;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_GRAIN_INPUT_TPD;
  } catch {
    // Storage can be unavailable in private mode.
    return DEFAULT_GRAIN_INPUT_TPD;
  }
}

export function PlantInputProvider({ children }: { children: ReactNode }) {
  const [grainInputTpd, setValue] = useState<number>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(grainInputTpd));
    } catch {
      // Entered value still works for this session.
    }
  }, [grainInputTpd]);

  const setGrainInputTpd = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    setValue(clamp(value));
  }, []);

  const value = useMemo<PlantInput>(
    () => ({
      grainInputTpd,
      setGrainInputTpd,
      isExtrapolating:
        grainInputTpd < TRAINED_MIN_TPD || grainInputTpd > TRAINED_MAX_TPD,
    }),
    [grainInputTpd, setGrainInputTpd]
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
