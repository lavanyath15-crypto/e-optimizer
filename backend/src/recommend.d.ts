/** Type declarations for recommend.js. */

export interface DistillationScenarioPayload {
  id: string;
  refluxRatio: number;
  specificSteamKgPerKl: number;
  recoveryPct: number;
  purityPct: number;
  feasible: boolean;
  recommended: boolean;
}

export interface PlantState {
  grainInputTpd: number;
  electricityKwh: number;
  distillationSteamKg: number;
  dryerFuelMmbtu: number;
  ethanolProductionKl: number;
  co2eIntensityKgPerKl: number;
  totalEnergyIntensityKwhPerKl: number;
  refluxRatio?: number;
  distillationScenarios?: DistillationScenarioPayload[];
}

export interface RecommendationResult {
  recommendations: string | null;
  provider: string | null;
  error: string | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function getRecommendations(plantState: PlantState): Promise<RecommendationResult>;

export function askAssistant(
  question: string,
  plantState: PlantState,
  history?: ChatTurn[]
): Promise<RecommendationResult>;
