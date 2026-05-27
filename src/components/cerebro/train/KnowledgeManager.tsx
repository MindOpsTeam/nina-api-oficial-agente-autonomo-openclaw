import React, { useState } from 'react';
import { Plus, Loader2, BookOpen } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { useBrainKnowledge, slugify, type BrainKnowledgeInput } from '@/hooks/useBrainKnowledge';
import KnowledgeItem from './KnowledgeItem';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const EMPTY_DRAFT: BrainKnowledgeInput = { title: '', slug: '', content_md: '' };

const KnowledgeManager: React.FC = () => {
  const { entries, loading, create, update, remove } = useBrainKnowledge();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [draft, setDraft] = useState<BrainKnowledgeInput>(EMPTY_DRAFT);

  // Auto-deriva o slug do título enquanto o usuário não editar o slug manualmente.
  const onTitleChange = (title: string) =>
    setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }));

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setSlugTouched(false);
    setAdding(false);
  };

  const handleCreate = async () => {
    if (!draft.title.trim() || !draft.content_md.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    const payload = { ...draft, slug: draft.slug.trim() || slugify(draft.title) };
    setBusy(true);
    const ok = await create(payload);
    setBusy(false);
    if (ok) {
      toast.success('Conhecimento adicionado');
      reset();
    } else {
      toast.error('Erro ao adicionar (slug pode já existir)');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
          <BookOpen className="w-6 h-6 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">Sem artigos de conhecimento. Ensine políticas, FAQs e processos.</p>
        </div>
      )}

      {entries.map((e) => (
        <KnowledgeItem key={e.id} entry={e} onSave={update} onDelete={remove} />
      ))}

      {adding ? (
        <div className="rounded-lg border border-cyan-500/30 bg-slate-950/40 p-4 space-y-3">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título *"
            className={inputClass}
          />
          <input
            type="text"
            value={draft.slug}
            onChange={(e) => { setSlugTouched(true); setDraft({ ...draft, slug: e.target.value }); }}
            placeholder="slug-unico (gerado do título)"
            className={`${inputClass} font-mono`}
          />
          <textarea
            value={draft.content_md}
            onChange={(e) => setDraft({ ...draft, content_md: e.target.value })}
            placeholder="Conteúdo (markdown) *"
            rows={4}
            className={`${inputClass} resize-none`}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={busy || !draft.title.trim() || !draft.content_md.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar conhecimento
        </Button>
      )}
    </div>
  );
};

export default KnowledgeManager;
