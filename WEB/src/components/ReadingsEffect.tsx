import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import type { PhysicsResult, UnmodelledReading } from '../lib/processPhysics';

interface ReadingsEffectProps {
  physics: PhysicsResult;
  unmodelled: UnmodelledReading[];
  onNavigateToReadings?: () => void;
}

const signed = (value: number, digits = 1) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const round0 = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

/**
 * What each reading did to the numbers.
 *
 * The network takes one input, so the honest way to use the other readings is
 * as process-engineering corrections to its output, shown as corrections rather
 * than folded in silently. An operator can see which of their entries moved
 * which figure, by how much, and on what basis - and, just as importantly,
 * which entries moved nothing at all.
 */
export const ReadingsEffect: React.FC<ReadingsEffectProps> = ({
  physics,
  unmodelled,
  onNavigateToReadings,
}) => {
  const moved = physics.adjustments.filter((a) => Math.abs(a.changePct) >= 0.05);
  const failedChecks = physics.crossChecks.filter((c) => !c.ok);

  return (
    <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5">
      <div>
        <h3 className="text-base font-bold text-[#061449]">What your readings did</h3>
        <p className="text-xs text-[#767680] mt-0.5">
          The network takes one input, grain throughput. Your other readings are applied to its
          output as process-engineering corrections, each one shown here with the reason it exists.
        </p>
      </div>

      {/* Baseline -> adjusted */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Ethanol',
            unit: 'kL/day',
            from: physics.baseline.ethanolKl,
            to: physics.adjusted.ethanolKl,
            digits: 2,
          },
          {
            label: 'Distillation steam',
            unit: 'kg/day',
            from: physics.baseline.distillationSteamKg,
            to: physics.adjusted.distillationSteamKg,
            digits: 0,
          },
          {
            label: 'Dryer fuel',
            unit: 'MMBtu/day',
            from: physics.baseline.dryerFuelMmbtu,
            to: physics.adjusted.dryerFuelMmbtu,
            digits: 1,
          },
        ].map((row) => {
          const delta = row.from > 0 ? ((row.to - row.from) / row.from) * 100 : 0;
          const same = Math.abs(delta) < 0.05;

          return (
            <div key={row.label} className="p-3.5 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6]">
              <span className="text-[11px] text-[#767680] block">{row.label}</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-sm text-[#767680]">
                  {row.from.toFixed(row.digits)}
                </span>
                <ArrowRight className="w-3 h-3 text-[#3d93ad] shrink-0" />
                <span className="font-mono text-base font-bold text-[#061449]">
                  {row.to.toFixed(row.digits)}
                </span>
              </div>
              <span className="text-[11px] text-[#767680]">{row.unit}</span>
              <span
                className={`block text-[11px] font-bold mt-0.5 ${
                  same ? 'text-[#767680]' : 'text-[#0f6e8c]'
                }`}
              >
                {same ? 'unchanged by your readings' : `${signed(delta)}% from your readings`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Itemised corrections */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#061449] uppercase tracking-wider">
          Corrections applied
        </h4>

        {moved.length === 0 ? (
          <p className="text-xs text-[#767680]">
            Every reading is at the reference point the network was trained on, so nothing is
            being corrected. Change one on Process Monitor and it will appear here.
          </p>
        ) : (
          moved.map((a) => (
            <div
              key={a.id}
              className="p-3 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6] text-xs space-y-1"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="font-bold text-[#061449]">
                  {a.unit}: {a.reading}
                </span>
                <span className="font-mono font-bold text-[#0f6e8c] shrink-0">
                  {signed(a.changePct)}% {a.target.toLowerCase()}
                </span>
              </div>
              <p className="text-[11px] text-[#45464f]">{a.basis}</p>
            </div>
          ))
        )}
      </div>

      {/* Liquefaction, deliberately outside the ledger */}
      <div className="p-3.5 bg-[#0f6e8c]/5 border border-[#0f6e8c]/25 rounded-lg text-xs text-[#0f6e8c] flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-bold">
            Liquefaction steam: {round0(physics.liquefactionSteamKg)} kg/day.
          </strong>{' '}
          Heat to bring the mash from make-up water temperature to your cook setpoint, from your
          grain moisture, cook temperature and header pressure. It is{' '}
          <strong>not</strong> in the CO2e ledger, because the source dataset excludes its
          liquefaction steam column from the CO2e it reports. Adding it here would break the
          reconciliation the ledger above claims.
        </p>
      </div>

      {/* Cross-checks */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#061449] uppercase tracking-wider">
          Consistency checks
        </h4>
        {physics.crossChecks.map((check) => (
          <div
            key={check.id}
            className={`p-3 rounded-lg border text-xs space-y-1 ${
              check.ok
                ? 'bg-[#2D6A4F]/5 border-[#2D6A4F]/25'
                : 'bg-[#FFB703]/10 border-[#FFB703]/40'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-bold text-[#061449] flex items-center gap-1.5">
                {check.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#8a6100] shrink-0" />
                )}
                <span>{check.label}</span>
              </span>
              <span className="font-mono shrink-0 text-[#45464f]">
                you entered {check.entered}, implied {check.implied}
              </span>
            </div>
            {!check.ok && (
              <p className="text-[11px] text-[#8a6100]">
                That is {Math.abs(check.deviation * 100).toFixed(0)}% out. {check.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* What is not used. Naming these is the point. */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-bold text-[#061449] uppercase tracking-wider">
          Recorded, but not used in any figure
        </h4>
        <p className="text-[11px] text-[#767680]">
          These are shown on Process Monitor and checked against their bands, but nothing here
          derives a number from them. Giving them an invented sensitivity would be worse than
          leaving them out.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {unmodelled.map((item) => (
            <div
              key={`${item.unit}-${item.label}`}
              className="p-2.5 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6] text-[11px]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-[#061449]">{item.label}</span>
                <span className="font-mono text-[#45464f] shrink-0">{item.value}</span>
              </div>
              <p className="text-[#767680] mt-0.5">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {(failedChecks.length > 0 || moved.length > 0) && onNavigateToReadings && (
        <button
          onClick={onNavigateToReadings}
          className="text-xs font-bold text-[#0f6e8c] hover:underline cursor-pointer"
        >
          Change readings on Process Monitor
        </button>
      )}
    </div>
  );
};
