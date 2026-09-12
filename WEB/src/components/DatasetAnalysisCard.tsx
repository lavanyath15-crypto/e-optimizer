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
import { usePlantFigures } from '../hooks/usePlantFigures';
import { buildPlantState } from '../lib/plantState';
import {
  DATASET_LIMITS,
  DatasetError,
  analyseDataset as analyseLocally,
  parseCsv,
  summaryForPrompt,
  type DatasetSummary,
} from '../lib/datasetAnalysis';
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
      const parsed = parseCsv(text);
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
            {isParsing ? 'Reading your file...' : 'Drop a CSV here'}
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
            Up to {DATASET_LIMITS.fileBytes / 1024 / 1024} MB and{' '}
            {DATASET_LIMITS.rows.toLocaleString()} rows. Name a column{' '}
            <span className="font-mono">Grain_Input_tpd</span> to have consumption scored against the
            model.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
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
