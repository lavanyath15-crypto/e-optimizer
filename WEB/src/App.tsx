import React, { useCallback, useEffect, useState } from 'react';
import { TabType, ReportItem } from './types';
import { INITIAL_REPORTS } from './data/mockData';
import { useWakeWord } from './hooks/useVoice';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AiAssistantModal } from './components/AiAssistantModal';
import { GenerateReportModal } from './sections/reports/GenerateReportModal';
import { ReportDetailModal } from './sections/reports/ReportDetailModal';
import { renderSection, type SectionContext } from './sections/registry';
import { Bot } from 'lucide-react';

const WAKE_WORD_KEY = 'eoptimizer-wake-word';

/** Defaults to on; only an explicit "false" from a previous visit turns it off. */
function readWakeWordPref(): boolean {
  try {
    return localStorage.getItem(WAKE_WORD_KEY) !== 'false';
  } catch {
    return true;
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('reports');
  const [reports, setReports] = useState<ReportItem[]>(INITIAL_REPORTS);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<ReportItem | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiAssistantPrompt, setAiAssistantPrompt] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Voice
  // On by default so voice works without hunting for a switch first. The cost is
  // that the dashboard asks for the microphone on load; the toggle in the
  // assistant header turns it off and that choice is remembered.
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(readWakeWordPref);

  useEffect(() => {
    try {
      localStorage.setItem(WAKE_WORD_KEY, String(wakeWordEnabled));
    } catch {
      // Private mode: the setting just does not persist.
    }
  }, [wakeWordEnabled]);
  const [voiceAutoStart, setVoiceAutoStart] = useState(false);

  const handleWakeWord = useCallback(() => {
    setAiAssistantPrompt('');
    setVoiceAutoStart(true);
    setIsAiAssistantOpen(true);
  }, []);

  // Paused while the drawer is open, because the assistant's own recogniser
  // takes the microphone from there.
  const wakeWord = useWakeWord({
    enabled: wakeWordEnabled && !isAiAssistantOpen,
    onDetected: handleWakeWord
  });

  // Switching it back on is the retry: a refused microphone stays refused until
  // the operator asks again, so granting permission and flicking this recovers
  // without reloading the page.
  const handleToggleWakeWord = () => {
    const next = !wakeWordEnabled;
    setWakeWordEnabled(next);
    if (next) wakeWord.retry();
  };

  // Periodic check to turn any 'generating' report into 'ready'
  const handleGenerateReport = (newReport: ReportItem) => {
    setReports((prev) => [newReport, ...prev]);

    // Automatically transition to ready after 5 seconds
    setTimeout(() => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === newReport.id
            ? {
                ...r,
                status: 'ready',
                statusText: 'Generated just now',
                generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            : r
        )
      );
    }, 5000);
  };

  // Retry failed report
  const handleRetryReport = (reportId: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'ready',
              statusText: 'Generated just now (sample report)',
              generatedAt: 'Illustrative data, nothing was imputed'
            }
          : r
      )
    );
  };

  // Download export simulation
  const handleDownloadReport = (report: ReportItem, format: 'PDF' | 'CSV') => {
    if (format === 'CSV') {
      const csvContent = `data:text/csv;charset=utf-8,Plant ID,ETH-042\nReport Title,${report.title}\nCategory,${report.category}\nGenerated,${report.generatedAt}\nStatus,${report.status}\n\nMetric,Value,Change\n${
        report.metricsSummary
          ?.map((m) => `"${m.label}","${m.value}","${m.change || ''}"`)
          .join('\n') || ''
      }`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${report.title.replace(/\s+/g, '_')}_ETH-042.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // PDF export / print view
      window.print();
    }
  };

  const handleOpenAiWithPrompt = (prompt: string = '') => {
    setAiAssistantPrompt(prompt);
    setIsAiAssistantOpen(true);
  };

  const handleQuickRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // What the shell can do on a section's behalf. The plant's readings are not in
  // here on purpose: a section that needs them reads the store, so it cannot be
  // handed a copy that has gone stale.
  const sectionContext: SectionContext = {
    reports,
    searchQuery,
    navigate: setCurrentTab,
    openGenerateModal: () => setIsGenerateModalOpen(true),
    viewReport: (rep) => setSelectedReportForDetail(rep),
    retryReport: handleRetryReport,
    downloadReport: handleDownloadReport,
    openAssistant: handleOpenAiWithPrompt,
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#191c1e] font-sans antialiased flex">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAiAssistant={() => {
          setAiAssistantPrompt('');
          setIsAiAssistantOpen(true);
        }}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Top Navbar */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onOpenSettings={() => setCurrentTab('settings')}
        onQuickRefresh={handleQuickRefresh}
        isRefreshing={isRefreshing}
        wakeWordSupported={wakeWord.isSupported}
        wakeWordEnabled={wakeWordEnabled}
        wakeWordActive={wakeWord.isActive}
        onToggleWakeWord={handleToggleWakeWord}
      />

      {/* Main Content Area */}
      <main className="pt-20 md:pt-24 pb-24 md:pb-12 px-4 md:px-8 ml-0 md:ml-64 w-full min-h-screen transition-all duration-300">
        {/* One line, because which section is on screen is the registry's
            business. This was nine conditionals that every new section had to be
            threaded through by hand. */}
        <div className="max-w-7xl mx-auto">{renderSection(currentTab, sectionContext)}</div>
      </main>

      {/* Floating Action Button (AI Assistant) exactly matching the screenshot */}
      <button
        onClick={() => {
          setAiAssistantPrompt('');
          setIsAiAssistantOpen(true);
        }}
        aria-label="Open AI Assistant"
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-full shadow-[0px_12px_32px_rgba(15, 110, 140,0.35)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 group cursor-pointer"
        id="fab-ai-assistant"
      >
        <Bot className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>

      {/* MODALS */}
      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerateReport}
      />

      {/* View Detailed Report Modal */}
      <ReportDetailModal
        report={selectedReportForDetail}
        isOpen={!!selectedReportForDetail}
        onClose={() => setSelectedReportForDetail(null)}
        onDownload={handleDownloadReport}
        onAskAi={(q) => handleOpenAiWithPrompt(q)}
      />

      {/* AI Assistant Drawer */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        initialPrompt={aiAssistantPrompt}
        autoStartListening={voiceAutoStart}
        onAutoStartConsumed={() => setVoiceAutoStart(false)}
        wakeWordEnabled={wakeWordEnabled}
        onToggleWakeWord={handleToggleWakeWord}
        wakeWordSupported={wakeWord.isSupported}
        wakeWordError={wakeWord.error}
      />

    </div>
  );
}
