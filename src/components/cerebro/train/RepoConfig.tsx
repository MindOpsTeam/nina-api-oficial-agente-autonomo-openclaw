import React, { useEffect, useState } from 'react';
import { Loader2, Save, Github, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNinaSettings } from '@/hooks/useNinaSettings';

const PAT_FLAG_KEY = 'nina_github_pat_configured';

const TEXT = {
  repoLabel: 'Repositório do cérebro (GitHub)',
  repoPlaceholder: 'https://github.com/sua-org/seu-repo',
  repoHint: 'O brain-build commita os arquivos da skill no branch dedicado "nina-brain" deste repo.',
  saveRepo: 'Salvar repositório',
  repoSaved: 'Repositório salvo',
  repoError: 'Erro ao salvar repositório',
  patLabel: 'PAT do GitHub (token de acesso)',
  patPlaceholder: 'ghp_… (salvo no Vault, nunca exibido de volta)',
  patHint: 'O token é enviado direto para um cofre seguro (Vault) e nunca é gravado no navegador nem no banco.',
  savePat: 'Salvar token',
  patSaved: 'Token salvo com segurança',
  patEmpty: 'Cole o PAT do GitHub primeiro',
  patError: 'Erro ao salvar o token. Verifique e tente novamente.',
  configured: 'Configurado',
  notConfigured: 'Não configurado',
} as const;

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const RepoConfig: React.FC = () => {
  const { values, loading, saving, save } = useNinaSettings();
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [savingPat, setSavingPat] = useState(false);
  const [patConfigured, setPatConfigured] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(PAT_FLAG_KEY) === 'true'
  );

  useEffect(() => {
    setRepoUrl(values.brain_repo_url);
  }, [values.brain_repo_url]);

  const handleSaveRepo = async () => {
    const ok = await save({ brain_repo_url: repoUrl.trim() });
    toast[ok ? 'success' : 'error'](ok ? TEXT.repoSaved : TEXT.repoError);
  };

  const handleSavePat = async () => {
    if (!pat.trim()) {
      toast.error(TEXT.patEmpty);
      return;
    }
    setSavingPat(true);
    try {
      const { error } = await supabase.functions.invoke('save-github-token', {
        body: { value: pat.trim() },
      });
      if (error) throw error;
      window.localStorage.setItem(PAT_FLAG_KEY, 'true');
      setPatConfigured(true);
      setPat('');
      toast.success(TEXT.patSaved);
    } catch (err) {
      console.error('[RepoConfig] Erro ao salvar PAT:', err);
      toast.error(TEXT.patError);
    } finally {
      setSavingPat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
          <Github className="w-4 h-4" />
          {TEXT.repoLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder={TEXT.repoPlaceholder}
            className={`${inputClass} font-mono`}
          />
          <Button onClick={handleSaveRepo} disabled={saving} className="flex-shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">{TEXT.repoHint}</p>
      </div>

      <div className="border-t border-slate-800 pt-5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <KeyRound className="w-4 h-4" />
            {TEXT.patLabel}
          </label>
          <span
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              patConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}
          >
            {patConfigured ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {patConfigured ? TEXT.configured : TEXT.notConfigured}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder={TEXT.patPlaceholder}
            autoComplete="off"
            className={inputClass}
          />
          <Button onClick={handleSavePat} disabled={savingPat || !pat.trim()} className="flex-shrink-0">
            {savingPat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">{TEXT.patHint}</p>
      </div>
    </div>
  );
};

export default RepoConfig;
