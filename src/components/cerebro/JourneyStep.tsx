import React from 'react';
import { Check, Lock } from 'lucide-react';

interface JourneyStepProps {
  step: number;
  title: string;
  subtitle?: string;
  done?: boolean;
  locked?: boolean;
  lockHint?: string;
  children: React.ReactNode;
}

/**
 * Passo numerado da jornada do /cerebro (Chaves → Treinar/Sincronizar → Instalar).
 * Quando `locked`, mostra a dica de bloqueio e desabilita visualmente o conteúdo.
 * Wrapper leve: os filhos trazem seus próprios cards.
 */
const JourneyStep: React.FC<JourneyStepProps> = ({
  step,
  title,
  subtitle,
  done,
  locked,
  lockHint,
  children,
}) => {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done
              ? 'bg-emerald-500/15 text-emerald-400'
              : locked
              ? 'bg-slate-800 text-slate-500'
              : 'bg-cyan-500/15 text-cyan-400'
          }`}
        >
          {done ? <Check className="w-4 h-4" /> : locked ? <Lock className="w-3.5 h-3.5" /> : step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="font-semibold text-white leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {locked && lockHint && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300 ml-10">
          <Lock className="w-4 h-4 flex-shrink-0 mt-px" />
          {lockHint}
        </div>
      )}

      <div className={locked ? 'pointer-events-none select-none opacity-50' : ''} aria-disabled={locked}>
        {children}
      </div>
    </section>
  );
};

export default JourneyStep;
