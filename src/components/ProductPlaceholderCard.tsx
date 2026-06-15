import type { CSSProperties } from 'react';

type ProductPlaceholderCardProps = {
  brand?: string;
  category: string;
  productName: string;
  strength?: string;
  priceLabel?: string;
  savingsLabel?: string;
  statusLabel?: string;
  ctaLabel?: string;
  compact?: boolean;
  style?: CSSProperties;
};

const navy = '#061b3a';
const teal = '#0baec4';

export default function ProductPlaceholderCard({
  brand = 'PepScriptRX',
  category,
  productName,
  strength,
  priceLabel,
  savingsLabel,
  statusLabel,
  ctaLabel = 'View Product',
  compact = false,
  style,
}: ProductPlaceholderCardProps) {
  const safeStrength = strength && strength !== 'Standard' ? strength : 'Strength / Size';
  const safePrice = priceLabel || '$---';
  const safeStatus = statusLabel || 'Status';
  const brandParts = brand.match(/^(.*?)(RX)$/i);
  const brandLead = brandParts?.[1] || brand.replace(/rx$/i, '');
  const brandRx = brandParts?.[2] || 'RX';

  if (compact) {
    return (
      <div
        aria-label={`${productName} placeholder product card`}
        style={{
          width: 88,
          height: 88,
          maxWidth: '100%',
          aspectRatio: '1',
          borderRadius: 9,
          border: '1px solid rgba(11, 174, 196, .45)',
          background:
            'radial-gradient(circle at 82% 22%, rgba(11,174,196,.16), transparent 34%), linear-gradient(145deg, #ffffff 0%, #f7fbfd 65%, #edf8fb 100%)',
          boxShadow: '0 8px 18px rgba(6,27,58,.10), inset 0 0 0 1px rgba(255,255,255,.72)',
          color: navy,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 26px',
          gap: 4,
          overflow: 'hidden',
          padding: 6,
          position: 'relative',
          ...style,
        }}
      >
        <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `1px solid ${teal}`,
                display: 'grid',
                flexShrink: 0,
                fontSize: 6,
                fontWeight: 950,
                placeItems: 'center',
              }}
            >
              Rx
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {brandLead}
              <span style={{ color: teal }}>{brandRx}</span>
            </span>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 950,
              lineHeight: 1.08,
              marginTop: 5,
              maxHeight: 22,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {productName}
          </div>
          <div
            style={{
              color: '#667085',
              fontSize: 7,
              fontWeight: 780,
              lineHeight: 1.1,
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {safeStrength}
          </div>
          <div style={{ color: navy, fontSize: 14, fontWeight: 950, lineHeight: 1, marginTop: 5 }}>
            {safePrice}
          </div>
          <div
            style={{
              color: '#03667a',
              fontSize: 6,
              fontWeight: 850,
              lineHeight: 1.1,
              marginTop: 2,
              maxHeight: 13,
              overflow: 'hidden',
            }}
          >
            {savingsLabel || safeStatus}
          </div>
        </div>

        <div aria-hidden="true" style={{ position: 'relative', zIndex: 0 }}>
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 5,
              width: 24,
              height: 51,
              borderRadius: 5,
              border: '1px solid rgba(6,27,58,.2)',
              background: 'linear-gradient(90deg, #f4f7f9, #fff 46%, #e8eef2)',
              boxShadow: '5px 7px 12px rgba(6,27,58,.12)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 13,
              bottom: 8,
              width: 22,
              height: 46,
              borderRadius: 10,
              border: '1px solid rgba(6,27,58,.28)',
              background: 'linear-gradient(90deg, rgba(255,255,255,.9), rgba(230,246,250,.68), rgba(255,255,255,.94))',
              boxShadow: '0 7px 12px rgba(6,27,58,.13)',
            }}
          >
            <div style={{ height: 5, width: '74%', margin: '0 auto', borderRadius: 99, background: teal }} />
            <div style={{ color: navy, fontSize: 13, fontWeight: 950, marginTop: 12, textAlign: 'center' }}>
              R<span style={{ color: teal }}>x</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label={`${productName} placeholder product card`}
      style={{
        width: compact ? 148 : 280,
        maxWidth: '100%',
        aspectRatio: compact ? '0.78' : '0.76',
        borderRadius: compact ? 10 : 18,
        border: `1px solid rgba(11, 174, 196, ${compact ? 0.42 : 0.52})`,
        background:
          'radial-gradient(circle at 82% 24%, rgba(11,174,196,.13), transparent 28%), linear-gradient(145deg, #ffffff 0%, #f7fbfd 62%, #edf8fb 100%)',
        boxShadow: compact
          ? '0 8px 18px rgba(6,27,58,.10), inset 0 0 0 1px rgba(255,255,255,.7)'
          : '0 18px 36px rgba(6,27,58,.16), inset 0 0 0 1px rgba(255,255,255,.74)',
        color: navy,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: compact ? 10 : 20,
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 10, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            width: compact ? 24 : 42,
            height: compact ? 24 : 42,
            borderRadius: '50%',
            border: `1px solid ${teal}`,
            display: 'grid',
            placeItems: 'center',
            color: navy,
            fontSize: compact ? 10 : 17,
            fontWeight: 950,
            background: 'rgba(255,255,255,.82)',
            flexShrink: 0,
          }}
        >
          Rx
        </div>
        <div
          style={{
            fontSize: compact ? 13 : 24,
            fontWeight: 850,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {brandLead}
          <span style={{ color: teal }}>{brandRx}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: compact ? 8 : 16, marginTop: compact ? 10 : 22, minHeight: 0 }}>
        <div style={{ flex: '1 1 58%', minWidth: 0, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: compact ? 18 : 28,
                height: compact ? 18 : 28,
                borderRadius: '50%',
                border: `1px solid rgba(11,174,196,.65)`,
                background: '#fff',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: navy,
                fontSize: compact ? 8 : 14,
                fontWeight: 800,
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: compact ? 'nowrap' : 'normal',
              }}
            >
              {category}
            </span>
          </div>

          <div
            style={{
              color: navy,
              fontSize: compact ? 15 : 34,
              fontWeight: 950,
              lineHeight: compact ? 1.04 : 0.96,
              marginTop: compact ? 8 : 18,
              overflowWrap: 'anywhere',
            }}
          >
            {productName}
          </div>

          <div
            style={{
              color: '#667085',
              fontSize: compact ? 9 : 17,
              fontWeight: 760,
              lineHeight: 1.15,
              marginTop: compact ? 5 : 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {safeStrength}
          </div>

          <div
            style={{
              color: navy,
              fontSize: compact ? 18 : 42,
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 1,
              marginTop: compact ? 7 : 16,
            }}
          >
            {safePrice}
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            alignSelf: 'stretch',
            flex: '0 0 36%',
            minWidth: compact ? 46 : 86,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: compact ? 0 : 3,
              bottom: compact ? 17 : 28,
              width: compact ? 42 : 78,
              height: compact ? 78 : 142,
              borderRadius: compact ? 5 : 8,
              border: '1px solid rgba(6,27,58,.22)',
              background: 'linear-gradient(90deg, #f4f7f9, #fff 46%, #e8eef2)',
              boxShadow: '10px 14px 24px rgba(6,27,58,.14)',
            }}
          >
            <div
              style={{
                color: navy,
                fontSize: compact ? 17 : 34,
                fontWeight: 950,
                marginTop: compact ? 12 : 30,
                textAlign: 'center',
              }}
            >
              R<span style={{ color: teal }}>x</span>
            </div>
            <div
              style={{
                color: navy,
                fontSize: compact ? 5 : 10,
                fontWeight: 850,
                textAlign: 'center',
              }}
            >
              {brand.toUpperCase()}
            </div>
            <div style={{ height: compact ? 3 : 5, background: teal, bottom: compact ? 8 : 15, left: 0, right: 0, position: 'absolute' }} />
          </div>
          <div
            style={{
              position: 'absolute',
              right: compact ? 26 : 48,
              bottom: compact ? 20 : 34,
              width: compact ? 34 : 64,
              height: compact ? 68 : 126,
              borderRadius: compact ? 12 : 22,
              border: '1px solid rgba(6,27,58,.32)',
              background:
                'linear-gradient(90deg, rgba(255,255,255,.88), rgba(230,246,250,.64) 48%, rgba(255,255,255,.92))',
              boxShadow: '0 10px 20px rgba(6,27,58,.16)',
            }}
          >
            <div style={{ height: compact ? 7 : 12, width: '74%', margin: '0 auto', borderRadius: 99, background: teal }} />
            <div
              style={{
                color: navy,
                fontSize: compact ? 18 : 35,
                fontWeight: 950,
                marginTop: compact ? 15 : 32,
                textAlign: 'center',
              }}
            >
              R<span style={{ color: teal }}>x</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: compact ? 5 : 9, marginTop: compact ? 6 : 12, zIndex: 1 }}>
        <div
          style={{
            color: navy,
            fontSize: compact ? 8 : 14,
            fontWeight: 800,
            lineHeight: 1.15,
            minHeight: compact ? 18 : 22,
            overflow: 'hidden',
          }}
        >
          <span style={{ color: teal }}>{savingsLabel ? 'Info' : 'Status'}</span>
          {' - '}
          {savingsLabel || safeStatus}
        </div>
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(180deg, #08b8cb, #006f88)',
            borderRadius: compact ? 9 : 18,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.52), 0 8px 16px rgba(6,27,58,.18)',
            color: '#fff',
            display: 'flex',
            fontSize: compact ? 9 : 21,
            fontWeight: 950,
            gap: compact ? 5 : 11,
            justifyContent: 'center',
            minHeight: compact ? 25 : 52,
            padding: compact ? '5px 7px' : '10px 14px',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,.74)',
              borderRadius: '50%',
              display: 'flex',
              flexShrink: 0,
              fontSize: compact ? 12 : 22,
              height: compact ? 18 : 34,
              justifyContent: 'center',
              width: compact ? 18 : 34,
            }}
          >
            {'>'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctaLabel}</span>
        </div>
      </div>
    </div>
  );
}
