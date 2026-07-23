import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { EMAIL_SUPPORT, PHONE_DISPLAY, PHONE_HREF } from '../../config';
import {
  PEPRXBOT_DISCLAIMER,
  PEPRXBOT_IMAGE,
  PEPRXBOT_OPENING_MESSAGE,
  PEPRXBOT_QUICK_ACTIONS,
  PEPRXBOT_TOPIC_ANSWERS,
  type PepRxBotTopic,
} from '../../lib/peprxbotRules';
import { PEPRXBOT_FAQ_CATEGORIES } from '../../lib/peprxbotFaq';

type PepRxBotModalProps = {
  open: boolean;
  onClose: () => void;
  initialTopic?: PepRxBotTopic;
};

export default function PepRxBotModal({ open, onClose, initialTopic = 'shopping' }: PepRxBotModalProps) {
  const [topic, setTopic] = useState<PepRxBotTopic>(initialTopic);
  const [query, setQuery] = useState('');
  const answer = PEPRXBOT_TOPIC_ANSWERS[topic];
  const faqs = useMemo(() => PEPRXBOT_FAQ_CATEGORIES.flatMap((category) => category.items).filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query]);

  if (!open) return null;

  return (
    <div className="peprxbot-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="peprxbot-modal-title">
      <div className="peprxbot-modal">
        <div className="peprxbot-modal-head">
          <img src={PEPRXBOT_IMAGE} alt="PEPRXbot" />
          <div>
            <div className="peprxbot-kicker">Support in one place</div>
            <h2 id="peprxbot-modal-title">Help Center & Q&A</h2>
          </div>
          <button type="button" className="peprxbot-close" onClick={onClose} aria-label="Close PEPRXbot">
            x
          </button>
        </div>

        <p className="peprxbot-opening">{PEPRXBOT_OPENING_MESSAGE}</p>

        <label className="peprxbot-search"><span className="sr-only">Search questions and answers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help questions..." /></label>

        <div className="peprxbot-quick-grid">
          {PEPRXBOT_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className={topic === action.id ? 'active' : ''}
              onClick={() => setTopic(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="peprxbot-answer">
          <div className="peprxbot-kicker">Current guide</div>
          <h3>{answer.title}</h3>
          <p>{answer.answer}</p>
          {answer.href && answer.cta && (
            <Link to={answer.href} className="btn btn-primary btn-sm" onClick={onClose}>
              {answer.cta}
            </Link>
          )}
        </div>

        <div className="peprxbot-faq-strip">
          {faqs.map((item) => (
            <button
              key={item.question}
              type="button"
              onClick={() => setTopic(questionToTopic(item.question))}
              title={item.answer}
            >
              {item.question}
            </button>
          ))}
        </div>

        <div className="peprxbot-support-actions"><Link to="/help" className="btn btn-primary btn-sm" onClick={onClose}>Open full Help Center</Link><a href={PHONE_HREF}>Call {PHONE_DISPLAY}</a><a href={`mailto:${EMAIL_SUPPORT}`}>Email a person</a></div>

        <div className="peprxbot-modal-foot">{PEPRXBOT_DISCLAIMER}</div>
      </div>
    </div>
  );
}

function questionToTopic(question: string): PepRxBotTopic {
  const value = question.toLowerCase();
  if (value.includes('mix') || value.includes('dose') || value.includes('bac water')) return 'mixing';
  if (value.includes('receipt') || value.includes('upload')) return 'receipt';
  if (value.includes('checkout') || value.includes('zelle') || value.includes('venmo') || value.includes('order')) return 'checkout';
  if (value.includes('coa') || value.includes('certificate') || value.includes('quality')) return 'quality';
  if (value.includes('portal') || value.includes('rep')) return 'portal';
  if (value.includes('ship') || value.includes('support')) return 'support';
  if (value.includes('difference') || value.includes('take') || value.includes('weight')) return 'compare';
  return 'shopping';
}
