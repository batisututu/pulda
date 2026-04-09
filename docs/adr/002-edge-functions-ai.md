# ADR-002: Run AI Gateways Exclusively in Supabase Edge Functions

## Status
Accepted

## Date
2026-04-06

## Context
The app uses 5 AI gateways (OCR via GPT-4o-mini, Classifier, Explanation via Claude Sonnet, Verifier, VariantGenerator). These require API keys for OpenAI and Anthropic. Client-side execution would expose keys in the app bundle and increase bundle size.

## Decision
All AI gateway implementations run in Supabase Edge Functions (Deno runtime) at `supabase/functions/`. Client code invokes them via `supabase.functions.invoke()`. AI SDK packages (`openai`, `@anthropic-ai/sdk`) are never imported in client code.

## Consequences

### Positive
- API keys never leave the server
- Bundle size stays small
- Rate limiting and cost tracking possible server-side
- Can switch AI models without app updates

### Negative
- Adds network latency for AI operations
- Edge Function cold starts
- Different runtime (Deno) requires separate import conventions and tsconfig

### Neutral
- Edge Functions have separate deployment lifecycle from the app
