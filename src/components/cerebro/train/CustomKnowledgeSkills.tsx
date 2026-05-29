import React, { useState } from 'react';
import { Loader2, Plus, BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import {
  useCustomKnowledgeSkills,
  MAX_CONTENT_BYTES,
  type CustomSkill,
  type CustomSkillInput,
} from '@/hooks/useCustomKnowledgeSkills';
import CustomSkillItem from './CustomSkillItem';

const TEXT = {
  title: 'Suas habilidades de conhecimento',
  subtitle: 'Crie skills de conhecimento próprias (markdown) que complementam o cérebro da Nina.',
  new: 'Nova habilidade',
  empty: 'Você ainda não criou nenhuma habilidade de conhecimento.',
  errorTitle: 'Erro ao carregar suas habilidades',
  changedBanner: 'Habilidades alteradas — clique em "Sincronizar cérebro" (abaixo) para aplicar.',
  nameLabel: 'Nome',
  descLabel: 'Descrição (opcional)',
  contentLabel: 'Conteúdo (markdown)',
  save: 'Salvar',
  cancel: 'Cancelar',
  required: 'Preencha o nome e o conteúdo.',
  created: 'Habilidade criada',
  updated: 'Habilidade atualizada',
  nearLimit: 'Perto do limite — acima de ~8KB o conteúdo é truncado por skill.',
  overLimit: 'Acima de ~8KB: o conteúdo será truncado no cérebro.',
} as const;

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const EMPTY: CustomSkillInput = { name: '', description: '', content: '' };

const CustomKnowledgeSkills: React.FC = () => {
  const { skills, loading, error, changed, create, update, setEnabled, remove } = useCustomKnowledgeSkills();
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [draft, setDraft] = useState<CustomSkillInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const bytes = new TextEncoder().encode(draft.content).length;
  const overLimit = bytes >= MAX_CONTENT_BYTES;
  const nearLimit = !overLimit && bytes >= MAX_CONTENT_BYTES * 0.85;

  const openNew = () => {
    setDraft(EMPTY);
    setEditing('new');
  };

  const openEdit = (skill: CustomSkill) => {
    setDraft({ name: skill.name, description: skill.description ?? '', content: skill.content });
    setEditing(skill.id);
  };

  const close = () => {
    setEditing(null);
    setDraft(EMPTY);
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.content.trim()) {
      toast.error(TEXT.required);
      return;
    }
    setSaving(true);
    const err = editing === 'new' ? await create(draft) : await update(editing as string, draft);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(editing === 'new' ? TEXT.created : TEXT.updated);
    close();
  };

  return (
    <section className="space-y-3 border-t border-slate-800 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-white">{TEXT.title}</h4>
        </div>
        {editing === null && (
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            {TEXT.new}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400">{TEXT.subtitle}</p>

      {changed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-px" />
          {TEXT.changedBanner}
        </div>
      )}

      {editing !== null && (
        <div className="rounded-lg border border-cyan-500/30 bg-slate-950/40 p-4 space-y-3">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={TEXT.nameLabel}
            className={inputClass}
          />
          <input
            type="text"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder={TEXT.descLabel}
            className={inputClass}
          />
          <div>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder={TEXT.contentLabel}
              rows={6}
              className={`${inputClass} resize-y font-mono`}
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={overLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-500'}>
                {bytes} / {MAX_CONTENT_BYTES} bytes
              </span>
              {(nearLimit || overLimit) && (
                <span className={overLimit ? 'text-red-400' : 'text-amber-400'}>
                  {overLimit ? TEXT.overLimit : TEXT.nearLimit}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close} disabled={saving}>
              {TEXT.cancel}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !draft.name.trim() || !draft.content.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {TEXT.save}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">{TEXT.errorTitle}</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      ) : skills.length === 0 && editing === null ? (
        <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center text-sm text-slate-400">
          {TEXT.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <CustomSkillItem
              key={skill.id}
              skill={skill}
              onEdit={openEdit}
              onToggle={setEnabled}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CustomKnowledgeSkills;
