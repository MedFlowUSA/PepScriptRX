import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import PepRxBotBadge from '../../components/ai/PepRxBotBadge';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { compounds, CATEGORIES, CATEGORY_ICONS } from '../../data/compoundLibrary';
import type { Compound, CompoundCategory } from '../../data/compoundLibrary';

const DISCLAIMER =
  'This library is for educational purposes only. Information provided is not medical advice, diagnosis, or treatment guidance. Product availability, eligibility, and use may require review by a licensed provider where applicable. Compounds referenced have not necessarily been evaluated or approved by the FDA for all discussed wellness applications.';

const DISCLAIMER_TR =
  'Bu kütüphane yalnızca eğitim amaçlıdır. Buradaki bilgiler tıbbi tavsiye, tanı veya tedavi yönlendirmesi değildir. Ürün bulunurluğu, uygunluk ve kullanım, geçerli durumlarda lisanslı bir sağlayıcı tarafından inceleme gerektirebilir. Bahsi geçen bileşikler, tüm wellness kullanım alanları için FDA tarafından değerlendirilmiş veya onaylanmış olmayabilir.';

const CATEGORY_LABELS_TR: Record<CompoundCategory, string> = {
  'GLP / Weight Management': 'GLP / Kilo Yönetimi',
  'Recovery & Repair': 'Toparlanma ve Onarım',
  'Growth Hormone / Performance': 'Büyüme Hormonu / Performans',
  'Longevity & Anti-Aging': 'Uzun Yaşam ve Anti-Aging',
  'Cognitive / Mood / Sleep': 'Bilişsel / Ruh Hali / Uyku',
  'Immune / Wellness': 'Bağışıklık / Wellness',
};

function categoryLabel(cat: CompoundCategory, isTurkish: boolean) {
  return isTurkish ? CATEGORY_LABELS_TR[cat] : cat;
}

// ── Category filter chip ───────────────────────────────────────────
function CategoryChip({
  cat,
  active,
  onClick,
  isTurkish,
}: {
  cat: CompoundCategory;
  active: boolean;
  onClick: () => void;
  isTurkish: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lib-cat-chip${active ? ' active' : ''}`}
    >
      <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</span>
      {categoryLabel(cat, isTurkish)}
    </button>
  );
}

// ── Compound card ──────────────────────────────────────────────────
function CompoundCard({ c, onSelect, isTurkish }: { c: Compound; onSelect: () => void; isTurkish: boolean }) {
  return (
    <button type="button" className="lib-card" onClick={onSelect} aria-label={isTurkish ? `${c.name} hakkında daha fazla bilgi` : `Learn more about ${c.name}`}>
      <div className="lib-card-cat">
        <span>{CATEGORY_ICONS[c.category]}</span>
        {categoryLabel(c.category, isTurkish)}
      </div>
      <div className="lib-card-name">{c.name}</div>
      {c.altName && <div className="lib-card-alt">{c.altName}</div>}
      <p className="lib-card-tagline">{c.tagline}</p>
      <div className="lib-card-interests">
        {c.wellnessInterests.slice(0, 3).map((w) => (
          <span key={w} className="lib-tag">{w}</span>
        ))}
        {c.wellnessInterests.length > 3 && (
          <span className="lib-tag lib-tag-more">+{c.wellnessInterests.length - 3} {isTurkish ? 'daha' : 'more'}</span>
        )}
      </div>
      <span className="lib-card-cta">
        {isTurkish ? 'Detayları Gör' : 'Learn More'}
      </span>
    </button>
  );
}

// ── Detail modal ───────────────────────────────────────────────────
function CompoundDetail({
  c,
  onClose,
  brandName = 'PepScriptRX',
  productPath,
  isTurkish,
}: {
  c: Compound;
  onClose: () => void;
  brandName?: string;
  productPath: string;
  isTurkish: boolean;
}) {
  const [tab, setTab] = useState<'overview' | 'research' | 'strengths' | 'faq'>('overview');

  return (
    <div className="lib-modal-backdrop" onClick={onClose}>
      <div className="lib-modal" role="dialog" aria-modal="true" aria-labelledby="compound-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-header">
          <div>
            <div className="lib-modal-cat">
              {CATEGORY_ICONS[c.category]} {categoryLabel(c.category, isTurkish)}
            </div>
            <h2 id="compound-detail-title" className="lib-modal-name">{c.name}</h2>
            {c.altName && <div className="lib-modal-alt">{c.altName}</div>}
          </div>
          <button type="button" className="lib-modal-close" onClick={onClose} aria-label={isTurkish ? 'Kapat' : 'Close'}>
            ✕
          </button>
        </div>

        <div className="lib-modal-tabs">
          {(['overview', 'research', 'strengths', 'faq'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`lib-modal-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' && (isTurkish ? 'Genel Bakış' : 'Overview')}
              {t === 'research' && (isTurkish ? 'Wellness İlgi Alanları' : 'Wellness Interest')}
              {t === 'strengths' && (isTurkish ? 'Güçler ve Eşleşmeler' : 'Strengths & Pairings')}
              {t === 'faq' && 'FAQ'}
            </button>
          ))}
        </div>

        <div className="lib-modal-body">
          {tab === 'overview' && (
            <div>
              <p className="lib-modal-overview">{c.overview}</p>
              <div className="lib-modal-disclaimer">
                <span style={{ fontSize: 15 }}>ⓘ</span>
                {isTurkish ? DISCLAIMER_TR : DISCLAIMER}
              </div>
            </div>
          )}

          {tab === 'research' && (
            <div>
              <div className="lib-section-label">{isTurkish ? 'Sık Araştırılan Wellness Alanları' : 'Commonly Researched Wellness Areas'}</div>
              <div className="lib-interest-grid">
                {c.wellnessInterests.map((w) => (
                  <div key={w} className="lib-interest-item">
                    <span className="lib-interest-dot" />
                    {w}
                  </div>
                ))}
              </div>
              <div className="lib-modal-disclaimer" style={{ marginTop: 24 }}>
                <span style={{ fontSize: 15 }}>ⓘ</span>
                {isTurkish ? 'Bunlar araştırma ilgi alanlarına dair eğitim amaçlı özetlerdir; tıbbi iddia değildir. Bireysel sonuçlar garanti edilmez ve birçok faktöre bağlıdır. Her zaman lisanslı bir sağlayıcıya danışın.' : 'These are educational summaries of research interest areas, not medical claims. Individual outcomes are not guaranteed and depend on many factors. Always consult a licensed provider.'}
              </div>
            </div>
          )}

          {tab === 'strengths' && (
            <div>
              <div className="lib-section-label">{isTurkish ? 'Mevcut Güçler' : 'Available Strengths'}</div>
              <div className="lib-strengths-list">
                {c.strengths.map((s) => (
                  <div key={s} className="lib-strength-item">{s}</div>
                ))}
              </div>

              <div className="lib-section-label" style={{ marginTop: 28 }}>{isTurkish ? 'Yaygın Wellness Eşleşmeleri' : 'Common Wellness Pairings'}</div>
              <p style={{ fontSize: 13, color: 'rgba(226,234,244,.78)', marginBottom: 12 }}>
                {isTurkish ? 'Wellness ortamlarında sık konuşulan eşleşmeler. Birlikte kullanım kararları her zaman lisanslı bir sağlayıcı ile gözden geçirilmelidir.' : 'Pairings commonly discussed in wellness settings. Stacking decisions should always be reviewed with a licensed provider.'}
              </p>
              <div className="lib-pairings">
                {c.pairings.map((p) => (
                  <span key={p} className="lib-pairing-chip">{p}</span>
                ))}
              </div>
            </div>
          )}

          {tab === 'faq' && (
            <div className="lib-faq">
              {c.faq.map((item, i) => (
                <div key={i} className="lib-faq-item">
                  <div className="lib-faq-q">{item.q}</div>
                  <div className="lib-faq-a">{item.a}</div>
                </div>
              ))}
              <div className="lib-modal-disclaimer" style={{ marginTop: 24 }}>
                <span style={{ fontSize: 15 }}>ⓘ</span>
                {isTurkish ? 'FAQ yanıtları yalnızca eğitim amaçlıdır ve tıbbi tavsiye değildir. Durumunuza özel yönlendirme için lisanslı bir sağlayıcıya danışın.' : 'FAQ responses are for educational purposes only and are not medical advice. Consult a licensed provider for guidance specific to your situation.'}
              </div>
            </div>
          )}
        </div>

        <div className="lib-modal-footer">
          {c.hasProduct ? (
            <Link to={productPath} className="btn btn-primary">
              {isTurkish ? `${brandName} Ürünlerini Gör` : brandName === 'PepScriptRX' ? 'Start Refill Request' : `Shop ${brandName}`}
            </Link>
          ) : (
            <span className="lib-catalog-note">{isTurkish ? 'Genişletilmiş partner kataloğu üzerinden mevcut' : 'Available through expanded partner catalog'}</span>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {isTurkish ? 'Kapat' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
type LibraryProps = {
  portalKey?: string;
};

export default function Library({ portalKey }: LibraryProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const isPortal = Boolean(portal);
  const isTurkish = portal?.id === 'anatolia';
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const homePath = portal?.path ?? '/';
  const productPath = portal ? portal.path : '/start';
  const mixingPath = portal ? `${portal.path}/mixing` : '/mixing';
  const heroKicker = isTurkish ? `${brandName} Ürün Kütüphanesi` : portal ? `${brandName} Compound Library` : 'PepScriptRX Compound Library';
  const heroTitle = isTurkish ? (
    <>
      Wellness ve peptit eğitimi<br />
      <span style={{ color: 'var(--teal)' }}>Toparlanma, performans ve metabolik destek</span>
    </>
  ) : portal ? (
    <>
      AACTIVATED Education for<br />
      <span style={{ color: 'var(--teal)' }}>Recovery, Performance & Wellness</span>
    </>
  ) : (
    <>
      Your Guide to Wellness,<br />
      <span style={{ color: 'var(--teal)' }}>Recovery & Performance Compounds</span>
    </>
  );
  const heroSubtitle = isTurkish
    ? `${compounds.length} bileşik ve ${CATEGORIES.length} kategori hakkında sade Türkçe arayüzlü eğitim kütüphanesi. Tıbbi tavsiye değildir; ödeme öncesinde daha iyi sorular sormanıza yardımcı olmak için hazırlanmıştır.`
    : portal
    ? `Plain-English education on ${compounds.length} compounds across ${CATEGORIES.length} categories, branded for the ${brandName} portal. Not medical advice. Built to help you ask better questions before checkout.`
    : `Plain-English education on ${compounds.length} compounds across ${CATEGORIES.length} categories - GLP weight management, recovery peptides, growth hormone support, longevity, cognitive wellness, and immune health. Not medical advice. Built to help you ask better questions.`;
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CompoundCategory | null>(null);
  const [selected, setSelected] = useState<Compound | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return compounds.filter((c) => {
      const matchesCat = !activeCategory || c.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.altName?.toLowerCase().includes(q) ?? false) ||
        c.category.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.wellnessInterests.some((w) => w.toLowerCase().includes(q))
      );
    });
  }, [search, activeCategory]);

  const counts = useMemo(() => {
    const map: Partial<Record<CompoundCategory, number>> = {};
    const q = search.toLowerCase().trim();
    for (const c of compounds) {
      if (q) {
        const match =
          c.name.toLowerCase().includes(q) ||
          (c.altName?.toLowerCase().includes(q) ?? false) ||
          c.category.toLowerCase().includes(q) ||
          c.wellnessInterests.some((w) => w.toLowerCase().includes(q));
        if (!match) continue;
      }
      map[c.category] = (map[c.category] ?? 0) + 1;
    }
    return map;
  }, [search]);

  return (
    <PublicLayout
      isolatedPortal={isPortal}
      portalKey={portal?.id}
      portalHomePath={portal?.path}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
    >
      {/* Hero */}
      <section className="lib-hero">
        <div className="container">
          {portal && (
            <Link to={homePath} className="btn btn-ghost btn-sm" style={{ color: 'rgba(226,234,244,.72)', borderColor: 'rgba(255,255,255,.18)', marginBottom: 18 }}>
              {isTurkish ? `${brandName} mağazasına dön` : `Back to ${brandName}`}
            </Link>
          )}
          <div className="lib-hero-kicker">⚗ {heroKicker}</div>

          <h1 className="lib-hero-title">
            {heroTitle}
          </h1>

          <p className="lib-hero-sub">
            {heroSubtitle}
          </p>

          {/* Stats row */}
          <div className="lib-hero-stats">
            <div className="lib-hero-stat">
              <span className="lib-hero-stat-num">{compounds.length}</span>
              <span className="lib-hero-stat-label">{isTurkish ? 'Bileşik' : 'Compounds'}</span>
            </div>
            <div className="lib-hero-stat-divider" />
            <div className="lib-hero-stat">
              <span className="lib-hero-stat-num">{CATEGORIES.length}</span>
              <span className="lib-hero-stat-label">{isTurkish ? 'Kategori' : 'Categories'}</span>
            </div>
            <div className="lib-hero-stat-divider" />
            <div className="lib-hero-stat">
              <span className="lib-hero-stat-num">100%</span>
              <span className="lib-hero-stat-label">{isTurkish ? 'Eğitim Amaçlı' : 'Educational'}</span>
            </div>
          </div>

          {/* Category preview chips in hero */}
          <div className="lib-hero-cats">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`lib-cat-chip${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</span>
                {categoryLabel(cat, isTurkish)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="lib-search-wrap">
            <span className="lib-search-icon" aria-hidden="true">{isTurkish ? 'Ara' : 'Search'}</span>
            <input
              type="search"
              className="lib-search"
              placeholder={isTurkish ? 'Bileşik adı, kategori veya wellness ilgi alanı ile ara...' : 'Search by compound name, category, or wellness interest...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="lib-search-clear" onClick={() => setSearch('')} aria-label={isTurkish ? 'Aramayı temizle' : 'Clear search'}>x</button>
            )}
          </div>
          <div className="lib-ai-helper">
            <PepRxBotBadge
              title={isTurkish ? 'Kütüphane için PEPRXbot’a sorun' : 'Ask PEPRXbot about the library'}
              body={isTurkish ? 'Kategorileri karşılaştırma, ürün detaylarını anlama ve karışım merkezine geçiş konusunda tıbbi öneri vermeden yardımcı olur.' : 'Get plain-English help comparing categories, finding supplies, and understanding listed product details without medical recommendations.'}
              context="product"
              compact
              variant="inline"
              secondaryHref={mixingPath}
            />
          </div>
        </div>
      </section>

      {/* Sticky filter bar — only shows when a category is active or search has results */}
      <div className="lib-filter-bar">
        <div className="container">
          <div className="lib-cats">
            <button
              type="button"
              className={`lib-cat-chip${!activeCategory ? ' active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              {isTurkish ? 'Tümü' : 'All'} ({compounds.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = counts[cat] ?? 0;
              if (count === 0 && search) return null;
              return (
                <CategoryChip
                  key={cat}
                  cat={cat}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  isTurkish={isTurkish}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="lib-grid-section">
        <div className="container">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ color: 'rgba(226,234,244,.72)' }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title" style={{ color: '#E2EAF4' }}>{isTurkish ? 'Bileşik bulunamadı' : 'No compounds found'}</div>
              <p className="empty-state-desc">{isTurkish ? 'Farklı bir arama deneyin veya filtreleri temizleyin.' : 'Try a different search term or clear your filters.'}</p>
              <button
                type="button"
                className="btn btn-outline"
                style={{ marginTop: 16, borderColor: 'rgba(255,255,255,.2)', color: 'rgba(226,234,244,.7)' }}
                onClick={() => { setSearch(''); setActiveCategory(null); }}
              >
                {isTurkish ? 'Filtreleri temizle' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <>
              <div className="lib-results-count">
                {isTurkish
                  ? `${filtered.length} bileşik${activeCategory ? ` - ${categoryLabel(activeCategory, true)}` : ''}${search ? ` - "${search}" ile eşleşiyor` : ''}`
                  : `${filtered.length} compound${filtered.length !== 1 ? 's' : ''}${activeCategory ? ` in ${activeCategory}` : ''}${search ? ` matching "${search}"` : ''}`}
              </div>
              <div className="lib-grid">
                {filtered.map((c) => (
                  <CompoundCard key={c.id} c={c} onSelect={() => setSelected(c)} isTurkish={isTurkish} />
                ))}
              </div>
            </>
          )}

          {/* Footer disclaimer */}
          <div className="lib-page-disclaimer">
            <strong>{isTurkish ? 'Eğitim Amaçlı Uyarı:' : 'Educational Disclaimer:'}</strong> {isTurkish ? DISCLAIMER_TR : DISCLAIMER}
          </div>
        </div>
      </section>

      {/* Detail modal */}
      {selected && (
        <CompoundDetail c={selected} onClose={() => setSelected(null)} brandName={brandName} productPath={productPath} isTurkish={isTurkish} />
      )}
    </PublicLayout>
  );
}
