/**
 * Parses and bounds the request body.
 *
 * Two real bugs lived here before:
 *
 * 1. `typeof value !== 'number'` accepted NaN and Infinity, which then reached
 *    `.toFixed()` and put the literal string "NaN" in the prompt. The model
 *    would then reason confidently about a plant whose steam use was "NaN".
 *    Number.isFinite is the check that was wanted.
 *
 * 2. Chat history arrived from the client with its role unvalidated. The type
 *    said 'user' | 'assistant', but nothing enforced it at runtime, so a crafted
 *    request could inject a `system` turn and rewrite the model's instructions.
 *    Roles are now whitelisted.
 *
 * Everything is also bounded. Each field below is attacker-controlled and every
 * one of them costs tokens, which on a free tier is the actual budget.
 */

import { ApiError } from '../_shared/http.ts';

export const LIMITS = {
  /** Generous for a question, far short of a token-burning essay. */
  questionChars: 1_000,
  /**
   * A dataset summary is aggregates, not rows, so this is roomy for what it
   * holds: about 14 columns of statistics plus a model comparison. The browser
   * builds it, so the cap is a backstop against a crafted request rather than
   * against the UI.
   */
  datasetSummaryChars: 6_000,
  /** Turns kept from the transcript. The oldest are dropped first. */
  historyTurns: 6,
  historyTurnChars: 2_000,
  /** The UI sends four. Anything near this is not the dashboard talking. */
  scenarios: 12,
  /** Whole body, before parsing. */
  bodyBytes: 64 * 1024,
} as const;

export type ChatRole = 'user' | 'assistant';
const CHAT_ROLES: readonly string[] = ['user', 'assistant'];

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface DistillationScenario {
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
  distillationScenarios?: DistillationScenario[];
}

export type Mode = 'recommend' | 'chat' | 'dataset';

export interface ParsedRequest {
  mode: Mode;
  state: PlantState;
  question: string;
  history: ChatTurn[];
  /** Statistics describing an operator's uploaded export. Empty unless mode is 'dataset'. */
  datasetSummary: string;
}

const REQUIRED_NUMBERS = [
  'grainInputTpd',
  'electricityKwh',
  'distillationSteamKg',
  'dryerFuelMmbtu',
  'ethanolProductionKl',
  'co2eIntensityKgPerKl',
  'totalEnergyIntensityKwhPerKl',
] as const;

/** Rejects NaN and Infinity, which `typeof x === 'number'` happily allows. */
function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalFinite(value: unknown): number | undefined {
  return finiteNumber(value) ? value : undefined;
}

function parseScenarios(raw: unknown): DistillationScenario[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw
    .slice(0, LIMITS.scenarios)
    .filter(
      (s): s is DistillationScenario =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as DistillationScenario).id === 'string' &&
        finiteNumber((s as DistillationScenario).refluxRatio) &&
        finiteNumber((s as DistillationScenario).specificSteamKgPerKl) &&
        finiteNumber((s as DistillationScenario).recoveryPct) &&
        finiteNumber((s as DistillationScenario).purityPct)
    )
    .map((s) => ({
      // Rebuilt field by field rather than spread, so nothing unexpected on the
      // incoming object can ride along into the prompt.
      id: String(s.id).slice(0, 16),
      refluxRatio: s.refluxRatio,
      specificSteamKgPerKl: s.specificSteamKgPerKl,
      recoveryPct: s.recoveryPct,
      purityPct: s.purityPct,
      feasible: Boolean(s.feasible),
      recommended: Boolean(s.recommended),
    }));
}

function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (turn): turn is ChatTurn =>
        !!turn &&
        typeof turn === 'object' &&
        // The whitelist. Without it a client could send role 'system' and
        // replace the instructions the model was given.
        CHAT_ROLES.includes((turn as ChatTurn).role) &&
        typeof (turn as ChatTurn).content === 'string' &&
        (turn as ChatTurn).content.trim().length > 0
    )
    .slice(-LIMITS.historyTurns)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, LIMITS.historyTurnChars),
    }));
}

export async function parseRequest(req: Request): Promise<ParsedRequest> {
  const rawBody = await req.text();

  if (rawBody.length > LIMITS.bodyBytes) {
    throw new ApiError(413, 'That request is too large.', { code: 'body_too_large' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, 'Body must be JSON.', { code: 'invalid_json' });
  }

  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Body must be a JSON object.', { code: 'invalid_body' });
  }

  const mode: Mode =
    body.mode === 'chat' ? 'chat' : body.mode === 'dataset' ? 'dataset' : 'recommend';

  const missing = REQUIRED_NUMBERS.filter((key) => !finiteNumber(body[key]));
  if (missing.length) {
    throw new ApiError(400, `Missing or invalid fields: ${missing.join(', ')}`, {
      code: 'invalid_fields',
    });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (mode === 'chat' && !question) {
    throw new ApiError(400, 'Ask a question.', { code: 'empty_question' });
  }

  const datasetSummary =
    typeof body.datasetSummary === 'string' ? body.datasetSummary.trim() : '';
  if (mode === 'dataset' && !datasetSummary) {
    throw new ApiError(400, 'No dataset summary was sent.', { code: 'empty_dataset' });
  }

  const state: PlantState = {
    grainInputTpd: body.grainInputTpd as number,
    electricityKwh: body.electricityKwh as number,
    distillationSteamKg: body.distillationSteamKg as number,
    dryerFuelMmbtu: body.dryerFuelMmbtu as number,
    ethanolProductionKl: body.ethanolProductionKl as number,
    co2eIntensityKgPerKl: body.co2eIntensityKgPerKl as number,
    totalEnergyIntensityKwhPerKl: body.totalEnergyIntensityKwhPerKl as number,
    refluxRatio: optionalFinite(body.refluxRatio),
    distillationScenarios: parseScenarios(body.distillationScenarios),
  };

  return {
    mode,
    state,
    question: question.slice(0, LIMITS.questionChars),
    history: mode === 'chat' ? parseHistory(body.history) : [],
    datasetSummary:
      mode === 'dataset' ? datasetSummary.slice(0, LIMITS.datasetSummaryChars) : '',
  };
}
