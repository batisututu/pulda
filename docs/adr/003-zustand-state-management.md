# ADR-003: Use Zustand v5 for Client-Side State Management

## Status
Accepted

## Date
2026-04-06

## Context
Needed a state management solution for React Native that integrates with Clean Architecture -- stores should be thin presentation-layer coordinators that delegate to UseCases, not business logic containers.

## Decision
Use Zustand v5 with the `create()` pattern. Each major domain (auth, exam, minitest, social, parent) gets its own store. Stores call UseCase factory functions from the DI container for data operations. Only `supabase.auth` is called directly from stores (auth is the sole exception to the "no Supabase in presentation" rule).

## Consequences

### Positive
- Minimal boilerplate vs Redux
- No providers/context wrapping needed
- Stores are plain JavaScript -- easy to test
- Selective re-rendering via selectors
- Works well with TypeScript strict mode

### Negative
- No built-in devtools as rich as Redux DevTools
- No middleware ecosystem
- Less opinionated -- team must enforce patterns manually

### Neutral
- Zustand is lightweight (~1KB) and has good React Native support
