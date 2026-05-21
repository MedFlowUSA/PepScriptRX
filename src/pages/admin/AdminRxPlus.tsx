import DashLayout from '../../components/layout/DashLayout';
import {
  GUY_DISTRIBUTOR_PRODUCTS,
  RX_PLUS_DISTRIBUTORS,
  RX_PLUS_PRODUCTS,
  WHOLESALE_TIERS,
  estimateDistributorCommission,
  getDistributorProducts,
} from '../../data/rxPlus';
import { ADMIN_NAV } from './adminNav';

export default function AdminRxPlus() {
  const guy = RX_PLUS_DISTRIBUTORS.find((distributor) => distributor.slug === 'guy')!;
  const guyProducts = getDistributorProducts('guy');
  const featuredCount = GUY_DISTRIBUTOR_PRODUCTS.filter((item) => item.featured && item.is_enabled).length;
  const sampleGross = guyProducts.slice(0, 6).reduce((sum, product) => sum + product.displayPrice, 0);
  const sampleCost = guyProducts.slice(0, 6).reduce((sum, product) => sum + product.base_cost, 0);
  const sampleCommission = estimateDistributorCommission(sampleGross, sampleCost, guy.commission_rate);

  return (
    <DashLayout title="PepScriptRX+" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{RX_PLUS_DISTRIBUTORS.length}</div>
          <div className="stat-label">Distributors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{RX_PLUS_PRODUCTS.length}</div>
          <div className="stat-label">Rx+ products</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{featuredCount}</div>
          <div className="stat-label">Guy featured items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(guy.commission_rate * 100)}%</div>
          <div className="stat-label">Guy net profit comp</div>
        </div>
      </div>

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

      <div className="detail-grid">
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Guy Product Visibility</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              First-pass seeded catalog. Supabase persistence can wire these controls in the next pass.
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Retail</th>
                  <th>Base Cost</th>
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
                    <td>${product.base_cost}</td>
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
