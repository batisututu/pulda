# ADR-004: Use Explicit Bidirectional Mappers for Domain-DB Translation

## Status
Accepted

## Date
2026-04-06

## Context
Supabase PostgreSQL uses snake_case columns while domain entities use camelCase. JSON columns (`verification_result`, `visual_explanation`) need type-safe parsing. Direct Supabase response typing is loose -- mappers provide the type safety boundary.

## Decision
Every entity gets a mapper in `src/infrastructure/mappers/` with two functions: `toDomain(dbRow)` converts snake_case DB rows to camelCase domain entities; `toPersistence(entity)` does the reverse. Repositories must use mappers -- never return raw DB rows. Adding a field to an entity requires updating both mapper functions and creating a DB migration.

## Consequences

### Positive
- Domain layer stays clean (camelCase, no DB concerns)
- Type safety at the DB boundary
- Easy to spot missing field mappings in code review
- Mappers are simple functions -- easy to test

### Negative
- Every entity field change requires 3 edits (entity, mapper toDomain, mapper toPersistence + migration)
- Boilerplate for simple entities

### Neutral
- 16 mapper files matching 16 repositories -- one-to-one correspondence
