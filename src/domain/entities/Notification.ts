/**
 * In-app notification for a user.
 */
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;              // ISO 8601
}
