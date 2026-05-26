import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Loader2, RefreshCw, Globe, Tag, Clock, ServerCrash } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { InstanceInfo, InstanceStatus } from '@/hooks/useInstance';
import { INSTANCE_POLL_INTERVAL_MS } from '@/hooks/useInstance';

const TEXT = {
  title: 'Status da instância',
  refresh: 'Atualizar',
  autoRefresh: `Atualiza automaticamente a cada ${INSTANCE_POLL_INTERVAL_MS / 1000}s`,
  empty: 'Nenhuma instância registrada ainda. Gere o comando de instalação acima.',
  ingress: 'Endereço (ingress)',
  version: 'Versão do OpenClaw',
  heartbeat: 'Último heartbeat',
  noHeartbeat: 'Aguardando primeiro heartbeat',
  errorTitle: 'Erro ao carregar status',
} as const;

/** Mostra apenas o host do ingress_url para manter a UI curta. */
function shortenUrl(url: string | null): string {
  if (!url) return '—';
  try {
    return new URL(url).host;
  } catch {
    return url.length > 40 ? `${url.slice(0, 40)}…` : url;
  }
}

function relativeHeartbeat(iso: string | null): string {
  if (!iso) return TEXT.noHeartbeat;
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '—';
  }
}

interface StatusBlockProps {
  instance: InstanceInfo | null;
  status: InstanceStatus;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const StatusBlock: React.FC<StatusBlockProps> = ({ instance, status, loading, error, onRefresh }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">{TEXT.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {!loading && <StatusBadge status={status} />}
          <button
            type="button"
            onClick={onRefresh}
            title={TEXT.refresh}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-5">{TEXT.autoRefresh}</p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <ServerCrash className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">{TEXT.errorTitle}</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      ) : !instance ? (
        <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          {TEXT.empty}
        </p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoItem icon={Globe} label={TEXT.ingress} value={shortenUrl(instance.ingress_url)} mono />
          <InfoItem icon={Tag} label={TEXT.version} value={instance.openclaw_version || '—'} mono />
          <InfoItem icon={Clock} label={TEXT.heartbeat} value={relativeHeartbeat(instance.last_heartbeat)} />
        </dl>
      )}
    </div>
  );
};

const InfoItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}> = ({ icon: Icon, label, value, mono }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
    <dt className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </dt>
    <dd className={`text-sm text-slate-200 truncate ${mono ? 'font-mono' : ''}`} title={value}>
      {value}
    </dd>
  </div>
);

export default StatusBlock;
