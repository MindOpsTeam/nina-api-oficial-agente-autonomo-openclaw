import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GraduationCap, Loader2, RefreshCw, GitCommit, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../Button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import IdentityForm from './train/IdentityForm';
import ProductsManager from './train/ProductsManager';
import KnowledgeManager from './train/KnowledgeManager';
import { getLastSync, setLastSync, type LastSync } from '@/services/cerebroService';

const TEXT = {
  title: 'Treinar a Nina',
  subtitle: 'Configure a identidade, os produtos e o conhecimento — depois sincronize o cérebro com o repositório.',
  tabs: { identity: 'Identidade', products: 'Produtos', knowledge: 'Conhecimento' },
  sync: 'Sincronizar cérebro',
  syncing: 'Sincronizando…',
  synced: 'Cérebro sincronizado',
  lastSyncPrefix: 'Último sync',
  onBranch: 'no branch',
  errNoConfig: 'Configure o repositório e o PAT do GitHub antes de sincronizar.',
  errGithub: 'Falha ao falar com o GitHub. Verifique o repositório e o token.',
  errGeneric: 'Erro ao sincronizar o cérebro. Tente novamente.',
} as const;

async function mapBuildError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  let serverMsg: string | undefined;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const payload = await ctx.json();
      serverMsg = payload?.message ?? payload?.error;
    } catch {
      /* corpo não-JSON */
    }
  }
  if (ctx?.status === 400) return serverMsg || TEXT.errNoConfig;
  if (ctx?.status === 502) return TEXT.errGithub;
  return serverMsg || TEXT.errGeneric;
}

const TrainBlock: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSyncState] = useState<LastSync | null>(() => getLastSync());
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { data, error } = await supabase.functions.invoke('brain-build');
      if (error) {
        setSyncError(await mapBuildError(error));
        return;
      }
      if (data?.error) {
        setSyncError(data.message ?? TEXT.errGeneric);
        return;
      }
      const result: LastSync = {
        commitSha: data?.commit_sha ?? '',
        branch: data?.branch ?? 'nina-brain',
        filesCount: Array.isArray(data?.files_written) ? data.files_written.length : 0,
        at: new Date().toISOString(),
      };
      setLastSync(result); // persiste + notifia a jornada (destrava o passo Instalar)
      setLastSyncState(result);
      toast.success(TEXT.synced, { description: `${result.filesCount} arquivos no branch ${result.branch}` });
    } catch (err) {
      console.error('[TrainBlock] Erro ao sincronizar:', err);
      setSyncError(TEXT.errGeneric);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center gap-3 mb-1">
        <GraduationCap className="w-5 h-5 text-cyan-400" />
        <h3 className="font-semibold text-white">{TEXT.title}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-5">{TEXT.subtitle}</p>

      <Tabs defaultValue="identity">
        <TabsList className="bg-slate-950/60 border border-slate-800">
          <TabsTrigger value="identity">{TEXT.tabs.identity}</TabsTrigger>
          <TabsTrigger value="products">{TEXT.tabs.products}</TabsTrigger>
          <TabsTrigger value="knowledge">{TEXT.tabs.knowledge}</TabsTrigger>
        </TabsList>
        <TabsContent value="identity" className="mt-5"><IdentityForm /></TabsContent>
        <TabsContent value="products" className="mt-5"><ProductsManager /></TabsContent>
        <TabsContent value="knowledge" className="mt-5"><KnowledgeManager /></TabsContent>
      </Tabs>

      <div className="mt-6 border-t border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-500 min-w-0">
          {lastSync ? (
            <span className="flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 flex-shrink-0" />
              {TEXT.lastSyncPrefix} {formatDistanceToNow(new Date(lastSync.at), { addSuffix: true, locale: ptBR })}
              {lastSync.commitSha && (
                <code className="text-slate-400">· {lastSync.commitSha.slice(0, 7)}</code>
              )}
              <span className="text-slate-600">{TEXT.onBranch} {lastSync.branch}</span>
            </span>
          ) : (
            <span>Ainda não sincronizado.</span>
          )}
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {TEXT.syncing}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              {TEXT.sync}
            </>
          )}
        </Button>
      </div>

      {syncError && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-px" />
          <p className="text-sm text-red-300">{syncError}</p>
        </div>
      )}
    </div>
  );
};

export default TrainBlock;
