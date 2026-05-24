import type { DistributorCatalogProduct } from './rxPlus';

export const GUY_INTERNAL_WHOLESALE_COSTS: Record<string, number> = {
  'retatrutide-5mg': 8.63,
  'retatrutide-10mg': 12.65,
  'retatrutide-15mg': 16.10,
  'retatrutide-20mg': 20.70,
  'tirzepatide-10mg': 6.90,
  'tirzepatide-15mg': 9.20,
  'tirzepatide-20mg': 10.93,
  'tirzepatide-30mg': 15.53,
  'tirzepatide-60mg': 24.15,
  cagrisema: 20.70,
  'cagrilintide-5mg': 13.80,
  'aod-9604-5mg': 11.39,
  'aod-9604-10mg': 21.28,
  'hgh-10iu': 6.33,
  'hgh-15iu': 9.20,
  'hgh-24iu': 13.80,
  'hgh-36iu': 20.13,
  'tesamorelin-2mg': 7.48,
  'tesamorelin-5mg': 13.23,
  'tesamorelin-10mg': 23.46,
  'cjc-ipamorelin-10mg': 12.54,
  'mk-677': 3.22,
  'wolverine-bpc-tb': 12.54,
  'bpc-157-10mg': 7.48,
  'tb-500-10mg': 17.83,
  'ghk-cu-100mg': 6.90,
  'mots-c-10mg': 7.48,
  'nad-100iu': 4.60,
  'nad-500iu': 9.43,
  'nad-1000iu': 15.53,
  'glutathione-1500mg': 17.25,
  'epithalon-10mg': 4.03,
  'ss-31': 40.14,
  selank: 8.28,
  semax: 8.05,
  'pt-141': 7.94,
};

export function getGuyWholesaleCost(productId: string): number | null {
  return GUY_INTERNAL_WHOLESALE_COSTS[productId] ?? null;
}

export function getGuyProductFinancials(product: DistributorCatalogProduct, commissionRate = 0.6) {
  const retail = product.displayPrice;
  const wholesale = getGuyWholesaleCost(product.id);
  if (typeof retail !== 'number' || typeof wholesale !== 'number') {
    return {
      retail,
      wholesale,
      margin: null,
      netProfit: null,
      guyCommission: null,
      platformProfit: null,
    };
  }

  const netProfit = Math.max(0, retail - wholesale);
  const guyCommission = netProfit * commissionRate;
  return {
    retail,
    wholesale,
    margin: retail - wholesale,
    netProfit,
    guyCommission,
    platformProfit: netProfit - guyCommission,
  };
}
