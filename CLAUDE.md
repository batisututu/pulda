# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**풀다 (StudyAI / 시험의 신)** — AI-powered Korean exam analysis mobile app for middle/high school students.
Analyzes uploaded exam papers via OCR + multi-model AI pipeline, diagnoses error types, generates variant practice problems, and provides mini-tests.

**Stack**: Expo v55 + React Native 0.83 + Supabase (PostgreSQL, Auth, Storage, Edge Functions) + OpenAI GPT-4o-mini + Anthropic Claude Sonnet + Zustand v5 + NativeWind v4

**Repository**: `http://gitlab.deephigh.ai:8929/deephigh/pulda/pulda.git` (GitLab)

**Master specification**: `docs/SERVICE-SPEC.md` — all feature development must align with this document. Read it before implementing any feature.

## Architecture: Clean Architecture 4-Layer

Dependency rule (inward only): `Presentation → UseCases → Domain ← Infrastructure`

| Layer | Location | Responsibility | Dependencies |
|-------|----------|---------------|-------------|
| **Domain** | `src/domain/` | Entities (16), Value Objects (10), Ports (repos + gateways), Business Rules (9 modules) | None (pure) |
| **UseCases** | `src/usecases/` | 25 use cases across 7 domains. Implement `UseCase<TInput, TOutput>`. Stateless, created fresh per call | Domain ports only |
| **Infrastructure** | `src/infrastructure/` | Supabase repos (16), AI gateways (5), mappers (15), storage. Repos are lazy singletons | Implements domain ports |
| **Presentation** | `src/presentation/` + `app/` | Expo Router (file-based), Zustand stores, NativeWind components | UseCases via DI container |

**DI Container** (`src/di/container.ts`): Composition root. Repos = lazy singletons (one per Supabase client). Use cases = fresh per call. AI gateways are NOT wired here — they run only in Edge Functions.

**Path alias**: `@/*` → `./src/*` (not available inside `supabase/functions/`)

## Critical Architectural Boundaries

1. **AI gateways are Edge Function only** — `IOcrGateway`, `IClassifierGateway`, `IExplanationGateway`, `IVerifierGateway`, `IVariantGeneratorGateway` run exclusively in `supabase/functions/` (Deno runtime). Client code calls them via `supabase.functions.invoke()`. Never import `openai` or `@anthropic-ai/sdk` in client code.

2. **Mapper obligation** — Every repository must use a mapper (`src/infrastructure/mappers/`). `toDomain(dbRow)` converts snake_case DB rows to camelCase domain entities; `toPersistence(entity)` does the reverse. Adding an entity field requires updating both mapper functions + DB migration.

3. **Edge Functions run on Deno** — `supabase/functions/**` is excluded from tsconfig. These functions have their own imports (Deno-style). Do not use `@/` path alias inside them. Shared utilities go in `supabase/functions/_shared/`.

4. **Error hierarchy** — All app errors extend `AppError` from `src/shared/errors.ts`. Use specific subclasses (`NotFoundError`, `InsufficientCreditsError`, `ValidationError`, `ForbiddenError`, etc.), never raw `Error`.

5. **Original exams are never shareable** — Business rule in `src/domain/rules/sharingRules.ts`. Only AI-generated content (variants, error notes, mini-test results, blueprints) can be shared.

## Domain Terminology

| Term | Meaning |
|------|---------|
| `Exam` | Uploaded exam paper (photo/PDF) being analyzed |
| `Question` | Single problem extracted from an exam via OCR |
| `Blueprint` | Exam structure analysis (unit/type/difficulty distribution) |
| `ErrorDiagnosis` | 3-type error cause analysis (concept_gap, calculation_error, time_pressure) |
| `VariantQuestion` | AI-generated practice problem targeting a specific error type |
| `MiniTest` | Timed drill session composed of selected variants |
| `ParentLink` | Parent-child account link (child generates 6-char code, parent enters it) |
| `Credit` | Usage currency; 1 credit per question analyzed. Resets monthly by plan |

## Development Workflow

### Before writing code
1. Read `docs/SERVICE-SPEC.md` for the relevant feature specification
2. Identify which Clean Architecture layer(s) the change touches
3. Check `src/domain/` for existing entities, ports, and rules to reuse
4. **Critical decisions require user approval**: new entity, schema change, new AI gateway, library addition, architecture change, business logic branching — ask first using AskUserQuestion

### After writing code — self-verification (complete BEFORE moving to next task)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx vitest run` → all tests pass
- [ ] Dependency rule not violated (no outward imports)
- [ ] Mapper updated if entity fields changed
- [ ] Korean comments (한글) added where logic is non-obvious

### Mistake tracking
When a mistake is repeated, add it to the "Known Pitfalls" section below with a date and description. Review this section before starting work.

## Commands

```bash
npx tsc --noEmit                    # Type check (must be 0 errors)
npx vitest run                      # Run all tests (398+)
npx vitest run src/domain           # Run domain tests only
npx vitest run src/usecases         # Run use case tests only
npx vitest run --reporter=verbose   # Verbose test output
npx expo start                      # Dev server
npx expo start --android            # Android
npx expo start --ios                # iOS
```

## Known Pitfalls

> Living section — add entries when mistakes repeat. Review before starting work.

| Date | Pitfall | Fix |
|------|---------|-----|
| 2026-03-30 | Forgetting mapper when adding entity field | Update both `toDomain()` and `toPersistence()` in the corresponding mapper + add DB migration |
| 2026-03-30 | Importing AI SDKs in client code | OpenAI/Anthropic only in `supabase/functions/`. Client uses `supabase.functions.invoke()` |
| 2026-03-30 | Mixing snake_case in domain layer | Domain entities use camelCase only. snake_case lives in DB rows and mappers only |
| 2026-03-30 | Creating use case as singleton | Use cases must be fresh per call (stateless). Only repos are lazy singletons in container |
| 2026-03-30 | Direct Supabase queries in presentation | Always go through UseCase → Repository. Never call `supabase.from()` in components or stores |

## Agent Skills

Layer-specific Claude Code skills are available for guidance:
- `studyai-domain` — entities, VOs, ports, business rules
- `studyai-usecases` — orchestration, DTOs, use case flows
- `studyai-infrastructure` — repos, mappers, adapters, DB, RLS
- `studyai-presentation` — Expo Router, React Native, NativeWind, Zustand
- `studyai-design` — UI/UX design system (.pen files)
- `studyai-orchestrator` agent — cross-layer coordination and feature decomposition
