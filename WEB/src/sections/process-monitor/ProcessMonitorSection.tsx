import React, { useState, useRef } from 'react';
import {
  Cpu,
  Gauge,
  Droplets,
  Flame,
  Wind,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  X,
  Loader2,
  ShieldCheck,
  ChevronDown,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import {
  PROCESS_UNITS,
  PROCESS_DEFAULTS,
  isInBand,
  formatValue,
} from '../../data/processUnits';
import { tonnesPerDayToBushelsPerHour } from '../../lib/grainFeed';
import { usePlantInput, TRAINED_MIN_TPD, TRAINED_MAX_TPD } from '../../hooks/usePlantInput';
import { SubmittedReadingResult } from './SubmittedReadingResult';
import { DatasetAnalysisCard } from './DatasetAnalysisCard';
import { downloadProcessTemplate } from '../../lib/excelTemplate';
import { parseDatasetFile, columnStats, DatasetError, DATASET_LIMITS } from '../../lib/datasetAnalysis';
import { suggestReadings, toProcessValues, type ReadingSuggestion } from '../../lib/datasetReadings';
import type { TabType } from '../../types';

const UNIT_ICONS: Record<string, React.ReactNode> = {
  milling: <Gauge className="w-4 h-4 text-[#0f6e8c]" />,
  liquefaction: <Flame className="w-4 h-4 text-[#FFB703]" />,
  fermentation: <Droplets className="w-4 h-4 text-[#4CC9F0]" />,
  distillation: <Cpu className="w-4 h-4 text-[#0f6e8c]" />,
  drying: <Wind className="w-4 h-4 text-[#767680]" />,
};

interface ProcessMonitorSectionProps {
  onNavigateTab?: (tab: TabType) => void;
}

export const ProcessMonitorSection: React.FC<ProcessMonitorSectionProps> = ({ onNavigateTab }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { readings: values, hasSubmitted, updatedAt, applyProcessReadings } = usePlantInput();

  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [suggestion, setSuggestion] = useState<ReadingSuggestion | null>(null);
  const [detectedRowCount, setDetectedRowCount] = useState<number>(0);
  const [detectedColumnCount, setDetectedColumnCount] = useState<number>(0);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showFullDatasetAnalytics, setShowFullDatasetAnalytics] = useState(false);

  const handleProcessFile = async (file: File) => {
    setParseError(null);
    setSubmitSuccess(false);
    setIsParsing(true);
    setSelectedFile(file);

    try {
      if (file.size > DATASET_LIMITS.fileBytes) {
        throw new DatasetError(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${
            DATASET_LIMITS.fileBytes / 1024 / 1024
          } MB limit.`
        );
      }

      const parsed = await parseDatasetFile(file);
      setDetectedRowCount(parsed.rows.length);
      setDetectedColumnCount(parsed.headers.length);

      const stats = columnStats(parsed.headers, parsed.rows);
      const suggested = suggestReadings(stats);

      if (suggested.readings.length === 0) {
        throw new DatasetError(
          'No columns matched any standard process parameters. Use the sample Excel template to ensure column headers match.'
        );
      }

      setSuggestion(suggested);
    } catch (err) {
      setSuggestion(null);
      setParseError(
        err instanceof DatasetError
          ? err.message
          : err instanceof Error
          ? `Could not read that spreadsheet: ${err.message}`
          : 'Could not read that file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmitProcessData = () => {
    if (!suggestion || suggestion.readings.length === 0) return;
    const processPatch = toProcessValues(suggestion.readings);
    applyProcessReadings(processPatch);
    setSubmitSuccess(true);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSuggestion(null);
    setParseError(null);
    setSubmitSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreDefaults = () => {
    applyProcessReadings(PROCESS_DEFAULTS);
    handleReset();
  };

  // Check grain input training envelope
  const grainTpd = values.milling.feedRate;
  const isGrainOutsideTraining = grainTpd < TRAINED_MIN_TPD || grainTpd > TRAINED_MAX_TPD;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="pb-2 border-b border-[#e0e3e6]/60 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            Plant Process Data
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Process Monitor
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            Submit your plant process Excel spreadsheet (.xlsx, .xls) to update all unit operations and drive real-time optimization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadProcessTemplate()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#c6c5d1] hover:border-[#0f6e8c] text-[#061449] hover:text-[#0f6e8c] rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Download formatted Excel template matching plant parameters"
          >
            <Download className="w-3.5 h-3.5 text-[#0f6e8c]" />
            <span>Download Template (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#c6c5d1] text-[#45464f] hover:bg-[#eceef1] rounded-lg text-xs font-bold transition-colors cursor-pointer"
            title="Reset plant state to calibrated nominal defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Interactive Plant Topology Map (Live Status Cards) */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#061449]">
              Plant Topology & Stage Telemetry
            </h3>
            <p className="text-xs text-[#767680] mt-0.5">
              Live operating parameters across all 5 dry-mill stages. Driven by your submitted process spreadsheet.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {hasSubmitted ? (
              <span className="flex items-center gap-1.5 text-xs text-[#2D6A4F] font-bold bg-[#2D6A4F]/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Operating Point{updatedAt ? ` · ${updatedAt}` : ''}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[#8a6100] font-bold bg-[#FFB703]/10 px-2.5 py-1 rounded-full border border-[#FFB703]/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Awaiting submission</span>
              </span>
            )}
          </div>
        </div>

        {/* 5 Stage Overview Cards.
            Values only ever came from PROCESS_DEFAULTS before a submission, and
            the band check ran against those defaults too -- so a card could say
            "1 outside band" about a number nobody entered. Nothing here is a
            real reading until hasSubmitted is true, so nothing is shown as one:
            every field renders as an em dash until then. */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {PROCESS_UNITS.map((u) => {
            const headline = u.fields[0];
            const sub = u.fields[1];
            const third = u.fields[2];
            const headlineValue = values[u.id][headline.key];
            const subValue = values[u.id][sub.key];
            const thirdValue = values[u.id][third.key];
            const unitOutOfBand = u.fields.filter(
              (f) => !isInBand(f, values[u.id][f.key])
            ).length;

            return (
              <div
                key={u.id}
                className="p-4 rounded-xl border border-[#e0e3e6] bg-[#f7f9fc] hover:border-[#0f6e8c]/40 transition-all text-left space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-[#061449] border-b border-[#e0e3e6]/60 pb-2">
                  <span>{u.step}. {u.name}</span>
                  {UNIT_ICONS[u.id]}
                </div>

                <div className="text-[11px] text-[#767680] font-medium">{u.equipment}</div>

                <div className="space-y-1.5 pt-1">
                  {/* Field 1 (Headline) */}
                  <div>
                    <span className="text-[10px] text-[#767680] block">{headline.label}</span>
                    <div className="font-mono text-sm font-bold text-[#061449]">
                      {hasSubmitted
                        ? `${formatValue(headline, headlineValue)}${headline.unit ? ` ${headline.unit}` : ''}`
                        : '—'}
                    </div>
                  </div>

                  {/* Field 2 */}
                  <div className="text-[11px]">
                    <span className="text-[10px] text-[#767680] block">{sub.label}</span>
                    <div
                      className={`font-mono font-semibold ${
                        !hasSubmitted
                          ? 'text-[#767680]'
                          : isInBand(sub, subValue)
                          ? 'text-[#2D6A4F]'
                          : 'text-[#8a6100]'
                      }`}
                    >
                      {hasSubmitted
                        ? `${formatValue(sub, subValue)}${sub.unit ? ` ${sub.unit}` : ''}`
                        : '—'}
                    </div>
                  </div>

                  {/* Field 3 */}
                  <div className="text-[11px]">
                    <span className="text-[10px] text-[#767680] block">{third.label}</span>
                    <div
                      className={`font-mono font-semibold ${
                        !hasSubmitted
                          ? 'text-[#767680]'
                          : isInBand(third, thirdValue)
                          ? 'text-[#2D6A4F]'
                          : 'text-[#8a6100]'
                      }`}
                    >
                      {hasSubmitted
                        ? `${formatValue(third, thirdValue)}${third.unit ? ` ${third.unit}` : ''}`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="pt-2 border-t border-[#e0e3e6]/60">
                  {!hasSubmitted ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#767680]">
                      <span>Awaiting data</span>
                    </span>
                  ) : unitOutOfBand > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#8a6100]">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{unitOutOfBand} outside band</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#2D6A4F]">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>All within band</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grain Input Footnote */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[#767680] pt-2 border-t border-[#e0e3e6]/60">
          {hasSubmitted ? (
            <div>
              Current Throughput:{' '}
              <strong className="text-[#061449] font-mono">{grainTpd.toFixed(1)} t/day</strong>
              {' '}(= {tonnesPerDayToBushelsPerHour(grainTpd).toFixed(0)} bu/hr).
              {isGrainOutsideTraining && (
                <span className="text-[#8a6100] ml-2 font-semibold">
                  Outside trained {TRAINED_MIN_TPD}-{TRAINED_MAX_TPD} t/day model range.
                </span>
              )}
            </div>
          ) : (
            <div>
              No throughput submitted yet. Upload a spreadsheet below to see it here.
            </div>
          )}
          <span className="text-[11px] text-[#767680]">
            Normal bands reflect typical dry-mill commissioning specs.
          </span>
        </div>
      </div>

      {/* Excel Process Submission Card */}
      <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#0f6e8c]" />
              <h3 className="text-base font-bold text-[#061449]">
                Submit Process Readings via Excel Sheet (.xlsx / .xls)
              </h3>
            </div>
            <p className="text-xs text-[#767680] mt-1">
              Upload your plant log or shift data spreadsheet. All 5 process stages (Milling, Liquefaction, Fermentation, Distillation, DDGS) will be updated automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadProcessTemplate()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f6e8c]/10 text-[#0f6e8c] hover:bg-[#0f6e8c]/20 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample Template</span>
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 bg-[#2D6A4F]/5 border border-[#2D6A4F]/25 rounded-lg text-[11px] text-[#2D6A4F]">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Spreadsheets are read entirely inside your browser. No files or plant rows are transmitted to an external server.
          </span>
        </div>

        {/* Upload Box */}
        {!suggestion && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleProcessFile(file);
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? 'border-[#0f6e8c] bg-[#0f6e8c]/5' : 'border-[#c6c5d1] bg-[#f7f9fc]'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#0f6e8c]/10 flex items-center justify-center mx-auto text-[#0f6e8c] mb-3">
              {isParsing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <p className="text-sm font-bold text-[#061449]">
              {isParsing ? 'Reading and matching spreadsheet...' : 'Drop your process Excel file (.xlsx, .xls) here'}
            </p>
            <p className="text-xs text-[#767680] mt-1">
              or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#0f6e8c] font-bold hover:underline cursor-pointer"
              >
                browse to choose a file
              </button>
            </p>
            <p className="text-[11px] text-[#767680] mt-3">
              Supports Excel (.xlsx, .xls) and CSV files. Both single-shift logs and multi-row exports are supported.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleProcessFile(file);
              }}
            />
          </div>
        )}

        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-lg text-xs text-[#BA1A1A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">File Reading Notice</span>
              <span>{parseError}</span>
            </div>
          </div>
        )}

        {/* Parsed Preview & Submit Action */}
        {suggestion && (
          <div className="space-y-4">
            {/* File Info Bar */}
            <div className="flex items-center justify-between gap-3 p-3 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-[#0f6e8c] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#061449] truncate">
                    {selectedFile?.name ?? 'Uploaded Spreadsheet'}
                  </p>
                  <p className="text-[11px] text-[#767680]">
                    {detectedRowCount.toLocaleString()} {detectedRowCount === 1 ? 'record' : 'rows'} detected · {detectedColumnCount} columns · {suggestion.readings.length} process parameters matched
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                title="Upload different file"
                aria-label="Upload different file"
                className="p-1.5 text-[#767680] hover:text-[#BA1A1A] hover:bg-[#eceef1] rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Extracted Parameters Preview */}
            <div className="p-4 bg-[#0f6e8c]/5 border border-[#0f6e8c]/25 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#061449]">
                    Matched Process Stage Parameters ({suggestion.readings.length} of 15)
                  </h4>
                  <p className="text-[11px] text-[#45464f] mt-0.5">
                    Values extracted from your spreadsheet. Review the detected parameters below before committing to the plant system.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitProcessData}
                    disabled={submitSuccess}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:bg-[#2D6A4F] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    {submitSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Committed to Plant System</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Process Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {submitSuccess && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded-lg text-xs text-[#2D6A4F] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Process data successfully applied! All 5 stages, Overview KPIs, Distillation Screening, and Carbon Intelligence are running on these values.
                    </span>
                  </div>

                  {onNavigateTab && (
                    <div className="p-4 bg-[#0f6e8c]/5 border border-[#0f6e8c]/20 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-[#061449]">
                        View results across the dashboard:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { tab: 'overview', label: 'Plant Overview', color: 'bg-[#061449]/10 text-[#061449] border-[#061449]/20 hover:bg-[#061449]/20' },
                          { tab: 'carbon', label: 'Carbon & CO2e', color: 'bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20 hover:bg-[#2D6A4F]/20' },
                          { tab: 'analytics', label: 'Plant Analytics', color: 'bg-[#0f6e8c]/10 text-[#0f6e8c] border-[#0f6e8c]/20 hover:bg-[#0f6e8c]/20' },
                          { tab: 'ai-optimization', label: 'AI Optimization', color: 'bg-[#0f6e8c]/10 text-[#0f6e8c] border-[#0f6e8c]/20 hover:bg-[#0f6e8c]/20' },
                          { tab: 'recommendations', label: 'Plant Recommendations', color: 'bg-[#8a6100]/10 text-[#8a6100] border-[#8a6100]/20 hover:bg-[#8a6100]/20' },
                          { tab: 'reports', label: 'System Reports', color: 'bg-[#45464f]/10 text-[#45464f] border-[#45464f]/20 hover:bg-[#45464f]/20' },
                        ] as { tab: TabType; label: string; color: string }[]).map(({ tab, label, color }) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => onNavigateTab(tab)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${color}`}
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grid of Matched Readings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggestion.readings.map((r) => (
                  <div
                    key={`${r.unitId}.${r.fieldKey}`}
                    className="flex items-baseline justify-between gap-2 text-[11px] bg-white rounded-lg border border-[#e0e3e6] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-[#061449] block truncate">{r.label}</span>
                      <span className="text-[10px] text-[#767680] block truncate">
                        {r.unitName} · col: <span className="font-mono">{r.column}</span>
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold text-xs ${
                          r.clamped ? 'text-[#8a6100]' : 'text-[#061449]'
                        }`}
                      >
                        {r.value.toFixed(2)}
                        {r.unit && ` ${r.unit}`}
                      </span>
                      {r.clamped && (
                        <span className="block text-[9px] text-[#8a6100] font-semibold">clamped</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {suggestion.unmatched.length > 0 && (
                <p className="text-[11px] text-[#767680] pt-1">
                  Unmatched parameters ({suggestion.unmatched.length}) will retain their current plant baseline values:{' '}
                  <span className="italic">{suggestion.unmatched.map((u) => u.label).join(', ')}</span>.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submitted Reading Operational Impact / Scenarios */}
      {hasSubmitted && (
        <SubmittedReadingResult enteredRefluxRatio={values.distillation.refluxRatio} />
      )}

      {/* Expandable Historian & AI Correlation Analytics Card */}
      <div className="border border-[#e0e3e6] rounded-xl overflow-hidden bg-white shadow-[0px_4px_20px_rgba(30,42,94,0.04)]">
        <button
          type="button"
          onClick={() => setShowFullDatasetAnalytics((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-[#f7f9fc] hover:bg-[#eceef1] text-left transition-colors cursor-pointer border-b border-[#e0e3e6]"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-[#0f6e8c]" />
            <div>
              <span className="text-xs font-bold text-[#061449]">
                Deep Historian Analytics & AI Review
              </span>
              <span className="block text-[11px] text-[#767680]">
                Quartile distributions, model comparison, and AI assistant advice for multi-row datasets.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#0f6e8c] font-bold">
            <span>{showFullDatasetAnalytics ? 'Hide Analytics' : 'Show Analytics'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showFullDatasetAnalytics ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {showFullDatasetAnalytics && (
          <div className="p-4">
            <DatasetAnalysisCard />
          </div>
        )}
      </div>
    </div>
  );
};
