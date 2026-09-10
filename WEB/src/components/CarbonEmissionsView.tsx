import React, { useState } from 'react';
import { Leaf, Award, TrendingDown, ArrowDownRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export const CarbonEmissionsView: React.FC = () => {
  const [co2CaptureRate, setCo2CaptureRate] = useState<number>(96.8);
  const [rngBlend, setRngBlend] = useState<number>(5);

  // Dynamic CI score formula
  const baseCi = 58.0;
  const captureEffect = (co2CaptureRate - 90) * 0.45;
  const rngEffect = rngBlend * 0.35;
  const currentCi = (baseCi - captureEffect - rngEffect).toFixed(1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] bg-[#2D6A4F]/10 px-2.5 py-0.5 rounded-full">
            LCFS & EPA Compliance
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Carbon & CO2e Ledger
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            Where your CO2e comes from, split by Scope 1 and 2, with fermentation CO2 kept separate because it's biogenic.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 rounded-lg text-xs font-bold text-[#2D6A4F]">
          <ShieldCheck className="w-4 h-4" />
          <span>GREET 2026 Model Validated</span>
        </div>
      </div>

      {/* CI Score Hero Block */}
      <div className="bg-gradient-to-r from-[#001d23] via-[#00333d] to-[#061449] rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#abedff]">
            <Award className="w-4 h-4" />
            <span>Certified Carbon Intensity (CI)</span>
          </div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-5xl font-extrabold font-mono text-white">
              {currentCi}
            </span>
            <span className="text-sm font-bold text-[#abedff]">
              gCO2e / MJ
            </span>
          </div>
          <p className="text-xs text-[#dde1ff] mt-2 max-w-md">
            Outperforming Midwest standard baseline (78.0 gCO2e/MJ) by <strong>{(78.0 - parseFloat(currentCi)).toFixed(1)} pts</strong>, eligible for tier-1 premium carbon credits.
          </p>
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-[#abedff] block">Scope 1 (Boilers)</span>
            <span className="text-lg font-bold font-mono text-white">12,850 MT</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-[#abedff] block">Scope 2 (Grid Mix)</span>
            <span className="text-lg font-bold font-mono text-white">3,420 MT</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/15 col-span-2">
            <span className="text-[11px] text-[#abedff] block">Biogenic Fermentation Capture</span>
            <span className="text-lg font-bold font-mono text-[#4CC9F0]">-28,950 MT CO2e</span>
          </div>
        </div>
      </div>

      {/* Interactive Scenario Simulator */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-6">
        <div>
          <h3 className="text-base font-bold text-[#061449]">
            Interactive CI Abatement Scenario Simulator
          </h3>
          <p className="text-xs text-[#767680] mt-0.5">
            Move a lever and see what it does to next quarter's credits
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lever 1 */}
          <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-3">
            <div className="flex justify-between text-xs font-bold text-[#061449]">
              <span>Fermentation CO2 Liquefaction Capture Rate</span>
              <span className="font-mono text-[#0f6e8c]">{co2CaptureRate}%</span>
            </div>
            <input
              type="range"
              min="90"
              max="99"
              step="0.2"
              value={co2CaptureRate}
              onChange={(e) => setCo2CaptureRate(parseFloat(e.target.value))}
              className="w-full accent-[#0f6e8c] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#767680]">
              <span>90% (Current baseline)</span>
              <span>99% (Full compression capacity)</span>
            </div>
          </div>

          {/* Lever 2 */}
          <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-3">
            <div className="flex justify-between text-xs font-bold text-[#061449]">
              <span>Renewable Natural Gas (RNG) Co-fire Blend</span>
              <span className="font-mono text-[#2D6A4F]">{rngBlend}% Blend</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={rngBlend}
              onChange={(e) => setRngBlend(parseInt(e.target.value))}
              className="w-full accent-[#2D6A4F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#767680]">
              <span>0% (Fossil Gas Only)</span>
              <span>20% (Max pipeline injection)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
