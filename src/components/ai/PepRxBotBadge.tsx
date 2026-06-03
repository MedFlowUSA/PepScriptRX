import { useState } from 'react';
import { PEPRXBOT_IMAGE, PEPRXBOT_SHORT_DISCLAIMER, type PepRxBotTopic } from '../../lib/peprxbotRules';
import PepRxBotModal from './PepRxBotModal';

type PepRxBotBadgeProps = {
  title?: string;
  body?: string;
  context?: PepRxBotTopic;
  compact?: boolean;
  variant?: 'card' | 'section' | 'inline';
  secondaryHref?: string;
};

export default function PepRxBotBadge({
  title = 'PEPRXbot',
  body = 'Need help choosing products, understanding supplies, uploading receipts, or using the mixing calculator? PEPRXbot can guide you step by step.',
  context = 'shopping',
  compact = false,
  variant = 'card',
  secondaryHref,
}: PepRxBotBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`peprxbot-badge ${variant}${compact ? ' compact' : ''}`}>
        <img src={PEPRXBOT_IMAGE} alt="PEPRXbot" />
        <div className="peprxbot-badge-copy">
          <strong>{title}</strong>
          <span>Your AI Shopping &amp; Mixing Assistant</span>
          {!compact && <p>{body}</p>}
          <small>{PEPRXBOT_SHORT_DISCLAIMER}</small>
        </div>
        <div className="peprxbot-badge-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            Ask PEPRXbot
          </button>
          {secondaryHref && (
            <a href={secondaryHref} className="btn btn-outline btn-sm">
              Need help mixing?
            </a>
          )}
        </div>
      </div>
      <PepRxBotModal open={open} onClose={() => setOpen(false)} initialTopic={context} />
    </>
  );
}
