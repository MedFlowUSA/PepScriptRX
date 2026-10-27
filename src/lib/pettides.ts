import { supabase } from './supabase';

export type Concept = { slug: string; name: string; description: string; image: string; article_slug: string; public_price: number | null; purchasable?: boolean };
export type Article = { slug: string; title: string; category: string; body: string; sources: string[]; status: 'draft' | 'in_review' | 'approved' | 'published'; review_note: string; reviewed_by: string | null; reviewed_at: string | null };
export const conceptStatus = 'Concept — Not Available for Purchase.';
export const concepts: Concept[] = [
  { slug: 'bpc-157', name: 'BPC-157', description: 'An investigational peptide concept. Evidence and product-specific review remain pending.', image: '/brands/pettides/bpc-157.jpg', article_slug: 'bpc-157-dogs', public_price: null },
  { slug: 'tb-500', name: 'TB-500', description: 'A compound concept requiring confirmation of exact identity and a separate evidence review.', image: '/brands/pettides/tb-500.jpg', article_slug: 'tb-500-thymosin-beta-4', public_price: null },
  { slug: 'wolverine-blend', name: 'Wolverine Blend', description: 'A blend concept. Composition and proportions have not been established.', image: '/brands/pettides/wolverine-blend.jpg', article_slug: 'product-quality', public_price: null },
  { slug: 'nad-plus', name: 'NAD+', description: 'A coenzyme concept, not a peptide. Product-specific evidence review remains pending.', image: '/brands/pettides/nad-plus.jpg', article_slug: 'nad-animal-aging', public_price: null },
];
export async function publicConcepts(): Promise<Concept[]> {
  if (!supabase) return concepts;
  const { data, error } = await supabase.rpc('pettides_public_concepts');
  if (error) return concepts;
  return data as Concept[];
}
export async function publishedArticles(): Promise<Article[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('pettides_articles').select('*').eq('status', 'published');
  if (error) return [];
  return data as Article[];
}
export function pettidesCart(products: Concept[], quantities: Record<string, number>) {
  const items = products.flatMap(p => {
    const quantity = quantities[p.slug];
    if (!p.purchasable || p.public_price === null || Number(p.public_price) <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return [];
    return [{ id: `pettides-${p.slug}`, sku: `PETTIDES-${p.slug.toUpperCase()}`, name: `PetTides ${p.name}`, quantity, price: Number(p.public_price) }];
  });
  return { store_slug: 'pettides', items, total: items.reduce((n, p) => n + p.price * p.quantity, 0) };
}
