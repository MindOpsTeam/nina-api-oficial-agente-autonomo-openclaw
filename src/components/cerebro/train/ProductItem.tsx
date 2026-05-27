import React, { useState } from 'react';
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '../../Button';
import type { BrainProduct, BrainProductInput } from '@/hooks/useBrainProducts';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

interface ProductItemProps {
  product: BrainProduct;
  onSave: (id: string, patch: Partial<BrainProductInput>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const ProductItem: React.FC<ProductItemProps> = ({ product, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BrainProductInput>({
    name: product.name,
    summary: product.summary,
    details_md: product.details_md,
    is_active: product.is_active,
  });

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    const ok = await onSave(product.id, draft);
    setBusy(false);
    if (ok) setEditing(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await onDelete(product.id);
    setBusy(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 truncate">{product.name}</span>
            <span
              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                product.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-500'
              }`}
            >
              {product.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          {product.summary && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{product.summary}</p>}
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
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Nome do produto *"
        className={inputClass}
      />
      <input
        type="text"
        value={draft.summary ?? ''}
        onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
        placeholder="Resumo curto"
        className={inputClass}
      />
      <textarea
        value={draft.details_md ?? ''}
        onChange={(e) => setDraft({ ...draft, details_md: e.target.value })}
        placeholder="Detalhes (markdown): preço, diferenciais, objeções…"
        rows={3}
        className={`${inputClass} resize-none`}
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="accent-cyan-500"
          />
          Produto ativo
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
            <X className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !draft.name.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductItem;
