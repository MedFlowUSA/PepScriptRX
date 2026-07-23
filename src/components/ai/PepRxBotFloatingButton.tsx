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
        aria-label="Open Help Center and Q&A"
      >
        <img src={PEPRXBOT_IMAGE} alt="" aria-hidden="true" />
        <span>Help & Q&A</span>
      </button>
      <PepRxBotModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
