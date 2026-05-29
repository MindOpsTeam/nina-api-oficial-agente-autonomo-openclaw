import React, { useState } from 'react';
import { BookOpen, Wrench, KeyRound, Server, AlertTriangle } from 'lucide-react';
import { Switch } from '../../ui/switch';
import { toast } from 'sonner';
import type { SkillPack, PackConfig } from '@/hooks/useSkillPacks';

const TEXT = {
  requiresSecret: 'Requer chave:',
  requiresEdgeFns: 'Usa funções de servidor:',
  saved: 'Habilidade atualizada',
  error: 'Erro ao atualizar habilidade',
  configSaved: 'Configuração salva',
  durationLabel: 'Janela do follow-up',
  metaWarning: 'O follow-up só dispara dentro da janela de 24h da Meta (mensagem gratuita).',
} as const;

type DurationUnit = 'minutos' | 'horas';

const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'minutos', label: 'Minutos' },
  { value: 'horas', label: 'Horas' },
];

// Teto por unidade para a janela ficar SEMPRE < 24h (acima disso a Meta exige template pago).
const MAX_BY_UNIT: Record<DurationUnit, number> = { minutos: 1439, horas: 23 };

const normalizeUnit = (u: unknown): DurationUnit => (u === 'minutos' ? 'minutos' : 'horas');

const clampValor = (valor: number, unit: DurationUnit): number => {
  const n = Math.floor(Number(valor)) || 1;
  return Math.min(MAX_BY_UNIT[unit], Math.max(1, n));
};

const fieldClass =
  'h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const LEVEL_META = (level: string) => {
  const isTool = level.toLowerCase().includes('ferr');
  return isTool
    ? { label: 'Ferramenta', className: 'bg-violet-500/10 text-violet-300 border-violet-500/20', Icon: Wrench }
    : { label: 'Conhecimento', className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', Icon: BookOpen };
};

const humanize = (key: string) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const hasDuration = (schema: PackConfig) => 'janela_valor' in schema && 'janela_unidade' in schema;

interface SkillPackCardProps {
  pack: SkillPack;
  onToggle: (slug: string, enabled: boolean) => Promise<boolean>;
  onConfig: (slug: string, config: PackConfig) => Promise<boolean>;
}

const SkillPackCard: React.FC<SkillPackCardProps> = ({ pack, onToggle, onConfig }) => {
  const [busy, setBusy] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PackConfig>(pack.config);
  const level = LEVEL_META(pack.level);

  const isDuration = hasDuration(pack.config_schema);
  // No fallback genérico, só campos numéricos simples (exclui as chaves de duração).
  const genericKeys = Object.keys(pack.config_schema).filter(
    (k) => !['janela_valor', 'janela_unidade'].includes(k),
  );

  const currentUnit = normalizeUnit(draftConfig.janela_unidade);

  const handleToggle = async (checked: boolean) => {
    setBusy(true);
    const ok = await onToggle(pack.slug, checked);
    setBusy(false);
    toast[ok ? 'success' : 'error'](ok ? TEXT.saved : TEXT.error);
  };

  const persist = async (next: PackConfig) => {
    const ok = await onConfig(pack.slug, next);
    toast[ok ? 'success' : 'error'](ok ? TEXT.configSaved : TEXT.error);
  };

  // Duração: número (1..max da unidade) + select (minutos|horas). Persiste { janela_valor, janela_unidade }.
  // Ao trocar a unidade, re-clampa o valor para o teto da nova unidade (sempre < 24h).
  const commitDuration = (patch: Partial<PackConfig>) => {
    const merged = { ...draftConfig, ...patch };
    const unit = normalizeUnit(merged.janela_unidade);
    const valor = clampValor(Number(merged.janela_valor), unit);
    const next: PackConfig = { ...merged, janela_unidade: unit, janela_valor: valor };
    setDraftConfig(next);
    if (next.janela_valor !== pack.config.janela_valor || next.janela_unidade !== pack.config.janela_unidade) {
      persist(next);
    }
  };

  const handleGenericBlur = (key: string) => {
    if (draftConfig[key] === pack.config[key]) return;
    persist({ ...pack.config, ...draftConfig });
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-100">{pack.name}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${level.className}`}>
              <level.Icon className="w-3 h-3" />
              {level.label}
            </span>
          </div>
          {pack.description && <p className="text-xs text-slate-400 mt-1">{pack.description}</p>}

          {pack.requires_secrets.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-400">
              <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
              {TEXT.requiresSecret} <code className="text-amber-300">{pack.requires_secrets.join(', ')}</code>
            </p>
          )}
          {pack.requires_edge_fns.length > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Server className="w-3.5 h-3.5 flex-shrink-0" />
              {TEXT.requiresEdgeFns} {pack.requires_edge_fns.join(', ')}
            </p>
          )}
        </div>

        <Switch checked={pack.enabled} onCheckedChange={handleToggle} disabled={busy} className="flex-shrink-0 mt-0.5" />
      </div>

      {pack.enabled && isDuration && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">{TEXT.durationLabel}</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={MAX_BY_UNIT[currentUnit]}
              value={Number(draftConfig.janela_valor ?? 1)}
              onChange={(e) => setDraftConfig((c) => ({ ...c, janela_valor: Number(e.target.value) }))}
              onBlur={() => commitDuration({})}
              className={`${fieldClass} w-24`}
            />
            <select
              value={currentUnit}
              onChange={(e) => commitDuration({ janela_unidade: e.target.value })}
              className={`${fieldClass} flex-1`}
            >
              {DURATION_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            {TEXT.metaWarning}
          </div>
        </div>
      )}

      {pack.enabled && !isDuration && genericKeys.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {genericKeys.map((key) => (
            <div key={key}>
              <label className="text-[11px] font-medium text-slate-400 mb-1 block">{humanize(key)}</label>
              <input
                type="number"
                min={0}
                value={Number(draftConfig[key] ?? 0)}
                onChange={(e) => setDraftConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                onBlur={() => handleGenericBlur(key)}
                className={`${fieldClass} w-full`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillPackCard;
