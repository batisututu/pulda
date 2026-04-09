/**
 * Status of a follow relationship between students.
 * - pending: Follow request sent, awaiting acceptance
 * - accepted: Follow request accepted
 * - blocked: Follow request blocked
 */
export type FollowStatus = 'pending' | 'accepted' | 'blocked';
