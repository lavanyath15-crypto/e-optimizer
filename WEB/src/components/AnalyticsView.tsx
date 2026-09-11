import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Download, RefreshCw, Sparkles } from 'lucide-react';
import { IllustrativeDataBanner } from './IllustrativeDataBanner';

export const AnalyticsView: React.FC = () => {
  const [metricChoice, setMetricChoice] = useState<'yield' | 'steam' | 'ci'>('yield');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Historian Analytics & Trends
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Plant Analytics
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            How starch quality tracks against the steam you burn per litre. Useful when you're deciding what to pay for grain.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white p-1 rounded-lg border border-[#e0e3e6]">
            <button
              onClick={() => setMetricChoice('yield')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                metricChoice === 'yield' ? 'bg-[#061449] text-white' : 'text-[#45464f]'
              }`}
            >
              Ethanol Yield (gal/bu)
            </button>
            <button
              onClick={() => setMetricChoice('steam')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                metricChoice === 'steam' ? 'bg-[#061449] text-white' : 'text-[#45464f]'
              }`}
            >
              Steam Specific Load
            </button>
            <button
              onClick={() => setMetricChoice('ci')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                metricChoice === 'ci' ? 'bg-[#061449] text-white' : 'text-[#45464f]'
              }`}
            >
              Carbon CI Curve
            </button>
          </div>
        </div>
      </div>

      <IllustrativeDataBanner>
        The bars below are a fixed sample series, not your historian. The three metric
        buttons above change the label, not the data, and there is no historian
        connected yet. The project's real accuracy figures are the held-out R2 values
        of 0.69, 0.38 and 0.18 shown on the AI Optimization screen.
      </IllustrativeDataBanner>

      {/* Main Chart Card */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#061449]">
              30-Day Moving Average vs AI Optimization Horizon
            </h3>
            <p className="text-xs text-[#767680] mt-0.5">
              Shape is illustrative. For the model's measured accuracy, see the R2 printed
              on each prediction in AI Optimization.
            </p>
          </div>
          <span className="text-xs font-bold text-[#45464f] bg-[#eceef1] px-2.5 py-1 rounded-full">
            Sample trend
          </span>
        </div>

        {/* Dynamic Visual Graph */}
        <div className="h-56 flex items-end gap-3 pt-6 pb-2 border-b border-[#e0e3e6]">
          {[72, 74, 73, 76, 75, 78, 80, 82, 81, 84, 86, 85, 88, 89, 87, 91, 93, 92, 94, 95, 96, 98].map(
            (val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                <div
                  style={{ height: `${val}%` }}
                  className="w-full bg-gradient-to-t from-[#061449] to-[#0f6e8c] rounded-t-xs hover:to-[#4CC9F0] transition-all cursor-pointer"
                />
                <span className="text-[9px] font-mono text-[#767680]">D-{22 - idx}</span>
                <div className="absolute -top-8 bg-[#061449] text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20">
                  Day {idx + 1}: {(val * 0.03 + 2.1).toFixed(2)} gal/bu
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
