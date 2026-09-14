import React from 'react';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { OPERATING_DAYS_PER_YEAR, type DistillationScenarioResult } from '../lib/distillationEngine';

interface Co2ReductionCardProps {
  /** The scenario the submitted reflux puts the column on. */
  current: DistillationScenarioResult;
  /** Lowest-steam scenario clearing purity and recovery. */
  recommended?: DistillationScenarioResult;
  /** Operational CO2e the plant emits now, for the share calculation. */
  totalCo2eKgDay: number;
}

const n0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

/**
 * What is actually on the table, in CO2e.
 *
 * Reflux is the only lever in this project with a computed CO2e effect, so this
 * is the whole reduction the dashboard can honestly claim. It is deliberately
 * not called a credit: turning an operational reduction into a tradable one
 * needs a lifecycle methodology and third-party verification, neither of which
 * this project has. The Carbon Reduction report says so at length; this card
 * gives the number and the one-line version.
 */
export const Co2ReductionCard: React.FC<Co2ReductionCardProps> = ({
  current,
  recommended,
  totalCo2eKgDay,
}) => {
  if (!recommended || recommended.id === current.id) {
    return (
      <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-2">
        <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-[#2D6A4F]" />
          <span>CO2e Reduction Potential</span>
        </h3>
        <p className="text-xs text-[#45464f]">
          {recommended
            ? `You are already on ${current.id}, the lowest-steam scenario that meets purity and recovery. There is no reduction available from reflux at this throughput.`
            : 'No scenario met both the purity and recovery limits, so no reduction can be screened.'}
        </p>
      </div>
    );
  }

  const co2eDelta = current.co2eKgDay - recommended.co2eKgDay;
  const steamDelta = current.steamKgDay - recommended.steamKgDay;
  const costsMore = co2eDelta < 0;
  const annualTonnes = (Math.abs(co2eDelta) * OPERATING_DAYS_PER_YEAR) / 1000;
  const sharePct = totalCo2eKgDay > 0 ? (Math.abs(co2eDelta) / totalCo2eKgDay) * 100 : 0;

  return (
    <div
      className={`rounded-xl border shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-4 ${
        costsMore ? 'bg-[#FFB703]/5 border-[#FFB703]/40' : 'bg-white border-[#2D6A4F]/30'
      }`}
    >
      <div>
        <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
          {costsMore ? (
            <AlertTriangle className="w-4 h-4 text-[#8a6100]" />
          ) : (
            <TrendingDown className="w-4 h-4 text-[#2D6A4F]" />
          )}
          <span>CO2e Reduction Potential</span>
        </h3>
        <p className="text-xs text-[#767680] mt-0.5">
          {costsMore
            ? `${current.id} uses less steam than ${recommended.id}, but only because it fails the purity or recovery limit. Getting back inside them costs CO2e.`
            : `From moving the beer column from ${current.id} to ${recommended.id} at reflux ${recommended.refluxRatio.toFixed(2)}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-[11px] text-[#767680] block">
            {costsMore ? 'Extra CO2e' : 'CO2e Reduction'}
          </span>
          <span
            className={`text-2xl font-extrabold font-mono ${
              costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
            }`}
          >
            {n0(Math.abs(co2eDelta))}
          </span>
          <span className="text-[11px] text-[#767680] ml-1">kg/day</span>
        </div>
        <div>
          <span className="text-[11px] text-[#767680] block">Annualised</span>
          <span
            className={`text-2xl font-extrabold font-mono ${
              costsMore ? 'text-[#8a6100]' : 'text-[#2D6A4F]'
            }`}
          >
            {annualTonnes.toFixed(1)}
          </span>
          <span className="text-[11px] text-[#767680] ml-1">t/yr</span>
        </div>
        <div>
          <span className="text-[11px] text-[#767680] block">Steam</span>
          <span className="text-2xl font-extrabold font-mono text-[#0f6e8c]">
            {n0(Math.abs(steamDelta))}
          </span>
          <span className="text-[11px] text-[#767680] ml-1">kg/day</span>
        </div>
        <div>
          <span className="text-[11px] text-[#767680] block">Of operational CO2e</span>
          <span className="text-2xl font-extrabold font-mono text-[#061449]">
            {sharePct.toFixed(1)}
          </span>
          <span className="text-[11px] text-[#767680] ml-1">%</span>
        </div>
      </div>

      <p className="text-[10px] text-[#767680] pt-2 border-t border-[#e0e3e6]">
        An operational reduction, not a carbon credit. Claiming it as one would need a lifecycle
        methodology covering farming, fertiliser and transport, a registry-accepted baseline and
        third-party verification, none of which this project has. Generate the Carbon Reduction /
        Credit Potential report for the full list. {OPERATING_DAYS_PER_YEAR} operating days assumed.
      </p>
    </div>
  );
};
