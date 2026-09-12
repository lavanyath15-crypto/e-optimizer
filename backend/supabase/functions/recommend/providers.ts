/**
 * LLM providers, tried in order until one answers.
 *
 * Both are open-weight models on free tiers, so the fallback is not a luxury:
 * a rate limit on one is an ordinary Tuesday, not an outage.
 *
 *   1. Mistral - mistral-small-latest. Open-weight, primary on purpose.
 *   2. Groq    - openai/gpt-oss-120b. Apache 2.0, and fast.
 *
 * Groq was originally primary on the assumption it served LLaMA 3.3. As of
 * 2026-09 it serves no LLaMA chat model; the only llama entries are
 * llama-prompt-guard-2-*, which are safety classifiers. Hence the order.
 *
 * Secrets: supabase secrets set MISTRAL_API_KEY=... GROQ_API_KEY=...
 */

import { ApiError, logError } from '../_shared/http.ts';
import type { ChatMessage } from './prompts.ts';

/**
 * Whole-request budget. Previously each provider had its own 25s timeout with
 * no ceiling on the total, so two slow providers meant a 50s request and a
 * client that had long since given up. Each attempt now draws from one clock.
 */
const TOTAL_BUDGET_MS = 20_000;
/** Below this there is no point starting another provider. */
const MIN_ATTEMPT_MS = 3_000;

interface Provider {
  name: string;
  url: string;
  model: string;
  keyEnv: string;
}

const PROVIDERS: readonly Provider[] = [
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    keyEnv: 'MISTRAL_API_KEY',
  },
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    keyEnv: 'GROQ_API_KEY',
  },
] as const;

export interface Completion {
  text: string;
  provider: string;
  model: string;
}

async function callProvider(
  provider: Provider,
  apiKey: string,
  messages: ChatMessage[],
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, temperature: 0.2, max_tokens: 600, messages }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // The body can echo request content and provider-side detail. It belongs
      // in the logs, never in the response: the old code passed it straight
      // back to the browser.
      const detail = await res.text().catch(() => '<unreadable>');
      throw new Error(`HTTP ${res.status}: ${detail.slice(0, 500)}`);
    }

    const payload = await res.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('empty completion');
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * First provider that answers wins. Throws ApiError when none can.
 *
 * Failures are logged with their provider and reason; the caller sees only that
 * the service is unavailable.
 */
export async function complete(messages: ChatMessage[]): Promise<Completion> {
  const startedAt = Date.now();
  let sawConfiguredProvider = false;

  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.keyEnv);
    if (!apiKey) {
      logError('provider_unconfigured', { provider: provider.name, env: provider.keyEnv });
      continue;
    }
    sawConfiguredProvider = true;

    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) {
      logError('provider_budget_exhausted', { provider: provider.name, remaining });
      break;
    }

    try {
      const text = await callProvider(provider, apiKey, messages, remaining);
      return { text, provider: provider.name, model: provider.model };
    } catch (err) {
      logError('provider_failed', {
        provider: provider.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!sawConfiguredProvider) {
    throw new ApiError(503, 'The assistant is not configured yet.', {
      code: 'no_provider_configured',
      internal: 'no provider API key present in the function environment',
    });
  }

  throw new ApiError(503, 'The assistant is busy right now. Try again in a moment.', {
    code: 'providers_unavailable',
  });
}
