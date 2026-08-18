const WORDPRESS_SESSION_ERROR_CODES = new Set([
  'amount_mismatch',
  'amount_range',
  'bridge_disabled',
  'expired',
  'fee_contract',
  'invalid_destination',
  'invalid_items',
  'invalid_request',
  'probe_unavailable',
  'replay',
  'structured_total',
  'unauthorized',
]);

export type WordPressSessionDiagnostic = {
  upstream_http_status: number | null;
  upstream_error_code: string;
  correlation_id: string;
};

export function sanitizeWordPressSessionDiagnostic(
  responseStatus: unknown,
  responseBody: unknown,
  expectedCorrelationId: string,
  localContractError?: 'invalid_checkout_url' | 'correlation_mismatch',
): WordPressSessionDiagnostic {
  const status = Number(responseStatus);
  const upstreamHttpStatus = Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : null;
  const body = responseBody && typeof responseBody === 'object' ? responseBody as Record<string, unknown> : {};
  const candidateCode = typeof body.code === 'string' ? body.code.toLowerCase() : '';
  const upstreamErrorCode = localContractError
    ? localContractError
    : WORDPRESS_SESSION_ERROR_CODES.has(candidateCode) ? candidateCode : 'unknown_wordpress_error';

  return {
    upstream_http_status: upstreamHttpStatus,
    upstream_error_code: upstreamErrorCode,
    correlation_id: expectedCorrelationId,
  };
}
