import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { patientNav } from './patientNav';

const cards = [
  {
    title: 'Mixing Center',
    text: 'Beginner-friendly syringe-unit guidance, BAC water settings, and product-specific instructions.',
    to: '/mixing',
    primary: true,
  },
  {
    title: 'Product Library',
    text: 'Browse educational product guides and category explainers.',
    to: '/library',
  },
  {
    title: 'Quality Confidence',
    text: 'Review sourcing, testing, and quality policy information.',
    to: '/product-confidence',
  },
  {
    title: 'Certificates',
    text: 'Access available certificate and document links.',
    to: '/certificates',
  },
];

export default function PatientEducation() {
  return (
    <DashLayout title="Education Center" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Customer resources</div>
            <h1 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 28 }}>Simple help without the clutter</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 720 }}>
              Use these tools to reduce confusion around mixing, shipping, payment, and product education. Educational purposes only; follow your healthcare professional's instructions.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          {cards.map((card) => (
            <div className="card" key={card.title}>
              <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontWeight: 900, color: 'var(--navy)', fontSize: 18 }}>{card.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>{card.text}</div>
                <Link className={`btn ${card.primary ? 'btn-primary' : 'btn-outline'} btn-sm`} to={card.to}>
                  Open {card.title}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashLayout>
  );
}
