const promoImages = [
  {
    src: '/marketing/pepscript-promo-1.png',
    alt: 'PepScriptRX peptide refill savings promotional image',
  },
  {
    src: '/marketing/pepscript-promo-2.png',
    alt: 'PepScriptRX premium peptides promotional image',
  },
  {
    src: '/marketing/pepscript-promo-3.png',
    alt: 'PepScriptRX wellness results promotional image',
  },
  {
    src: '/marketing/pepscript-promo-4.png',
    alt: 'PepScriptRX prescription refill discount promotional image',
  },
  {
    src: '/marketing/pepscript-promo-5.png',
    alt: 'PepScriptRX weight management refill promotional image',
  },
];

export default function MarketingImageScatter() {
  return (
    <section className="marketing-scatter" aria-label="PepScriptRX promotions">
      <div className="container">
        <div className="marketing-scatter-header">
          <p className="text-teal font-semibold text-sm">PepScriptRX campaigns</p>
          <h2 className="section-title">Receipt-first savings campaigns.</h2>
        </div>
        <div className="marketing-scatter-grid">
          {promoImages.map((image) => (
            <figure className="marketing-scatter-card" key={image.src}>
              <img src={image.src} alt={image.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
