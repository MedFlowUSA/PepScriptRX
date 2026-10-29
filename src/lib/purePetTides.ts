import { supabase } from './supabase';
import type { Article } from './pettides';

export const PURE_PETTIDES = { name: 'Pure PetTides', path: '/pure-pettides', scope: 'PUREPETTIDES', payee: 'Lily Graham', rep: 'LILY60', commission: 0.65, override: 0, platform: 0.35 } as const;
export const PURE_PETTIDES_STATUS = 'Concept — Not Available for Purchase.';
export type PurePetConcept = { slug: string; name: string; description: string; image: string; article_slug: string; public_price: number | null };
export const purePetConcepts: PurePetConcept[] = [
  { slug: 'bpc-157', name: 'BPC-157', description: 'An investigational peptide. Explore what animal research has and has not established.', image: '/brands/pettides/bpc-157.jpg', article_slug: 'bpc-157-benefits-evidence', public_price: null },
  { slug: 'tb-500', name: 'TB-500', description: 'Exact compound identity matters. TB-500 and full-length thymosin beta-4 are not assumed to be equivalent.', image: '/brands/pettides/tb-500.jpg', article_slug: 'tb-500-benefits-evidence', public_price: null },
  { slug: 'wolverine-blend', name: 'Wolverine Blend', description: 'A blend concept awaiting its own formulation, quality, and evidence review.', image: '/brands/pettides/wolverine-blend.jpg', article_slug: 'wolverine-blend-benefits-evidence', public_price: null },
  { slug: 'nad-plus', name: 'NAD+', description: 'A coenzyme involved in cellular metabolism, not a peptide. Biological roles and product outcomes are different questions.', image: '/brands/pettides/nad-plus.jpg', article_slug: 'nad-plus-benefits-evidence', public_price: null },
];
export async function loadPurePetConcepts() {
  if (!supabase) return { products: purePetConcepts, configured: false };
  const { data, error } = await supabase.rpc('pure_pettides_public_concepts');
  return error ? { products: purePetConcepts, configured: false } : { products: data as PurePetConcept[], configured: true };
}
export async function loadPurePetArticles(): Promise<Article[]> {
  if (!supabase) return [];
  // A narrow projection of the existing library: published AND professionally reviewed.
  const { data, error } = await supabase.rpc('pure_pettides_library');
  return error ? [] : data as Article[];
}
