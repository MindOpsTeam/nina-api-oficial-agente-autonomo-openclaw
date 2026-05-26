import React from 'react';
import { CircleDashed, CircleDot, Wifi, WifiOff } from 'lucide-react';
import type { InstanceStatus } from '@/hooks/useInstance';

interface BadgeConfig {
  label: string;
  className: string;
  dotClassName: string;
  pulse: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

export const STATUS_CONFIG: Record<InstanceStatus, BadgeConfig> = {
  unregistered: {
    label: 'Não registrada',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    dotClassName: 'bg-slate-500',
    pulse: false,
    Icon: CircleDashed,
  },
  registered: {
    label: 'Registrada',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-500',
    pulse: false,
    Icon: CircleDot,
  },
  online: {
    label: 'Online',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-500',
    pulse: true,
    Icon: Wifi,
  },
  offline: {
    label: 'Offline',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotClassName: 'bg-red-500',
    pulse: false,
    Icon: WifiOff,
  },
};

export const StatusBadge: React.FC<{ status: InstanceStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${config.dotClassName}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dotClassName}`} />
      </span>
      {config.label}
    </div>
  );
};
