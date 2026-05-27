import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BrainProduct {
  id: string;
  name: string;
  summary: string | null;
  details_md: string | null;
  position: number;
  is_active: boolean;
}

export type BrainProductInput = Pick<
  BrainProduct,
  'name' | 'summary' | 'details_md' | 'is_active'
>;

interface UseBrainProductsResult {
  products: BrainProduct[];
  loading: boolean;
  error: string | null;
  create: (input: BrainProductInput) => Promise<boolean>;
  update: (id: string, patch: Partial<BrainProductInput>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/** CRUD de brain_products (RLS owner-scoped; owner_user_id default = auth.uid()). */
export function useBrainProducts(): UseBrainProductsResult {
  const { user } = useAuth();
  const [products, setProducts] = useState<BrainProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('brain_products')
        .select('id, name, summary, details_md, position, is_active')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setProducts((data ?? []) as BrainProduct[]);
    } catch (err) {
      console.error('[useBrainProducts] Erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const create = useCallback(
    async (input: BrainProductInput): Promise<boolean> => {
      try {
        const position = products.length;
        const { error: insertError } = await supabase
          .from('brain_products')
          .insert({ ...input, position });
        if (insertError) throw insertError;
        await fetchProducts();
        return true;
      } catch (err) {
        console.error('[useBrainProducts] Erro ao criar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao criar produto');
        return false;
      }
    },
    [products.length, fetchProducts]
  );

  const update = useCallback(
    async (id: string, patch: Partial<BrainProductInput>): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('brain_products')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (updateError) throw updateError;
        await fetchProducts();
        return true;
      } catch (err) {
        console.error('[useBrainProducts] Erro ao atualizar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao atualizar produto');
        return false;
      }
    },
    [fetchProducts]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase.from('brain_products').delete().eq('id', id);
        if (deleteError) throw deleteError;
        await fetchProducts();
        return true;
      } catch (err) {
        console.error('[useBrainProducts] Erro ao remover:', err);
        setError(err instanceof Error ? err.message : 'Erro ao remover produto');
        return false;
      }
    },
    [fetchProducts]
  );

  return { products, loading, error, create, update, remove, refetch: fetchProducts };
}
