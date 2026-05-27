import React, { useState } from 'react';
import { Plus, Loader2, Package } from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { useBrainProducts, type BrainProductInput } from '@/hooks/useBrainProducts';
import ProductItem from './ProductItem';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

const EMPTY_DRAFT: BrainProductInput = { name: '', summary: '', details_md: '', is_active: true };

const ProductsManager: React.FC = () => {
  const { products, loading, create, update, remove } = useBrainProducts();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BrainProductInput>(EMPTY_DRAFT);

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      toast.error('Informe o nome do produto');
      return;
    }
    setBusy(true);
    const ok = await create(draft);
    setBusy(false);
    if (ok) {
      toast.success('Produto adicionado');
      setDraft(EMPTY_DRAFT);
      setAdding(false);
    } else {
      toast.error('Erro ao adicionar produto');
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
      {products.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
          <Package className="w-6 h-6 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">Nenhum produto cadastrado. Adicione o que a Nina vende.</p>
        </div>
      )}

      {products.map((p) => (
        <ProductItem key={p.id} product={p} onSave={update} onDelete={remove} />
      ))}

      {adding ? (
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
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={busy || !draft.name.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar produto
        </Button>
      )}
    </div>
  );
};

export default ProductsManager;
