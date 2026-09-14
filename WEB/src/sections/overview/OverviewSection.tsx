import React from 'react';
import { TabType, ReportItem } from '../../types';
import { deriveAlarms } from '../../lib/plantAlarms';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { buildPlantMetrics, formatMetricValue, isWeak } from '../../lib/plantMetrics';
import { ReadingSourceBar } from '../../components/ReadingSourceBar';
import { usePlantInput } from '../../hooks/usePlantInput';
import { PROCESS_UNITS, isInBand, formatValue } from '../../data/processUnits';
import { AlertTriangle, FileText, Sparkles, ArrowUpRight } from 'lucide-react';

interface OverviewSectionProps {
  onNavigateTab: (tab: TabType) => void;
  onViewReport: (report: ReportItem) => void;
  onOpenAiAssistant: () => void;
  /**
   * The live list App holds, newest first. This widget used to import
   * INITIAL_REPORTS directly, so it showed the same two seeded samples forever
   * and a report the operator had just generated never appeared here.
   */
  reports: ReportItem[];
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  onNavigateTab,
  onViewReport,
  onOpenAiAssistant,
  reports
}) => {
  const { model, consumption, emissions, loading, error, grainInputTpd, source, updatedAt } =
    usePlantFigures();
  const { readings } = usePlantInput();
  const alarms = deriveAlarms(readings);
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
          whatever throughput was last submitted on Process Monitor. */}
      <ReadingSourceBar
        grainInputTpd={grainInputTpd}
        source={source}
        updatedAt={updatedAt}
        onNavigateTab={onNavigateTab}
      />

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

          {/* Built from the same PROCESS_UNITS the Process Monitor uses, showing
              whatever was last submitted. These were four hand-written tiles of
              sample values that contradicted the operator's own readings two
              screens away. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROCESS_UNITS.map((unit) => {
              const unitValues = readings[unit.id];
              const outOfBand = unit.fields.filter((f) => !isInBand(f, unitValues[f.key]));

              return (
                <div
                  key={unit.id}
                  className="p-4 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#061449] gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[#767680] shrink-0">{unit.step}.</span>
                      <span className="truncate">{unit.name}</span>
                    </span>
                    <span
                      className={`font-mono shrink-0 ${
                        outOfBand.length === 0 ? 'text-[#2D6A4F]' : 'text-[#8a6100]'
                      }`}
                    >
                      {outOfBand.length === 0
                        ? 'in band'
                        : `${outOfBand.length} out of band`}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-[#45464f]">
                    {unit.fields.map((field) => (
                      <div key={field.key} className="flex justify-between gap-2">
                        <span className="truncate">{field.label}:</span>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            isInBand(field, unitValues[field.key])
                              ? 'text-[#061449]'
                              : 'text-[#8a6100]'
                          }`}
                        >
                          {formatValue(field, unitValues[field.key])}
                          {field.unit && ` ${field.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="w-full bg-[#e0e3e6] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={outOfBand.length === 0 ? 'bg-[#2D6A4F] h-full' : 'bg-[#FFB703] h-full'}
                      style={{
                        width: `${((unit.fields.length - outOfBand.length) / unit.fields.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Active Alarms & Quick Reports */}
        <div className="space-y-6">
          {/* Active Alarms */}
          <div className="bg-white rounded-xl p-5 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#061449] flex items-center gap-1.5">
                <AlertTriangle
                  className={`w-4 h-4 ${alarms.length ? 'text-[#ba1a1a]' : 'text-[#2D6A4F]'}`}
                />
                <span>Readings Outside Band</span>
              </h3>
              <span className="text-xs font-semibold text-[#767680]">
                {alarms.length} active
              </span>
            </div>

            {/* Raised from the operator's own readings. Three invented alarms
                used to sit here - a centrifuge bearing, a beer well sensor, a
                tariff window - none of which could change and none of which had
                anything to do with what had just been entered. */}
            <div className="space-y-2.5">
              {alarms.length === 0 ? (
                <p className="text-xs text-[#2D6A4F] py-1">
                  Every reading is inside its band.
                </p>
              ) : (
                alarms.slice(0, 3).map((alarm) => (
                  <button
                    key={alarm.id}
                    type="button"
                    onClick={() => onNavigateTab('process-monitor')}
                    className={`w-full text-left p-3 rounded-lg border text-xs space-y-1 cursor-pointer transition-colors ${
                      alarm.severity === 'critical'
                        ? 'bg-[#ffdad6]/40 border-[#ba1a1a]/30 text-[#93000a] hover:bg-[#ffdad6]/60'
                        : 'bg-[#FFB703]/10 border-[#FFB703]/30 text-[#8a6100] hover:bg-[#FFB703]/20'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span className="truncate">{alarm.title}</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {alarm.severity}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90 truncate">{alarm.location}</p>
                    <p className="text-[11px] font-mono">
                      {alarm.currentValue} &middot; band {alarm.threshold}
                    </p>
                  </button>
                ))
              )}

              {alarms.length > 3 && (
                <p className="text-[11px] text-[#767680]">
                  and {alarms.length - 3} more on Process Monitor
                </p>
              )}
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
              {reports.length === 0 && (
                <p className="text-xs text-[#767680] py-2">
                  Nothing generated yet.
                </p>
              )}

              {reports.slice(0, 2).map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => onViewReport(rep)}
                  className="p-3 bg-[#f7f9fc] hover:bg-[#eceef1] rounded-lg border border-[#e0e3e6] flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#061449] truncate">{rep.title}</div>
                    <div className="text-[10px] text-[#767680] truncate">
                      {rep.generatedAt} &middot; {rep.statusText}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      rep.status === 'generating'
                        ? 'bg-[#FFB703]/20 text-[#8a6100]'
                        : rep.status === 'failed'
                        ? 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                        : 'bg-[#2D6A4F]/15 text-[#2D6A4F]'
                    }`}
                  >
                    {rep.status === 'generating' ? 'Working' : rep.fileFormat}
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
