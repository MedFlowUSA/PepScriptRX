const AACTIVATED_LIBRARY_SEARCHES: Record<string, string> = {
  'retatrutide': 'Retatrutide',
  'tirzepatide': 'Tirzepatide',
  'semaglutide': 'Semaglutide',
  'cagrisema': 'CagriSema',
  'cagrilintide': 'Cagrilintide',
  'aod-9604': 'AOD-9604',
  'wolverine': 'Wolverine',
  'bpc-157': 'BPC-157',
  'tb-500': 'TB-500',
  'ghk-cu': 'GHK-Cu',
  'kpv': 'KPV',
  'tesamorelin': 'Tesamorelin',
  'cjc-1295': 'CJC',
  'cjc-ipamorelin': 'CJC',
  'ipamorelin': 'Ipamorelin',
  'hgh': 'HGH',
  'mk-677': 'MK-677',
  'nad': 'NAD',
  'glutathione': 'Glutathione',
  'mots-c': 'MOTS-C',
  'epithalon': 'Epithalon',
  'ss-31': 'SS-31',
  'selank': 'Selank',
  'semax': 'Semax',
};

export function getAactivatedLibrarySearch(compoundId: string): string | null {
  return AACTIVATED_LIBRARY_SEARCHES[compoundId] ?? null;
}

export function getAactivatedLibraryProductPath(compoundId: string): string | null {
  const search = getAactivatedLibrarySearch(compoundId);
  return search
    ? `/aactivated?search=${encodeURIComponent(search)}&from=library#aactivated-top-sellers`
    : null;
}
