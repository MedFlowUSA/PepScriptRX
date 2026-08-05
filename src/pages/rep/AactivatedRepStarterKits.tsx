import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { createStripeCheckoutSession } from '../../lib/stripeCheckout';
import {
  AACTIVATED_STARTER_KIT_PATH,
  AACTIVATED_STARTER_KITS,
  findStarterKit,
  starterKitComponents,
} from '../../lib/aactivatedStarterKits';
import {
  AACTIVATED_PARENT_STORE_NAME,
  isAactivatedPartnerAdmin,
  isAactivatedRep,
  isPlatformAdminRole,
} from '../../lib/aactivatedScope';
import type { Rep } from '../../types';

type PackageRow = {
  package_id: string;
  package_tier: string;
  package_name: string;
  promo_label: string | null;
  description: string | null;
  retail_value: number;
  promo_price: number;
  savings: number;
  enabled: boolean;
  sort_order: number;
};

type VariationRow = {
  package_id: string;
  variation_id: string;
  variation_name: string;
  retail_value: number;
  promo_price: number;
  savings: number;
};

type AvailabilityRow = {
  package_id: string;
  variation_id: string | null;
  components: Array<{ sku: string; name: string; quantity: number; current_qty: number; active: boolean }> | null;
  is_available: boolean;
  already_purchased: boolean;
  can_purchase: boolean;
  message: string;
};

type ResourceAccessRow = {
  id: string;
  package_id: string;
  package_tier: string;
  resources: Array<{ title?: string; path?: string }>;
  unlocked_at: string;
};

const NAV = [
  { label: 'My Dashboard', path: '/rep', icon: '01' },
  { label: 'Starter Kits', path: AACTIVATED_STARTER_KIT_PATH, icon: '02' },
];

export default function AactivatedRepStarterKits() {
  const { profile } = useAuth();
  const [rep, setRep] = useState<Rep | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [variations, setVariations] = useState<VariationRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [resourceAccess, setResourceAccess] = useState<ResourceAccessRow[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<Record<string, string>>({ 'starter-experience-kit': 'reta' });
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState('');
  const [error, setError] = useState('');

  const isAdmin = isPlatformAdminRole(profile?.role) || isAactivatedPartnerAdmin(profile);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !profile) {
        if (active) { setLoading(false); setAuthorized(false); }
        return;
      }

      setLoading(true);
      setError('');
      const { data: repData } = await supabase
        .from('reps')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });
      const reps = (repData as Rep[] | null) ?? [];
      const nextRep = reps.find((row) => isAactivatedRep(row)) ?? null;
      const nextAuthorized = Boolean(nextRep || isAdmin);
      if (!active) return;
      setRep(nextRep);
      setAuthorized(nextAuthorized);
      if (!nextAuthorized) {
        setLoading(false);
        return;
      }

      const [{ data: kitData, error: kitError }, { data: variationData, error: variationError }, { data: availabilityData, error: availabilityError }, { data: resourceData, error: resourceError }] = await Promise.all([
        supabase.from('aactivated_starter_kit_packages').select('*').order('sort_order', { ascending: true }),
        supabase.from('aactivated_starter_kit_variations').select('*').order('sort_order', { ascending: true }),
        supabase.rpc('get_aactivated_starter_kit_availability'),
        supabase.from('aactivated_starter_kit_resource_access').select('id,package_id,package_tier,resources,unlocked_at').order('unlocked_at', { ascending: false }),
      ]);
      if (!active) return;
      const anyError = kitError || variationError || availabilityError || resourceError;
      if (anyError) setError(anyError.message);
      setPackages((kitData as PackageRow[] | null) ?? []);
      setVariations((variationData as VariationRow[] | null) ?? []);
      setAvailability(((availabilityData as AvailabilityRow[] | null) ?? []).map((row) => ({
        ...row,
        components: Array.isArray(row.components) ? row.components : [],
      })));
      setResourceAccess(((resourceData as ResourceAccessRow[] | null) ?? []).map((row) => ({
        ...row,
        resources: Array.isArray(row.resources) ? row.resources : [],
      })));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [profile, isAdmin]);

  const rows = useMemo(() => {
    const byPackage = new Map(packages.map((row) => [row.package_id, row]));
    return AACTIVATED_STARTER_KITS.map((starter) => {
      const dbRow = byPackage.get(starter.packageId);
      return {
        staticKit: starter,
        package_id: starter.packageId,
        package_name: dbRow?.package_name ?? starter.name,
        promo_label: dbRow?.promo_label ?? starter.label,
        description: dbRow?.description ?? '',
        retail_value: Number(dbRow?.retail_value ?? starter.retailValue),
        promo_price: Number(dbRow?.promo_price ?? starter.promoPrice),
        savings: Number(dbRow?.savings ?? starter.savings),
        enabled: dbRow?.enabled ?? true,
      };
    });
  }, [packages]);

  function availabilityFor(packageId: string, variationId?: string | null) {
    return availability.find((row) => row.package_id === packageId && (row.variation_id ?? '') === (variationId ?? ''));
  }

  async function startCheckout(packageId: string) {
    if (!supabase) return;
    setBuyingId(packageId);
    setError('');
    const kit = findStarterKit(packageId);
    const variationId = kit?.variationRequired ? selectedVariation[packageId] : null;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-aactivated-starter-kit-order', {
        body: { package_id: packageId, variation_id: variationId },
      });
      if (invokeError) throw new Error(invokeError.message);
      const paymentToken = String((data as { public_payment_token?: string })?.public_payment_token ?? '');
      if (!paymentToken) throw new Error('Payment token was not returned.');
      const session = await createStripeCheckoutSession(paymentToken);
      if (!session?.url) throw new Error('Card checkout could not be started.');
      window.location.href = session.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Starter kit checkout could not be started.');
      setBuyingId('');
    }
  }

  if (!profile && !loading) return <Navigate to={`/login?portal=rep&redirect=${encodeURIComponent(AACTIVATED_STARTER_KIT_PATH)}`} replace />;
  if (authorized === false && !loading) return <Navigate to="/rep" replace />;

  return (
    <DashLayout title="AACTIVATEDRX Starter Kits" navItems={NAV}>
      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{
          background: '#07131c',
          color: '#fff',
          border: '1px solid rgba(23, 190, 207, .35)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            minHeight: 240,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 380px)',
            gap: 24,
            padding: 28,
            alignItems: 'center',
          }}>
            <div>
              <div style={{ color: '#22d3ee', fontSize: 12, fontWeight: 900, letterSpacing: 0, textTransform: 'uppercase' }}>Private rep purchasing</div>
              <h1 style={{ margin: '8px 0 10px', fontSize: 'clamp(30px, 4vw, 54px)', lineHeight: 1, letterSpacing: 0 }}>{AACTIVATED_PARENT_STORE_NAME} Rep Starter Kits</h1>
              <p style={{ maxWidth: 720, color: '#d7e6ee', fontSize: 16, lineHeight: 1.6 }}>
                Inventory-backed onboarding kits for active AACTIVATEDRX reps. These orders use internal checkout, do not accept discount codes, and do not create rep commission.
              </p>
              {rep && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  <span className="badge badge-info">{rep.rep_name || rep.rep_slug}</span>
                  <span className="badge badge-default">{rep.rep_slug}</span>
                </div>
              )}
            </div>
            <div style={{ justifySelf: 'end', width: '100%', maxWidth: 360, aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.2)' }}>
              <img src="/marketing/aactivated-product-vial.png" alt="AACTIVATEDRX product vial" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </section>

        {loading ? (
          <div style={{ padding: 56, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            {resourceAccess.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Unlocked Starter Kit Resources</div>
                    <div className="card-subtitle">Available after a paid starter-kit order is finalized.</div>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {resourceAccess.flatMap((access) => access.resources.map((resource, index) => (
                    <a key={`${access.id}-${index}`} className="btn btn-outline btn-sm" href={resource.path || '#'} target="_blank" rel="noreferrer">
                      {resource.title || 'Starter kit resource'}
                    </a>
                  )))}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {rows.map((kit) => {
                const selected = kit.staticKit.variationRequired ? selectedVariation[kit.package_id] || 'reta' : null;
                const liveAvailability = availabilityFor(kit.package_id, selected);
                const components = liveAvailability?.components?.length
                  ? liveAvailability.components.map((component) => ({ sku: component.sku, name: component.name, quantity: component.quantity, currentQty: component.current_qty }))
                  : starterKitComponents(kit.package_id, selected).map((component) => ({ ...component, currentQty: 0 }));
                const packageVariations = variations.filter((row) => row.package_id === kit.package_id);
                const selectedVariationRow = packageVariations.find((row) => row.variation_id === selected);
                const displayRetail = Number(selectedVariationRow?.retail_value ?? kit.retail_value);
                const displayPromo = Number(selectedVariationRow?.promo_price ?? kit.promo_price);
                const displaySavings = Number(selectedVariationRow?.savings ?? kit.savings);
                const disabled = !kit.enabled || !liveAvailability?.can_purchase || buyingId === kit.package_id;
                return (
                  <article key={kit.package_id} style={{
                    background: '#fff',
                    border: kit.promo_label?.toLowerCase().includes('popular') ? '2px solid #0891b2' : '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 16px 36px rgba(7, 19, 28, .08)',
                  }}>
                    <div style={{ padding: 18, borderBottom: '1px solid var(--border)', background: '#f8fbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <span className={kit.enabled ? 'badge badge-info' : 'badge badge-warning'}>{kit.enabled ? kit.promo_label : 'Disabled'}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 800 }}>Save ${displaySavings.toFixed(0)}</span>
                      </div>
                      <h2 style={{ margin: '14px 0 6px', color: 'var(--navy)', fontSize: 22, letterSpacing: 0 }}>{kit.package_name}</h2>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.55 }}>{kit.description}</p>
                    </div>
                    <div style={{ padding: 18, display: 'grid', gap: 14 }}>
                      {kit.staticKit.variationRequired && (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div className="form-label">Starter variation</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {(packageVariations.length ? packageVariations : kit.staticKit.variations ?? []).map((variation) => {
                              const value = 'variation_id' in variation ? variation.variation_id : variation.variationId;
                              const label = 'variation_name' in variation ? variation.variation_name : variation.name;
                              return (
                                <button
                                  key={value}
                                  className={selected === value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                                  type="button"
                                  onClick={() => setSelectedVariation({ ...selectedVariation, [kit.package_id]: value })}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Metric label="Retail value" value={`$${displayRetail.toFixed(2)}`} muted />
                        <Metric label="Rep price" value={`$${displayPromo.toFixed(2)}`} />
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        {components.map((component) => (
                          <div key={`${kit.package_id}-${selected ?? 'base'}-${component.sku}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #edf2f7', paddingBottom: 7 }}>
                            <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{component.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>x{component.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className={liveAvailability?.can_purchase ? 'alert alert-success' : 'alert alert-warning'} style={{ margin: 0 }}>
                        {liveAvailability?.message ?? 'Checking eligibility and inventory.'}
                      </div>
                      <button className="btn btn-primary" type="button" disabled={disabled} onClick={() => startCheckout(kit.package_id)}>
                        {buyingId === kit.package_id ? 'Starting checkout...' : `Buy for $${displayPromo.toFixed(2)}`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashLayout>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: muted ? '#f8fafc' : '#ecfeff' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'var(--navy)', fontSize: 22, fontWeight: 950 }}>{value}</div>
    </div>
  );
}
