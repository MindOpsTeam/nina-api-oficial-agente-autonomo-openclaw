import React from 'react';
import { Loader2, Sparkles, AlertCircle, Store } from 'lucide-react';
import { useSkillPacks } from '@/hooks/useSkillPacks';
import SkillPackCard from './SkillPackCard';

const TEXT = {
  subtitle: 'Ligue ou desligue habilidades do cérebro da Nina. As ativas entram no próximo sync.',
  empty: 'Nenhuma habilidade disponível no catálogo ainda.',
  errorTitle: 'Erro ao carregar habilidades',
  changedBanner: 'Habilidades alteradas — clique em "Sincronizar cérebro" (abaixo) para aplicar no cérebro.',
} as const;

const SkillsStore: React.FC = () => {
  const { packs, loading, error, changed, setEnabled, setConfig } = useSkillPacks();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400">{TEXT.errorTitle}</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">{TEXT.subtitle}</p>

      {changed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-px" />
          {TEXT.changedBanner}
        </div>
      )}

      {packs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
          <Store className="w-6 h-6 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">{TEXT.empty}</p>
        </div>
      ) : (
        packs.map((pack) => (
          <SkillPackCard key={pack.slug} pack={pack} onToggle={setEnabled} onConfig={setConfig} />
        ))
      )}
    </div>
  );
};

export default SkillsStore;
