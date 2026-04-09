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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');

  // service_role 키로 클라이언트를 생성하여 어떤 유저의 JWT든 검증 가능
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}
