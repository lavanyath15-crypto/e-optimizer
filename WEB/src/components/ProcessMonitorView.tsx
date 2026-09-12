import React, { useEffect, useState } from 'react';
import { Cpu, Gauge, Droplets, Flame, Wind, Play, Pause, RotateCcw, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import {
  PROCESS_UNITS,
  PROCESS_DEFAULTS,
  ProcessValues,
  ProcessField,
  isInBand,
  clampToField,
  formatValue,
} from '../data/processUnits';
import { bushelsPerHourToTonnesPerDay } from '../lib/grainFeed';
import { usePlantInput } from '../hooks/usePlantInput';
import { SubmittedReadingResult } from './SubmittedReadingResult';

const STORAGE_KEY = 'eoptimizer-process-inputs';

const UNIT_ICONS: Record<string, React.ReactNode> = {
  milling: <Gauge className="w-4 h-4 text-[#0f6e8c]" />,
  liquefaction: <Flame className="w-4 h-4 text-[#FFB703]" />,
  fermentation: <Droplets className="w-4 h-4 text-[#4CC9F0]" />,
  distillation: <Cpu className="w-4 h-4 text-[#0f6e8c]" />,
  drying: <Wind className="w-4 h-4 text-[#767680]" />,
};

/** Merge saved values over the defaults so a new field never comes back undefined. */
function loadValues(): ProcessValues {
  const merged: ProcessValues = {};
  for (const unit of PROCESS_UNITS) {
    merged[unit.id] = { ...PROCESS_DEFAULTS[unit.id] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return merged;

    const saved = JSON.parse(raw) as ProcessValues;
    for (const unit of PROCESS_UNITS) {
      for (const field of unit.fields) {
        const value = saved?.[unit.id]?.[field.key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          merged[unit.id][field.key] = clampToField(field, value);
        }
      }
    }
  } catch {
    // Corrupt or unavailable storage just falls back to the defaults.
  }
  return merged;
}

export const ProcessMonitorView: React.FC = () => {
  const [selectedUnit, setSelectedUnit] = useState<string>('distillation');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [values, setValues] = useState<ProcessValues>(loadValues);
  // Raw text per input so a half-typed value like "1." is not clobbered mid-edit.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const { applyProcessReadings } = usePlantInput();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Storage can be unavailable in private mode; entered values still work
      // for this session.
    }
  }, [values]);

  const unit = PROCESS_UNITS.find((u) => u.id === selectedUnit)!;

  const commit = (unitId: string, field: ProcessField, raw: string) => {
    const parsed = parseFloat(raw);
    setValues((prev) => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        // Clearing the box or typing junk restores the previous reading rather
        // than silently writing the field minimum.
        [field.key]: Number.isNaN(parsed)
          ? prev[unitId][field.key]
          : clampToField(field, parsed),
      },
    }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[`${unitId}.${field.key}`];
      return next;
    });
  };

  const resetUnit = (unitId: string) => {
    setValues((prev) => ({ ...prev, [unitId]: { ...PROCESS_DEFAULTS[unitId] } }));
    setDrafts({});
    setSubmittedAt(null);
  };

  /**
   * Applies every pending edit at once.
   *
   * Fields commit on blur, so typing a value and hitting Submit without leaving
   * the box would otherwise discard it. This flushes the drafts first, which is
   * the behaviour the button implies.
   */
  const submitReadings = () => {
    setValues((prev) => {
      const next: ProcessValues = { ...prev };

      for (const u of PROCESS_UNITS) {
        for (const field of u.fields) {
          const raw = drafts[`${u.id}.${field.key}`];
          if (raw === undefined) continue;

          const parsed = parseFloat(raw);
          // Same rule as commit(): junk keeps the previous reading rather than
          // silently writing the field minimum.
          if (Number.isNaN(parsed)) continue;

          next[u.id] = { ...next[u.id], [field.key]: clampToField(field, parsed) };
        }
      }

      return next;
    });

    setDrafts({});
    setSubmittedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Push the readings that other screens can actually use. Drafts are read
    // directly because the setValues above has not flushed yet at this point.
    const readingOf = (unitId: string, fieldKey: string): number => {
      const unit = PROCESS_UNITS.find((u) => u.id === unitId)!;
      const field = unit.fields.find((f) => f.key === fieldKey)!;
      const draft = drafts[`${unitId}.${fieldKey}`];

      if (draft !== undefined) {
        const parsed = parseFloat(draft);
        if (!Number.isNaN(parsed)) return clampToField(field, parsed);
      }
      return values[unitId][fieldKey];
    };

    applyProcessReadings({
      // Bushels per hour off the mill scale is what an operator reads; tonnes
      // per day is what the network takes.
      grainInputTpd: bushelsPerHourToTonnesPerDay(readingOf('milling', 'feedRate')),
      // Not a model input, but it places the plant against the screened
      // scenarios on the Carbon and AI Optimization screens.
      refluxRatio: readingOf('distillation', 'refluxRatio'),
    });
  };

  const pendingCount = Object.keys(drafts).length;

  const outOfBandCount = unit.fields.filter(
    (f) => !isInBand(f, values[unit.id][f.key])
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Operator-Entered Readings
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Process Monitor
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            Every stage on one screen. Type in what you're actually reading and the map updates as you go.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isSimulating ? 'bg-[#2D6A4F] text-white' : 'bg-[#eceef1] text-[#45464f]'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {/* There is no stream. This toggles whether the cards highlight as
                you type; it used to claim "Live Telemetry Stream: Active". */}
            <span>{isSimulating ? 'Highlight changes: on' : 'Highlight changes: off'}</span>
          </button>
        </div>
      </div>

      {/* Process Schematic Card */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#061449]">
            Interactive Plant Topology Map
          </h3>
          <div className="flex items-center gap-2 text-xs text-[#767680]">
            <span>Values you enter, not a feed</span>
          </div>
        </div>

        {/* Process Flow Diagram / Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {PROCESS_UNITS.map((u) => {
            const headline = u.fields[0];
            const sub = u.fields[1];
            const headlineValue = values[u.id][headline.key];
            const subValue = values[u.id][sub.key];
            const unitOutOfBand = u.fields.filter(
              (f) => !isInBand(f, values[u.id][f.key])
            ).length;

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUnit(u.id)}
                aria-pressed={selectedUnit === u.id}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                  selectedUnit === u.id
                    ? 'border-[#0f6e8c] bg-[#0f6e8c]/5 shadow-sm ring-2 ring-[#0f6e8c]/20'
                    : 'border-[#e0e3e6] bg-[#f7f9fc] hover:bg-[#eceef1]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-[#061449]">
                  <span>{u.step}. {u.name}</span>
                  {UNIT_ICONS[u.id]}
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="text-[11px] text-[#767680]">{u.equipment}</div>
                  <div className="font-mono font-bold text-[#061449]">
                    {formatValue(headline, headlineValue)}{headline.unit && ` ${headline.unit}`}
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${
                      isInBand(sub, subValue) ? 'text-[#2D6A4F]' : 'text-[#8a6100]'
                    }`}
                  >
                    {sub.label}: {formatValue(sub, subValue)}{sub.unit && ` ${sub.unit}`}
                  </div>
                  {unitOutOfBand > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#8a6100] pt-0.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{unitOutOfBand} outside band</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Unit Inputs */}
        <div className="p-5 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-[#061449]">
                Process Inputs: {unit.name}
              </h4>
              <p className="text-[11px] text-[#767680] mt-0.5">
                {unit.equipment}. Type in what you're reading and the card above follows along.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {outOfBandCount === 0 ? (
                <span className="flex items-center gap-1.5 text-xs text-[#2D6A4F] font-bold bg-[#2D6A4F]/10 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All inputs within band</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-[#8a6100] font-bold bg-[#FFB703]/20 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{outOfBandCount} outside normal band</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => resetUnit(unit.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c6c5d1] text-[#45464f] hover:bg-[#eceef1] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unit.fields.map((field) => {
              const draftKey = `${unit.id}.${field.key}`;
              const value = values[unit.id][field.key];
              const inBand = isInBand(field, value);
              const inputId = `input-${draftKey}`;

              return (
                <div
                  key={field.key}
                  className="bg-white p-3.5 rounded-lg border border-[#e0e3e6] space-y-1.5"
                >
                  <label
                    htmlFor={inputId}
                    className="text-[11px] text-[#767680] block font-medium"
                  >
                    {field.label}
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="number"
                      inputMode="decimal"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={drafts[draftKey] ?? String(value)}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                      }
                      onBlur={(e) => commit(unit.id, field, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-base font-bold text-[#061449] focus:outline-none focus:ring-2 transition-colors ${
                        inBand
                          ? 'border-[#c6c5d1] focus:border-[#0f6e8c] focus:ring-[#0f6e8c]/20'
                          : 'border-[#FFB703] bg-[#FFB703]/5 focus:border-[#8a6100] focus:ring-[#FFB703]/30'
                      }`}
                    />
                    {field.unit && (
                      <span className="text-xs font-semibold text-[#767680] shrink-0">
                        {field.unit}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-[11px] font-semibold ${
                      inBand ? 'text-[#2D6A4F]' : 'text-[#8a6100]'
                    }`}
                  >
                    {inBand ? 'Within band' : 'Outside band'} ({formatValue(field, field.normalMin)}
                    {' to '}
                    {formatValue(field, field.normalMax)}
                    {field.unit && ` ${field.unit}`})
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e0e3e6]">
            <div className="text-[11px] min-h-[18px]">
              {pendingCount > 0 ? (
                <span className="text-[#8a6100] font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {pendingCount} unsaved {pendingCount === 1 ? 'edit' : 'edits'}
                  </span>
                </span>
              ) : submittedAt ? (
                <span className="text-[#2D6A4F] font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Readings saved to this browser at {submittedAt}</span>
                </span>
              ) : (
                <span className="text-[#767680]">
                  Readings save as you go. Submit applies anything still being typed.
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={submitReadings}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Submit Readings</span>
            </button>
          </div>

          <p className="text-[10px] text-[#767680] pt-1 border-t border-[#e0e3e6]">
            Heads up: those normal bands are typical dry-mill numbers, not your commissioned
            limits. Swap them for your real ones before anyone makes a call off this screen.
            Submitting stores what you type in this browser only. Nothing is sent to a DCS or
            historian, and nothing is written to a server.
          </p>
        </div>
      </div>

      {submittedAt && (
        <SubmittedReadingResult enteredRefluxRatio={values.distillation.refluxRatio} />
      )}
    </div>
  );
};
