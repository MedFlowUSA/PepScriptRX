import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ReferralAgreement {
  id: string; account_id: string; version: number; revision: number;
  status: 'draft' | 'issued' | 'partner_signed' | 'signed' | 'void';
  company_name: string; payout_schedule: string; termination_terms: string; contact_email: string;
  terms: string; terms_hash: string | null; reviewed_at: string | null; reviewed_by: string | null;
  partner_signature: string | null; partner_consent: string | null; partner_user_id: string | null; partner_signed_at: string | null;
  company_signature: string | null; company_consent: string | null; company_user_id: string | null; company_signed_at: string | null;
}

export const electronicConsent = 'I have read this version, can access and retain it, consent to electronic records and signatures, and intend my typed name to be my signature.';

/** Render the retained database record, including the digest of the exact text signed. */
export async function agreementPdf(a: ReferralAgreement): Promise<Uint8Array> {
  if (a.terms_hash) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.terms));
    const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== a.terms_hash) throw new Error('Agreement text integrity check failed. Reload the retained record.');
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Private Referral Agreement - Version ${a.version}`);
  pdf.setSubject(`Agreement ${a.id}`);
  pdf.setProducer('PepScriptRX');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([612, 792]);
  let y = 746;
  const text = `${a.status === 'signed' ? 'SIGNED AGREEMENT' : `NOT FULLY SIGNED - ${a.status.toUpperCase()}`}\nAgreement ID: ${a.id}\n\n${a.terms}\n\nSIGNING RECORD\nText SHA-256: ${a.terms_hash ?? 'Draft; not issued'}\nAdmin review: ${a.reviewed_at ?? 'Pending'}\nReviewer: ${a.reviewed_by ?? 'Pending'}\n\nReferrer signature: ${a.partner_signature ?? 'Pending'}\nVerified signer account: ${a.partner_user_id ?? 'Pending'}\nSigned at (UTC): ${a.partner_signed_at ?? 'Pending'}\n\nCompany signature: ${a.company_signature ?? 'Pending'}\nAuthorized signer account: ${a.company_user_id ?? 'Pending'}\nSigned at (UTC): ${a.company_signed_at ?? 'Pending'}\n\nConsent recorded with each signature: ${electronicConsent}\nCompany signer also confirms authority to bind the Company.\nAudit records are retained by PepScriptRX under this agreement ID.`;
  function line(value: string) {
    if (y < 48) { page = pdf.addPage([612, 792]); y = 746; }
    page.drawText(value, { x: 44, y, size: 10, font, color: rgb(0.1, 0.12, 0.16) });
    y -= 14;
  }
  for (const paragraph of text.split('\n')) {
    let current = '';
    // Split long unbroken evidence (e.g. hashes) without dropping characters.
    for (const char of paragraph) {
      if (font.widthOfTextAtSize(current + char, 10) > 524) { line(current); current = ''; }
      current += char;
    }
    line(current);
  }
  for (const [i, p] of pdf.getPages().entries()) p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: 540, y: 24, size: 8, font });
  return pdf.save();
}

export async function downloadAgreement(a: ReferralAgreement) {
  const bytes = await agreementPdf(a);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url; link.download = `referral-agreement-v${a.version}-${a.status}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
