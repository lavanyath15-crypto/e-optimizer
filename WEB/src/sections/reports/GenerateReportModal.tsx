import React, { useState } from 'react';
import { ReportItem } from '../../types';
import { ASSETS } from '../../data/mockData';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { describeSource } from '../../hooks/usePlantInput';
import {
  DISTILLATION_SCENARIOS,
  classifyScenarios,
  evaluateScenario,
  resolveCurrentScenario,
} from '../../lib/distillationEngine';
import { REPORT_TEMPLATES, findTemplate } from './reportTemplates';
import { X, FileText, Sparkles, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (newReport: ReportItem) => void;
}

/** yyyy-mm-dd for a date `days` before today, which is what a date input wants. */
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a report from the live figures at the moment it is generated.
 *
 * The template list is the four reports this project can actually produce. The
 * dropdown used to offer six, including a predictive maintenance log and a
 * fermentation batch certification for things nothing here measures, and it
 * filled whichever you picked with the same generic content.
 */
export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  isOpen,
  onClose,
  onGenerate
}) => {
  const [templateId, setTemplateId] = useState(REPORT_TEMPLATES[0].id);
  // Relative to today rather than fixed. These were hardcoded to a date in the
  // past, so the form opened on a stale range that drifted further out every day.
  const [startDate, setStartDate] = useState(() => isoDaysAgo(1));
  const [endDate, setEndDate] = useState(() => isoDaysAgo(0));
  const [format, setFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [includeAiAudit, setIncludeAiAudit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    model,
    consumption,
    emissions,
    physics,
    unmodelled,
    grainInputTpd,
    refluxRatio,
    source,
    updatedAt,
  } = usePlantFigures();

  const template = findTemplate(templateId);

  const scenarios = classifyScenarios(
    DISTILLATION_SCENARIOS.map((s) => evaluateScenario(s, grainInputTpd))
  );
  const recommended = scenarios.find((s) => s.classification === 'Energy_Efficient');
  const current = resolveCurrentScenario(scenarios, refluxRatio);

  // Nothing can be built without the network, and a report of placeholders is
  // exactly what this screen used to produce.
  const canGenerate = Boolean(consumption && emissions && physics);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;
    setIsSubmitting(true);

    const iconUrl =
      template.iconType === 'carbon'
        ? ASSETS.carbonIcon
        : template.iconType === 'ai'
        ? ASSETS.aiIcon
        : ASSETS.energyIcon;

    const built = template.build({
      model,
      consumption: consumption!,
      emissions: emissions!,
      physics: physics!,
      unmodelled,
      grainInputTpd,
      sourceNote: describeSource(source, updatedAt),
      scenarios,
      current,
      recommended,
      startDate,
      endDate,
    });

    const newReport: ReportItem = {
      id: `rep-${Date.now()}`,
      title: template.title,
      category: template.category,
      description: template.description,
      status: 'generating',
      statusText: 'Est. 1 min remaining',
      generatedAt: 'Just now',
      fileFormat: format,
      iconType: template.iconType,
      customIconUrl: iconUrl,
      fileSize: format === 'PDF' ? '3.8 MB' : '1.4 MB',
      metricsSummary: built.metricsSummary,
      detailedData: includeAiAudit
        ? built.detailedData
        : built.detailedData && { ...built.detailedData, aiKeyFindings: ['Generated without the model commentary.'] },
    };

    setTimeout(() => {
      onGenerate(newReport);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 bg-[#061449]/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-[0px_12px_32px_rgba(30,42,94,0.18)] border border-[#e0e3e6]/80 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        id="report-modal"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#e0e3e6]/60 flex justify-between items-center bg-[#f7f9fc]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#061449] text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-xl font-bold text-[#061449]">
              Generate New Report
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#767680] hover:text-[#ba1a1a] transition-colors p-1 rounded-lg hover:bg-[#eceef1] cursor-pointer"
            id="btn-close-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Form Group: Report Type */}
            <div>
              <label className="block text-sm font-semibold text-[#45464f] mb-2">
                Report
              </label>
              <div className="relative">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#c6c5d1] rounded-lg px-4 py-3 text-sm text-[#061449] font-medium focus:border-[#061449] focus:ring-2 focus:ring-[#061449]/20 outline-none transition-colors cursor-pointer"
                >
                  {REPORT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[#767680] pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#767680] mt-1.5 leading-relaxed">
                {template.description}
              </p>
            </div>

            {!canGenerate && (
              <div className="flex items-start gap-2 p-3 bg-[#FFB703]/10 border border-[#FFB703]/40 rounded-lg text-xs text-[#8a6100]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The consumption model has not loaded, so there are no figures to build a report
                  from. Nothing will be generated until it does.
                </span>
              </div>
            )}

            {/* Form Group: Date Range */}
            <div>
              <label className="block text-sm font-semibold text-[#45464f] mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="text-[11px] uppercase font-bold text-[#767680] block mb-1">
                    Start Date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-[#c6c5d1] rounded-lg px-3 py-2 text-xs text-[#061449] focus:border-[#061449] focus:ring-1 focus:ring-[#061449] outline-none"
                  />
                </div>
                <div className="relative">
                  <span className="text-[11px] uppercase font-bold text-[#767680] block mb-1">
                    End Date
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-[#c6c5d1] rounded-lg px-3 py-2 text-xs text-[#061449] focus:border-[#061449] focus:ring-1 focus:ring-[#061449] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Group: Format */}
            <div>
              <label className="block text-sm font-semibold text-[#45464f] mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    format === 'PDF'
                      ? 'border-[#061449] bg-[#061449]/5 font-semibold text-[#061449]'
                      : 'border-[#c6c5d1] text-[#45464f] hover:bg-[#f7f9fc]'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'PDF'}
                    onChange={() => setFormat('PDF')}
                    className="text-[#061449] focus:ring-[#061449]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-[#061449]">PDF Document</div>
                    <div className="text-[#767680] text-[11px]">Formatted with charts & audits</div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    format === 'CSV'
                      ? 'border-[#061449] bg-[#061449]/5 font-semibold text-[#061449]'
                      : 'border-[#c6c5d1] text-[#45464f] hover:bg-[#f7f9fc]'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'CSV'}
                    onChange={() => setFormat('CSV')}
                    className="text-[#061449] focus:ring-[#061449]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-[#061449]">Raw Data (CSV)</div>
                    <div className="text-[#767680] text-[11px]">10-sec historian logs</div>
                  </div>
                </label>
              </div>
            </div>

            {/* AI Enhancement Option */}
            <div className="p-3 bg-[#3d93ad]/10 rounded-lg border border-[#3d93ad]/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[#0f6e8c]" />
                <div>
                  <span className="text-xs font-bold text-[#061449] block">
                    Include Neural Anomaly Synthesis
                  </span>
                  <span className="text-[11px] text-[#45464f]">
                    Cross-checks every sensor against what your historian expected
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeAiAudit}
                onChange={(e) => setIncludeAiAudit(e.target.checked)}
                className="w-4 h-4 text-[#3d93ad] rounded focus:ring-[#3d93ad] cursor-pointer"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-[#e0e3e6]/60 bg-[#f7f9fc] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-[#c6c5d1] text-[#45464f] hover:bg-[#eceef1] rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              id="btn-cancel-modal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canGenerate}
              className="px-6 py-2.5 bg-[#061449] hover:bg-[#1e2a5e] text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Queuing Generation...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Start Generation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
