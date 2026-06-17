import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { isProductIntelligenceAdmin } from '../../lib/productIntelligenceAccess';
import { ADMIN_NAV } from './adminNav';

type ActiveStatus = 'active' | 'inactive' | 'hidden' | 'review';

type ProductIntelligenceProduct = {
  product_key: string;
  product_name: string;
  scientific_name: string | null;
  sku: string;
  category: string;
  strength: string | null;
  units_per_box: number;
  supplier_box_cost: number | null;
  cost_per_unit: number | null;
  true_landing_cost: number | null;
  current_retail_price: number | null;
  profit_per_unit: number | null;
  margin_percent: number | null;
  active_status: ActiveStatus;
  description: string | null;
  typical_use_case: string | null;
  components: string[] | null;
  notes: string | null;
  sort_order: number;
};

type ProductAlias = {
  id: string;
  product_key: string;
  alias: string;
};

type StoreVisibility = {
  id: string;
  product_key: string;
  store_key: string;
  store_name: string;
  visible: boolean;
  source: string;
};

type EditDraft = {
  units_per_box: string;
  supplier_box_cost: string;
  current_retail_price: string;
  active_status: ActiveStatus;
  notes: string;
};

const REQUIRED_STORES = [
  { store_key: 'main', store_name: 'Main Store' },
  { store_key: 'aactivated', store_name: 'AACTIVATED' },
  { store_key: 'empire', store_name: 'Empire' },
  { store_key: 'peakform', store_name: 'Peak Form' },
  { store_key: 'zenora', store_name: 'Zenora' },
  { store_key: 'aurora', store_name: 'Aurora' },
  { store_key: 'ginto', store_name: 'Ginto Wellness Labs' },
];

const STATUS_LABELS: Record<ActiveStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  hidden: 'Hidden',
  review: 'Review',
};

function money(value: number | null | undefined): string {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '--';
}

function percent(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '--';
}

function normalize(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function productDisplayName(product: ProductIntelligenceProduct): string {
  return [product.product_name, product.strength].filter(Boolean).join(' ');
}

export default function AdminProductIntelligence() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductIntelligenceProduct[]>([]);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [visibilityRows, setVisibilityRows] = useState<StoreVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<ActiveStatus | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const allowed = isProductIntelligenceAdmin(profile);

  useEffect(() => {
    if (allowed) void loadData();
  }, [allowed]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.product_key === selectedKey) ?? null,
    [products, selectedKey],
  );

  useEffect(() => {
    if (!selectedProduct) {
      setDraft(null);
      return;
    }
    setDraft({
      units_per_box: String(selectedProduct.units_per_box),
      supplier_box_cost: selectedProduct.supplier_box_cost != null ? String(selectedProduct.supplier_box_cost) : '',
      current_retail_price: selectedProduct.current_retail_price != null ? String(selectedProduct.current_retail_price) : '',
      active_status: selectedProduct.active_status,
      notes: selectedProduct.notes ?? '',
    });
    setAliasDraft('');
  }, [selectedProduct]);

  const aliasesByProduct = useMemo(() => {
    return aliases.reduce<Record<string, ProductAlias[]>>((acc, alias) => {
      acc[alias.product_key] = [...(acc[alias.product_key] ?? []), alias];
      return acc;
    }, {});
  }, [aliases]);

  const visibilityByProduct = useMemo(() => {
    return visibilityRows.reduce<Record<string, StoreVisibility[]>>((acc, row) => {
      acc[row.product_key] = [...(acc[row.product_key] ?? []), row];
      return acc;
    }, {});
  }, [visibilityRows]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = normalize(search);
    const directlyMatched = new Set<string>();
    const componentNames = new Set<string>();

    if (query) {
      for (const product of products) {
        const productAliases = aliasesByProduct[product.product_key]?.map((item) => item.alias) ?? [];
        const haystack = [
          product.product_name,
          product.scientific_name,
          product.sku,
          product.category,
          product.strength,
          ...productAliases,
          ...(product.components ?? []),
        ].join(' ').toLowerCase();

        if (haystack.includes(query)) {
          directlyMatched.add(product.product_key);
          for (const component of product.components ?? []) componentNames.add(normalize(component));
        }
      }
    }

    return products.filter((product) => {
      if (category !== 'all' && product.category !== category) return false;
      if (status !== 'all' && product.active_status !== status) return false;
      if (!query) return true;
      if (directlyMatched.has(product.product_key)) return true;

      const normalizedName = normalize(product.product_name);
      return Array.from(componentNames).some((component) => (
        component.includes(normalizedName) || normalizedName.includes(component)
      ));
    });
  }, [aliasesByProduct, category, products, search, status]);

  const activeCount = products.filter((product) => product.active_status === 'active').length;
  const averageMargin = products
    .filter((product) => typeof product.margin_percent === 'number')
    .reduce((sum, product, _index, rows) => sum + Number(product.margin_percent) / rows.length, 0);
  const needsCost = products.filter((product) => product.supplier_box_cost == null).length;

  async function loadData() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const [
      { data: productData, error: productError },
      { data: aliasData, error: aliasError },
      { data: visibilityData, error: visibilityError },
    ] = await Promise.all([
      supabase
        .from('product_intelligence_products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('product_name', { ascending: true }),
      supabase
        .from('product_intelligence_aliases')
        .select('*')
        .order('alias', { ascending: true }),
      supabase
        .from('product_intelligence_store_visibility')
        .select('*')
        .order('store_name', { ascending: true }),
    ]);

    const loadError = productError || aliasError || visibilityError;
    if (loadError) setError(loadError.message);
    setProducts((productData as ProductIntelligenceProduct[]) ?? []);
    setAliases((aliasData as ProductAlias[]) ?? []);
    setVisibilityRows((visibilityData as StoreVisibility[]) ?? []);
    setLoading(false);
  }

  async function saveProduct() {
    if (!supabase || !selectedProduct || !draft) return;
    const units = Number(draft.units_per_box);
    if (!Number.isInteger(units) || units <= 0) {
      setMessage('Units per box must be a positive whole number.');
      return;
    }

    setSaving(true);
    setMessage('');
    const { error: saveError } = await supabase
      .from('product_intelligence_products')
      .update({
        units_per_box: units,
        supplier_box_cost: parseNullableNumber(draft.supplier_box_cost),
        current_retail_price: parseNullableNumber(draft.current_retail_price),
        active_status: draft.active_status,
        notes: draft.notes.trim() || null,
      })
      .eq('product_key', selectedProduct.product_key);

    if (saveError) {
      setMessage(saveError.message);
    } else {
      setMessage('Product intelligence saved.');
      await loadData();
    }
    setSaving(false);
  }

  async function addAlias() {
    if (!supabase || !selectedProduct) return;
    const nextAlias = aliasDraft.trim();
    if (!nextAlias) return;
    setSaving(true);
    setMessage('');
    const { error: aliasError } = await supabase
      .from('product_intelligence_aliases')
      .insert({ product_key: selectedProduct.product_key, alias: nextAlias });
    if (aliasError) setMessage(aliasError.message);
    else {
      setAliasDraft('');
      await loadData();
    }
    setSaving(false);
  }

  async function removeAlias(aliasId: string) {
    if (!supabase) return;
    setSaving(true);
    setMessage('');
    const { error: aliasError } = await supabase
      .from('product_intelligence_aliases')
      .delete()
      .eq('id', aliasId);
    if (aliasError) setMessage(aliasError.message);
    else await loadData();
    setSaving(false);
  }

  function storeRowsFor(productKey: string): StoreVisibility[] {
    const existing = visibilityByProduct[productKey] ?? [];
    const byKey = new Map(existing.map((row) => [row.store_key, row]));
    const requiredRows = REQUIRED_STORES.map((store) => (
      byKey.get(store.store_key) ?? {
        id: `${productKey}-${store.store_key}`,
        product_key: productKey,
        store_key: store.store_key,
        store_name: store.store_name,
        visible: false,
        source: 'not_configured',
      }
    ));
    const requiredKeys = new Set(REQUIRED_STORES.map((store) => store.store_key));
    return [...requiredRows, ...existing.filter((row) => !requiredKeys.has(row.store_key))];
  }

  if (!allowed) return <Navigate to="/admin" replace />;

  return (
    <DashLayout title="Operations / Product Intelligence" navItems={ADMIN_NAV}>
      {message && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <>
          <div className="stats-grid mb-8">
            <div className="stat-card">
              <div className="stat-value">{products.length}</div>
              <div className="stat-label">Internal products</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{activeCount}</div>
              <div className="stat-label">Active status</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number.isFinite(averageMargin) ? percent(averageMargin) : '--'}</div>
              <div className="stat-label">Avg calculated margin</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{needsCost}</div>
              <div className="stat-label">Need supplier cost</div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div>
                <div className="card-title">Product Intelligence</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Internal cost, landed-cost, profit, and margin data. Super/master admin access only.
                </div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 220px 180px', gap: 12 }}>
              <input
                className="form-input"
                value={search}
                placeholder="Search name, AKA, scientific name, SKU, category"
                onChange={(event) => setSearch(event.target.value)}
              />
              <select className="form-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value as ActiveStatus | 'all')}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>AKA Name(s)</th>
                    <th>Scientific / Generic Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Strength</th>
                    <th>Units Per Box</th>
                    <th>Supplier Box Cost</th>
                    <th>Cost Per Unit</th>
                    <th>True Landing Cost</th>
                    <th>Current Retail Price</th>
                    <th>Profit Per Unit</th>
                    <th>Margin %</th>
                    <th>Active Status</th>
                    <th>Stores Carrying Product</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const productAliases = aliasesByProduct[product.product_key] ?? [];
                    const storesCarrying = (visibilityByProduct[product.product_key] ?? []).filter((row) => row.visible).length;
                    return (
                      <tr
                        key={product.product_key}
                        onClick={() => setSelectedKey(product.product_key)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{product.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{product.product_key}</div>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          {productAliases.length ? productAliases.map((item) => item.alias).join(', ') : '--'}
                        </td>
                        <td>{product.scientific_name || '--'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{product.sku}</td>
                        <td>{product.category}</td>
                        <td>{product.strength || '--'}</td>
                        <td>{product.units_per_box}</td>
                        <td>{money(product.supplier_box_cost)}</td>
                        <td>{money(product.cost_per_unit)}</td>
                        <td>{money(product.true_landing_cost)}</td>
                        <td>{money(product.current_retail_price)}</td>
                        <td style={{ color: Number(product.profit_per_unit ?? 0) >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 800 }}>
                          {money(product.profit_per_unit)}
                        </td>
                        <td>{percent(product.margin_percent)}</td>
                        <td><span className="badge badge-info">{STATUS_LABELS[product.active_status]}</span></td>
                        <td>{storesCarrying}</td>
                        <td style={{ maxWidth: 220 }}>{product.notes || '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedProduct && draft && (
        <>
          <div
            onClick={() => setSelectedKey(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(7, 21, 36, .36)', zIndex: 40 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(620px, 100vw)',
              height: '100vh',
              background: 'var(--card)',
              borderLeft: '1px solid var(--border)',
              zIndex: 41,
              overflowY: 'auto',
              boxShadow: '-20px 0 60px rgba(7, 21, 36, .18)',
            }}
          >
            <div style={{ position: 'sticky', top: 0, background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Product Detail</div>
                <h2 style={{ margin: '3px 0 0', fontSize: 24, color: 'var(--navy)' }}>{productDisplayName(selectedProduct)}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedKey(null)}>Close</button>
            </div>

            <div style={{ padding: 22, display: 'grid', gap: 18 }}>
              <section className="card">
                <div className="card-header"><div className="card-title">Product Overview</div></div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 14 }}>
                  <Detail label="Product Name" value={productDisplayName(selectedProduct)} />
                  <Detail label="Scientific Name" value={selectedProduct.scientific_name || '--'} />
                  <Detail label="Category" value={selectedProduct.category} />
                  <Detail label="SKU" value={selectedProduct.sku} />
                  <Detail label="Typical Use Case" value={selectedProduct.typical_use_case || '--'} full />
                  <Detail label="Description" value={selectedProduct.description || '--'} full />
                  {selectedProduct.components?.length ? (
                    <Detail label="Components" value={selectedProduct.components.join(', ')} full />
                  ) : null}
                </div>
              </section>

              <section className="card">
                <div className="card-header"><div className="card-title">AKA Name Library</div></div>
                <div className="card-body">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {(aliasesByProduct[selectedProduct.product_key] ?? []).map((alias) => (
                      <span key={alias.id} className="badge badge-default" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        {alias.alias}
                        <button
                          type="button"
                          onClick={() => void removeAlias(alias.id)}
                          disabled={saving}
                          style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 900 }}
                          aria-label={`Remove ${alias.alias}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      value={aliasDraft}
                      placeholder="Add AKA name"
                      onChange={(event) => setAliasDraft(event.target.value)}
                    />
                    <button className="btn btn-outline btn-sm" onClick={() => void addAlias()} disabled={saving}>Add</button>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header"><div className="card-title">Pricing</div></div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="form-label">
                    Units Per Box
                    <input className="form-input" value={draft.units_per_box} onChange={(event) => setDraft({ ...draft, units_per_box: event.target.value })} />
                  </label>
                  <label className="form-label">
                    Supplier Cost
                    <input className="form-input" value={draft.supplier_box_cost} onChange={(event) => setDraft({ ...draft, supplier_box_cost: event.target.value })} placeholder="0.00" />
                  </label>
                  <label className="form-label">
                    Retail Price
                    <input className="form-input" value={draft.current_retail_price} onChange={(event) => setDraft({ ...draft, current_retail_price: event.target.value })} placeholder="0.00" />
                  </label>
                  <label className="form-label">
                    Active Status
                    <select className="form-select" value={draft.active_status} onChange={(event) => setDraft({ ...draft, active_status: event.target.value as ActiveStatus })}>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <Detail label="Cost Per Unit" value={money(selectedProduct.cost_per_unit)} />
                  <Detail label="True Landing Cost" value={money(selectedProduct.true_landing_cost)} />
                  <Detail label="Profit" value={money(selectedProduct.profit_per_unit)} />
                  <Detail label="Margin %" value={percent(selectedProduct.margin_percent)} />
                  <label className="form-label" style={{ gridColumn: '1 / -1' }}>
                    Notes
                    <textarea className="form-input" value={draft.notes} rows={4} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
                  </label>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => void saveProduct()} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Product Intelligence'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header"><div className="card-title">Catalog Visibility</div></div>
                <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                  {storeRowsFor(selectedProduct.product_key).map((row) => (
                    <div key={row.store_key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '8px 0', fontSize: 14 }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy)' }}>{row.store_name}</span>
                      <span style={{ color: row.visible ? 'var(--success)' : 'var(--text-muted)', fontWeight: 800 }}>
                        {row.visible ? '✓ Visible' : '✕ Hidden'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </>
      )}
    </DashLayout>
  );
}

function Detail({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--navy)', fontWeight: 700, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
