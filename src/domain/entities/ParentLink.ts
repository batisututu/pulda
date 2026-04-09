/**
 * Parent-child account link for parental monitoring.
 * Uses a 6-character alphanumeric code for pairing.
 */
export interface ParentLink {
  id: string;
  parentUserId: string | null;
  childUserId: string;
  linkCode: string | null;        // 6-char code
  status: 'pending' | 'active' | 'revoked';
  linkedAt: string | null;        // ISO 8601
  revokedAt: string | null;       // ISO 8601
  createdAt: string;              // ISO 8601
}
