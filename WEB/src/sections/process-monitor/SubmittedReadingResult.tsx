import React, { useState } from 'react';
import { Bot, Loader2, AlertTriangle, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { buildPlantState } from '../../lib/plantState';
import {
  DISTILLATION_SCENARIOS,
  classifyScenarios,
  evaluateScenario,
} from '../../lib/distillationEngine';
import { getRecommendations } from '@backend/recommend.js';

interface SubmittedReadingResultProps {
  /** Reflux the operator entered on the distillation card, for the closest-scenario match. */
  enteredRefluxRatio: number;
}

/**
 * What the submitted readings actually produce.
 *
 * One thing is stated plainly here rather than left to be inferred: only the
 * grain feed rate changes these numbers. The network has a single input, chosen
 * by greedy forward selection over 23 candidate levers, and nothing else cleared
 * the bar. Temperatures, pH, enzyme dose and the rest are recorded but do not
 * move the prediction, and an operator who tweaked the mash pH and watched the
 * steam figure change would reasonably conclude otherwise.
 */
export const SubmittedReadingResult: React.FC<SubmittedReadingResultProps> = ({
  enteredRefluxRatio,
}) => {
  const { model, consumption, emissions, loading, error, grainInputTpd, isExtrapolating } =
    usePlantFigures();

  const [advice, setAdvice] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // The screened scenarios at this throughput, plus whichever anchor point the
  // operator's entered reflux sits closest to.
  const scenarios = classifyScenarios(
    DISTILLATION_SCENARIOS.map((s) => evaluateScenario(s, grainInputTpd))
  );
  const closest = scenarios.reduce((best, s) =>
    Math.abs(s.refluxRatio - enteredRefluxRatio) < Math.abs(best.refluxRatio - enteredRefluxRatio)
      ? s
      : best
  );
  const recommended = scenarios.find((s) => s.classification === 'Energy_Efficient');

  const generate = async () => {
    if (!model) return;

    setIsAsking(true);
    setAdvice(null);
    setAdviceError(null);
    setProvider(null);

    const result = await getRecommendations(
      buildPlantState(model, grainInputTpd, { refluxRatio: enteredRefluxRatio, scenarios })
    );

    setAdvice(result.recommendations);
    setProvider(result.provider);
    setAdviceError(result.error);
    setIsAsking(false);
  };

  if (loading) {
    return <div className="h-40 bg-white rounded-xl border border-[#e0e3e6] animate-pulse" />;
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Could not load the consumption model: {error}</span>
      </div>
    );
  }

  if (!consumption || !emissions || !model) return null;

  const predictions = [
    {
      label: 'Process Electricity',
      value: consumption.electricityKwh,
      unit: 'kWh/day',
      decimals: 0,
      r2: model.testR2['Total_Process_Electricity_kWh'],
    },
    {
      label: 'Distillation Steam',
      value: consumption.distillationSteamKg,
      unit: 'kg/day',
      decimals: 0,
      r2: model.testR2['Distillation_Steam_kg'],
    },
    {
      label: 'DDGS Dryer Fuel',
      value: consumption.dryerFuelMmbtu,
      unit: 'MMBtu/day',
      decimals: 1,
      r2: model.testR2['DDGS_Dryer_Fuel_MMBtu'],
    },
  ];

  const derived = [
    { label: 'Ethanol Production', value: emissions.ethanolProductionKl, unit: 'kL/day', decimals: 2 },
    { label: 'CO2e Intensity', value: emissions.co2eIntensityKgPerKl, unit: 'kg CO2e/kL', decimals: 1 },
    { label: 'Energy Intensity', value: emissions.totalEnergyIntensityKwhPerKl, unit: 'kWh/kL', decimals: 1 },
    { label: 'Total CO2e', value: emissions.totalCo2eTonnes, unit: 't/day', decimals: 2 },
  ];

  const fmt = (value: number, decimals: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return (
    <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-[#061449]">Result of these readings</h3>
        <p className="text-xs text-[#767680] mt-1">
          Your grain feed rate works out at{' '}
          <strong className="font-mono text-[#061449]">{grainInputTpd.toFixed(1)} t/day</strong>, which
          is what the network runs on.
        </p>
      </div>

      {isExtrapolating && (
        <div className="flex items-start gap-2 p-3 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg text-[11px] text-[#8a6100]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            That feed rate is outside the range the model was trained on (124.5 to 165 t/day), so it
            is extrapolating. Treat everything below as indicative only.
          </span>
        </div>
      )}

      <div>
        <h4 className="text-xs font-bold text-[#061449] mb-2">What you'll burn</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {predictions.map((p) => (
            <div key={p.label} className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
              <span className="text-[11px] text-[#767680] block">{p.label}</span>
              <span className="text-lg font-bold font-mono text-[#061449]">
                {fmt(p.value, p.decimals)}
              </span>
              <span className="text-[11px] text-[#767680] ml-1">{p.unit}</span>
              <span
                className={`text-[11px] font-semibold block mt-0.5 ${
                  p.r2 >= 0.5 ? 'text-[#2D6A4F]' : 'text-[#8a6100]'
                }`}
              >
                R2 {p.r2.toFixed(2)}
                {p.r2 < 0.5 && ' - weak, indicative'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-[#061449] mb-2">What that works out to</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {derived.map((d) => (
            <div key={d.label} className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
              <span className="text-[11px] text-[#767680] block">{d.label}</span>
              <span className="text-lg font-bold font-mono text-[#0f6e8c]">
                {fmt(d.value, d.decimals)}
              </span>
              <span className="text-[11px] text-[#767680] ml-1">{d.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Where the entered reflux sits against the screened scenarios. */}
      <div className="p-4 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6] space-y-2">
        <h4 className="text-xs font-bold text-[#061449]">Your reflux against the scenarios</h4>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#45464f]">
            You entered <strong className="font-mono">{enteredRefluxRatio.toFixed(2)}</strong>, closest
            to <strong>{closest.id}</strong> ({closest.refluxRatio.toFixed(2)})
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              closest.classification === 'Energy_Efficient'
                ? 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                : closest.classification === 'Constraint_Violation'
                ? 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                : 'bg-[#eceef1] text-[#45464f]'
            }`}
          >
            {closest.classification === 'Energy_Efficient'
              ? 'Already the recommended point'
              : closest.classification === 'Constraint_Violation'
              ? 'Violates purity or recovery'
              : 'Feasible'}
          </span>
        </div>

        {recommended && closest.id !== recommended.id && (
          <p className="text-xs text-[#45464f] flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-[#0f6e8c] shrink-0" />
            <span>
              Lowest-steam point that still clears both limits is{' '}
              <strong>{recommended.id}</strong> at reflux{' '}
              <strong className="font-mono">{recommended.refluxRatio.toFixed(2)}</strong>, using{' '}
              <strong className="font-mono">
                {fmt(closest.steamKgDay - recommended.steamKgDay, 0)}
              </strong>{' '}
              kg/day less steam.
            </span>
          </p>
        )}
      </div>

      {/* Advisory */}
      <div className="pt-1 border-t border-[#e0e3e6] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <h4 className="text-xs font-bold text-[#061449] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0f6e8c]" />
            <span>What to do about it</span>
          </h4>
          <button
            type="button"
            onClick={generate}
            disabled={isAsking}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            {isAsking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : advice ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Bot className="w-3.5 h-3.5" />
            )}
            <span>{isAsking ? 'Analysing...' : advice ? 'Regenerate' : 'Get Recommendations'}</span>
          </button>
        </div>

        {adviceError && (
          <div className="flex items-start gap-2 p-3 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-lg text-xs text-[#BA1A1A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{adviceError}</span>
          </div>
        )}

        {advice && (
          <div className="p-4 bg-[#f7f9fc] border border-[#e0e3e6] rounded-lg">
            <p className="text-xs text-[#191c1e] whitespace-pre-line leading-relaxed">{advice}</p>
            {provider && (
              <p className="text-[10px] text-[#767680] mt-3 pt-2 border-t border-[#e0e3e6]">
                Written by an open-weight model via {provider}. Every number above came from the
                network and the formulas; the model only puts them into sentences.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[#767680] pt-1 border-t border-[#e0e3e6]">
        Only the grain feed rate moves these numbers. The network has one input, picked by greedy
        forward selection over 23 candidate levers, and no other reading cleared the bar: outside
        throughput, nothing in the source dataset exceeds a correlation of 0.19 against any target.
        Your temperatures, pH, enzyme dose and the rest are recorded and checked against their bands,
        but they do not change the prediction.
      </p>
    </div>
  );
};
