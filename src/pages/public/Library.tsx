import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { compounds, CATEGORIES, CATEGORY_ICONS } from '../../data/compoundLibrary';
import type { Compound, CompoundCategory } from '../../data/compoundLibrary';

const DISCLAIMER =
  'This library is for educational purposes only. Information provided is not medical advice, diagnosis, or treatment guidance. Product availability, eligibility, and use may require review by a licensed provider where applicable. Compounds referenced have not necessarily been evaluated or approved by the FDA for all discussed wellness applications.';

// ── Category filter chip ───────────────────────────────────────────
function CategoryChip({
  cat,
  active,
  onClick,
}: {
  cat: CompoundCategory;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lib-cat-chip${active ? ' active' : ''}`}
    >
      <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</span>
      {cat}
    </button>
  );
}

// ── Compound card ──────────────────────────────────────────────────
function CompoundCard({ c, onSelect }: { c: Compound; onSelect: () => void }) {
  return (
    <div className="lib-card" onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      <div className="lib-card-cat">
        <span>{CATEGORY_ICONS[c.category]}</span>
        {c.category}
      </div>
      <div className="lib-card-name">{c.name}</div>
      {c.altName && <div className="lib-card-alt">{c.altName}</div>}
      <p className="lib-card-tagline">{c.tagline}</p>
      <div className="lib-card-interests">
        {c.wellnessInterests.slice(0, 3).map((w) => (
          <span key={w} className="lib-tag">{w}</span>
        ))}
        {c.wellnessInterests.length > 3 && (
          <span className="lib-tag lib-tag-more">+{c.wellnessInterests.length - 3} more</span>
        )}
      </div>
      <button type="button" className="lib-card-cta">
        Learn More →
      </button>
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────
function CompoundDetail({ c, onClose }: { c: Compound; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'research' | 'strengths' | 'faq'>('overview');

  return (
    <div className="lib-modal-backdrop" onClick={onClose}>
      <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lib-modal-header">
          <div>
            <div className="lib-modal-cat">
              {CATEGORY_ICONS[c.category]} {c.category}
            </div>
            <h2 className="lib-modal-name">{c.name}</h2>
            {c.altName && <div className="lib-modal-alt">{c.altName}</div>}
          </div>
          <button type="button" className="lib-modal-close" onClick={onClose} aria-label="Close">
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
              {t === 'overview' && 'Overview'}
              {t === 'research' && 'Wellness Interest'}
              {t === 'strengths' && 'Strengths & Pairings'}
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
                {DISCLAIMER}
              </div>
            </div>
          )}

          {tab === 'research' && (
            <div>
              <div className="lib-section-label">Commonly Researched Wellness Areas</div>
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
                These are educational summaries of research interest areas, not medical claims. Individual outcomes are not guaranteed and depend on many factors. Always consult a licensed provider.
              </div>
            </div>
          )}

          {tab === 'strengths' && (
            <div>
              <div className="lib-section-label">Available Strengths</div>
              <div className="lib-strengths-list">
                {c.strengths.map((s) => (
                  <div key={s} className="lib-strength-item">{s}</div>
                ))}
              </div>

              <div className="lib-section-label" style={{ marginTop: 28 }}>Common Wellness Pairings</div>
              <p style={{ fontSize: 13, color: 'rgba(226,234,244,.55)', marginBottom: 12 }}>
                Pairings commonly discussed in wellness settings — stacking decisions should always be reviewed with a licensed provider.
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
                FAQ responses are for educational purposes only and are not medical advice. Consult a licensed provider for guidance specific to your situation.
              </div>
            </div>
          )}
        </div>

        <div className="lib-modal-footer">
          {c.hasProduct && c.productPath ? (
            <Link to={c.productPath} className="btn btn-primary">
              Start Refill Request
            </Link>
          ) : (
            <span className="lib-catalog-note">Available through expanded partner catalog</span>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Library() {
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
    <PublicLayout>
      {/* Hero */}
      <section className="lib-hero">
        <div className="container">
          <div className="lib-hero-kicker">Compound Library</div>
          <h1 className="lib-hero-title">
            Explore the PepScriptRX<br />
            <span style={{ color: 'var(--teal)' }}>Compound Library</span>
          </h1>
          <p className="lib-hero-sub">
            Simple, organized education for wellness, recovery, performance, and longevity compounds.
          </p>
          <div className="lib-search-wrap">
            <span className="lib-search-icon">⌕</span>
            <input
              type="search"
              className="lib-search"
              placeholder="Search compounds, categories, or wellness interests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="lib-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>
      </section>

      {/* Category filters */}
      <div className="lib-filter-bar">
        <div className="container">
          <div className="lib-cats">
            <button
              type="button"
              className={`lib-cat-chip${!activeCategory ? ' active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              All ({compounds.length})
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
            <div className="empty-state" style={{ color: 'rgba(226,234,244,.55)' }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title" style={{ color: '#E2EAF4' }}>No compounds found</div>
              <p className="empty-state-desc">Try a different search term or clear your filters.</p>
              <button
                type="button"
                className="btn btn-outline"
                style={{ marginTop: 16, borderColor: 'rgba(255,255,255,.2)', color: 'rgba(226,234,244,.7)' }}
                onClick={() => { setSearch(''); setActiveCategory(null); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="lib-results-count">
                {filtered.length} compound{filtered.length !== 1 ? 's' : ''}
                {activeCategory && ` in ${activeCategory}`}
                {search && ` matching "${search}"`}
              </div>
              <div className="lib-grid">
                {filtered.map((c) => (
                  <CompoundCard key={c.id} c={c} onSelect={() => setSelected(c)} />
                ))}
              </div>
            </>
          )}

          {/* Footer disclaimer */}
          <div className="lib-page-disclaimer">
            <strong>Educational Disclaimer:</strong> {DISCLAIMER}
          </div>
        </div>
      </section>

      {/* Detail modal */}
      {selected && (
        <CompoundDetail c={selected} onClose={() => setSelected(null)} />
      )}
    </PublicLayout>
  );
}
