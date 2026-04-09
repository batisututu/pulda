/**
 * Shared HTTP response utilities for Edge Functions.
 */
import { corsHeaders } from './cors.ts';

/**
 * Create a JSON success response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a JSON error response with CORS headers.
 */
export function errorResponse(
  message: string,
  status = 500,
  code?: string,
): Response {
  return new Response(
    JSON.stringify({ error: message, code: code ?? 'INTERNAL_ERROR' }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
