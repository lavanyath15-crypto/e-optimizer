export type TabType = 
  | 'reports'
  | 'overview'
  | 'process-monitor'
  | 'energy'
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

export interface PlantMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  target: string;
  status: 'optimal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  changePercentage: string;
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
