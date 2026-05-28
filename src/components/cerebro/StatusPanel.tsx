import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wifi, WifiOff, GitCommit } from 'lucide-react';
import type { InstanceStatus } from '@/hooks/useInstance';
import type { LastSync } from '@/services/cerebroService';

const TEXT = {
  online: 'OpenClaw online',
  offline: 'Sem instância online',
  synced: 'Cérebro sincronizado',
  notSynced: 'Cérebro nunca sincronizado',
} as const;

interface StatusPanelProps {
  instanceStatus: InstanceStatus;
  lastSync: LastSync | null;
}

/** Painel compacto no topo do /cerebro: instância ONLINE + último sync (badges simples). */
const StatusPanel: React.FC<StatusPanelProps> = ({ instanceStatus, lastSync }) => {
  const online = instanceStatus === 'online';
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <Badge ok={online}>
        {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {online ? TEXT.online : TEXT.offline}
      </Badge>
      <span className="text-slate-700">·</span>
      <Badge ok={!!lastSync}>
        <GitCommit className="w-3.5 h-3.5" />
        {lastSync
          ? `${TEXT.synced} ${formatDistanceToNow(new Date(lastSync.at), { addSuffix: true, locale: ptBR })}`
          : TEXT.notSynced}
      </Badge>
    </div>
  );
};

const Badge: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <span
    className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-400' : 'text-slate-500'}`}
  >
    <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-600'}`} />
    {children}
  </span>
);

export default StatusPanel;
