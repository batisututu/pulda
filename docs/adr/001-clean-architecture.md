# ADR-001: Adopt Clean Architecture 4-Layer Pattern

## Status
Accepted

## Date
2026-04-06

## Context
StudyAI needed a scalable, testable architecture for a mobile app with AI pipelines, multiple data sources (Supabase, OpenAI, Anthropic), and complex domain logic (exam analysis, scoring, error diagnosis). The team needed clear boundaries to allow independent development and testing of each layer.

## Decision
Adopt a 4-layer Clean Architecture:

1. **Domain** (`src/domain/`) — Entities, Value Objects, Port interfaces, and Business Rules. Pure TypeScript with zero external dependencies.
2. **UseCases** (`src/usecases/`) — Application orchestration. Each use case is a single class with one `execute()` method. Dependencies injected as port interfaces.
3. **Infrastructure** (`src/infrastructure/`) — Concrete implementations of domain ports: Supabase repositories, AI gateways, mappers, storage adapters.
4. **Presentation** (`src/presentation/` + `app/`) — Expo Router screens, React Native components, Zustand stores, NativeWind styling.

Strict dependency rule: dependencies flow inward only (Presentation -> UseCases -> Domain <- Infrastructure). The DI container at `src/di/container.ts` serves as the composition root, wiring ports to adapters.

## Consequences

### Positive
- Domain logic is pure and testable without external dependencies
- UseCases can be tested with mock ports
- Infrastructure can be swapped (e.g., different DB) without touching domain
- Clear contracts between layers via port interfaces

### Negative
- More boilerplate (ports, mappers, DI wiring)
- Learning curve for new developers
- Each entity addition requires updates in 4+ places (entity, mapper, repo, port)

### Neutral
- Total file count is higher but each file has focused responsibility
