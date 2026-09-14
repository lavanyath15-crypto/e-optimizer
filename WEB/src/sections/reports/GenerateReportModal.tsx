import React, { useState } from 'react';
import { ReportCategory, ReportItem } from '../../types';
import { ASSETS } from '../../data/mockData';
import { usePlantFigures } from '../../hooks/usePlantFigures';
import { describeSource } from '../../hooks/usePlantInput';
import {
  DISTILLATION_SCENARIOS,
  classifyScenarios,
  evaluateScenario,
} from '../../lib/distillationEngine';
import { X, Calendar, FileText, Sparkles, ChevronDown, CheckCircle2 } from 'lucide-react';

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

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  isOpen,
  onClose,
  onGenerate
}) => {
  const [reportTitle, setReportTitle] = useState('Daily Energy Consumables');
  const [category, setCategory] = useState<ReportCategory>('OPERATIONS');
  // Relative to today rather than fixed. These were hardcoded to a date in the
  // past, so the form opened on a stale range that drifted further out every day.
  const [startDate, setStartDate] = useState(() => isoDaysAgo(1));
  const [endDate, setEndDate] = useState(() => isoDaysAgo(0));
  const [format, setFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [includeAiAudit, setIncludeAiAudit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { model, consumption, emissions, grainInputTpd, source, updatedAt } = usePlantFigures();

  const scenarios = classifyScenarios(
    DISTILLATION_SCENARIOS.map((s) => evaluateScenario(s, grainInputTpd))
  );
  const recommendedScenario = scenarios.find((s) => s.classification === 'Energy_Efficient');

  if (!isOpen) return null;

  const handleCategorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setReportTitle(val);

    if (val.includes('Carbon') || val.includes('Compliance')) {
      setCategory('COMPLIANCE');
    } else if (val.includes('Predictive') || val.includes('AI Insight')) {
      setCategory('INTELLIGENCE');
    } else {
      setCategory('OPERATIONS');
    }
  };

  // A report is a snapshot, so it captures the figures as they are now rather
  // than recomputing later against a throughput the operator has since changed.
  const liveMetrics: NonNullable<ReportItem['metricsSummary']> =
    consumption && emissions
      ? [
          {
            label: 'Grain Throughput',
            value: `${grainInputTpd.toFixed(1)} t/day`,
            change: describeSource(source, updatedAt),
            isPositive: true,
          },
          {
            label: 'Ethanol Production',
            value: `${emissions.ethanolProductionKl.toFixed(2)} kL/day`,
            change: 'grain x 390 L/t',
            isPositive: true,
          },
          {
            label: 'Process Electricity',
            value: `${Math.round(consumption.electricityKwh).toLocaleString()} kWh/day`,
            change: `R2 ${(model?.testR2['Total_Process_Electricity_kWh'] ?? 0).toFixed(2)}`,
            isPositive: true,
          },
          {
            label: 'Distillation Steam',
            value: `${Math.round(consumption.distillationSteamKg).toLocaleString()} kg/day`,
            change: `R2 ${(model?.testR2['Distillation_Steam_kg'] ?? 0).toFixed(2)} - weak`,
            isPositive: false,
          },
          {
            label: 'DDGS Dryer Fuel',
            value: `${consumption.dryerFuelMmbtu.toFixed(1)} MMBtu/day`,
            change: `R2 ${(model?.testR2['DDGS_Dryer_Fuel_MMBtu'] ?? 0).toFixed(2)} - weak`,
            isPositive: false,
          },
          {
            label: 'Operational CO2e Intensity',
            value: `${emissions.co2eIntensityKgPerKl.toFixed(1)} kg CO2e/kL`,
            change: 'operations only, not lifecycle',
            isPositive: true,
          },
          {
            label: 'Total Operational CO2e',
            value: `${emissions.totalCo2eTonnes.toFixed(2)} t/day`,
            change: 'electricity, steam and dryer fuel',
            isPositive: true,
          },
        ]
      : [
          {
            label: 'Model',
            value: 'not loaded',
            change: 'figures unavailable at generation time',
            isPositive: false,
          },
        ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let iconUrl = ASSETS.energyIcon;
    let iconType: ReportItem['iconType'] = 'energy';
    if (category === 'COMPLIANCE') {
      iconUrl = ASSETS.carbonIcon;
      iconType = 'carbon';
    } else if (category === 'INTELLIGENCE') {
      iconUrl = ASSETS.aiIcon;
      iconType = 'ai';
    }

    const newReport: ReportItem = {
      id: `rep-${Date.now()}`,
      title: reportTitle,
      category: category,
      description: `Custom ${format} report compiled for period ${startDate} to ${endDate} covering plant zone telemetry and AI audit.`,
      status: 'generating',
      statusText: 'Est. 1 min remaining',
      generatedAt: 'Just now',
      fileFormat: format,
      iconType: iconType,
      customIconUrl: iconUrl,
      fileSize: format === 'PDF' ? '3.8 MB' : '1.4 MB',
      // The figures on screen at the moment of generation. These were fixed
      // placeholders ("142,800 dataset points", "97.2% plant efficiency") that
      // never changed no matter what the operator had submitted.
      metricsSummary: liveMetrics,
      detailedData: {
        executiveSummary:
          consumption && emissions
            ? `${reportTitle} for ${startDate} to ${endDate}, computed at ${grainInputTpd.toFixed(1)} t/day of grain. ` +
              `At that throughput the network predicts ${Math.round(consumption.electricityKwh).toLocaleString()} kWh of process electricity, ` +
              `${Math.round(consumption.distillationSteamKg).toLocaleString()} kg of distillation steam and ` +
              `${consumption.dryerFuelMmbtu.toFixed(1)} MMBtu of dryer fuel per day, producing ` +
              `${emissions.ethanolProductionKl.toFixed(2)} kL of ethanol at ${emissions.co2eIntensityKgPerKl.toFixed(1)} kg CO2e/kL. ` +
              `Steam and dryer fuel carry weak held-out fits and should be read as indicative.`
            : `${reportTitle}. The consumption model was not loaded when this was generated, so it carries no figures.`,
        sections: [
          {
            title: 'Predicted consumption and derived intensities',
            description:
              'Predicted by the trained network from grain throughput, then converted using emission factors recovered from the source dataset. Operational energy only.',
            tableHeaders: ['Measure', 'Value', 'Units', 'Basis'],
            tableRows:
              consumption && emissions
                ? [
                    ['Grain throughput', grainInputTpd.toFixed(1), 't/day', describeSource(source, updatedAt)],
                    ['Ethanol production', emissions.ethanolProductionKl.toFixed(2), 'kL/day', 'Formula, grain x 390 L/t'],
                    ['Process electricity', Math.round(consumption.electricityKwh).toLocaleString(), 'kWh/day', `Network, R2 ${(model?.testR2['Total_Process_Electricity_kWh'] ?? 0).toFixed(2)}`],
                    ['Distillation steam', Math.round(consumption.distillationSteamKg).toLocaleString(), 'kg/day', `Network, R2 ${(model?.testR2['Distillation_Steam_kg'] ?? 0).toFixed(2)}, weak`],
                    ['DDGS dryer fuel', consumption.dryerFuelMmbtu.toFixed(1), 'MMBtu/day', `Network, R2 ${(model?.testR2['DDGS_Dryer_Fuel_MMBtu'] ?? 0).toFixed(2)}, weak`],
                    ['Operational CO2e intensity', emissions.co2eIntensityKgPerKl.toFixed(1), 'kg CO2e/kL', 'Recovered factors'],
                    ['Energy intensity', emissions.totalEnergyIntensityKwhPerKl.toFixed(1), 'kWh/kL', 'Electricity plus dryer fuel'],
                    ['Total operational CO2e', emissions.totalCo2eTonnes.toFixed(2), 't/day', 'Three sources summed'],
                  ]
                : [],
            notes:
              'Operational emissions only. Farming, fertiliser, grain transport and land use are excluded, so this is not a lifecycle carbon intensity and cannot be compared against an LCFS or GREET score.',
          },
          ...(recommendedScenario
            ? [
                {
                  title: 'Distillation screening',
                  description: `Screened against purity >= 99.5% and recovery >= 95% at ${grainInputTpd.toFixed(1)} t/day.`,
                  tableHeaders: ['Scenario', 'Reflux', 'Steam (kg/day)', 'Specific (kg/kL)', 'Status'],
                  tableRows: scenarios.map((s) => [
                    s.id,
                    s.refluxRatio.toFixed(2),
                    Math.round(s.steamKgDay).toLocaleString(),
                    s.specificSteamKgPerKl.toFixed(1),
                    s.classification === 'Energy_Efficient'
                      ? 'Recommended'
                      : s.classification === 'Constraint_Violation'
                      ? 'Violates limits'
                      : 'Feasible',
                  ]),
                  notes: `Lowest-steam option clearing both limits is ${recommendedScenario.id} at reflux ${recommendedScenario.refluxRatio.toFixed(2)}. CO2e in this table uses a generic natural gas factor and is not on the same basis as the intensity above.`,
                },
              ]
            : []),
        ],
        aiKeyFindings: includeAiAudit
          ? [
              `Computed at ${grainInputTpd.toFixed(1)} t/day, ${describeSource(source, updatedAt).toLowerCase()}.`,
              recommendedScenario
                ? `Distillation screening recommends ${recommendedScenario.id} at reflux ${recommendedScenario.refluxRatio.toFixed(2)}, the lowest-steam point meeting purity and recovery limits.`
                : 'No distillation scenario met both the purity and recovery limits.',
              'Steam and dryer fuel predictions carry held-out R2 below 0.5. Only grain throughput carries signal in the source dataset, so no other lever should be read as driving these figures.',
            ]
          : ['Generated without the model commentary.'],
      }
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
                Report Category & Template
              </label>
              <div className="relative">
                <select
                  value={reportTitle}
                  onChange={handleCategorySelectChange}
                  className="w-full appearance-none bg-white border border-[#c6c5d1] rounded-lg px-4 py-3 text-sm text-[#061449] font-medium focus:border-[#061449] focus:ring-2 focus:ring-[#061449]/20 outline-none transition-colors cursor-pointer"
                >
                  <option value="Daily Energy Consumables">Daily Energy Consumables</option>
                  <option value="Carbon Compliance (Scope 1 & 2)">Carbon Compliance (Scope 1 & 2)</option>
                  <option value="Predictive Maintenance Log">Predictive Maintenance Log</option>
                  <option value="Custom AI Insight Report">Custom AI Insight Report</option>
                  <option value="Boiler Thermal & Steam Efficiency">Boiler Thermal & Steam Efficiency</option>
                  <option value="Fermentation Batch Kinetics & Microbiology">Fermentation Batch Kinetics & Microbiology</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[#767680] pointer-events-none" />
              </div>
            </div>

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
              disabled={isSubmitting}
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
