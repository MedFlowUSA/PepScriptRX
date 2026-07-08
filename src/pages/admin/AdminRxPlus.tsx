import { useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import {
  GUY_DISTRIBUTOR_PRODUCTS,
  RX_PLUS_DISTRIBUTORS,
  RX_PLUS_PRODUCTS,
  WHOLESALE_TIERS,
  estimateDistributorCommission,
  getDistributorProducts,
} from '../../data/rxPlus';
import { AACTIVATED_PROMO_LINKS, getGuyProductFinancials, getGuySplitModel } from '../../data/rxPlusAdmin';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';

export default function AdminRxPlus() {
  const { profile } = useAuth();
  const guy = RX_PLUS_DISTRIBUTORS.find((distributor) => distributor.slug === 'guy')!;
  const guyProducts = getDistributorProducts('guy');
  const isScopedRxPlusAdmin = profile?.role === 'rx_plus_admin';
  const [productControls, setProductControls] = useState(() => (
    Object.fromEntries(GUY_DISTRIBUTOR_PRODUCTS.map((item) => [item.product_id, {
      enabled: item.is_enabled,
      featured: item.featured,
    }]))
  ));
  const visibleGuyProducts = useMemo(() => (
    guyProducts.map((product) => ({
      ...product,
      distributorProduct: {
        ...product.distributorProduct,
        is_enabled: productControls[product.id]?.enabled ?? product.distributorProduct.is_enabled,
        featured: productControls[product.id]?.featured ?? product.distributorProduct.featured,
      },
    }))
  ), [guyProducts, productControls]);
  const featuredCount = visibleGuyProducts.filter((item) => item.distributorProduct.featured && item.distributorProduct.is_enabled).length;
  const sampleGross = visibleGuyProducts.slice(0, 6).reduce((sum, product) => sum + (product.displayPrice ?? 0), 0);
  const sampleCost = visibleGuyProducts.slice(0, 6).reduce((sum, product) => sum + (getGuyProductFinancials(product, guy.commission_rate).wholesale ?? 0), 0);
  const sampleCommission = estimateDistributorCommission(sampleGross, sampleCost, guy.commission_rate);
  const sampleAnchorSplit = getGuySplitModel(sampleCommission.netProfit, 'mlm_anchor');
  const navItems = isScopedRxPlusAdmin ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;
  const categoryCount = new Set(visibleGuyProducts.map((product) => product.category)).size;

  function toggleProduct(productId: string, field: 'enabled' | 'featured') {
    setProductControls((current) => ({
      ...current,
      [productId]: {
        enabled: current[productId]?.enabled ?? true,
        featured: current[productId]?.featured ?? false,
        [field]: !(current[productId]?.[field] ?? false),
      },
    }));
  }

  if (isScopedRxPlusAdmin) {
    return (
      <DashLayout title="AACTIVATEDRX Admin" navItems={navItems}>
        <div className="stats-grid mb-8">
          <div className="stat-card">
            <div className="stat-value">{visibleGuyProducts.filter((product) => product.distributorProduct.is_enabled).length}</div>
            <div className="stat-label">Enabled products</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{categoryCount}</div>
            <div className="stat-label">Catalog categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{featuredCount}</div>
            <div className="stat-label">Top sellers</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Active</div>
            <div className="stat-label">Storefront status</div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <div>
              <div className="card-title">Storefront Tools</div>
              <div className="card-subtitle">Partner-facing controls for AACTIVATEDRX. Internal wholesale costs, platform splits, and payout formulas are intentionally not shown.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="/AACTIVATED" target="_blank" rel="noreferrer">Open Storefront</a>
            <a className="btn btn-outline" href="/admin/aactivated-promos">Manage Promo Links</a>
            <a className="btn btn-outline" href="/AACTIVATED/product-confidence" target="_blank" rel="noreferrer">Quality Policy</a>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Catalog Visibility</div>
              <div className="card-subtitle">Set the customer-facing catalog focus for AACTIVATEDRX.</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Strength</th>
                  <th>Retail</th>
                  <th>Enabled</th>
                  <th>Top seller</th>
                </tr>
              </thead>
              <tbody>
                {visibleGuyProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{product.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.sku}</div>
                    </td>
                    <td>{product.category}</td>
                    <td>{product.strength}</td>
                    <td>{typeof product.displayPrice === 'number' ? `$${product.displayPrice.toFixed(2)}` : 'Retail price not configured'}</td>
                    <td>
                      <label className="checkbox-item" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                        <input type="checkbox" checked={product.distributorProduct.is_enabled} onChange={() => toggleProduct(product.id, 'enabled')} />
                        <span>{product.distributorProduct.is_enabled ? 'On' : 'Off'}</span>
                      </label>
                    </td>
                    <td>
                      <label className="checkbox-item" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                        <input type="checkbox" checked={product.distributorProduct.featured} onChange={() => toggleProduct(product.id, 'featured')} />
                        <span>{product.distributorProduct.featured ? 'Featured' : 'Standard'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashLayout>
    );
  }

  return (
    <DashLayout title="AACTIVATEDRX Partner Admin" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{isScopedRxPlusAdmin ? visibleGuyProducts.filter((product) => product.distributorProduct.is_enabled).length : RX_PLUS_DISTRIBUTORS.length}</div>
          <div className="stat-label">{isScopedRxPlusAdmin ? 'Enabled products' : 'Distributors'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{isScopedRxPlusAdmin ? categoryCount : RX_PLUS_PRODUCTS.length}</div>
          <div className="stat-label">{isScopedRxPlusAdmin ? 'Catalog categories' : 'Rx+ products'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{featuredCount}</div>
          <div className="stat-label">Guy featured items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{isScopedRxPlusAdmin ? 'Active' : `${Math.round(guy.commission_rate * 100)}%`}</div>
          <div className="stat-label">{isScopedRxPlusAdmin ? 'Portal status' : 'Guy net profit comp'}</div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header" style={{ paddingBottom: 16 }}>
          <div className="card-title">AACTIVATEDRX Strategy Controls</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Admin-only economics, promo links, and split rules. Public storefront users never see wholesale cost, margin, net profit, or payout math.
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">60 / 40</div>
              <div className="stat-label">Standard Guy / platform split</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">50 / 25 / 25</div>
              <div className="stat-label">MLM anchor / Guy / platform split</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">5</div>
              <div className="stat-label">Minimum vials per SKU per wholesale order</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">VITALITYINS</div>
              <div className="stat-label">Checkout scope and account credit</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
            {AACTIVATED_PROMO_LINKS.map((link) => (
              <div key={link.label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{link.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{link.href}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isScopedRxPlusAdmin && (
        <div className="card mb-6">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Distributor Portals</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Skeleton management view for portal visibility, white-label eligibility, and commission tracking.
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Portal</th>
                  <th>Commission</th>
                  <th>White Label</th>
                  <th>Wholesale</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {RX_PLUS_DISTRIBUTORS.map((distributor) => (
                  <tr key={distributor.id}>
                    <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{distributor.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>/rx-plus/{distributor.slug}</td>
                    <td>{distributor.portal_name}</td>
                    <td>{Math.round(distributor.commission_rate * 100)}% of net profit</td>
                    <td><span className={`badge ${distributor.white_label_enabled ? 'badge-success' : 'badge-default'}`}>{distributor.white_label_enabled ? 'Enabled' : 'Off'}</span></td>
                    <td><span className={`badge ${distributor.wholesale_enabled ? 'badge-success' : 'badge-default'}`}>{distributor.wholesale_enabled ? 'Enabled' : 'Off'}</span></td>
                    <td><span className={`badge ${distributor.is_active ? 'badge-teal' : 'badge-default'}`}>{distributor.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">{isScopedRxPlusAdmin ? 'AACTIVATEDRX Wholesale Pricing' : 'AACTIVATEDRX Wholesale / Retail / Split Matrix'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isScopedRxPlusAdmin
                ? 'Internal margin view for Guy. These costs are never displayed on the public storefront.'
                : 'Admin-only internal pricing, visibility, and featured controls for Guy’s AACTIVATED-RX catalog.'}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Strength</th>
                  <th>Retail</th>
                  <th>Wholesale / vial</th>
                  <th>Margin / vial</th>
                  <th>Net Profit</th>
                  <th>Guy 70%</th>
                  <th>Platform 30%</th>
                  <th>MLM anchor / Guy / Platform</th>
                  <th>Enabled</th>
                  <th>Featured</th>
                </tr>
              </thead>
              <tbody>
                {visibleGuyProducts.map((product) => {
                  const financials = getGuyProductFinancials(product, guy.commission_rate);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{product.product_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.sku}</div>
                      </td>
                      <td>{product.category}</td>
                      <td>{product.strength}</td>
                      <td>{financials.retail === null ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Retail price not configured</span> : `$${financials.retail.toFixed(2)}`}</td>
                      <td>{financials.wholesale === null ? '—' : `$${financials.wholesale.toFixed(2)}`}</td>
                      <td>{financials.margin === null ? '—' : `$${financials.margin.toFixed(2)}`}</td>
                      <td>{financials.netProfit === null ? '—' : `$${financials.netProfit.toFixed(2)}`}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{financials.guyCommission === null ? '—' : `$${financials.guyCommission.toFixed(2)}`}</td>
                      <td>{financials.platformProfit === null ? '—' : `$${financials.platformProfit.toFixed(2)}`}</td>
                      <td>{financials.anchorSplit ? `$${financials.anchorSplit.anchor.toFixed(2)} / $${financials.anchorSplit.guy.toFixed(2)} / $${financials.anchorSplit.platform.toFixed(2)}` : '-'}</td>
                      <td>
                        <label className="checkbox-item" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                          <input type="checkbox" checked={product.distributorProduct.is_enabled} onChange={() => toggleProduct(product.id, 'enabled')} />
                          <span>{product.distributorProduct.is_enabled ? 'On' : 'Off'}</span>
                        </label>
                      </td>
                      <td>
                        <label className="checkbox-item" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                          <input type="checkbox" checked={product.distributorProduct.featured} onChange={() => toggleProduct(product.id, 'featured')} />
                          <span>{product.distributorProduct.featured ? 'Featured' : 'Standard'}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {isScopedRxPlusAdmin ? (
            <div className="card mb-6">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">Portal Access</div>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div className="detail-row"><span className="detail-label">Public storefront</span><span className="detail-value">/AACTIVATED</span></div>
                <div className="detail-row"><span className="detail-label">Catalog</span><span className="detail-value">{visibleGuyProducts.filter((product) => product.distributorProduct.is_enabled).length} enabled items</span></div>
                <div className="detail-row"><span className="detail-label">White label</span><span className="detail-value">{guy.white_label_enabled ? 'Enabled' : 'Off'}</span></div>
                <div className="detail-row"><span className="detail-label">Wholesale</span><span className="detail-value">{guy.wholesale_enabled ? 'Enabled' : 'Off'}</span></div>
              </div>
            </div>
          ) : (
            <div className="card mb-6">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">Sample Commission Math</div>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div className="detail-row"><span className="detail-label">Gross sale</span><span className="detail-value">${sampleCommission.grossSale.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Product cost</span><span className="detail-value">${sampleCommission.productCost.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Net profit</span><span className="detail-value">${sampleCommission.netProfit.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Guy payout</span><span className="detail-value">${sampleCommission.distributorCommission.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Platform retained</span><span className="detail-value">${sampleCommission.platformProfit.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">MLM anchor sample</span><span className="detail-value">${sampleAnchorSplit.anchor.toFixed(2)} / ${sampleAnchorSplit.guy.toFixed(2)} / ${sampleAnchorSplit.platform.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Wholesale Tiers</div>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {WHOLESALE_TIERS.map((tier) => (
                <div key={tier.id} className="detail-row" style={{ flexDirection: 'column', gap: 2 }}>
                  <span className="detail-value">{tier.tier_name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {tier.max_vials ? `${tier.min_vials}-${tier.max_vials}` : `${tier.min_vials}+`} vials - {tier.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
