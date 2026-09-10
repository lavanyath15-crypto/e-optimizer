/**
 * Client for the `recommend` Edge Function.
 *
 * Goes through supabase.functions.invoke so the anon key is attached
 * automatically and the LLM API keys stay on the server.
 */

import { supabase, isConfigured } from './supabaseClient.js';

const NOT_CONFIGURED =
  'Recommendations need a Supabase connection. See backend/README.md.';

/**
 * @returns {Promise<{recommendations: string|null, provider: string|null, error: string|null}>}
 */
export async function getRecommendations(plantState) {
  return callFunction(plantState);
}

/**
 * Free-text question answered against the same plant figures.
 * `history` is prior turns, oldest first; the function trims it server-side.
 *
 * @returns {Promise<{recommendations: string|null, provider: string|null, error: string|null}>}
 */
export async function askAssistant(question, plantState, history = []) {
  return callFunction({ ...plantState, mode: 'chat', question, history });
}

async function callFunction(body) {
  if (!isConfigured) {
    return { recommendations: null, provider: null, error: NOT_CONFIGURED };
  }

  try {
    const { data, error } = await supabase.functions.invoke('recommend', {
      body,
    });

    if (error) {
      // A non-2xx carries the function's own JSON body, which explains which
      // provider failed and why. Surface that instead of "Edge Function error".
      let detail = error.message ?? 'Recommendation service failed.';
      try {
        const body = await error.context?.json?.();
        if (body?.error) {
          detail = body.attempts?.length
            ? `${body.error} (${body.attempts.join('; ')})`
            : body.error;
        }
      } catch {
        // Keep the generic message if the body is not readable.
      }
      return { recommendations: null, provider: null, error: detail };
    }

    if (!data?.recommendations) {
      return {
        recommendations: null,
        provider: null,
        error: 'The recommendation service returned an empty response.',
      };
    }

    return {
      recommendations: data.recommendations,
      provider: data.provider ?? null,
      error: null,
    };
  } catch (err) {
    return {
      recommendations: null,
      provider: null,
      error: err instanceof Error ? err.message : 'Recommendation request failed.',
    };
  }
}
