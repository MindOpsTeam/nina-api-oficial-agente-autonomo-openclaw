import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { useNinaSettings, type BrainIdentity, type NinaSettingsForm } from '@/hooks/useNinaSettings';

const TEXT = {
  companyName: 'Nome da empresa',
  sdrName: 'Nome da agente (Nina)',
  systemPrompt: 'Instruções extras (system prompt)',
  systemPromptPlaceholder: 'Diretrizes adicionais que a Nina deve sempre seguir…',
  save: 'Salvar identidade',
  saved: 'Identidade salva',
  error: 'Erro ao salvar identidade',
} as const;

const IDENTITY_FIELDS: { key: keyof BrainIdentity; label: string; placeholder: string; rows: number }[] = [
  { key: 'empresa_missao', label: 'Missão da empresa', placeholder: 'O que a empresa faz e por quê', rows: 2 },
  { key: 'empresa_tagline', label: 'Tagline', placeholder: 'Frase curta de posicionamento', rows: 1 },
  { key: 'publico_alvo', label: 'Público-alvo', placeholder: 'Para quem você vende', rows: 2 },
  { key: 'fundadores', label: 'Fundadores', placeholder: 'Quem são e a credibilidade deles', rows: 2 },
  { key: 'prova_social', label: 'Prova social', placeholder: 'Cases, números, depoimentos', rows: 2 },
  { key: 'tom', label: 'Tom de voz', placeholder: 'Ex: caloroso, direto, consultivo', rows: 1 },
  { key: 'guardrails', label: 'Guardrails (o que a Nina NÃO deve fazer)', placeholder: 'Limites e proibições', rows: 2 },
];

const IdentityForm: React.FC = () => {
  const { values, loading, saving, save } = useNinaSettings();
  const [draft, setDraft] = useState<NinaSettingsForm>(values);

  useEffect(() => {
    setDraft(values);
  }, [values]);

  const setField = (key: keyof NinaSettingsForm, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setIdentity = (key: keyof BrainIdentity, value: string) =>
    setDraft((d) => ({ ...d, brain_identity: { ...d.brain_identity, [key]: value } }));

  const handleSave = async () => {
    const ok = await save(draft);
    toast[ok ? 'success' : 'error'](ok ? TEXT.saved : TEXT.error);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={TEXT.companyName}>
          <input
            type="text"
            value={draft.company_name}
            onChange={(e) => setField('company_name', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={TEXT.sdrName}>
          <input
            type="text"
            value={draft.sdr_name}
            onChange={(e) => setField('sdr_name', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {IDENTITY_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <textarea
            value={draft.brain_identity[f.key] ?? ''}
            onChange={(e) => setIdentity(f.key, e.target.value)}
            placeholder={f.placeholder}
            rows={f.rows}
            className={`${inputClass} resize-none`}
          />
        </Field>
      ))}

      <Field label={TEXT.systemPrompt}>
        <textarea
          value={draft.system_prompt_override}
          onChange={(e) => setField('system_prompt_override', e.target.value)}
          placeholder={TEXT.systemPromptPlaceholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </Field>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {TEXT.save}
        </Button>
      </div>
    </div>
  );
};

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-xs font-medium text-slate-400 mb-1.5 block">{label}</label>
    {children}
  </div>
);

export default IdentityForm;
