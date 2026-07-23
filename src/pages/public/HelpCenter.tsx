import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { EMAIL_SUPPORT, PHONE_DISPLAY, PHONE_HREF } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { PEPRXBOT_FAQ_CATEGORIES } from '../../lib/peprxbotFaq';
import { usePageMeta } from '../../hooks/usePageMeta';

const HELP_TOPICS = [
  { title: 'Order status', body: 'See review, payment, fulfillment, shipping, and delivery updates.', to: '/patient', signedIn: true },
  { title: 'Receipt uploads', body: 'Review supported formats, size limits, and discount-review expectations.', to: '/start' },
  { title: 'Mixing Calculator', body: 'Perform arithmetic using values from written provider or pharmacy instructions.', to: '/mixing' },
  { title: 'Find a product', body: 'Search educational catalog listings by product name and strength.', to: '/library' },
  { title: 'Account access', body: 'Sign in, create a patient account, or reset your password.', to: '/login' },
  { title: 'Notifications', body: 'Review order events, exceptions, delivery updates, and refill reminders.', to: '/patient/notifications', signedIn: true },
];

export default function HelpCenter() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  usePageMeta('PepScriptRX Help Center & Q&A', 'Order help, receipt uploads, Mixing Calculator, account assistance, support contacts, and searchable questions and answers.');
  const matches = useMemo(() => PEPRXBOT_FAQ_CATEGORIES.flatMap((group) => group.items.map((item) => ({ ...item, category: group.category }))).filter((item) => {
    const categoryMatch = category === 'All' || item.category === category;
    const text = `${item.question} ${item.answer} ${item.category}`.toLowerCase();
    return categoryMatch && text.includes(query.trim().toLowerCase());
  }), [category, query]);

  return <PublicLayout>
    <main className="help-center-page"><div className="container container-md">
      <header className="help-center-hero"><div className="precisionmix-kicker">One place for support</div><h1>Help Center & Q&A</h1><p>Find the next step, search common questions, or reach a person when self-service is not enough.</p>
        <label className="help-search"><span className="sr-only">Search help questions</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders, receipts, payment, shipping, mixing..." /></label>
      </header>
      <section className="help-topic-grid" aria-label="Help topics">{HELP_TOPICS.filter((topic) => !topic.signedIn || user).map((topic) => <Link key={topic.title} to={topic.to} className="help-topic-card"><strong>{topic.title}</strong><p>{topic.body}</p><span>Open →</span></Link>)}</section>
      <section className="help-qa" aria-labelledby="help-qa-title"><div className="help-section-head"><div><div className="precisionmix-kicker">Questions and answers</div><h2 id="help-qa-title">Common questions</h2></div><select aria-label="Filter questions by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{PEPRXBOT_FAQ_CATEGORIES.map((group) => <option key={group.category}>{group.category}</option>)}</select></div>
        <div className="help-qa-list">{matches.length ? matches.map((item) => <details key={`${item.category}:${item.question}`}><summary>{item.question}<small>{item.category}</small></summary><p>{item.answer}</p></details>) : <div className="empty-state"><div className="empty-state-title">No matching questions</div><div className="empty-state-desc">Try a broader phrase or contact support below.</div></div>}</div>
      </section>
      <section className="help-human" aria-labelledby="human-support-title"><div><div className="precisionmix-kicker">Human escalation</div><h2 id="human-support-title">Still need help?</h2><p>Include your order reference, but do not send passwords, payment credentials, or unnecessary medical information by ordinary email or text.</p></div><div className="help-human-actions"><a className="btn btn-primary" href={PHONE_HREF}>Call {PHONE_DISPLAY}</a><a className="btn btn-outline" href={`sms:${PHONE_HREF.replace('tel:', '')}`}>Text support</a><a className="btn btn-outline" href={`mailto:${EMAIL_SUPPORT}?subject=PepScriptRX support request`}>Email support</a></div></section>
    </div></main>
  </PublicLayout>;
}
