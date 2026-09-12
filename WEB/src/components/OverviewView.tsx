import React from 'react';
import { PLANT_ALARMS, INITIAL_REPORTS } from '../data/mockData';
import { TabType, ReportItem } from '../types';
import { usePlantFigures } from '../hooks/usePlantFigures';
import { buildPlantMetrics, formatMetricValue, isWeak } from '../lib/plantMetrics';
import {
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowUpRight,
  Gauge,
  Droplets,
  Flame,
  Cpu
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateTab: (tab: TabType) => void;
  onViewReport: (report: ReportItem) => void;
  onOpenAiAssistant: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
  onViewReport,
  onOpenAiAssistant
}) => {
  const { model, consumption, emissions, loading, error, grainInputTpd } = usePlantFigures();
  const metrics =
    model && consumption && emissions ? buildPlantMetrics(consumption, emissions, model) : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
              Mission Control
            </span>
            <span className="text-xs text-[#767680]">Plant ETH-042 (Iowa Facility)</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Plant Overview
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('reports')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#eceef1] text-[#061449] border border-[#c6c5d1] rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>View All Reports</span>
          </button>
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-lg text-sm font-bold shadow-md transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Run AI Plant Diagnosis</span>
          </button>
        </div>
      </div>

      {/* KPI cards, computed live from the network and the emission formulas at
          the throughput set on the AI Optimization screen. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[#45464f]">
          Computed at{' '}
          <strong className="font-mono text-[#061449]">{grainInputTpd.toFixed(1)}</strong> t/day of
          grain.{' '}
          <button
            onClick={() => onNavigateTab('ai-optimization')}
            className="text-[#0f6e8c] font-bold hover:underline cursor-pointer"
          >
            Change throughput
          </button>
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not load the consumption model: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="bg-white rounded-xl p-5 border border-[#e0e3e6] h-[132px] animate-pulse"
            />
          ))}

        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] hover:border-[#3d93ad]/40 transition-all"
          >
            <div className="flex items-center justify-between text-xs text-[#767680] font-semibold mb-1 gap-2">
              <span>{metric.label}</span>
              {metric.r2 !== null && (
                <span
                  className={`px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    isWeak(metric)
                      ? 'bg-[#FFB703]/20 text-[#8a6100]'
                      : 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                  }`}
                >
                  R2 {metric.r2.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#061449] font-mono">
                {formatMetricValue(metric)}
              </span>
              <span className="text-sm font-semibold text-[#767680]">{metric.unit}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#e0e3e6]/60 text-xs text-[#45464f]">
              {isWeak(metric) ? (
                <span className="text-[#8a6100] font-semibold">
                  {metric.hint} &mdash; weak fit, treat as indicative
                </span>
              ) : (
                <span>{metric.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Split: Process Status & Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Loop Telemetry */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#061449]">
                Live Process Stage Status
              </h3>
              <p className="text-xs text-[#767680] mt-0.5">
                Grain in, ethanol out, running right now
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('process-monitor')}
              className="text-xs font-bold text-[#0f6e8c] hover:text-[#0b5670] flex items-center gap-1 cursor-pointer"
            >
              <span>Detailed Schematic</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Stage 1 */}
            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#061449]">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-[#0f6e8c]" />
                  1. Milling & Liquefaction
                </span>
                <span className="text-[#2D6A4F] font-mono">98.4% Conv</span>
              </div>
              <div className="space-y-1 text-xs text-[#45464f]">
                <div className="flex justify-between">
                  <span>Slurry Mash Temp:</span>
                  <span className="font-mono font-bold text-[#061449]">185.4 °F</span>
                </div>
                <div className="flex justify-between">
                  <span>Alpha-Amylase Dosing:</span>
                  <span className="font-mono font-bold text-[#061449]">142 mL/min</span>
                </div>
              </div>
              <div className="w-full bg-[#e0e3e6] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#2D6A4F] h-full w-[98%]"></div>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#061449]">
                <span className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-[#4CC9F0]" />
                  2. Fermentation Hall (F-01..08)
                </span>
                <span className="text-[#2D6A4F] font-mono">14.82% ABV</span>
              </div>
              <div className="space-y-1 text-xs text-[#45464f]">
                <div className="flex justify-between">
                  <span>Active Fermenters:</span>
                  <span className="font-mono font-bold text-[#061449]">7 / 8 Online</span>
                </div>
                <div className="flex justify-between">
                  <span>Cooling Water Delta:</span>
                  <span className="font-mono font-bold text-[#061449]">4.2 °F (Safe)</span>
                </div>
              </div>
              <div className="w-full bg-[#e0e3e6] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#0f6e8c] h-full w-[88%]"></div>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#061449]">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#FFB703]" />
                  3. Distillation & Stripping
                </span>
                <span className="text-[#2D6A4F] font-mono">190 Proof</span>
              </div>
              <div className="space-y-1 text-xs text-[#45464f]">
                <div className="flex justify-between">
                  <span>Beer Column PSI:</span>
                  <span className="font-mono font-bold text-[#061449]">14.8 PSI</span>
                </div>
                <div className="flex justify-between">
                  <span>Reflux Ratio (current, S4):</span>
                  <span className="font-mono font-bold text-[#061449]">3.1</span>
                </div>
              </div>
              <div className="w-full bg-[#e0e3e6] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#2D6A4F] h-full w-[96%]"></div>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#061449]">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#3d93ad]" />
                  4. Molecular Sieve Dehydration
                </span>
                <span className="text-[#2D6A4F] font-mono">99.85% Pure</span>
              </div>
              <div className="space-y-1 text-xs text-[#45464f]">
                <div className="flex justify-between">
                  <span>Bed A / B Cycle:</span>
                  <span className="font-mono font-bold text-[#061449]">Bed A Active (4m left)</span>
                </div>
                <div className="flex justify-between">
                  <span>Specific Energy:</span>
                  <span className="font-mono font-bold text-[#061449]">1.41 kWh/gal</span>
                </div>
              </div>
              <div className="w-full bg-[#e0e3e6] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#4CC9F0] h-full w-[99%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Active Alarms & Quick Reports */}
        <div className="space-y-6">
          {/* Active Alarms */}
          <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#061449] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                <span>Priority Plant Alarms</span>
              </h3>
              <span className="text-xs font-semibold text-[#767680]">
                {PLANT_ALARMS.length} active
              </span>
            </div>

            <div className="space-y-2.5">
              {PLANT_ALARMS.slice(0, 2).map((alarm) => (
                <div
                  key={alarm.id}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    alarm.severity === 'critical'
                      ? 'bg-[#ffdad6]/40 border-[#ba1a1a]/30 text-[#93000a]'
                      : 'bg-[#FFB703]/10 border-[#FFB703]/30 text-[#8a6100]'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{alarm.title}</span>
                    <span className="text-[10px] uppercase font-bold">{alarm.severity}</span>
                  </div>
                  <p className="text-[11px] opacity-90">{alarm.location}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Reports Widget */}
          <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#061449] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0f6e8c]" />
                <span>Latest System Reports</span>
              </h3>
              <button
                onClick={() => onNavigateTab('reports')}
                className="text-xs font-bold text-[#0f6e8c] hover:underline"
              >
                All Reports
              </button>
            </div>

            <div className="space-y-2">
              {INITIAL_REPORTS.slice(0, 2).map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => onViewReport(rep)}
                  className="p-3 bg-[#f7f9fc] hover:bg-[#eceef1] rounded-lg border border-[#e0e3e6] flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-[#061449]">{rep.title}</div>
                    <div className="text-[10px] text-[#767680]">{rep.statusText}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2D6A4F]/15 text-[#2D6A4F]">
                    {rep.fileFormat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
