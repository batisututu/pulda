const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I,l
const CODE_LENGTH = 6;
const CODE_EXPIRY_HOURS = 24;

export function generateLinkCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALLOWED_CHARS[Math.floor(Math.random() * ALLOWED_CHARS.length)];
  }
  return code;
}

export function isCodeExpired(createdAt: Date): boolean {
  const expiryMs = CODE_EXPIRY_HOURS * 60 * 60 * 1000;
  return Date.now() - createdAt.getTime() > expiryMs;
}
