import type { Blueprint } from '@/domain/entities';

/**
 * Database row shape for the `blueprints` table (snake_case).
 */
export interface BlueprintRow {
  id: string;
  exam_id: string;
  unit_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
  difficulty_distribution: Record<string, number>;
  insights: string[] | null;
  created_at: string;
}

/**
 * Maps a Supabase `blueprints` row to the domain Blueprint entity.
 */
export function toDomain(row: BlueprintRow): Blueprint {
  return {
    id: row.id,
    examId: row.exam_id,
    unitDistribution: row.unit_distribution,
    typeDistribution: row.type_distribution,
    difficultyDistribution: row.difficulty_distribution,
    insights: row.insights,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Blueprint entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  blueprint: Partial<Omit<Blueprint, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (blueprint.examId !== undefined) row.exam_id = blueprint.examId;
  if (blueprint.unitDistribution !== undefined) row.unit_distribution = blueprint.unitDistribution;
  if (blueprint.typeDistribution !== undefined) row.type_distribution = blueprint.typeDistribution;
  if (blueprint.difficultyDistribution !== undefined) row.difficulty_distribution = blueprint.difficultyDistribution;
  if (blueprint.insights !== undefined) row.insights = blueprint.insights;

  return row;
}
