import React, { useState } from 'react';
import { Sparkles, DollarSign, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';

export const RecommendationsView: React.FC = () => {
  const [appliedList, setAppliedList] = useState<string[]>([]);

  const recs = [
    {
      id: 'rec-1',
      title: 'Shift Centrifuge CIP to Low-Tariff Off-Peak Window',
      category: 'Energy Cost Optimization',
      impact: '$4,200 / month savings',
      payback: 'Immediate (Zero CapEx)',
      description: 'Move Clean-in-Place (CIP) wash sequence for Decanter Centrifuges 1-4 from 15:00 to 22:00 to avoid high demand rate window.',
      effort: 'Low'
    },
    {
      id: 'rec-2',
      title: 'Beer Column Pre-Heater Tube Bundle Descaling',
      category: 'Thermal Recovery',
      impact: '1.2 k-lbs/hr steam reduction ($38,000 / yr)',
      payback: '1.5 months',
      description: 'Fouling factor on Exchanger E-101 has risen to 0.0028 hr-ft²-°F/Btu. Chemical flush will restore approach temperature from 18°F to 9°F.',
      effort: 'Medium'
    },
    {
      id: 'rec-3',
      title: 'Mash Enzyme Dosage Micro-Modulation',
      category: 'Chemical Consumables',
      impact: '$18,500 / month savings',
      payback: 'Immediate',
      description: 'Adjust alpha-amylase and glucoamylase pump flow proportional to inbound corn starch NIR spectrometer curve rather than fixed volumetric ratio.',
      effort: 'Low'
    }
  ];

  const handleApply = (id: string) => {
    setAppliedList((prev) => [...prev, id]);
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
            What to fix first. Ranked by what it saves you, what carbon it cuts, and whether it's safe to try.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recs.map((rec) => {
          const isDone = appliedList.includes(rec.id);

          return (
            <div
              key={rec.id}
              className="bg-white rounded-xl p-6 border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] flex flex-col justify-between space-y-4 hover:border-[#3d93ad]/40 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0f6e8c] uppercase tracking-wider">
                    {rec.category}
                  </span>
                  <span className="px-2 py-0.5 bg-[#f2f4f7] rounded-full font-semibold text-[#45464f]">
                    {rec.effort} Effort
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#061449] leading-snug">
                  {rec.title}
                </h3>

                <p className="text-xs text-[#45464f] leading-relaxed">
                  {rec.description}
                </p>

                <div className="p-3 bg-[#2D6A4F]/10 rounded-lg text-xs font-bold text-[#2D6A4F] flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 shrink-0" />
                  <span>{rec.impact}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e0e3e6]/60">
                {isDone ? (
                  <div className="flex items-center justify-center gap-1.5 py-2.5 bg-[#2D6A4F] text-white rounded-lg text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Queued for Shift Supervisor</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleApply(rec.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#061449] hover:bg-[#1e2a5e] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>Adopt Recommendation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
