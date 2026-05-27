// _shared/userauth.ts
// Resolve o usuário a partir do JWT (header Authorization: Bearer <jwt>).
// Retorna { id } em sucesso, ou null (o caller responde 401).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getJwtUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { id: user.id };
}
