// Mirrors the verified paid-order margin basis, for explanation only.
// Settlement remains the responsibility of the existing paid-order finalizer.
export function purePetCommissionExample(sale: number, discount: number, cost: number) {
  const margin = Math.max(0, sale - Math.min(sale, Math.max(0, discount)) - Math.max(0, cost));
  return { margin, lily: Math.round(margin * 0.65 * 100) / 100, override: 0, platform: Math.round(margin * 0.35 * 100) / 100 };
}
