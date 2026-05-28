import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useInstance } from '@/hooks/useInstance';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useProvisionSecrets } from '@/hooks/useProvisionSecrets';
import { useCerebroConfig } from '@/hooks/useCerebroConfig';
import StatusPanel from './cerebro/StatusPanel';
import JourneyStep from './cerebro/JourneyStep';
import KeysStep from './cerebro/KeysStep';
import InstallBlock from './cerebro/InstallBlock';
import StatusBlock from './cerebro/StatusBlock';
import TestBlock from './cerebro/TestBlock';
import ActivateBlock from './cerebro/ActivateBlock';
import TrainBlock from './cerebro/TrainBlock';

const TEXT = {
  title: 'Cérebro',
  subtitlePrefix: 'Conecte e gerencie o cérebro OpenClaw da',
  initialized: 'Inicializado',
  step1Title: '1. Chaves & repositório',
  step1Sub: 'Configure a chave Anthropic, o PAT do GitHub e o repositório do cérebro.',
  step2Title: '2. Treinar e sincronizar',
  step2Sub: 'Ensine a identidade, produtos e conhecimento — depois sincronize o cérebro.',
  step3Title: '3. Instalar na VPS',
  step3Sub: 'Gere o comando e rode no seu servidor.',
  installLockHint: 'Configure as chaves (Anthropic + GitHub PAT) e sincronize o cérebro ao menos uma vez antes de instalar na VPS.',
  operations: 'Operação',
} as const;

const Cerebro: React.FC = () => {
  const { instance, status, loading, error, refetch } = useInstance();
  const { companyName } = useCompanySettings();
  // Auto-provisiona os secrets internos ao abrir a tela (silencioso/idempotente).
  const { provisioned } = useProvisionSecrets();
  // Estado da jornada (ordem/trava dos passos).
  const { keysReady, synced, installUnlocked, lastSync } = useCerebroConfig();

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-950 text-slate-50 custom-scrollbar">
      <div className="mb-6 flex items-start justify-between gap-4">
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

      <StatusPanel instanceStatus={status} lastSync={lastSync} />

      <div className="mt-8 space-y-8">
        <JourneyStep step={1} title={TEXT.step1Title} subtitle={TEXT.step1Sub} done={keysReady}>
          <KeysStep />
        </JourneyStep>

        <JourneyStep step={2} title={TEXT.step2Title} subtitle={TEXT.step2Sub} done={synced}>
          <TrainBlock />
        </JourneyStep>

        <JourneyStep
          step={3}
          title={TEXT.step3Title}
          subtitle={TEXT.step3Sub}
          done={status !== 'unregistered'}
          locked={!installUnlocked}
          lockHint={TEXT.installLockHint}
        >
          <div className="space-y-6">
            <InstallBlock locked={!installUnlocked} />
            <StatusBlock
              instance={instance}
              status={status}
              loading={loading}
              error={error}
              onRefresh={refetch}
            />
          </div>
        </JourneyStep>
      </div>

      <div className="mt-10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{TEXT.operations}</h3>
        <div className="space-y-6">
          <TestBlock status={status} />
          <ActivateBlock status={status} />
        </div>
      </div>
    </div>
  );
};

export default Cerebro;
