export type TabType = 
  | 'reports'
  | 'overview'
  | 'process-monitor'
  | 'carbon'
  | 'ai-optimization'
  | 'recommendations'
  | 'analytics'
  | 'settings'
  | 'support';

export type ReportCategory = 'OPERATIONS' | 'COMPLIANCE' | 'INTELLIGENCE' | 'FINANCIAL';

export type ReportStatus = 'ready' | 'generating' | 'failed';

export interface ReportItem {
  id: string;
  title: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  statusText?: string;
  generatedAt: string;
  fileFormat: 'PDF' | 'CSV' | 'XLSX';
  iconType: 'energy' | 'carbon' | 'ai' | 'error' | 'maintenance' | 'yield';
  customIconUrl?: string;
  fileSize?: string;
  metricsSummary?: {
    label: string;
    value: string;
    change?: string;
    isPositive?: boolean;
  }[];
  detailedData?: {
    executiveSummary: string;
    sections: {
      title: string;
      description: string;
      tableHeaders?: string[];
      tableRows?: (string | number)[][];
      notes?: string;
    }[];
    aiKeyFindings: string[];
    sensorAnomalies?: string[];
  };
}

export interface PlantAlarm {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  location: string;
  timestamp: string;
  acknowledged: boolean;
  metric: string;
  currentValue: string;
  threshold: string;
  recommendation: string;
}

/**
 * A headline figure on the Overview screen.
 *
 * `value` is a number, not a preformatted string. It used to be `'4,850'` with
 * the thousands separator and sometimes the unit baked in, which made the type
 * unusable for anything but rendering: nothing could compare, total or chart it.
 * Formatting is now the view's job and `decimals` says how.
 */
export interface PlantMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  decimals: number;
  /**
   * Held-out test R2 for a value the network predicts, so the screen can show
   * how far to trust it. Null for figures derived by formula, which carry no
   * prediction error of their own.
   */
  r2: number | null;
  /** Short note under the value, e.g. what the figure is derived from. */
  hint?: string;
}

export interface AiOptimizationSetpoint {
  id: string;
  parameter: string;
  unit: string;
  currentValue: number;
  recommendedValue: number;
  expectedGain: string;
  confidence: number;
  safetyMargin: string;
  status: 'pending' | 'applied' | 'dismissed';
}
