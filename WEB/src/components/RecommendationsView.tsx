import React, { useState } from 'react';
import { Sparkles, Bot, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePlantFigures } from '../hooks/usePlantFigures';
import { buildPlantState } from '../lib/plantState';
import { getRecommendations } from '@backend/recommend.js';
import { DatasetAnalysisCard } from './DatasetAnalysisCard';
import { TabType } from '../types';

interface RecommendationsViewProps {
  onNavigateTab?: (tab: TabType) => void;
}

/**
 * Recommendations generated from the plant's own figures.
 *
 * This screen used to be three hardcoded worked examples with invented savings
 * ("$4,200 / month", a fouling factor of 0.0028) and an Adopt button that only
 * marked the card locally. It now runs the same path the AI Optimization screen
 * does: model output and screened scenarios go to the LLM, which is told to use
 * only the numbers it is given.
 */
export const RecommendationsView: React.FC<RecommendationsViewProps> = ({ onNavigateTab }) => {
  const { model, loading, error, grainInputTpd } = usePlantFigures();

  const [advice, setAdvice] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  // The throughput the visible advice was written for. Submitting new readings
  // does not invalidate it automatically, and stale advice that still looks
  // current is worse than none.
  const [adviceTpd, setAdviceTpd] = useState<number | null>(null);

  const isStale = advice !== null && adviceTpd !== null && Math.abs(adviceTpd - grainInputTpd) > 0.05;

  const generate = async () => {
    if (!model) return;

    setIsAsking(true);
    setAdvice(null);
    setAdviceError(null);
    setProvider(null);

    const result = await getRecommendations(buildPlantState(model, grainInputTpd));

    setAdvice(result.recommendations);
    setProvider(result.provider);
    setAdviceError(result.error);
    if (result.recommendations) setAdviceTpd(grainInputTpd);
    setIsAsking(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2.5 py-0.5 rounded-full">
            AI Engineering Insights
          </span>
          <h2 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mt-1">
            Plant Recommendations
          </h2>
          <p className="text-xs text-[#45464f] mt-1">
            What to change, written from your own figures at{' '}
            <strong className="font-mono">{grainInputTpd.toFixed(1)}</strong> t/day. Nothing here is
            a stock
            suggestion.
          </p>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={isAsking || loading || !model}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0f6e8c] hover:bg-[#0b5670] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer shrink-0"
        >
          {isAsking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : advice ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Bot className="w-3.5 h-3.5" />
          )}
          <span>{isAsking ? 'Analysing...' : advice ? 'Regenerate' : 'Generate Recommendations'}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not load the consumption model: {error}</span>
        </div>
      )}

      {adviceError && (
        <div className="flex items-start gap-2 p-3.5 bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 rounded-xl text-xs text-[#BA1A1A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{adviceError}</span>
        </div>
      )}

      {!advice && !isAsking && !adviceError && (
        <div className="bg-white rounded-xl border border-dashed border-[#c6c5d1] p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#0f6e8c]/10 flex items-center justify-center mx-auto text-[#0f6e8c]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-[#061449]">Nothing generated yet</h3>
          <p className="text-xs text-[#767680] max-w-md mx-auto leading-relaxed">
            Recommendations are written on demand from your current throughput, the model's predicted
            consumption and the screened distillation scenarios. They are not cached, so what you get
            reflects the numbers on screen right now.
          </p>
        </div>
      )}

      {isAsking && (
        <div className="bg-white rounded-xl border border-[#e0e3e6] p-6 space-y-3">
          <div className="h-3 bg-[#eceef1] rounded animate-pulse w-3/4" />
          <div className="h-3 bg-[#eceef1] rounded animate-pulse w-full" />
          <div className="h-3 bg-[#eceef1] rounded animate-pulse w-5/6" />
          <div className="h-3 bg-[#eceef1] rounded animate-pulse w-2/3" />
        </div>
      )}

      <DatasetAnalysisCard />

      {advice && (
        <div
          className={`bg-white rounded-xl border shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-4 ${
            isStale ? 'border-[#FFB703]/60' : 'border-[#e0e3e6]'
          }`}
        >
          {isStale && (
            <div className="flex items-start gap-2 p-3 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg text-xs text-[#8a6100]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                These were written for{' '}
                <strong className="font-mono">{adviceTpd?.toFixed(1)} t/day</strong>, but you are now
                running <strong className="font-mono">{grainInputTpd.toFixed(1)}</strong>. Regenerate
                before acting on them.
              </span>
            </div>
          )}

          <p
            className={`text-sm whitespace-pre-line leading-relaxed ${
              isStale ? 'text-[#767680]' : 'text-[#191c1e]'
            }`}
          >
            {advice}
          </p>

          <div className="pt-3 border-t border-[#e0e3e6] space-y-2">
            {provider && (
              <p className="text-[11px] text-[#767680]">
                Written by an open-weight model via {provider}. Every figure it cites came from the
                network and the emission formulas; the model only puts them into sentences.
              </p>
            )}
            <p className="text-[11px] text-[#767680]">
              Sanity-check against the scenario table before changing anything on the plant.{' '}
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('ai-optimization')}
                  className="text-[#0f6e8c] font-bold hover:underline cursor-pointer"
                >
                  Open AI Optimization
                </button>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
