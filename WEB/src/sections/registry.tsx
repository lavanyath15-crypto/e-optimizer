/**
 * The one place the dashboard's sections are connected to its shell.
 *
 * Each section lives in its own folder under this one and owns its private
 * cards. None of them import each other. What they share is:
 *
 *  - the plant's readings, through usePlantInput / usePlantFigures, which is the
 *    single store every figure on every screen is derived from;
 *  - the SectionContext below, for the handful of things only the shell can do:
 *    switch tabs, open a modal, add a report.
 *
 * App renders through `renderSection`, so adding a section means adding a folder
 * and one line here rather than editing a chain of conditionals in App.
 */

import type { ReactNode } from 'react';
import type { ReportItem, TabType } from '../types';

import { OverviewSection } from './overview/OverviewSection';
import { ProcessMonitorSection } from './process-monitor/ProcessMonitorSection';
import { CarbonSection } from './carbon/CarbonSection';
import { AnalyticsSection } from './analytics/AnalyticsSection';
import { AiOptimizationSection } from './ai-optimization/AiOptimizationSection';
import { RecommendationsSection } from './recommendations/RecommendationsSection';
import { ReportsSection } from './reports/ReportsSection';
import { SettingsSection } from './settings/SettingsSection';

/**
 * Everything a section may need from the shell. Deliberately small: plant
 * figures do not travel through here, because a section that wants them reads
 * the store directly and therefore cannot be handed a stale copy.
 */
export interface SectionContext {
  reports: ReportItem[];
  searchQuery: string;
  navigate: (tab: TabType) => void;
  openGenerateModal: () => void;
  viewReport: (report: ReportItem) => void;
  retryReport: (reportId: string) => void;
  downloadReport: (report: ReportItem, format: 'PDF' | 'CSV') => void;
  openAssistant: (prompt?: string) => void;
}

export interface SectionDefinition {
  id: TabType;
  render: (ctx: SectionContext) => ReactNode;
}

export const SECTIONS: SectionDefinition[] = [
  {
    id: 'process-monitor',
    render: () => <ProcessMonitorSection />,
  },
  {
    id: 'carbon',
    render: (ctx) => <CarbonSection onNavigateTab={ctx.navigate} />,
  },
  {
    id: 'analytics',
    render: (ctx) => <AnalyticsSection onNavigateTab={ctx.navigate} />,
  },
  {
    id: 'ai-optimization',
    render: () => <AiOptimizationSection />,
  },
  {
    id: 'recommendations',
    render: (ctx) => <RecommendationsSection onNavigateTab={ctx.navigate} />,
  },
  {
    id: 'overview',
    render: (ctx) => (
      <OverviewSection
        reports={ctx.reports}
        onNavigateTab={ctx.navigate}
        onViewReport={ctx.viewReport}
        onOpenAiAssistant={() =>
          ctx.openAssistant('Provide a high-level operational diagnosis for Plant ETH-042')
        }
      />
    ),
  },
  {
    id: 'reports',
    render: (ctx) => (
      <ReportsSection
        reports={ctx.reports}
        searchQuery={ctx.searchQuery}
        onOpenGenerateModal={ctx.openGenerateModal}
        onViewReport={ctx.viewReport}
        onRetryReport={ctx.retryReport}
        onDownloadReport={ctx.downloadReport}
        onOpenAiAssistantWithPrompt={ctx.openAssistant}
      />
    ),
  },
  {
    id: 'settings',
    render: () => <SettingsSection initialTab="settings" />,
  },
  {
    id: 'support',
    render: () => <SettingsSection initialTab="support" />,
  },
];

export function renderSection(tab: TabType, ctx: SectionContext): ReactNode {
  const section = SECTIONS.find((s) => s.id === tab);
  return section ? section.render(ctx) : null;
}
