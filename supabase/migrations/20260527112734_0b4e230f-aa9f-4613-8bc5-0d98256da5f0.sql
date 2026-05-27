-- Migration: F5b — canal de reply de TESTE dedicado (sandbox do /cerebro).
-- A resposta de um run de teste (run_id prefixo 'test-') é gravada AQUI pela
-- edge fn nina-reply, NUNCA no send_queue — assim o whatsapp-sender jamais a
-- envia a um WhatsApp real. A edge fn nina-test pré-cria a row (status='pending')
-- e faz poll por run_id até a nina-reply preencher content/status.

CREATE TABLE IF NOT EXISTS public.nina_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  conversation_id uuid,
  content text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nina_test_results_run_id_idx ON public.nina_test_results (run_id);

ALTER TABLE public.nina_test_results ENABLE ROW LEVEL SECURITY;

-- RLS owner-scoped (o usuário só enxerga os próprios testes).
DROP POLICY IF EXISTS "owner_all_nina_test_results" ON public.nina_test_results;
CREATE POLICY "owner_all_nina_test_results" ON public.nina_test_results
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_nina_test_results" ON public.nina_test_results;
CREATE POLICY "service_role_all_nina_test_results" ON public.nina_test_results
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger (padrão do repo).
DROP TRIGGER IF EXISTS nina_test_results_updated_at_trigger ON public.nina_test_results;
CREATE TRIGGER nina_test_results_updated_at_trigger
  BEFORE UPDATE ON public.nina_test_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
