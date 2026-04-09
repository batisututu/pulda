/**
 * API 서버 베이스 URL.
 * 개발: localhost Next.js 서버
 * 프로덕션: Vercel 배포 URL
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
