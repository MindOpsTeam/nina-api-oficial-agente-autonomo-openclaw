-- Migration: RPC get_secret(text) — lê segredos do Supabase Vault.
-- Usada pelas Edge Functions (via service-role) para obter PANEL_TOKEN /
-- NINA_TOOLS_SECRET sem depender de Deno.env / dashboard.
--
-- SECURITY: o segredo NÃO pode vazar para o cliente.
--  - SECURITY DEFINER: roda como o owner (postgres), que enxerga vault.
--  - search_path = '': evita hijack; vault.decrypted_secrets é qualificado.
--  - EXECUTE revogado de PUBLIC/anon/authenticated; concedido só a service_role.

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
$$;

-- Fail-closed de acesso: ninguém executa por padrão, só service_role.
REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;
