import React, { useMemo, useState } from 'react';
import { AI_SETPOINTS } from '../../data/mockData';
import { AiOptimizationSetpoint } from '../../types';
import { BrainCircuit, CheckCircle2, Sparkles, Sliders, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  DISTILLATION_SCENARIOS,
  PURITY_MIN_PCT,
  RECOVERY_MIN_PCT,
  evaluateScenario,
  classifyScenarios,
  computeSavings,
  resolveCurrentScenario,
} from '../../lib/distillationEngine';
import { PlantAdvisorCard } from './PlantAdvisorCard';
import { usePlantInput } from '../../hooks/usePlantInput';

export const AiOptimizationSection: React.FC = () => {
  const { grainInputTpd, refluxRatio, hasSubmitted } = usePlantInput();
  const [setpoints, setSetpoints] = useState<AiOptimizationSetpoint[]>(AI_SETPOINTS);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApply = (id: string) => {
    setSetpoints((prev) =>
      prev.map((sp) => (sp.id === id ? { ...sp, status: 'applied' } : sp))
    );
    // Nothing is transmitted anywhere. This claimed "Setpoint command transmitted
    // to Emerson DeltaV DCS controller", which is a sentence an operator could
    // reasonably act on. There is no DCS connection in this project.
    setFeedback('Marked as accepted on this screen only. Nothing was sent to a DCS.');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRevert = (id: string) => {
    setSetpoints((prev) =>
      prev.map((sp) => (sp.id === id ? { ...sp, status: 'pending' } : sp))
    );
    setFeedback('Marked as not accepted. Again, nothing left this browser.');
    setTimeout(() => setFeedback(null), 4000);
  };

  // Recomputed whenever the operator changes throughput, so the table describes
  // the plant they are actually running rather than a fixed nominal day.
  const distillationResults = useMemo(
    () =>
      classifyScenarios(
        DISTILLATION_SCENARIOS.map((scenario) => evaluateScenario(scenario, grainInputTpd))
      ),
    [grainInputTpd]
  );

  // The scenario the plant is actually on, from the reflux submitted on Process
  // Monitor. This was pinned to S4 regardless, so entering 2.30 left this screen
  // calling S4 "(current)" and pricing savings against it while Carbon, reading
  // the same number, correctly said S1.
  const baseline = resolveCurrentScenario(distillationResults, refluxRatio);
  const recommended = distillationResults.find((r) => r.classification === 'Energy_Efficient');
  const savings = recommended ? computeSavings(baseline, recommended) : null;
  // Negative when the operator is running below the feasible band: cheaper on
  // steam, and off spec.
  const costsMore = (savings?.steamSavedKgDay ?? 0) < 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Autonomous Closed-Loop Control
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            AI Optimization & Setpoints
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            Setpoints worth changing today, with the steam saving next to each one so you can decide if it's worth the trouble.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3d93ad]/10 border border-[#3d93ad]/30 rounded-lg text-xs font-bold text-[#0f6e8c]">
          <BrainCircuit className="w-4 h-4" />
          {/* Named after what it actually is. "Industrial-Thermo-v4.2" was here
              before and no such model exists. */}
          <span>Model: 2-layer MLP, 1 input, 16 hidden</span>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded-xl text-xs font-bold text-[#2D6A4F] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Setpoints Table/Cards */}
      <div className="space-y-4">
        {setpoints.map((sp) => {
          const isApplied = sp.status === 'applied';

          return (
            <div
              key={sp.id}
              className={`p-6 rounded-xl border transition-all ${
                isApplied
                  ? 'bg-white border-[#2D6A4F]/40 shadow-xs'
                  : 'bg-white border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#061449]">
                      {sp.parameter}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isApplied
                          ? 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                          : 'bg-[#FFB703]/20 text-[#8a6100]'
                      }`}
                    >
                      {isApplied ? 'Closed Loop: Engaged' : 'AI Recommendation Available'}
                    </span>
                  </div>

                  <p className="text-xs text-[#2D6A4F] font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gain: {sp.expectedGain}</span>
                  </p>

                  <p className="text-xs text-[#767680]">
                    Safety Boundary: {sp.safetyMargin} • Confidence: <strong>{sp.confidence}%</strong>
                  </p>
                </div>

                {/* Values Comparison */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <span className="text-[11px] text-[#767680] block">Current</span>
                    <span className="text-xl font-extrabold font-mono text-[#45464f]">
                      {sp.currentValue} <span className="text-xs font-normal">{sp.unit}</span>
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#3d93ad]" />

                  <div className="text-center">
                    <span className="text-[11px] text-[#0f6e8c] font-bold block">Optimized</span>
                    <span className="text-xl font-extrabold font-mono text-[#0f6e8c]">
                      {sp.recommendedValue} <span className="text-xs font-normal">{sp.unit}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div>
                    {isApplied ? (
                      <button
                        onClick={() => handleRevert(sp.id)}
                        className="px-4 py-2 border border-[#c6c5d1] text-[#45464f] hover:bg-[#eceef1] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revert</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApply(sp.id)}
                        className="px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Apply Setpoint</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Distillation Scenario Optimizer */}
      <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-[#061449]">Distillation Scenario Optimizer</h3>
          <p className="text-xs text-[#767680] mt-1">
            The cheapest reflux setting usually isn't the one you can run. We check every option against
            purity ≥ {PURITY_MIN_PCT}% and recovery ≥ {RECOVERY_MIN_PCT}% first, then pick the lowest-steam one
            that actually clears both.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-[#767680] border-b border-[#e0e3e6]">
                <th className="py-2 pr-4 font-bold">Scenario</th>
                <th className="py-2 pr-4 font-bold">Reflux</th>
                <th className="py-2 pr-4 font-bold">Steam (kg/day)</th>
                <th className="py-2 pr-4 font-bold">Specific Steam (kg/kL)</th>
                <th className="py-2 pr-4 font-bold">Recovery %</th>
                <th className="py-2 pr-4 font-bold">Purity %</th>
                <th className="py-2 pr-4 font-bold">CO2e (kg/day)</th>
                <th className="py-2 pr-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {distillationResults.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-[#e0e3e6]/60 ${
                    r.classification === 'Energy_Efficient' ? 'bg-[#2D6A4F]/5' : ''
                  }`}
                >
                  <td className="py-2.5 pr-4 font-bold text-[#061449]">
                    {r.id}
                    {r.id === baseline.id && (
                      <span className="ml-1.5 text-[10px] font-normal text-[#767680]">
                        {hasSubmitted ? '(yours)' : '(nominal)'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-mono">{r.refluxRatio.toFixed(1)}</td>
                  {/* Scaling to throughput makes this fractional; kg/day to three
                      decimal places is noise on a 70-tonne figure. */}
                  <td className="py-2.5 pr-4 font-mono">
                    {r.steamKgDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 pr-4 font-mono">{r.specificSteamKgPerKl.toFixed(1)}</td>
                  <td className={`py-2.5 pr-4 font-mono ${!r.recoveryOk ? 'text-[#BA1A1A] font-bold' : ''}`}>
                    {r.recoveryPct.toFixed(1)}
                  </td>
                  <td className={`py-2.5 pr-4 font-mono ${!r.purityOk ? 'text-[#BA1A1A] font-bold' : ''}`}>
                    {r.purityPct.toFixed(2)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono">{r.co2eKgDay.toFixed(0)}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.classification === 'Energy_Efficient'
                          ? 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                          : r.classification === 'Constraint_Violation'
                          ? 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                          : 'bg-[#eceef1] text-[#45464f]'
                      }`}
                    >
                      {r.classification === 'Energy_Efficient'
                        ? 'Recommended'
                        : r.classification === 'Constraint_Violation'
                        ? 'Constraint Violation'
                        : 'Feasible'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recommended && savings && recommended.id !== baseline.id && (
          <div className="space-y-3 pt-2 border-t border-[#e0e3e6]">
            <p className="text-xs font-bold text-[#061449]">
              {costsMore
                ? `Moving from ${baseline.id} up to ${recommended.id}`
                : `Moving from ${baseline.id} down to ${recommended.id}`}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] text-[#767680] block">
                  {costsMore ? 'Extra Steam' : 'Steam Reduction'}
                </span>
                <span
                  className={`text-lg font-extrabold font-mono ${
                    costsMore ? 'text-[#8a6100]' : 'text-[#0f6e8c]'
                  }`}
                >
                  {Math.abs(savings.steamSavedPct).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">
                  {costsMore ? 'Extra Energy' : 'Energy Saved'}
                </span>
                <span
                  className={`text-lg font-extrabold font-mono ${
                    costsMore ? 'text-[#8a6100]' : 'text-[#0f6e8c]'
                  }`}
                >
                  {Math.abs(savings.energySavedGjDay).toFixed(1)} GJ/day
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">
                  {costsMore ? 'Extra CO2e' : 'CO2e Saved'}
                </span>
                <span
                  className={`text-lg font-extrabold font-mono ${
                    costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
                  }`}
                >
                  {Math.abs(savings.co2eSavedKgDay).toFixed(0)} kg/day
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#767680] block">Annualized CO2e</span>
                <span
                  className={`text-lg font-extrabold font-mono ${
                    costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
                  }`}
                >
                  {Math.abs(savings.co2eSavedTonnesYear).toFixed(1)} t/yr
                </span>
              </div>
            </div>

            {/* A plant running below the feasible band uses less steam because it
                is off spec. Reporting that as "Steam Reduction: -4.0%" put a
                minus sign in front of a saving instead of calling it a cost. */}
            {costsMore && (
              <p className="text-xs text-[#8a6100] bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg p-3">
                {baseline.id} uses less steam than {recommended.id}, but it fails the purity or
                recovery limit. These are the figures for getting back inside the limits, so they
                are a cost, not a saving.
              </p>
            )}
          </div>
        )}

        <p className="text-[10px] text-[#767680] pt-1 border-t border-[#e0e3e6]">
          CO2e in this table converts reboiler duty at 56.1 kg CO2e/GJ, the generic natural gas
          combustion factor, which works out to about 0.12 kg CO2e per kg of steam. The advisory card
          below prices the same steam at 0.06 kg CO2e/kg, the factor recovered from the source dataset.
          The two differ by roughly 2x, because the dataset's implied factor is about half what
          natural-gas-raised steam normally costs. Each is right for what it does here, but they are not
          interchangeable: don't compare the CO2e figures in this table against the ones below. The
          purity and recovery limits are study defaults too. Put your own commissioned numbers in before
          any of this goes in a report.
        </p>
      </div>

      <PlantAdvisorCard
        scenarios={distillationResults}
        currentRefluxRatio={baseline.refluxRatio}
      />
    </div>
  );
};
