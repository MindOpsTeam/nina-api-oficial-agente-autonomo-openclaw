import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createAppointmentFromAI,
  rescheduleAppointmentFromAI,
  cancelAppointmentFromAI,
} from "../_shared/appointments.ts";
import { getSecret } from "../_shared/secrets.ts";

// nina-tools: backend de ferramentas chamado pela SKILL de agendamento do agente OpenClaw.
// Autenticação por header 'x-nina-secret' (NÃO usa JWT do Supabase) — é server-to-server
// entre o gateway OpenClaw e esta função. Roda com SERVICE_ROLE.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nina-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface NinaToolsBody {
  action?: 'create' | 'reschedule' | 'cancel';
  contact_id?: string;
  conversation_id?: string;
  user_id?: string | null;
  args?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Auth: x-nina-secret deve bater com NINA_TOOLS_SECRET (lido do Vault).
  const expectedSecret = await getSecret('NINA_TOOLS_SECRET');
  const providedSecret = req.headers.get('x-nina-secret');
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    console.warn('[nina-tools] Unauthorized: missing/invalid x-nina-secret');
    return json({ error: 'unauthorized' }, 401);
  }

  let body: NinaToolsBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { action, contact_id, conversation_id, user_id, args } = body;

  if (!action || !['create', 'reschedule', 'cancel'].includes(action)) {
    return json({ error: 'invalid_action', detail: "action deve ser 'create' | 'reschedule' | 'cancel'" }, 400);
  }
  if (!contact_id) {
    return json({ error: 'missing_contact_id' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const userId = user_id ?? null;

  try {
    let result: any;

    switch (action) {
      case 'create':
        result = await createAppointmentFromAI(
          supabase,
          contact_id,
          conversation_id ?? '',
          userId,
          args || {},
        );
        break;
      case 'reschedule':
        result = await rescheduleAppointmentFromAI(supabase, contact_id, userId, args || {});
        break;
      case 'cancel':
        result = await cancelAppointmentFromAI(supabase, contact_id, userId, args || {});
        break;
    }

    // Erros de domínio são retornados em result.error (date_in_past / time_conflict /
    // no_appointment_found / etc). HTTP 200 com ok:false para a skill tratar a resposta.
    if (result && result.error) {
      console.log(`[nina-tools] action=${action} domain_error=${result.error}`);
      return json({ ok: false, action, error: result.error, detail: result }, 200);
    }

    console.log(`[nina-tools] action=${action} ok appointment=${result?.id}`);
    return json({ ok: true, action, appointment: result }, 200);
  } catch (e) {
    console.error('[nina-tools] Unexpected error:', e);
    return json({ ok: false, action, error: 'internal_error', detail: (e as Error)?.message }, 500);
  }
});
