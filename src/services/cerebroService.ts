import { supabase } from '@/integrations/supabase/client';

/**
 * Camada de acesso central da jornada do /cerebro: secrets, sync e provisionamento.
 * Concentra os invoke das edge fns e a leitura/escrita do "último sync" (localStorage),
 * além de um event-bus leve para o gate da jornada reagir a saves/sync na hora.
 */

export type SecretName = 'PANEL_TOKEN' | 'NINA_TOOLS_SECRET' | 'GITHUB_BRAIN_TOKEN' | 'ANTHROPIC_API_KEY';

export const SECRET_NAMES: SecretName[] = [
  'PANEL_TOKEN',
  'NINA_TOOLS_SECRET',
  'GITHUB_BRAIN_TOKEN',
  'ANTHROPIC_API_KEY',
];

export type SecretsStatus = Record<SecretName, boolean>;

export interface LastSync {
  commitSha: string;
  branch: string;
  filesCount: number;
  at: string;
}

const SYNC_KEY = 'nina_brain_last_sync';
const secretFlagKey = (name: SecretName) => `nina_secret_${name}`;
const CEREBRO_CHANGED_EVENT = 'nina-cerebro-changed';

/** Notifica que algo da config mudou (secret salvo, sync feito) para refresh reativo. */
export function notifyCerebroChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CEREBRO_CHANGED_EVENT));
}

export function subscribeCerebroChanged(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CEREBRO_CHANGED_EVENT, cb);
  return () => window.removeEventListener(CEREBRO_CHANGED_EVENT, cb);
}

const truthy = (v: unknown): boolean =>
  v === true ||
  v === 'true' ||
  (typeof v === 'object' && v !== null && (v as { exists?: unknown }).exists === true);

function normalize(data: unknown): Partial<SecretsStatus> {
  const src = ((data as { secrets?: unknown })?.secrets ?? data ?? {}) as Record<string, unknown>;
  const out: Partial<SecretsStatus> = {};
  for (const name of SECRET_NAMES) out[name] = truthy(src[name]);
  return out;
}

/** Status dos secrets via edge fn (NUNCA expõe valores). `available=false` no gap de deploy. */
export async function fetchSecretsStatus(): Promise<{ status: Partial<SecretsStatus>; available: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('secrets-status');
    if (error) throw error;
    return { status: normalize(data), available: true };
  } catch (err) {
    console.warn('[cerebroService] secrets-status indisponível:', err);
    return { status: {}, available: false };
  }
}

export function readLocalSecretFlags(): Partial<SecretsStatus> {
  const out: Partial<SecretsStatus> = {};
  if (typeof window === 'undefined') return out;
  for (const name of SECRET_NAMES) out[name] = window.localStorage.getItem(secretFlagKey(name)) === 'true';
  return out;
}

export function markSecretSavedLocal(name: SecretName): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(secretFlagKey(name), 'true');
  notifyCerebroChanged();
}

/** Auto-provisiona os secrets internos (idempotente). Retorna true em sucesso. */
export async function provisionSecrets(): Promise<boolean> {
  const { error } = await supabase.functions.invoke('provision-secrets');
  if (error) throw error;
  return true;
}

/** Salva um secret no Vault via allowlist (GITHUB_BRAIN_TOKEN | ANTHROPIC_API_KEY). */
export async function saveSecret(name: SecretName, value: string): Promise<void> {
  const { error } = await supabase.functions.invoke('save-secret', { body: { name, value } });
  if (error) throw error;
  markSecretSavedLocal(name);
}

/** Salva o PAT do GitHub (fn dedicada já deployada; status real vem do secrets-status). */
export async function saveGithubToken(value: string): Promise<void> {
  const { error } = await supabase.functions.invoke('save-github-token', { body: { value } });
  if (error) throw error;
  markSecretSavedLocal('GITHUB_BRAIN_TOKEN');
}

export function getLastSync(): LastSync | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as LastSync) : null;
  } catch {
    return null;
  }
}

export function setLastSync(result: LastSync): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(SYNC_KEY, JSON.stringify(result));
  notifyCerebroChanged();
}
