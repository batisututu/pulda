/**
 * Shared auth utility for Edge Functions.
 * Extracts user ID from Supabase JWT.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Extract the authenticated user ID from the request's Authorization header.
 * service_role 키로 getUser()를 호출하여 JWT 토큰에서 유저 정보를 추출한다.
 * Returns null if the token is invalid or missing.
 */
export async function getUserId(req: Request): Promise<string | null> {
  // x-user-token 우선 — ES256 JWT가 게이트웨이를 우회하여 직접 전달됨
  const userToken = req.headers.get('x-user-token');
  const authHeader = req.headers.get('Authorization');
  const token = userToken
    ?? (authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null);
  if (!token) return null;

  // service_role 키로 클라이언트를 생성하여 어떤 유저의 JWT든 검증 가능
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}
