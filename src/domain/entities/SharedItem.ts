/**
 * A socially shared AI-generated item.
 * IMPORTANT: Original exam papers are NEVER shareable (copyright protection).
 * Only AI-generated content (variant sets, error notes, mini test results, blueprints) can be shared.
 */
export interface SharedItem {
  id: string;
  userId: string;
  itemType: 'variant_set' | 'error_note' | 'mini_test_result' | 'blueprint';
  itemId: string;
  visibility: 'followers_only' | 'public';
  caption: string | null;
  createdAt: string;              // ISO 8601
}
