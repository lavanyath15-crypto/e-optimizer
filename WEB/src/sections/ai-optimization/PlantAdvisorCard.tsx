import React, { useState } from 'react';
import { Bot, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import {
  ELECTRICITY_KG_CO2E_PER_KWH,
  DISTILLATION_STEAM_KG_CO2E_PER_KG,
  DRYER_FUEL_KG_CO2E_PER_MMBTU,
} from '../../lib/emissionsFormula';
import { getRecommendations } from '@backend/recommend.js';
import type { DistillationScenarioPayload } from '@backend/recommend.js';
import { DistillationScenarioResult } from '../../lib/distillationEngine';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { TRAINED_MIN_TPD, TRAINED_MAX_TPD } from '../../hooks/usePlantInput';

interface PlantAdvisorCardProps {
  scenarios: DistillationScenarioResult[];
  currentRefluxRatio: number;
}

/**
 * No input box here any more. Grain throughput, and every correction applied to
 * it, comes from usePlantFigures() -- the same physics-corrected pipeline every
 * other screen reads. This card used to load the network and call
 * predictConsumption/computeEmissions on its own with the raw throughput, which
 * meant it skipped the moisture, ABV, header-pressure and boiler corrections
 * the rest of the dashboard applies: an operator with real readings entered saw
 * one set of numbers on Carbon and a different, uncorrected set here.
 */
export const PlantAdvisorCard: React.FC<PlantAdvisorCardProps> = ({
  scenarios,
  currentRefluxRatio,
}) => {
  const {
    model,
    error: modelError,
    grainInputTpd: grainInput,
    isExtrapolating: extrapolating,
    consumption,
    emissions,
  } = usePlantFigures();

  const [advice, setAdvice] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const askForRecommendations = async () => {
    if (!consumption || !emissions) return;

    setIsAsking(true);
    setAdvice(null);
    setAdviceError(null);
    setProvider(null);

    const payload: DistillationScenarioPayload[] = scenarios.map((s) => ({
      id: s.id,
      refluxRatio: s.refluxRatio,
      specificSteamKgPerKl: s.specificSteamKgPerKl,
      recoveryPct: s.recoveryPct,
      purityPct: s.purityPct,
      feasible: s.feasible,
      recommended: s.classification === 'Energy_Efficient',
    }));

    const result = await getRecommendations({
      grainInputTpd: grainInput,
      electricityKwh: consumption.electricityKwh,
      distillationSteamKg: consumption.distillationSteamKg,
      dryerFuelMmbtu: consumption.dryerFuelMmbtu,
      ethanolProductionKl: emissions.ethanolProductionKl,
      co2eIntensityKgPerKl: emissions.co2eIntensityKgPerKl,
      totalEnergyIntensityKwhPerKl: emissions.totalEnergyIntensityKwhPerKl,
      refluxRatio: currentRefluxRatio,
      distillationScenarios: payload,
    });

    setAdvice(result.recommendations);
    setProvider(result.provider);
    setAdviceError(result.error);
    setIsAsking(false);
  };

  return (
    <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5">
      <div>
        <h3 className="text-base font-bold text-[#061449]">Consumption Model & Advisory</h3>
        <p className="text-xs text-[#767680] mt-1">
          Reads your grain throughput straight from Process Monitor, predicts what you'll burn,
          converts that to CO2e, then writes the whole thing up in plain English you can hand to
          a shift supervisor.
        </p>
      </div>

      {modelError && (
        <div className="flex items-start gap-2 p-3 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-lg text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not load the model: {modelError}</span>
        </div>
      )}

      {/* Throughput, read-only. Submitting new readings on Process Monitor is
          the only way to change it now. */}
      {model && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6]">
          <div>
            <span className="text-[11px] text-[#767680] block">Grain Input</span>
            <span className="text-xl font-bold font-mono text-[#061449]">
              {grainInput.toFixed(1)}
              <span className="text-xs font-semibold text-[#767680] ml-1.5">t/day</span>
            </span>
          </div>
          <p
            className={`text-[11px] font-semibold ${
              extrapolating ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
            }`}
          >
            {extrapolating
              ? `Outside the trained range (${TRAINED_MIN_TPD} to ${TRAINED_MAX_TPD} t/day). The model is extrapolating.`
              : `Within the trained range (${TRAINED_MIN_TPD} to ${TRAINED_MAX_TPD} t/day).`}
          </p>
        </div>
      )}

      {/* What you'll burn */}
      {model && consumption && emissions && (
        <>
          <div>
            <h4 className="text-xs font-bold text-[#061449] mb-2">
              What you'll burn
              <span className="ml-2 font-normal text-[#767680]">
                how much to trust each one, in brackets
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: 'Electricity',
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
                  label: 'Dryer Fuel',
                  value: consumption.dryerFuelMmbtu,
                  unit: 'MMBtu/day',
                  decimals: 1,
                  r2: model.testR2['DDGS_Dryer_Fuel_MMBtu'],
                },
              ].map((m) => (
                <div key={m.label} className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                  <span className="text-[11px] text-[#767680] block">{m.label}</span>
                  <span className="text-lg font-bold font-mono text-[#061449]">
                    {m.value.toLocaleString(undefined, {
                      minimumFractionDigits: m.decimals,
                      maximumFractionDigits: m.decimals,
                    })}
                  </span>
                  <span className="text-[11px] text-[#767680] ml-1">{m.unit}</span>
                  <span
                    className={`text-[11px] font-semibold block mt-0.5 ${
                      m.r2 >= 0.5 ? 'text-[#2D6A4F]' : 'text-[#8a6100]'
                    }`}
                  >
                    R2 {m.r2.toFixed(2)}
                    {m.r2 < 0.5 && ' - weak, treat as indicative'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formula output */}
          <div>
            <h4 className="text-xs font-bold text-[#061449] mb-2">What that works out to</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                <span className="text-[11px] text-[#767680] block">Ethanol Production</span>
                <span className="text-lg font-bold font-mono text-[#061449]">
                  {emissions.ethanolProductionKl.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">kL/day</span>
              </div>
              <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                <span className="text-[11px] text-[#767680] block">CO2e Intensity</span>
                <span className="text-lg font-bold font-mono text-[#0f6e8c]">
                  {emissions.co2eIntensityKgPerKl.toFixed(1)}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">kg/kL</span>
              </div>
              <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                <span className="text-[11px] text-[#767680] block">Energy Intensity</span>
                <span className="text-lg font-bold font-mono text-[#0f6e8c]">
                  {emissions.totalEnergyIntensityKwhPerKl.toFixed(1)}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">kWh/kL</span>
              </div>
              <div className="bg-[#f7f9fc] p-3.5 rounded-lg border border-[#e0e3e6]">
                <span className="text-[11px] text-[#767680] block">Total CO2e</span>
                <span className="text-lg font-bold font-mono text-[#061449]">
                  {emissions.totalCo2eTonnes.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#767680] ml-1">t/day</span>
              </div>
            </div>
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
                onClick={askForRecommendations}
                disabled={isAsking}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {isAsking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
                <span>{isAsking ? 'Analysing...' : 'Generate Recommendations'}</span>
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
                <p className="text-xs text-[#191c1e] whitespace-pre-line leading-relaxed">
                  {advice}
                </p>
                {provider && (
                  <p className="text-[10px] text-[#767680] mt-3 pt-2 border-t border-[#e0e3e6]">
                    Written by an open-weight model via {provider}. Every number above came from
                    the model and the formulas. The LLM just puts them into sentences.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-[10px] text-[#767680] pt-1 border-t border-[#e0e3e6]">
        The factors here ({ELECTRICITY_KG_CO2E_PER_KWH} kg CO2e/kWh,{' '}
        {DISTILLATION_STEAM_KG_CO2E_PER_KG} kg CO2e/kg steam,{' '}
        {DRYER_FUEL_KG_CO2E_PER_MMBTU} kg CO2e/MMBtu) weren't guessed. We pulled them back out
        of the source data, and they reproduce its own CO2e column to within 0.006%. Worth
        knowing: that data is synthetic, and its README says don't use it for regulatory
        reporting or carbon credits. The scenario table above uses a generic natural gas factor
        instead, which prices the same steam about 2x higher, so its CO2e figures and these ones
        are not on the same basis.
      </p>
    </div>
  );
};
