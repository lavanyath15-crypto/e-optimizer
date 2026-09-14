import React, { useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Bot,
  X,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { buildPlantState } from '../../lib/plantState';
import {
  DATASET_LIMITS,
  DatasetError,
  analyseDataset as analyseLocally,
  parseDataset,
  summaryForPrompt,
  type DatasetSummary,
} from '../../lib/datasetAnalysis';
import { analyseDataset as askModel } from '@backend/recommend.js';

/**
 * Upload a plant export, get it reviewed.
 *
 * The file is parsed and reduced to statistics in the browser. Only that summary
 * is sent onward, never the rows: a plant's production history is commercially
 * sensitive, and aggregates are what the language model can actually reason over
 * anyway.
 */
export const DatasetAnalysisCard: React.FC = () => {
  const { model, grainInputTpd } = usePlantFigures();
  const inputRef = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [advice, setAdvice] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const reset = () => {
    setSummary(null);
    setParseError(null);
    setAdvice(null);
    setAdviceError(null);
    setProvider(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    reset();
    setIsParsing(true);

    try {
      if (file.size > DATASET_LIMITS.fileBytes) {
        throw new DatasetError(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${
            DATASET_LIMITS.fileBytes / 1024 / 1024
          } MB limit.`
        );
      }

      const text = await file.text();
      // Dispatches on content: CSV, TSV, semicolon- or pipe-delimited, or JSON.
      const parsed = parseDataset(text, file.name);
      setSummary(analyseLocally(file.name, parsed, model));
    } catch (err) {
      setParseError(
        err instanceof DatasetError
          ? err.message
          : err instanceof Error
          ? `Could not read that file: ${err.message}`
          : 'Could not read that file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const requestAnalysis = async () => {
    if (!summary || !model) return;

    setIsAsking(true);
    setAdvice(null);
    setAdviceError(null);
    setProvider(null);

    const result = await askModel(
      summaryForPrompt(summary),
      buildPlantState(model, grainInputTpd)
    );

    setAdvice(result.recommendations);
    setProvider(result.provider);
    setAdviceError(result.error);
    setIsAsking(false);
  };

  const fmt = (value: number, dp = 2) =>
    value.toLocaleString(undefined, { maximumFractionDigits: dp });

  return (
    <div className="bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-5">
      <div>
        <h3 className="text-base font-bold text-[#061449]">Analyse your own dataset</h3>
        <p className="text-xs text-[#767680] mt-1">
          Upload a CSV export from your historian. It gets scored against the trained model, then
          written up.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 bg-[#2D6A4F]/5 border border-[#2D6A4F]/25 rounded-lg text-[11px] text-[#2D6A4F]">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Your file is read in this browser and never uploaded. Only the summary below &mdash; column
          ranges, means and how they compare to the model &mdash; is sent for analysis. Individual
          rows never leave your machine.
        </span>
      </div>

      {!summary && (
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
            if (file) void handleFile(file);
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
            {isParsing ? 'Reading your file...' : 'Drop an export here'}
          </p>
          <p className="text-xs text-[#767680] mt-1">
            or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[#0f6e8c] font-bold hover:underline cursor-pointer"
            >
              choose a file
            </button>
          </p>
          <p className="text-[11px] text-[#767680] mt-3">
            CSV, TSV, semicolon or pipe delimited, or JSON. The separator is detected, so there is no
            need to convert anything. Up to {DATASET_LIMITS.fileBytes / 1024 / 1024} MB and{' '}
            {DATASET_LIMITS.rows.toLocaleString()} rows.
          </p>
          <p className="text-[11px] text-[#767680] mt-1">
            Name a column <span className="font-mono">Grain_Input_tpd</span> to have consumption
            scored against the model. Excel needs exporting to CSV first.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.json,.dat,text/csv,text/plain,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 p-3 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-lg text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}

      {summary && (
        <>
          <div className="flex items-center justify-between gap-3 p-3 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6]">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-[#0f6e8c] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#061449] truncate">{summary.fileName}</p>
                <p className="text-[11px] text-[#767680]">
                  {summary.rowCount.toLocaleString()} rows, {summary.columnCount} columns,{' '}
                  {summary.numericColumns.length} numeric
                  {summary.timeSpan &&
                    ` · ${summary.timeSpan.from} to ${summary.timeSpan.to} (${summary.timeSpan.days}d)`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              title="Remove this file"
              aria-label="Remove this file"
              className="p-1.5 text-[#767680] hover:text-[#BA1A1A] hover:bg-[#eceef1] rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {summary.warnings.length > 0 && (
            <div className="space-y-1.5">
              {summary.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-2 p-2.5 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg text-[11px] text-[#8a6100]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {summary.comparisons.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#061449]">
                Your plant against the model
                <span className="ml-2 font-normal text-[#767680]">
                  computed here, before anything is sent
                </span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-[#767680] border-b border-[#e0e3e6]">
                      <th className="py-2 pr-4 font-bold">Measure</th>
                      <th className="py-2 pr-4 font-bold">Your mean</th>
                      <th className="py-2 pr-4 font-bold">Model predicts</th>
                      <th className="py-2 pr-4 font-bold">Bias</th>
                      <th className="py-2 pr-4 font-bold">R2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.comparisons.map((c) => (
                      <tr key={c.target} className="border-b border-[#e0e3e6]/60">
                        <td className="py-2.5 pr-4">
                          <span className="font-bold text-[#061449]">{c.label}</span>
                          <span className="block text-[10px] text-[#767680] font-mono">
                            {c.matchedColumn}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{fmt(c.meanActual, 1)}</td>
                        <td className="py-2.5 pr-4 font-mono">{fmt(c.meanPredicted, 1)}</td>
                        <td
                          className={`py-2.5 pr-4 font-mono font-bold ${
                            Math.abs(c.biasPct) > 10
                              ? 'text-[#8a6100]'
                              : 'text-[#2D6A4F]'
                          }`}
                        >
                          {c.biasPct >= 0 ? '+' : ''}
                          {fmt(c.biasPct, 1)}%
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{fmt(c.r2, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-[#767680]">
                Positive bias means your plant consumes more than the model expects for its
                throughput. A low or negative R2 means the model does not explain your data well,
                which says as much about the model as about your plant.
              </p>
            </div>
          )}

          {/* The headline finding, computed before the LLM is involved. Best
              quartile is what the plant already achieved on its better days, so
              it is demonstrated rather than a target someone invented. */}
          {summary.bands.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#061449]">
                Best days vs average
                <span className="ml-2 font-normal text-[#767680]">
                  what this plant has already proved it can run at
                </span>
              </h4>

              <div className="space-y-3">
                {summary.bands.map((b) => {
                  const trend = summary.trends.find((t) => t.measure === b.measure);
                  const span = b.worstQuartile - b.bestQuartile;
                  const pos = span > 0 ? ((b.overallMean - b.bestQuartile) / span) * 100 : 50;

                  return (
                    <div
                      key={b.measure}
                      className="p-3.5 bg-[#f7f9fc] rounded-lg border border-[#e0e3e6] space-y-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-bold text-[#061449]">{b.measure}</span>
                        {/* Below half a percent the "saving" is rounding, not a
                            finding. Saying so beats printing 1 kWh/day. */}
                        {b.savingPct < 0.5 ? (
                          <span className="text-xs font-mono font-bold text-[#767680]">
                            already consistent, nothing on the table
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold text-[#2D6A4F]">
                            {fmt(b.savingPerDay, 0)} {b.absoluteUnit}/day on the table{' '}
                            <span className="text-[#767680] font-normal">
                              ({fmt(b.savingPct, 1)}%)
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Best to worst, with the average marked on it. */}
                      <div className="relative h-2 bg-gradient-to-r from-[#2D6A4F]/30 via-[#FFB703]/30 to-[#BA1A1A]/30 rounded-full">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-4 bg-[#061449] rounded-full"
                          style={{ left: `${Math.min(100, Math.max(0, pos))}%` }}
                          title="Your average"
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-mono text-[#767680]">
                        <span>best {fmt(b.bestQuartile, 1)}</span>
                        <span className="text-[#061449] font-bold">
                          avg {fmt(b.overallMean, 1)} {b.unit}
                        </span>
                        <span>worst {fmt(b.worstQuartile, 1)}</span>
                      </div>

                      <p className="text-[10px] text-[#767680]">
                        {b.savingPct >= 0.5 &&
                          `${fmt(b.savingOverPeriod, 0)} ${b.absoluteUnit} over ${b.days} days. `}
                        Day-to-day spread {fmt(b.coefficientOfVariation, 1)}%
                        {b.coefficientOfVariation > 15 && ', which is wide enough to suggest control rather than equipment'}
                        .
                        {trend && trend.direction !== 'flat' && (
                          <span
                            className={
                              trend.direction === 'worsening'
                                ? ' text-[#8a6100] font-semibold'
                                : ' text-[#2D6A4F] font-semibold'
                            }
                          >
                            {' '}
                            Drifted {trend.changePctOverPeriod >= 0 ? '+' : ''}
                            {fmt(trend.changePctOverPeriod, 1)}% across the period (
                            {trend.direction}).
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* What actually moves consumption in THEIR plant. The project's own
              dataset found nothing above |r| = 0.19 outside throughput; theirs
              may differ, and that difference is the finding. */}
          {summary.correlations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#061449]">
                What moves consumption here
                <span className="ml-2 font-normal text-[#767680]">
                  strongest correlations in your data
                </span>
              </h4>

              <div className="space-y-1.5">
                {summary.correlations.slice(0, 6).map((c) => {
                  const strength = Math.min(100, Math.abs(c.r) * 100);
                  const notable = Math.abs(c.r) >= 0.3;
                  return (
                    <div key={`${c.column}-${c.against}`} className="space-y-1">
                      <div className="flex items-baseline justify-between text-[11px] gap-3">
                        <span className="text-[#45464f] truncate">
                          <span className="font-mono font-bold text-[#061449]">{c.column}</span>
                          <span className="text-[#767680]"> vs {c.against}</span>
                        </span>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            notable ? 'text-[#0f6e8c]' : 'text-[#767680]'
                          }`}
                        >
                          r = {c.r.toFixed(3)}
                        </span>
                      </div>
                      <div className="w-full bg-[#eceef1] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            notable ? 'bg-[#0f6e8c]' : 'bg-[#c6c5d1]'
                          }`}
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-[#767680]">
                Single-variable correlations on operating data, where levers tend to move together,
                so these suggest rather than prove. For scale: in the synthetic dataset this model
                was trained on, nothing except throughput exceeded |r| = 0.19.
              </p>
            </div>
          )}

          {summary.qualityFlags.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-[#061449]">Data quality</h4>
              {summary.qualityFlags.map((flag) => (
                <div
                  key={flag}
                  className="flex items-start gap-2 p-2.5 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg text-[11px] text-[#8a6100]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-[#e0e3e6] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <h4 className="text-xs font-bold text-[#061449]">What the assistant makes of it</h4>
              <button
                type="button"
                onClick={requestAnalysis}
                disabled={isAsking || !model}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {isAsking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : advice ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
                <span>{isAsking ? 'Analysing...' : advice ? 'Re-analyse' : 'Analyse Dataset'}</span>
              </button>
            </div>

            {adviceError && (
              <div className="flex items-start gap-2 p-3 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-lg text-xs text-[#BA1A1A]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{adviceError}</span>
              </div>
            )}

            {advice && (
              <div className="p-4 bg-[#f7f9fc] border border-[#e0e3e6] rounded-lg">
                <p className="text-xs text-[#191c1e] whitespace-pre-line leading-relaxed">
                  {advice}
                </p>
                {provider && (
                  <p className="text-[10px] text-[#767680] mt-3 pt-2 border-t border-[#e0e3e6]">
                    Written by an open-weight model via {provider}, from the statistics above. It was
                    not given your rows and cannot cite a specific day or batch.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
