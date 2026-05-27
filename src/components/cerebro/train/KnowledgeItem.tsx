import React, { useState } from 'react';
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import type { BrainKnowledge, BrainKnowledgeInput } from '@/hooks/useBrainKnowledge';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

interface KnowledgeItemProps {
  entry: BrainKnowledge;
  onSave: (id: string, patch: Partial<BrainKnowledgeInput>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const KnowledgeItem: React.FC<KnowledgeItemProps> = ({ entry, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BrainKnowledgeInput>({
    title: entry.title,
    slug: entry.slug,
    content_md: entry.content_md,
  });

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.content_md.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    setBusy(true);
    const ok = await onSave(entry.id, draft);
    setBusy(false);
    if (ok) setEditing(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await onDelete(entry.id);
    setBusy(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-100 truncate block">{entry.title}</span>
          <code className="text-[11px] text-slate-500">/{entry.slug}</code>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{entry.content_md}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-cyan-400" title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} disabled={busy} className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-red-400" title="Remover">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-slate-950/40 p-4 space-y-3">
      <input
        type="text"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Título *"
        className={inputClass}
      />
      <input
        type="text"
        value={draft.slug}
        onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
        placeholder="slug-unico"
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
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
          <X className="w-4 h-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default KnowledgeItem;
