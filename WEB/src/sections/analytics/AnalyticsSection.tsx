import React, { useMemo, useState } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { TRAINED_MIN_TPD, TRAINED_MAX_TPD } from '../../hooks/usePlantInput';
import { DataSourceBanner } from '../../components/DataSourceBanner';
import {
  SWEEP_SERIES,
  barHeightPct,
  seriesRange,
  sweepThroughput,
  type SweepMetric,
} from '../../lib/throughputSweep';
import type { TabType } from '../../types';

/**
 * How the model responds to throughput.
 *
 * This was a fixed 22-bar array labelled "30-Day Moving Average" with an
 * invented R2 of 0.942 underneath it. There is no historian, so there was no
 * trend to draw; the bars were decoration.
 *
 * What the project can honestly plot is the network's own response curve across
 * the range it was trained on. The metric buttons now switch real series rather
 * than relabelling the same shape.
 */
interface AnalyticsSectionProps {
  onNavigateTab?: (tab: TabType) => void;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ onNavigateTab }) => {
  const { model, loading, error, grainInputTpd, readings, hasSubmitted, source, updatedAt } = usePlantFigures();
  const [metric, setMetric] = useState<SweepMetric>('distillationSteamKg');

  // Swept with the operator's other readings held at their current values, so
  // the curve and the marker are on the same basis as every other screen.
  const points = useMemo(
    () =>
      model
        ? sweepThroughput(model, {
            min: TRAINED_MIN_TPD,
            max: TRAINED_MAX_TPD,
            readings,
          })
        : [],
    [model, readings]
  );

  const series = SWEEP_SERIES.find((s) => s.key === metric)!;
  const range = useMemo(() => seriesRange(points, metric), [points, metric]);
  const r2 = series.r2Target && model ? model.testR2[series.r2Target] : null;

  const format = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: series.decimals,
      maximumFractionDigits: series.decimals,
    });

  // Marks where the operator is actually running, but only when that point is
  // on the chart. Without the range guard, a throughput of 400 t/day snapped to
  // the nearest bar and painted "your current throughput" on 165, which is a
  // wrong marker rather than a missing one.
  const onChart = grainInputTpd >= TRAINED_MIN_TPD && grainInputTpd <= TRAINED_MAX_TPD;

  const closestIndex = onChart
    ? points.reduce(
        (best, point, i) =>
          Math.abs(point.grainInputTpd - grainInputTpd) <
          Math.abs(points[best].grainInputTpd - grainInputTpd)
            ? i
            : best,
        0
      )
    : -1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Model Sensitivity
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Plant Analytics
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            How consumption and intensity respond to grain throughput, run through the network across
            the range it was trained on.
          </p>
        </div>

        <div className="flex items-center bg-white p-1 rounded-lg border border-[#e0e3e6] flex-wrap">
          {SWEEP_SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setMetric(s.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${metric === s.key ? 'bg-[#061449] text-white' : 'text-[#45464f] hover:bg-[#eceef1]'
                }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {/* Data source provenance banner */}
      <DataSourceBanner
        hasSubmitted={hasSubmitted}
        source={source}
        updatedAt={updatedAt}
        grainInputTpd={grainInputTpd}
        onGoToProcessMonitor={onNavigateTab ? () => onNavigateTab('process-monitor') : undefined}
      />

      {/* The chart can only span what the network was trained on, so an operating
          point outside that range genuinely has nowhere to sit on it. Saying so
          beats silently dropping the marker. */}
      {!onChart && !loading && (
        <div className="flex items-start gap-2 p-3.5 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-xl text-xs text-[#8a6100]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            You are running{' '}
            <strong className="font-mono">{grainInputTpd.toFixed(1)} t/day</strong>, outside the
            range this network was trained on ({TRAINED_MIN_TPD} to {TRAINED_MAX_TPD} t/day). The
            curve below stops at {TRAINED_MAX_TPD}, so your operating point is off the chart and no
            marker is shown. Predictions at your throughput are extrapolation: the shape of the
            curve is still informative, the absolute values are not.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not load the consumption model: {error}</span>
        </div>
      )}

      {loading && <div className="h-80 bg-white rounded-xl border border-[#e0e3e6] animate-pulse" />}

      {points.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#061449] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0f6e8c]" />
                <span>
                  {series.label} vs Grain Throughput
                </span>
              </h3>
              <p className="text-xs text-[#767680] mt-0.5">
                {format(range.min)} to {format(range.max)} {series.unit} across{' '}
                {TRAINED_MIN_TPD} to {TRAINED_MAX_TPD} t/day
              </p>
            </div>

            {r2 !== null && r2 !== undefined && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${r2 >= 0.5 ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'bg-[#FFB703]/20 text-[#8a6100]'
                  }`}
              >
                Held-out R2 {r2.toFixed(2)}
                {r2 < 0.5 && ' - weak'}
              </span>
            )}
          </div>

          <div className="h-56 flex items-end gap-1.5 pt-6 pb-2 border-b border-[#e0e3e6]">
            {points.map((point, idx) => {
              const value = point[metric];
              const isCurrent = idx === closestIndex;

              return (
                <div
                  key={point.grainInputTpd}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                >
                  <div
                    style={{ height: `${barHeightPct(value, range)}%` }}
                    className={`w-full rounded-t-xs transition-all ${isCurrent
                        ? 'bg-[#2D6A4F]'
                        : 'bg-gradient-to-t from-[#061449] to-[#0f6e8c] group-hover:to-[#4CC9F0]'
                      }`}
                  />
                  <span className="text-[9px] font-mono text-[#767680]">
                    {idx % 4 === 0 ? point.grainInputTpd.toFixed(0) : ''}
                  </span>
                  <div className="absolute -top-12 bg-[#061449] text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20">
                    {point.grainInputTpd.toFixed(1)} t/day
                    <br />
                    {format(value)} {series.unit}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#767680]">
            {onChart ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#2D6A4F]" />
                <span>
                  Your current throughput,{' '}
                  <strong className="font-mono text-[#061449]">
                    {grainInputTpd.toFixed(1)} t/day
                  </strong>
                </span>
              </span>
            ) : (
              <span className="text-[#8a6100] font-semibold">
                Your throughput is off this chart, so no marker is shown
              </span>
            )}
            <span>Grain throughput (t/day) along the bottom</span>
          </div>

          <p className="text-[10px] text-[#767680] pt-3 border-t border-[#e0e3e6]">
            Bars are scaled between the series minimum and maximum, not from zero, because these
            curves vary by a few percent across the range and a zero-based axis would render them
            flat. The range is printed above. This is a sensitivity curve from the model, not a
            historical trend: no historian is connected, so the project has no real time series to
            plot.
          </p>
        </div>
      )}
    </div>
  );
};
