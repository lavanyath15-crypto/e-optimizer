/**
 * Client for the `recommend` Edge Function.
 *
 * Goes through supabase.functions.invoke so the session JWT is attached
 * automatically and the LLM API keys stay on the server. The function rejects
 * anything that is not a signed-in user, so an expired session shows up here as
 * a 401 rather than a silent failure.
 */

import { supabase, isConfigured, NOT_CONFIGURED_MESSAGE } from './supabaseClient.js';

/** Longer than the function's own 20s budget, so the server's message wins. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * @returns {Promise<{recommendations: string|null, provider: string|null, error: string|null}>}
 */
export async function getRecommendations(plantState) {
  return callFunction(plantState);
}

/**
 * Free-text question answered against the same plant figures.
 * `history` is prior turns, oldest first; the function trims and validates it
 * server-side, so anything sent here is a suggestion, not a guarantee.
 *
 * @returns {Promise<{recommendations: string|null, provider: string|null, error: string|null}>}
 */
export async function askAssistant(question, plantState, history = []) {
  return callFunction({ ...plantState, mode: 'chat', question, history });
}

/**
 * Reviews an operator's own plant export.
 *
 * `datasetSummary` is statistics built in the browser, never the rows: the file
 * itself does not leave the machine. See WEB/src/lib/datasetAnalysis.ts.
 *
 * @returns {Promise<{recommendations: string|null, provider: string|null, error: string|null}>}
 */
export async function analyseDataset(datasetSummary, plantState) {
  return callFunction({ ...plantState, mode: 'dataset', datasetSummary });
}

function failure(error) {
  return { recommendations: null, provider: null, error };
}

/**
 * Pulls the function's own error message out of a non-2xx response.
 *
 * supabase-js surfaces these as a generic "Edge Function returned a non-2xx
 * status code", which tells an operator nothing. The real message is in the
 * response body.
 */
async function readErrorMessage(error) {
  try {
    // Named `payload`, not `body`: this used to shadow the request body in the
    // enclosing scope, which was confusing to read and a rename away from a bug.
    const payload = await error.context?.json?.();
    if (payload?.error) return payload.error;
  } catch {
    // Body already consumed or not JSON. Fall through to the generic message.
  }
  return error.message ?? 'The recommendation service failed.';
}

async function callFunction(body) {
  if (!isConfigured) return failure(NOT_CONFIGURED_MESSAGE);

  let timeoutId;
  try {
    // functions.invoke takes no abort signal, so the timeout is a race. It frees
    // the caller's UI; the underlying request may still be in flight.
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('The assistant took too long to respond. Try again.')),
        REQUEST_TIMEOUT_MS
      );
    });

    const { data, error } = await Promise.race([
      supabase.functions.invoke('recommend', { body }),
      timeout,
    ]);

    if (error) return failure(await readErrorMessage(error));

    if (!data?.recommendations) {
      return failure('The recommendation service returned an empty response.');
    }

    return {
      recommendations: data.recommendations,
      provider: data.provider ?? null,
      error: null,
    };
  } catch (err) {
    return failure(err instanceof Error ? err.message : 'The recommendation request failed.');
  } finally {
    clearTimeout(timeoutId);
  }
}
