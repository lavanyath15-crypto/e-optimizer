import React, { useState } from 'react';
import { ReportItem, ReportCategory } from '../types';
import { PlusCircle, Eye, Download, Check, Loader2, RefreshCw, AlertTriangle, Filter, Sparkles } from 'lucide-react';

interface ReportsViewProps {
  reports: ReportItem[];
  searchQuery: string;
  onOpenGenerateModal: () => void;
  onViewReport: (report: ReportItem) => void;
  onRetryReport: (reportId: string) => void;
  onDownloadReport: (report: ReportItem, format: 'PDF' | 'CSV') => void;
  onOpenAiAssistantWithPrompt?: (prompt: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  reports,
  searchQuery,
  onOpenGenerateModal,
  onViewReport,
  onRetryReport,
  onDownloadReport,
  onOpenAiAssistantWithPrompt
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedId, setDownloadedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Filter reports
  const filteredReports = reports.filter((rep) => {
    const matchesCategory =
      activeCategory === 'ALL' || rep.category === activeCategory;
    const matchesSearch =
      rep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories: { label: string; value: string; count: number }[] = [
    { label: 'All Reports', value: 'ALL', count: reports.length },
    {
      label: 'Operations',
      value: 'OPERATIONS',
      count: reports.filter((r) => r.category === 'OPERATIONS').length
    },
    {
      label: 'Compliance',
      value: 'COMPLIANCE',
      count: reports.filter((r) => r.category === 'COMPLIANCE').length
    },
    {
      label: 'Intelligence',
      value: 'INTELLIGENCE',
      count: reports.filter((r) => r.category === 'INTELLIGENCE').length
    }
  ];

  const handleDownloadClick = (report: ReportItem, format: 'PDF' | 'CSV') => {
    setDownloadingId(report.id);
    setTimeout(() => {
      setDownloadingId(null);
      setDownloadedId(report.id);
      onDownloadReport(report, format);
      setTimeout(() => {
        setDownloadedId(null);
      }, 2500);
    }, 1200);
  };

  const handleRetryClick = (reportId: string) => {
    setRetryingId(reportId);
    setTimeout(() => {
      onRetryReport(reportId);
      setRetryingId(null);
    }, 1800);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header matching the design */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#e0e3e6]/60">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#191c1e] tracking-tight">
            System Reports
          </h2>
          <p className="text-base text-[#45464f] mt-2 max-w-2xl leading-relaxed">
            Your analytics, shift logs and compliance paperwork in one place. Stuck on one? Ask the assistant to read it for you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGenerateModal}
            id="btn-generate-report"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#061449] hover:bg-[#1e2a5e] text-white rounded-lg font-semibold text-sm shadow-lg shadow-[#1e2a5e]/20 transition-all active:scale-[0.98] w-full md:w-auto cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Generate New Report</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat.value
                  ? 'bg-[#061449] text-white shadow-sm'
                  : 'bg-white text-[#45464f] hover:bg-[#eceef1] border border-[#e0e3e6]'
              }`}
            >
              {cat.label}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeCategory === cat.value
                    ? 'bg-white/20 text-white'
                    : 'bg-[#eceef1] text-[#45464f]'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {searchQuery && (
          <div className="text-xs text-[#767680] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtered by: "{searchQuery}"</span>
          </div>
        )}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => {
          const isDownloading = downloadingId === report.id;
          const isDone = downloadedId === report.id;
          const isRetrying = retryingId === report.id;

          // Status bar color
          let statusBarColor = 'bg-[#2D6A4F]'; // Ready green
          if (report.status === 'generating') statusBarColor = 'bg-[#FFB703]'; // Warning amber
          if (report.status === 'failed') statusBarColor = 'bg-[#BA1A1A]'; // Critical red

          return (
            <article
              key={report.id}
              className={`bg-white rounded-xl shadow-[0px_4px_20px_rgba(30,42,94,0.05)] border border-[#e0e3e6]/80 overflow-hidden flex flex-col h-full relative transition-all duration-200 hover:shadow-md hover:border-[#3d93ad]/30 ${
                report.status === 'failed' ? 'opacity-90' : ''
              }`}
            >
              {/* Status Bar line at top */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${statusBarColor}`} />

              <div className="p-6 flex-1 flex flex-col">
                {/* Category & 3D Isometric Icon Header */}
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[12px] font-bold tracking-wider text-[#45464f] uppercase">
                    {report.category}
                  </span>
                  <div className="w-12 h-12 rounded-lg bg-[#f2f4f7] flex items-center justify-center p-1.5 shadow-inner border border-[#e0e3e6]/40">
                    {report.status === 'failed' ? (
                      <div className="w-8 h-8 rounded-full bg-[#ffdad6]/80 flex items-center justify-center text-[#ba1a1a]">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    ) : report.customIconUrl ? (
                      <img
                        src={report.customIconUrl}
                        alt={report.title}
                        className="w-8 h-8 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Sparkles className="w-6 h-6 text-[#0f6e8c]" />
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-[#061449] mb-2 leading-snug">
                  {report.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#45464f] line-clamp-2 mb-4 leading-relaxed flex-1">
                  {report.description}
                </p>

                {/* Status indicator badge */}
                <div className="flex items-center gap-2 mb-1 mt-auto">
                  {report.status === 'ready' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#2D6A4F]/15 text-[#2D6A4F] text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] mr-1.5"></span>
                      Ready
                    </span>
                  )}

                  {report.status === 'generating' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFB703]/15 text-[#b38000] text-[11px] font-bold">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin text-[#b38000]" />
                      Generating...
                    </span>
                  )}

                  {report.status === 'failed' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#BA1A1A]/15 text-[#BA1A1A] text-[11px] font-bold">
                      <AlertTriangle className="w-3 h-3 mr-1 text-[#BA1A1A]" />
                      Failed
                    </span>
                  )}

                  <span className="text-xs text-[#767680]">
                    {report.statusText || report.generatedAt}
                  </span>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="border-t border-[#e0e3e6]/60 p-4 bg-[#f7f9fc] flex gap-2">
                {report.status === 'ready' && (
                  <>
                    <button
                      onClick={() => onViewReport(report)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-2 border border-[#061449] text-[#061449] hover:bg-[#061449]/5 rounded-md text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleDownloadClick(report, report.fileFormat === 'CSV' ? 'CSV' : 'PDF')}
                      disabled={isDownloading}
                      className={`flex-1 flex justify-center items-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all relative overflow-hidden text-white cursor-pointer ${
                        isDone
                          ? 'bg-[#2D6A4F]'
                          : 'bg-[#061449] hover:bg-[#505b92]'
                      }`}
                    >
                      {isDownloading ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Preparing...</span>
                        </span>
                      ) : isDone ? (
                        <span className="flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Download className="w-4 h-4" />
                          <span>{report.fileFormat || 'PDF'}</span>
                        </span>
                      )}
                    </button>
                  </>
                )}

                {report.status === 'generating' && (
                  <div className="w-full flex items-center justify-between px-2">
                    <div className="w-full h-10 bg-[#eceef1] rounded-md animate-pulse flex items-center justify-center text-xs text-[#767680] font-medium">
                      Sample report, generating...
                    </div>
                  </div>
                )}

                {report.status === 'failed' && (
                  <button
                    onClick={() => handleRetryClick(report.id)}
                    disabled={isRetrying}
                    className="w-full flex justify-center items-center gap-1.5 py-2 border border-[#c6c5d1] text-[#45464f] hover:text-[#061449] hover:bg-[#eceef1] rounded-md text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin text-[#3d93ad]' : ''}`} />
                    <span>{isRetrying ? 'Synthesizing Missing Sensor Data...' : 'Retry Generation'}</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-[#c6c5d1] p-8">
          <div className="w-12 h-12 rounded-full bg-[#eceef1] flex items-center justify-center mx-auto mb-3 text-[#767680]">
            <Filter className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-lg text-[#061449]">No reports found</h4>
          <p className="text-sm text-[#767680] mt-1">
            Nothing matched. Try a different search, or just generate a fresh report.
          </p>
          <button
            onClick={onOpenGenerateModal}
            className="mt-4 px-4 py-2 bg-[#061449] text-white text-sm font-semibold rounded-lg hover:bg-[#1e2a5e]"
          >
            Create Report
          </button>
        </div>
      )}

      {/* Quick AI Diagnostic Banner */}
      <div className="mt-8 p-5 bg-gradient-to-r from-[#1e2a5e] to-[#061449] rounded-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-[#384378]/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#3d93ad] flex items-center justify-center text-white shrink-0 shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Not sure what Batch #408 is telling you?</h4>
            <p className="text-xs text-[#dde1ff] mt-0.5">
              The assistant can line up fermentation heat against your 150# header load and tell you what moved.
            </p>
          </div>
        </div>
        {onOpenAiAssistantWithPrompt && (
          <button
            onClick={() => onOpenAiAssistantWithPrompt('Can you summarize yesterday\'s Energy Consumables and explain the steam reduction on the Beer Column?')}
            className="px-4 py-2 bg-[#3d93ad] hover:bg-[#0f6e8c] text-white text-xs font-bold rounded-lg shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Ask AI Assistant
          </button>
        )}
      </div>
    </div>
  );
};
