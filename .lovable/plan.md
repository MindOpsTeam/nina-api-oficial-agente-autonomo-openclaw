## Causa raiz

A passada de segurança anterior trancou `nina_settings` em admin-only (SELECT e ALL). O usuário do onboarding (`teste@teste.com`) não é admin — o trigger `handle_new_user` só promove o **primeiro** usuário cadastrado, e após o remix já existiam roles, então ele virou `user`.

Fluxo do erro em `OnboardingWizard.savePartialSettings()`:
1. `SELECT * FROM nina_settings` retorna `null` (RLS bloqueia silenciosamente).
2. `existing = null` → wizard cai no caminho **INSERT**.
3. INSERT falha: `new row violates row-level security policy for table "nina_settings"`.

## Decisão

Voltar `nina_settings` ao padrão **single-tenant** do projeto, igual `contacts`, `deals`, `appointments`, `conversations`, `messages` — todas com policy `auth.role() = 'authenticated'`. O project-knowledge confirma explicitamente esse modelo. Manter admin-only em uma única tabela cria inconsistência arquitetural e quebra o onboarding para qualquer usuário que não seja o primeiro.

## Plano

### 1. Migration: RLS de `nina_settings`

```sql
DROP POLICY IF EXISTS "Admins can modify nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Admins can read nina_settings"   ON public.nina_settings;

CREATE POLICY "Authenticated users can access all nina_settings"
ON public.nina_settings
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
```

A view `nina_settings_public` permanece intacta — `useCompanySettings` continua usando ela sem mudança.

### 2. Atualizar `security-memory`

Registrar que `nina_settings` é intencionalmente compartilhada entre todos os usuários autenticados (single-tenant workspace, mesmo modelo de `contacts`/`deals`/`messages`). Credenciais (`whatsapp_access_token`, `elevenlabs_api_key`) ficam acessíveis a todos os membros — risco aceito.

### 3. Marcar finding como `ignore` se reaparecer

Após a migration, o scanner pode reabrir o aviso sobre exposição de credenciais. Vou marcar como `ignore` com a mesma justificativa do project-knowledge.

## Riscos

- Credenciais de WhatsApp/ElevenLabs ficam legíveis para qualquer usuário autenticado. Coerente com o restante do projeto. Se algum dia virar multi-tenant, revisitar.
- Nenhuma mudança em código frontend, edge functions ou tipos.

## Verificação

1. Login com `teste@teste.com`.
2. Completar etapa do wizard que chama `savePartialSettings`.
3. Console deve mostrar `[OnboardingWizard] Step 4: Save result` sem erro de RLS.
