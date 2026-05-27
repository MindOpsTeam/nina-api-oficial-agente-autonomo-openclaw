import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useInstance } from '@/hooks/useInstance';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useProvisionSecrets } from '@/hooks/useProvisionSecrets';
import InstallBlock from './cerebro/InstallBlock';
import StatusBlock from './cerebro/StatusBlock';
import TestBlock from './cerebro/TestBlock';
import ActivateBlock from './cerebro/ActivateBlock';
import TrainBlock from './cerebro/TrainBlock';

const TEXT = {
  title: 'Cérebro',
  subtitlePrefix: 'Conecte e gerencie o cérebro OpenClaw da',
  initialized: 'Inicializado',
} as const;

const Cerebro: React.FC = () => {
  const { instance, status, loading, error, refetch } = useInstance();
  const { companyName } = useCompanySettings();
  // Auto-provisiona os secrets internos ao abrir a tela (silencioso/idempotente).
  const { provisioned } = useProvisionSecrets();

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-950 text-slate-50 custom-scrollbar">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{TEXT.title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {TEXT.subtitlePrefix} {companyName}.
          </p>
        </div>
        {provisioned && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/80 mt-1 flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {TEXT.initialized}
          </span>
        )}
      </div>

      <div className="space-y-6">
        <InstallBlock />
        <StatusBlock
          instance={instance}
          status={status}
          loading={loading}
          error={error}
          onRefresh={refetch}
        />
        <TestBlock status={status} />
        <ActivateBlock status={status} />
        <TrainBlock />
      </div>
    </div>
  );
};

export default Cerebro;
