import React, { useState } from 'react';
import { Zap, Flame, BatteryCharging, TrendingDown, ArrowUpRight, DollarSign } from 'lucide-react';

export const EnergyIntelligenceView: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<'24h' | '7d' | '30d'>('24h');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Energy Consumables & Load Management
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Energy Intelligence
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            Electricity, steam and gas, metered separately. Find out which unit is quietly eating your energy budget.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-[#e0e3e6]">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                selectedRange === range
                  ? 'bg-[#061449] text-white'
                  : 'text-[#45464f] hover:bg-[#eceef1]'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Energy Metrics 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)]">
          <div className="flex items-center justify-between text-xs text-[#767680] font-semibold">
            <span className="flex items-center gap-1.5 text-[#061449]">
              <Zap className="w-4 h-4 text-[#0f6e8c]" />
              Total Grid Power
            </span>
            <span className="text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full font-bold">
              -3.4% vs Peak
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#061449] font-mono">48.2</span>
            <span className="text-sm font-semibold text-[#767680] ml-1.5">MWh / day</span>
          </div>
          <div className="mt-2 text-xs text-[#45464f]">
            Specific index: <strong className="text-[#061449]">1.41 kWh/gal</strong> (Goal: 1.48)
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)]">
          <div className="flex items-center justify-between text-xs text-[#767680] font-semibold">
            <span className="flex items-center gap-1.5 text-[#061449]">
              <Flame className="w-4 h-4 text-[#FFB703]" />
              Steam Production (HP & LP)
            </span>
            <span className="text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full font-bold">
              -4.1% steam
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#061449] font-mono">112.6</span>
            <span className="text-sm font-semibold text-[#767680] ml-1.5">k-lbs / day</span>
          </div>
          <div className="mt-2 text-xs text-[#45464f]">
            Condensate return rate: <strong className="text-[#2D6A4F]">89.4%</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)]">
          <div className="flex items-center justify-between text-xs text-[#767680] font-semibold">
            <span className="flex items-center gap-1.5 text-[#061449]">
              <DollarSign className="w-4 h-4 text-[#2D6A4F]" />
              Estimated Daily Utility Cost
            </span>
            <span className="text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full font-bold">
              -$1,840 saved
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#061449] font-mono">$14,250</span>
            <span className="text-sm font-semibold text-[#767680] ml-1.5">net today</span>
          </div>
          <div className="mt-2 text-xs text-[#45464f]">
            Peak tariff shaving saved <strong className="text-[#2D6A4F]">$3,840</strong>
          </div>
        </div>
      </div>

      {/* Hourly Load Profile Visualizer */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#061449]">
              Sub-Metered Load Distribution (Past 24 Hours)
            </h3>
            <p className="text-xs text-[#767680] mt-0.5">
              Split across the reboiler, the DDGS evaporators and the fermentation chillers
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#061449]"></span>
              <span>Distillation (48%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#0f6e8c]"></span>
              <span>Dryers (28%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#4CC9F0]"></span>
              <span>Chillers (24%)</span>
            </div>
          </div>
        </div>

        {/* CSS Multi-bar graph */}
        <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-[#e0e3e6]">
          {[65, 62, 58, 55, 54, 59, 72, 85, 88, 76, 70, 68, 65, 64, 62, 60, 58, 62, 70, 75, 78, 70, 66, 64].map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
              <div
                style={{ height: `${val}%` }}
                className="w-full bg-gradient-to-t from-[#061449] via-[#0f6e8c] to-[#4CC9F0] rounded-t-xs transition-all hover:opacity-80 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-[#767680]">{idx % 4 === 0 ? `${idx}:00` : ''}</span>
              {/* Tooltip */}
              <div className="absolute -top-8 bg-[#061449] text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20">
                {idx}:00 - {val * 35} kW
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
