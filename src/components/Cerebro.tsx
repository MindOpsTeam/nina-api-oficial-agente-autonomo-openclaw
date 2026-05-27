import React from 'react';
import { useInstance } from '@/hooks/useInstance';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import InstallBlock from './cerebro/InstallBlock';
import StatusBlock from './cerebro/StatusBlock';
import TestBlock from './cerebro/TestBlock';
import ActivateBlock from './cerebro/ActivateBlock';

const TEXT = {
  title: 'Cérebro',
  subtitlePrefix: 'Conecte e gerencie o cérebro OpenClaw da',
} as const;

const Cerebro: React.FC = () => {
  const { instance, status, loading, error, refetch } = useInstance();
  const { companyName } = useCompanySettings();

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-950 text-slate-50 custom-scrollbar">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-white">{TEXT.title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          {TEXT.subtitlePrefix} {companyName}.
        </p>
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
      </div>
    </div>
  );
};

export default Cerebro;
