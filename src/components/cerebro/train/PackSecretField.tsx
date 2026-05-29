import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const TEXT = {
  label: 'Chave necessária',
  placeholder: 'Cole a chave (salva no Vault, nunca exibida de volta)',
  save: 'Salvar chave',
  saved: 'Chave salva com segurança',
  empty: 'Cole a chave antes de salvar.',
  error: 'Erro ao salvar a chave. Tente novamente.',
  configured: 'Configurada',
  missing: 'Ausente',
  missingHint: 'Sem esta chave, o pack não funciona.',
} as const;

const inputClass =
  'h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

/** Nomes amigáveis conhecidos; fallback = o próprio nome do secret. */
const FRIENDLY: Record<string, string> = {
  FIRECRAWL_API_KEY: 'Chave Firecrawl',
  ANTHROPIC_API_KEY: 'Chave Anthropic',
  GITHUB_BRAIN_TOKEN: 'PAT do GitHub',
};

interface PackSecretFieldProps {
  /** Nome do secret exigido pelo pack (ex.: FIRECRAWL_API_KEY). */
  secretName: string;
}

/**
 * Campo INLINE write-only para um secret arbitrário exigido por um pack.
 * Status via secrets-status (booleano por nome); save via save-secret {name,value}.
 * NUNCA exibe nem loga o valor — só o status configurada/ausente.
 */
const PackSecretField: React.FC<PackSecretFieldProps> = ({ secretName }) => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('secrets-status');
      if (error) throw error;
      setConfigured(Boolean((data as Record<string, unknown>)?.[secretName]));
    } catch (err) {
      console.warn('[PackSecretField] secrets-status indisponível:', err);
      setConfigured(null);
    } finally {
      setStatusLoading(false);
    }
  }, [secretName]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error(TEXT.empty);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-secret', {
        body: { name: secretName, value: value.trim() },
      });
      if (error) throw error;
      setValue(''); // nunca mantém o valor no client
      toast.success(TEXT.saved);
      await refreshStatus();
    } catch (err) {
      console.error('[PackSecretField] Erro ao salvar:', err);
      toast.error(TEXT.error);
    } finally {
      setSaving(false);
    }
  };

  const friendly = FRIENDLY[secretName];
  const isMissing = configured === false;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400 min-w-0">
          <KeyRound className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {TEXT.label}: {friendly ? `${friendly} ` : ''}
            <code className="text-slate-300">{secretName}</code>
          </span>
        </label>
        {statusLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 flex-shrink-0" />
        ) : configured ? (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            {TEXT.configured}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex-shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
            {TEXT.missing}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={TEXT.placeholder}
          autoComplete="off"
          className={inputClass}
        />
        <Button onClick={handleSave} disabled={saving || !value.trim()} className="flex-shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </Button>
      </div>
      {isMissing && <p className="mt-1.5 text-[11px] text-amber-400">{TEXT.missingHint}</p>}
    </div>
  );
};

export default PackSecretField;
