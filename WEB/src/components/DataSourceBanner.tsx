/**
 * DataSourceBanner
 *
 * Shows a contextual banner in every section confirming where the numbers
 * currently shown are derived from. Appears in three states:
 *
 * 1. No submission yet: shows a prompt to go to Process Monitor and submit data.
 * 2. Submitted from Excel: confirms data came from process spreadsheet + timestamp.
 * 3. Submitted from advisor slider: notes the source.
 *
 * Every section reads from the same usePlantInput context, so this banner
 * reflects the same state the numbers alongside it are derived from.
 */

import React from 'react';
import { CheckCircle2, FileSpreadsheet, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import type { InputSource } from '../hooks/usePlantInput';

interface DataSourceBannerProps {
  hasSubmitted: boolean;
  source: InputSource;
  updatedAt: string | null;
  grainInputTpd: number;
  /** Called to navigate to process-monitor. */
  onGoToProcessMonitor?: () => void;
}

export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({
  hasSubmitted,
  source,
  updatedAt,
  grainInputTpd,
  onGoToProcessMonitor,
}) => {
  if (!hasSubmitted) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FFB703]/5 border border-[#FFB703]/35 rounded-xl">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="w-5 h-5 text-[#8a6100] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#8a6100]">Running on nominal baseline data</p>
            <p className="text-xs text-[#8a6100]/80 mt-0.5">
              Submit your plant process readings (Excel spreadsheet or CSV) on the Process Monitor
              screen to see results computed from your actual operating point.
            </p>
          </div>
        </div>
        {onGoToProcessMonitor && (
          <button
            type="button"
            onClick={onGoToProcessMonitor}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Submit Process Data</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const isExcel = source === 'process-monitor';
  const isAdvisor = source === 'advisor';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border ${
        isExcel
          ? 'bg-[#2D6A4F]/5 border-[#2D6A4F]/25'
          : isAdvisor
          ? 'bg-[#0f6e8c]/5 border-[#0f6e8c]/25'
          : 'bg-[#f7f9fc] border-[#e0e3e6]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isExcel ? (
          <FileSpreadsheet className="w-4 h-4 text-[#2D6A4F] shrink-0" />
        ) : (
          <Activity className="w-4 h-4 text-[#0f6e8c] shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#061449]">
              {isExcel
                ? 'Live results from submitted process data'
                : isAdvisor
                ? 'Results from AI Optimization throughput input'
                : 'Running on default baseline'}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-2.5 h-2.5" />
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-[#767680] mt-0.5">
            Throughput: <span className="font-mono font-bold text-[#061449]">{grainInputTpd.toFixed(1)} t/day</span>
            {updatedAt && <span className="ml-2">· submitted {updatedAt}</span>}
            {isExcel && (
              <span className="ml-2 text-[#2D6A4F] font-semibold">
                · all sections reflect your plant's operating point
              </span>
            )}
          </p>
        </div>
      </div>

      {onGoToProcessMonitor && (
        <button
          type="button"
          onClick={onGoToProcessMonitor}
          className="flex items-center gap-1.5 text-xs text-[#0f6e8c] font-bold hover:text-[#0b5670] transition-colors cursor-pointer shrink-0"
        >
          <span>Update readings</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
