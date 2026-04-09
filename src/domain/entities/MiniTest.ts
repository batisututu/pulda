/**
 * A mini test composed of variant questions for focused practice.
 */
export interface MiniTest {
  id: string;
  userId: string;
  variantIds: string[];
  score: number | null;
  totalPoints: number | null;
  timeSpent: number | null;       // seconds
  completedAt: string | null;     // ISO 8601
  createdAt: string;              // ISO 8601
}
