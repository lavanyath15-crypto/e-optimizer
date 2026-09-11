import React from 'react';
import { Info } from 'lucide-react';

interface IllustrativeDataBannerProps {
  /** What specifically on this screen is not real, in plain language. */
  children: React.ReactNode;
}

/**
 * Marks a view whose figures are illustrative rather than measured or modelled.
 *
 * The consumption network, the emission formulas and the distillation screening
 * are real and carry their own footnotes explaining how far to trust them. The
 * remaining views are demonstration layouts built on fixed numbers. They say so
 * here rather than leaving an operator to work it out, because a dashboard that
 * looks equally confident about both is worse than one that admits the gap.
 */
export const IllustrativeDataBanner: React.FC<IllustrativeDataBannerProps> = ({
  children,
}) => (
  <div className="flex items-start gap-2.5 p-3.5 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-xl text-xs text-[#8a6100]">
    <Info className="w-4 h-4 shrink-0 mt-0.5" />
    <p className="leading-relaxed">
      <strong className="font-bold">Illustrative data.</strong> {children}
    </p>
  </div>
);
