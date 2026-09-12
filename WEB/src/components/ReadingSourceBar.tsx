import React from 'react';
import { Gauge, ArrowUpRight, CircleDashed } from 'lucide-react';
import { describeSource, type InputSource } from '../hooks/usePlantInput';
import type { TabType } from '../types';

interface ReadingSourceBarProps {
  grainInputTpd: number;
  source: InputSource;
  updatedAt: string | null;
  onNavigateTab?: (tab: TabType) => void;
}

/**
 * States the operating point a screen's figures were computed from, and where it
 * came from.
 *
 * Carbon and Analytics both derive everything from one throughput. Without this
 * they showed a precise number with no provenance, which invites the assumption
 * that it is a live measurement rather than the reading you last submitted.
 */
export const ReadingSourceBar: React.FC<ReadingSourceBarProps> = ({
  grainInputTpd,
  source,
  updatedAt,
  onNavigateTab,
}) => {
  const isDefault = source === 'default';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs ${
        isDefault
          ? 'bg-[#eceef1] border-[#c6c5d1] text-[#45464f]'
          : 'bg-[#0f6e8c]/5 border-[#0f6e8c]/25 text-[#0f6e8c]'
      }`}
    >
      <span className="flex items-center gap-2">
        {isDefault ? (
          <CircleDashed className="w-4 h-4 shrink-0" />
        ) : (
          <Gauge className="w-4 h-4 shrink-0" />
        )}
        <span>
          Computed at{' '}
          <strong className="font-mono">{grainInputTpd.toFixed(1)} t/day</strong>.{' '}
          {describeSource(source, updatedAt)}.
        </span>
      </span>

      {onNavigateTab && (
        <button
          onClick={() => onNavigateTab('process-monitor')}
          className="font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>{isDefault ? 'Enter your readings' : 'Change readings'}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
