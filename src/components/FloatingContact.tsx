import { useState } from 'react';
import { PHONE_DISPLAY, PHONE_HREF, EMAIL_SUPPORT } from '../config';

export default function FloatingContact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="float-contact">
      {open && (
        <div className="float-contact-menu">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, paddingLeft: 4 }}>
            Contact Us
          </div>
          <a href={PHONE_HREF} className="float-contact-option">
            <span className="float-contact-option-icon">📞</span>
            <div>
              <div>Call Us</div>
              <div className="float-contact-label">{PHONE_DISPLAY} — AI Line, 24/7</div>
            </div>
          </a>
          <a href={`sms:${PHONE_HREF.replace('tel:', '')}`} className="float-contact-option">
            <span className="float-contact-option-icon">💬</span>
            <div>
              <div>Text Us</div>
              <div className="float-contact-label">{PHONE_DISPLAY}</div>
            </div>
          </a>
          <a href={`mailto:${EMAIL_SUPPORT}`} className="float-contact-option">
            <span className="float-contact-option-icon">✉️</span>
            <div>
              <div>Email Us</div>
              <div className="float-contact-label">{EMAIL_SUPPORT}</div>
            </div>
          </a>
        </div>
      )}
      <button
        className="float-contact-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close contact menu' : 'Contact us'}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
