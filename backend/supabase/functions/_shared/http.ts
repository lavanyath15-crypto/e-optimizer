/**
 * JSON responses and the error type handlers throw.
 *
 * Keeping the shape in one place means every failure looks the same to the
 * client, and that the detail we log is never accidentally the detail we return.
 */

export interface ErrorBody {
  error: string;
  /** Optional machine-readable code so the client can branch without parsing prose. */
  code?: string;
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * An error with a status and a message that is safe to show a caller.
 *
 * `internal` carries anything we want in the logs but not in the response:
 * upstream bodies, provider names, key-shaped strings.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly internal?: string;

  constructor(status: number, message: string, options?: { code?: string; internal?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code ?? 'error';
    this.internal = options?.internal;
  }
}

/** Structured line so failures are greppable in the function logs. */
export function logError(event: string, detail: unknown): void {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      detail: detail instanceof Error ? detail.message : detail,
      at: new Date().toISOString(),
    })
  );
}
