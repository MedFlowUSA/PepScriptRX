import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getPartnerTenant, isPlatformAdmin, partnerCan } from '../../lib/partnerTenant';
import type { Rep } from '../../types';
import { ADMIN_NAV, BLACKLINE_ADMIN_NAV, PARTNER_LIMITED_ADMIN_NAV, RX_PLUS_ADMIN_NAV, VITALITY_ADMIN_NAV } from './adminNav';
import { ROCKPHORM_ADMIN_NAV } from '../../lib/rockPhormScope';

type MarketingAsset = {
  id: string;
  brand_id: string;
  store_slug: string;
  asset_name: string;
  asset_type: string;
  storage_path: string;
  public_url: string | null;
  created_at: string;
};

type MarketingLink = {
  id: string;
  brand_id: string;
  store_slug: string;
  link_label: string;
  link_url: string;
  discount_code: string | null;
  rep_id: string | null;
  created_at: string;
};

export default function AdminPartnerMarketing() {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  const [reps, setReps] = useState<Rep[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [links, setLinks] = useState<MarketingLink[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [linkDraft, setLinkDraft] = useState({ link_label: '', link_url: '', discount_code: '', rep_id: '' });
  const canUseMarketing = isPlatformAdmin(profile) || partnerCan(profile, 'marketing');

  const navItems = useMemo(() => {
    if (tenant?.brandId === 'vitality') return VITALITY_ADMIN_NAV;
    if (tenant?.brandId === 'blackline') return BLACKLINE_ADMIN_NAV;
    if (tenant && !['aactivated', 'aurora', 'rockphorm', 'glow', 'sandman', 'blackline'].includes(tenant.brandId)) return buildGenericPartnerNav(tenant.modules);
    if (profile?.role === 'partner_admin_limited') return PARTNER_LIMITED_ADMIN_NAV;
    if (tenant?.brandId === 'aurora') return PARTNER_LIMITED_ADMIN_NAV;
    if (tenant?.brandId === 'rockphorm' || tenant?.brandId === 'glow') return ROCKPHORM_ADMIN_NAV;
    if (profile?.role === 'rx_plus_admin' || profile?.role === 'partner_admin_full') return RX_PLUS_ADMIN_NAV;
    return ADMIN_NAV;
  }, [profile?.role, tenant?.brandId]);

  const storeLink = useMemo(() => toAbsoluteUrl(tenant?.storefrontPath ?? '/'), [tenant?.storefrontPath]);
  const scopedReps = useMemo(() => {
    if (!tenant) return reps;
    return reps.filter((rep) => isTenantRep(rep, tenant.brandId, tenant.storeSlug, tenant.scopeCode));
  }, [reps, tenant]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.brandId, profile?.id]);

  async function loadData() {
    if (!supabase || !tenant) return;
    setError('');
    const [
      { data: repData, error: repError },
      { data: assetData, error: assetError },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      supabase.from('reps').select('*').order('rep_name', { ascending: true }),
      supabase.from('partner_marketing_assets').select('*').eq('brand_id', tenant.brandId).order('created_at', { ascending: false }),
      supabase.from('partner_marketing_links').select('*').eq('brand_id', tenant.brandId).order('created_at', { ascending: false }),
    ]);
    if (repError) setError(repError.message);
    else setReps((repData as Rep[]) ?? []);
    if (assetError && !/does not exist/i.test(assetError.message)) setError(assetError.message);
    else setAssets((assetData as MarketingAsset[]) ?? []);
    if (linkError && !/does not exist/i.test(linkError.message)) setError(linkError.message);
    else setLinks((linkData as MarketingLink[]) ?? []);
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!supabase || !tenant || !file) return;
    setUploading(true);
    setMessage('');
    setError('');
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const storagePath = `${tenant.brandId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('partner-marketing-assets')
      .upload(storagePath, file, { upsert: false });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('partner-marketing-assets').getPublicUrl(storagePath);
    const { error: insertError } = await supabase.from('partner_marketing_assets').insert({
      brand_id: tenant.brandId,
      store_slug: tenant.storeSlug,
      asset_name: file.name,
      asset_type: file.type || 'application/octet-stream',
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      created_by: profile?.id,
    });
    if (insertError) setError(insertError.message);
    else {
      setMessage(`${file.name} uploaded.`);
      await loadData();
    }
    setUploading(false);
    event.target.value = '';
  }

  async function saveLink() {
    if (!supabase || !tenant) return;
    const linkUrl = linkDraft.link_url.trim();
    if (!linkDraft.link_label.trim() || !linkUrl) {
      setError('Link label and URL are required.');
      return;
    }
    setError('');
    setMessage('');
    const { error: insertError } = await supabase.from('partner_marketing_links').insert({
      brand_id: tenant.brandId,
      store_slug: tenant.storeSlug,
      link_label: linkDraft.link_label.trim(),
      link_url: toAbsoluteUrl(linkUrl),
      discount_code: linkDraft.discount_code.trim() || null,
      rep_id: linkDraft.rep_id || null,
      created_by: profile?.id,
    });
    if (insertError) setError(insertError.message);
    else {
      setMessage('Marketing link saved.');
      setLinkDraft({ link_label: '', link_url: '', discount_code: '', rep_id: '' });
      await loadData();
    }
  }

  return (
    <DashLayout title={tenant ? `${tenant.brandName} Marketing Assets` : 'Partner Marketing Assets'} navItems={navItems}>
      {!tenant || !canUseMarketing ? (
        <div className="card"><div className="card-body">Marketing assets are available inside an assigned partner brand.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="stats-grid">
            <QrCard title="Store Link" url={storeLink} code={tenant.scopeCode} />
            {scopedReps.slice(0, 3).map((rep) => (
              <QrCard key={rep.id} title={rep.rep_name || rep.rep_slug} url={repLink(tenant.storefrontPath, rep.rep_slug, tenant.brandId)} code={rep.discount_code || rep.rep_slug} />
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Brand Graphics</div>
                <div className="card-subtitle">Upload logos, flyers, social posts, QR-ready graphics, and campaign files for this brand only.</div>
              </div>
              <label className="btn btn-primary btn-sm">
                {uploading ? 'Uploading...' : 'Upload Asset'}
                <input type="file" accept="image/*,.pdf" onChange={uploadAsset} disabled={uploading} style={{ display: 'none' }} />
              </label>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Type</th><th>Created</th><th>Link</th></tr></thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No brand assets uploaded yet.</td></tr>
                  ) : assets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{asset.asset_name}</td>
                      <td>{asset.asset_type}</td>
                      <td>{new Date(asset.created_at).toLocaleDateString()}</td>
                      <td>{asset.public_url ? <a href={asset.public_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Referral & Campaign Links</div></div>
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-grid-2">
                <label className="form-group">
                  <span className="form-label">Label</span>
                  <input className="form-input" value={linkDraft.link_label} onChange={(event) => setLinkDraft({ ...linkDraft, link_label: event.target.value })} />
                </label>
                <label className="form-group">
                  <span className="form-label">Rep</span>
                  <select className="form-select" value={linkDraft.rep_id} onChange={(event) => setLinkDraft({ ...linkDraft, rep_id: event.target.value })}>
                    <option value="">Brand store</option>
                    {scopedReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.rep_name || rep.rep_slug}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid-2">
                <label className="form-group">
                  <span className="form-label">URL</span>
                  <input className="form-input" value={linkDraft.link_url} onChange={(event) => setLinkDraft({ ...linkDraft, link_url: event.target.value })} placeholder={storeLink} />
                </label>
                <label className="form-group">
                  <span className="form-label">Discount code</span>
                  <input className="form-input" value={linkDraft.discount_code} onChange={(event) => setLinkDraft({ ...linkDraft, discount_code: event.target.value.toUpperCase() })} />
                </label>
              </div>
              <button className="btn btn-primary" type="button" onClick={saveLink}>Save Marketing Link</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Label</th><th>URL</th><th>Discount</th><th>QR</th></tr></thead>
                <tbody>
                  {links.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No campaign links saved yet.</td></tr>
                  ) : links.map((link) => (
                    <tr key={link.id}>
                      <td>{link.link_label}</td>
                      <td><a href={link.link_url} target="_blank" rel="noreferrer">{link.link_url}</a></td>
                      <td>{link.discount_code || '-'}</td>
                      <td><QRCodeSVG value={link.link_url} size={72} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashLayout>
  );
}

function QrCard({ title, url, code }: { title: string; url: string; code?: string | null }) {
  return (
    <div className="stat-card" style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 14, alignItems: 'center' }}>
      <QRCodeSVG value={url} size={96} />
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{title}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere', color: 'var(--navy)' }}>{url}</div>
        {code && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>Code: {code}</div>}
      </div>
    </div>
  );
}

function isTenantRep(rep: Rep, brandId: string, storeSlug: string, scopeCode: string): boolean {
  const values = [
    rep.brand_id,
    rep.parent_brand_id,
    rep.assigned_store_slug,
    rep.custom_store_slug,
    rep.rep_slug,
    rep.rep_channel,
    rep.rep_tier,
    rep.brand_name,
  ].map((value) => String(value ?? '').toLowerCase());
  const scope = scopeCode.toLowerCase();
  return values.some((value) => value === brandId || value === storeSlug || value === scope || value.includes(brandId) || value.includes(storeSlug));
}

function buildGenericPartnerNav(modules: string[]) {
  const nav = [
    { module: 'dashboard', label: 'Dashboard', path: '/admin', icon: '01' },
    { module: 'orders', label: 'Orders', path: '/admin/submissions', icon: '02' },
    { module: 'customers', label: 'Customers', path: '/admin/leads', icon: '03' },
    { module: 'products', label: 'Products', path: '/admin/products', icon: '04' },
    { module: 'pricing', label: 'Pricing Manager', path: '/admin/pricing', icon: '05' },
    { module: 'discounts', label: 'Discount Codes', path: '/admin/aactivated-promos', icon: '06' },
    { module: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: '07' },
    { module: 'reports', label: 'Sales Reports', path: '/admin/commission-center', icon: '08' },
    { module: 'reps', label: 'Reps', path: '/admin/reps', icon: '09' },
    { module: 'inventory', label: 'Inventory', path: '/admin/inventory', icon: '10' },
    { module: 'storefront', label: 'Store Settings', path: '/admin/store-settings', icon: '11' },
    { module: 'marketing', label: 'Marketing Assets', path: '/admin/marketing-assets', icon: '12' },
  ];
  return nav.filter((item) => item.module === 'dashboard' || modules.includes(item.module));
}
function repLink(storefrontPath: string, repSlug: string, brandId: string): string {

  const basePath = brandId === 'aurora' ? '/auroralabs' : storefrontPath;
  return toAbsoluteUrl(`${basePath}?rep=${encodeURIComponent(repSlug)}`);
}

function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}