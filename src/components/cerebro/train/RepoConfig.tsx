import React, { useEffect, useState } from 'react';
import { Loader2, Save, Github, KeyRound, ExternalLink } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNinaSettings } from '@/hooks/useNinaSettings';
import { useSecretsStatus } from '@/hooks/useSecretsStatus';
import WriteOnlySecretField from './WriteOnlySecretField';

const TEXT = {
  repoLabel: 'Repositório do cérebro (GitHub)',
  repoPlaceholder: 'https://github.com/sua-org/seu-repo',
  repoHint: 'O brain-build commita os arquivos da skill no branch dedicado "nina-brain" deste repo.',
  repoSaved: 'Repositório salvo',
  repoError: 'Erro ao salvar repositório',
  patLabel: 'PAT do GitHub (token de acesso)',
  patPlaceholder: 'ghp_… (salvo no Vault, nunca exibido de volta)',
  patSaved: 'Token salvo com segurança',
  patError: 'Erro ao salvar o token. Verifique e tente novamente.',
} as const;

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const RepoConfig: React.FC = () => {
  const { values, loading, saving, save } = useNinaSettings();
  const { status, refetch, recordSaved } = useSecretsStatus();
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    setRepoUrl(values.brain_repo_url);
  }, [values.brain_repo_url]);

  const handleSaveRepo = async () => {
    const ok = await save({ brain_repo_url: repoUrl.trim() });
    toast[ok ? 'success' : 'error'](ok ? TEXT.repoSaved : TEXT.repoError);
  };

  const handleSavePat = async (value: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('save-github-token', { body: { value } });
      if (error) throw error;
      recordSaved('GITHUB_BRAIN_TOKEN');
      await refetch();
      toast.success(TEXT.patSaved);
      return true;
    } catch (err) {
      console.error('[RepoConfig] Erro ao salvar PAT:', err);
      toast.error(TEXT.patError);
      return false;
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
        <WriteOnlySecretField
          label={TEXT.patLabel}
          placeholder={TEXT.patPlaceholder}
          configured={status.GITHUB_BRAIN_TOKEN}
          onSave={handleSavePat}
          icon={<KeyRound className="w-4 h-4" />}
          instruction={
            <span>
              Crie em{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-cyan-400 hover:underline"
              >
                github.com/settings/tokens
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              com escopo <code className="text-slate-300">repo</code> (acesso de escrita ao repositório do cérebro).
            </span>
          }
        />
      </div>
    </div>
  );
};

export default RepoConfig;
