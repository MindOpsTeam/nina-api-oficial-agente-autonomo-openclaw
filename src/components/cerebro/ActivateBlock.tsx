import React from 'react';
import { BrainCircuit, Loader2, Sparkles, Server, AlertTriangle } from 'lucide-react';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { useBrainProvider } from '@/hooks/useBrainProvider';
import type { InstanceStatus } from '@/hooks/useInstance';

const TEXT = {
  title: 'Ativar cérebro',
  subtitle: 'Escolha qual cérebro processa as conversas da Nina.',
  lovable: 'Lovable AI',
  lovableDesc: 'Cérebro gerenciado, sempre disponível (padrão).',
  openclaw: 'OpenClaw (sua VPS)',
  openclawDesc: 'Agente autônomo rodando na sua instância.',
  toggleLabel: 'Usar OpenClaw como cérebro',
  requiresOnline: 'Ative apenas com a instância ONLINE. Conecte e aguarde o heartbeat antes de ativar.',
  fallbackNote:
    'Se a instância cair, a Nina volta automaticamente para o Lovable AI — você não perde atendimento.',
  activated: 'Cérebro alterado para OpenClaw',
  deactivated: 'Cérebro alterado para Lovable AI',
  error: 'Não foi possível alterar o cérebro',
} as const;

interface ActivateBlockProps {
  status: InstanceStatus;
}

const ActivateBlock: React.FC<ActivateBlockProps> = ({ status }) => {
  const { provider, loading, saving, setProvider } = useBrainProvider();
  const isOpenclaw = provider === 'openclaw';
  const isOnline = status === 'online';
  // Permite desligar a qualquer momento; ligar exige instância ONLINE.
  const toggleDisabled = saving || loading || (!isOpenclaw && !isOnline);

  const handleToggle = async (checked: boolean) => {
    const ok = await setProvider(checked ? 'openclaw' : 'lovable');
    if (ok) {
      toast.success(checked ? TEXT.activated : TEXT.deactivated);
    } else {
      toast.error(TEXT.error);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center gap-3 mb-1">
        <BrainCircuit className="w-5 h-5 text-cyan-400" />
        <h3 className="font-semibold text-white">{TEXT.title}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-5">{TEXT.subtitle}</p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <ProviderCard
              icon={Sparkles}
              name={TEXT.lovable}
              desc={TEXT.lovableDesc}
              active={!isOpenclaw}
            />
            <ProviderCard
              icon={Server}
              name={TEXT.openclaw}
              desc={TEXT.openclawDesc}
              active={isOpenclaw}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center gap-3">
              {saving && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
              <span className="text-sm font-medium text-slate-200">{TEXT.toggleLabel}</span>
            </div>
            <Switch checked={isOpenclaw} onCheckedChange={handleToggle} disabled={toggleDisabled} />
          </div>

          {!isOnline && !isOpenclaw && (
            <div className="mt-4 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
              {TEXT.requiresOnline}
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-px" />
            {TEXT.fallbackNote}
          </div>
        </>
      )}
    </div>
  );
};

const ProviderCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  active: boolean;
}> = ({ icon: Icon, name, desc, active }) => (
  <div
    className={`rounded-lg border p-4 transition-colors ${
      active
        ? 'border-cyan-500/40 bg-cyan-500/5'
        : 'border-slate-800 bg-slate-950/40'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>{name}</span>
      {active && (
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
          Ativo
        </span>
      )}
    </div>
    <p className="text-xs text-slate-500">{desc}</p>
  </div>
);

export default ActivateBlock;
