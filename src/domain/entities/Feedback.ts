/**
 * User feedback (thumbs up/down) on AI-generated content.
 */
export interface Feedback {
  id: string;
  userId: string;
  targetType: 'explanation' | 'variant' | 'blueprint';
  targetId: string;
  rating: -1 | 1;                 // thumbs down / up
  createdAt: string;              // ISO 8601
}
