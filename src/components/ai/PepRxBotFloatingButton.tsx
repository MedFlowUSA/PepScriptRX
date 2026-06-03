import { useState } from 'react';
import { PEPRXBOT_IMAGE } from '../../lib/peprxbotRules';
import PepRxBotModal from './PepRxBotModal';

export default function PepRxBotFloatingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="peprxbot-float"
        onClick={() => setOpen(true)}
        aria-label="Ask PEPRXbot"
      >
        <img src={PEPRXBOT_IMAGE} alt="" aria-hidden="true" />
        <span>Ask PEPRXbot</span>
      </button>
      <PepRxBotModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
