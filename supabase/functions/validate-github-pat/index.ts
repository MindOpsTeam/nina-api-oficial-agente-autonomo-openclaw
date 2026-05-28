/**
 * POST /validate-github-pat   (autenticada — user JWT)
 * Valida o PAT do GitHub (GITHUB_BRAIN_TOKEN do Vault) contra o repo de cérebro
 * do cliente (brain_repo_url de nina_settings), para a aba "Chaves" do /cerebro
 * avisar na hora se a chave está errada — antes de estourar no Sync/Install.
 *
 * Resposta JSON: { ok: boolean, can_write?: boolean, error?: string }
 * Regras:
 *   - 404            -> ok:false, error:'repo_nao_encontrado_ou_sem_acesso (...)'
 *   - 401            -> ok:false, error:'pat_invalido (token rejeitado pelo GitHub)'
 *   - 200 push:false -> ok:true,  can_write:false, error:'PAT sem permissão de ESCRITA (...)'
 *   - 200 push:true  -> ok:true,  can_write:true
 * NUNCA retorna nem loga o token.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";
import { getJwtUser } from "../_shared/userauth.ts";

// Extrai {owner, repo} de uma URL de repo (https ou ssh-ish), sem o .git.
function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const user = await getJwtUser(req);
  if (!user) return errorResponse("Auth obrigatória", 401);

  const pat = await getSecret("GITHUB_BRAIN_TOKEN");
  if (!pat) return jsonResponse({ ok: false, error: "token_nao_configurado (GITHUB_BRAIN_TOKEN ausente no Vault)" });

  // brain_repo_url: owner -> global (user_id null) -> qualquer (single-tenant),
  // mesmo fallback do setup-installer.
  const admin = adminClient();
  let repoUrl = "";
  {
    const byOwner = await admin.from("nina_settings").select("brain_repo_url").eq("user_id", user.id).maybeSingle();
    repoUrl = (byOwner.data?.brain_repo_url ?? "").trim();
    if (!repoUrl) {
      const global = await admin.from("nina_settings").select("brain_repo_url").is("user_id", null).maybeSingle();
      repoUrl = (global.data?.brain_repo_url ?? "").trim();
    }
    if (!repoUrl) {
      const any = await admin.from("nina_settings").select("brain_repo_url").limit(1).maybeSingle();
      repoUrl = (any.data?.brain_repo_url ?? "").trim();
    }
  }
  if (!repoUrl) return jsonResponse({ ok: false, error: "brain_repo_url_nao_configurado (configure o repo do cérebro primeiro)" });

  const parsed = parseRepo(repoUrl);
  if (!parsed) return jsonResponse({ ok: false, error: "brain_repo_url_invalido (esperado github.com/owner/repo)" });

  let resp: Response;
  try {
    resp = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "nina-cerebro-validate",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (_e) {
    return jsonResponse({ ok: false, error: "erro_rede (não foi possível contatar o GitHub)" });
  }

  if (resp.status === 404) {
    return jsonResponse({ ok: false, can_write: false, error: "repo_nao_encontrado_ou_sem_acesso (PAT precisa de acesso ao repo)" });
  }
  if (resp.status === 401) {
    return jsonResponse({ ok: false, can_write: false, error: "pat_invalido (token rejeitado pelo GitHub)" });
  }
  if (resp.status === 403) {
    return jsonResponse({ ok: false, can_write: false, error: "pat_sem_escopo_ou_rate_limit (GitHub respondeu 403)" });
  }
  if (!resp.ok) {
    return jsonResponse({ ok: false, can_write: false, error: `erro_github_${resp.status}` });
  }

  let data: { permissions?: { push?: boolean } } = {};
  try { data = await resp.json(); } catch { /* corpo inesperado: trata como sem permissão abaixo */ }

  const canWrite = data?.permissions?.push === true;
  if (!canWrite) {
    return jsonResponse({ ok: true, can_write: false, error: "PAT sem permissão de ESCRITA (Contents: Read and write)" });
  }
  return jsonResponse({ ok: true, can_write: true });
});
