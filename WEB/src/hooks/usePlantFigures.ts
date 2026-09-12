/**
 * The live plant figures, computed from the trained network and the emission
 * formulas at the operator's current throughput.
 *
 * Every screen that shows a real number reads from here. Before this, only the
 * advisory card loaded the model, so the rest of the dashboard had no access to
 * the pipeline that already existed and fell back to hardcoded strings.
 */

import { useEffect, useState } from 'react';
import { loadAnnModel, predictConsumption, type AnnModel, type ConsumptionPrediction } from '../lib/annModel';
import { computeEmissions, type EmissionsResult } from '../lib/emissionsFormula';
import { usePlantInput, type InputSource } from './usePlantInput';

export interface PlantFigures {
  model: AnnModel | null;
  /** True until the network has loaded or failed. */
  loading: boolean;
  error: string | null;
  grainInputTpd: number;
  /** Beer column reflux, once readings have been submitted. */
  refluxRatio: number | null;
  /** Where the throughput came from, so a screen can cite it. */
  source: InputSource;
  updatedAt: string | null;
  isExtrapolating: boolean;
  /** Null until the model is available. */
  consumption: ConsumptionPrediction | null;
  emissions: EmissionsResult | null;
}

export function usePlantFigures(): PlantFigures {
  const { grainInputTpd, refluxRatio, source, updatedAt, isExtrapolating } = usePlantInput();
  const [model, setModel] = useState<AnnModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // loadAnnModel caches the fetch, so mounting several screens that use this
    // hook still costs one request.
    loadAnnModel()
      .then((loaded) => {
        if (cancelled) return;
        setModel(loaded);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the model.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const consumption = model ? predictConsumption(model, grainInputTpd) : null;
  const emissions = consumption ? computeEmissions(consumption, grainInputTpd) : null;

  return {
    model,
    loading,
    error,
    grainInputTpd,
    refluxRatio,
    source,
    updatedAt,
    isExtrapolating,
    consumption,
    emissions,
  };
}
