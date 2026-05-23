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
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';

export default function AdminRxPlus() {
  const { profile } = useAuth();
  const guy = RX_PLUS_DISTRIBUTORS.find((distributor) => distributor.slug === 'guy')!;
  const guyProducts = getDistributorProducts('guy');
  const isScopedRxPlusAdmin = profile?.role === 'rx_plus_admin';
  const featuredCount = GUY_DISTRIBUTOR_PRODUCTS.filter((item) => item.featured && item.is_enabled).length;
  const sampleGross = guyProducts.slice(0, 6).reduce((sum, product) => sum + product.displayPrice, 0);
  const sampleCost = guyProducts.slice(0, 6).reduce((sum, product) => sum + product.base_cost, 0);
  const sampleCommission = estimateDistributorCommission(sampleGross, sampleCost, guy.commission_rate);
  const navItems = isScopedRxPlusAdmin ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;
  const categoryCount = new Set(guyProducts.map((product) => product.category)).size;

  return (
    <DashLayout title="PepScriptRX+" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{isScopedRxPlusAdmin ? guyProducts.length : RX_PLUS_DISTRIBUTORS.length}</div>
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
            <div className="card-title">{isScopedRxPlusAdmin ? 'Your Enabled Catalog' : 'Guy Product Visibility'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isScopedRxPlusAdmin
                ? 'Products currently enabled for your PepScriptRX+ portal.'
                : 'First-pass seeded catalog. Supabase persistence can wire these controls in the next pass.'}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Retail</th>
                  {!isScopedRxPlusAdmin && <th>Base Cost</th>}
                  <th>Visibility</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {guyProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{product.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.strength}</div>
                    </td>
                    <td>{product.category}</td>
                    <td>${product.displayPrice}</td>
                    {!isScopedRxPlusAdmin && <td>${product.base_cost}</td>}
                    <td>{product.visibility_type.replaceAll('_', ' ')}</td>
                    <td>
                      <span className={`badge ${product.distributorProduct.is_enabled ? 'badge-success' : 'badge-default'}`}>
                        {product.distributorProduct.is_enabled ? 'Enabled' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
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
                <div className="detail-row"><span className="detail-label">Catalog</span><span className="detail-value">{guyProducts.length} enabled items</span></div>
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
                <div className="detail-row"><span className="detail-label">Shipping</span><span className="detail-value">${sampleCommission.shippingCost.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Processing</span><span className="detail-value">${sampleCommission.processingFee.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Net profit</span><span className="detail-value">${sampleCommission.netProfit.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Guy payout</span><span className="detail-value">${sampleCommission.distributorCommission.toFixed(2)}</span></div>
                <div className="detail-row"><span className="detail-label">Platform retained</span><span className="detail-value">${sampleCommission.platformProfit.toFixed(2)}</span></div>
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
