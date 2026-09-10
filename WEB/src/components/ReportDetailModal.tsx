import React, { useState } from 'react';
import { ReportItem } from '../types';
import {
  X,
  Download,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers
} from 'lucide-react';

interface ReportDetailModalProps {
  report: ReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (report: ReportItem, format: 'PDF' | 'CSV') => void;
  onAskAi: (question: string) => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  isOpen,
  onClose,
  onDownload,
  onAskAi
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'ai-audit'>('overview');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !report) return null;

  const handlePrintOrExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      onDownload(report, report.fileFormat === 'CSV' ? 'CSV' : 'PDF');
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 bg-[#061449]/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-[#e0e3e6] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header with Title & Metadata */}
        <div className="p-6 border-b border-[#e0e3e6] bg-[#f7f9fc] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-2 shadow-xs border border-[#e0e3e6]/80 shrink-0">
              {report.customIconUrl ? (
                <img
                  src={report.customIconUrl}
                  alt={report.title}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Sparkles className="w-6 h-6 text-[#0f6e8c]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold tracking-wider text-[#0f6e8c] bg-[#0f6e8c]/10 px-2 py-0.5 rounded-full uppercase">
                  {report.category}
                </span>
                <span className="text-xs text-[#767680] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {report.generatedAt}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-[#061449] mt-1">
                {report.title}
              </h3>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintOrExport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#eceef1] text-[#061449] border border-[#c6c5d1] rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              {report.fileFormat === 'CSV' ? (
                <FileSpreadsheet className="w-4 h-4 text-[#2D6A4F]" />
              ) : (
                <Download className="w-4 h-4 text-[#061449]" />
              )}
              <span>{isExporting ? 'Exporting...' : `Export ${report.fileFormat || 'PDF'}`}</span>
            </button>

            <button
              onClick={() => {
                onAskAi(`Summarize key findings and optimization recommendations for the report "${report.title}".`);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#0f6e8c] to-[#3d93ad] hover:from-[#0b5670] hover:to-[#0f6e8c] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Bot className="w-4 h-4" />
              <span>Ask AI</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#767680] hover:text-[#ba1a1a] hover:bg-[#eceef1] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="px-6 border-b border-[#e0e3e6] bg-white flex items-center gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#061449] text-[#061449]'
                : 'border-transparent text-[#767680] hover:text-[#061449]'
            }`}
          >
            Executive Overview
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'tables'
                ? 'border-[#061449] text-[#061449]'
                : 'border-transparent text-[#767680] hover:text-[#061449]'
            }`}
          >
            Telemetry & Data Ledger
          </button>
          <button
            onClick={() => setActiveTab('ai-audit')}
            className={`py-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai-audit'
                ? 'border-[#3d93ad] text-[#3d93ad]'
                : 'border-transparent text-[#767680] hover:text-[#3d93ad]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Diagnostics & Anomalies</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Executive Summary Card */}
              <div className="p-5 bg-[#f7f9fc] rounded-xl border border-[#e0e3e6]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#767680] mb-2">
                  Executive Summary
                </h4>
                <p className="text-sm text-[#191c1e] leading-relaxed">
                  {report.detailedData?.executiveSummary || report.description}
                </p>
              </div>

              {/* KPI Highlights Grid */}
              {report.metricsSummary && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#767680] mb-3">
                    Key Performance Indicators (KPIs)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {report.metricsSummary.map((metric, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-white rounded-xl border border-[#e0e3e6] shadow-2xs"
                      >
                        <span className="text-[11px] font-semibold text-[#767680] block truncate">
                          {metric.label}
                        </span>
                        <span className="text-lg font-extrabold text-[#061449] block mt-0.5">
                          {metric.value}
                        </span>
                        {metric.change && (
                          <div className="flex items-center gap-1 text-xs mt-1 font-bold">
                            {metric.isPositive ? (
                              <span className="text-[#2D6A4F] flex items-center">
                                <TrendingUp className="w-3 h-3 mr-0.5" />
                                {metric.change}
                              </span>
                            ) : (
                              <span className="text-[#BA1A1A] flex items-center">
                                <TrendingDown className="w-3 h-3 mr-0.5" />
                                {metric.change}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Key Insights Box */}
              {report.detailedData?.aiKeyFindings && (
                <div className="p-4 bg-[#3d93ad]/5 rounded-xl border border-[#3d93ad]/20 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0f6e8c] uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Engineering Highlights</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#061449] pl-1">
                    {report.detailedData.aiKeyFindings.map((finding, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0 mt-0.5" />
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TELEMETRY TABLES */}
          {activeTab === 'tables' && (
            <div className="space-y-6 animate-fade-in">
              {report.detailedData?.sections && report.detailedData.sections.length > 0 ? (
                report.detailedData.sections.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-3">
                    <div>
                      <h4 className="text-base font-bold text-[#061449]">
                        {section.title}
                      </h4>
                      <p className="text-xs text-[#767680] mt-0.5">
                        {section.description}
                      </p>
                    </div>

                    {section.tableHeaders && section.tableRows && (
                      <div className="overflow-x-auto rounded-xl border border-[#e0e3e6]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#f7f9fc] border-b border-[#e0e3e6] text-[#45464f] font-bold">
                            <tr>
                              {section.tableHeaders.map((hdr, hIdx) => (
                                <th key={hIdx} className="px-4 py-3">
                                  {hdr}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e0e3e6] bg-white text-[#191c1e]">
                            {section.tableRows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-[#f7f9fc]/60">
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-4 py-2.5 ${
                                      cIdx === 0 ? 'font-semibold text-[#061449]' : 'font-mono'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {section.notes && (
                      <div className="text-xs text-[#45464f] bg-[#f7f9fc] p-3 rounded-lg border border-[#e0e3e6]/60">
                        <strong>Operational Notes:</strong> {section.notes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[#767680] text-sm">
                  Want the raw numbers? Grab the CSV.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI AUDIT & ANOMALIES */}
          {activeTab === 'ai-audit' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-white rounded-xl border border-[#e0e3e6] shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#3d93ad]" />
                  <h4 className="font-bold text-sm text-[#061449]">
                    Neural Anomaly Detection Pipeline
                  </h4>
                </div>
                <p className="text-xs text-[#45464f] leading-relaxed">
                  Checked 128 sensor streams against the mass and energy balance. Plant ETH-042.
                </p>

                {report.detailedData?.sensorAnomalies && report.detailedData.sensorAnomalies.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    <span className="text-xs font-bold text-[#BA1A1A] block">
                      Active Sensor Flags:
                    </span>
                    {report.detailedData.sensorAnomalies.map((anom, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg text-xs text-[#93000a] flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 text-[#ba1a1a] mt-0.5" />
                        <span>{anom}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 rounded-lg text-xs text-[#2D6A4F] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>No sensor drift worth worrying about over the whole run.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e0e3e6] bg-[#f7f9fc] flex items-center justify-between">
          <div className="text-xs text-[#767680]">
            Plant ID: <span className="font-mono font-bold text-[#061449]">ETH-042</span> • Document Hash: <span className="font-mono">{report.id.toUpperCase()}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#061449] hover:bg-[#1e2a5e] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
