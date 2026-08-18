alter table public.aactivated_agreements
  add column if not exists company_signed_by uuid,
  add column if not exists company_signer_name text,
  add column if not exists company_signature_text text,
  add column if not exists company_signed_at timestamptz;

comment on column public.aactivated_agreements.company_signed_by is
  'Authorized PepScriptRX or AACTIVATEDRX administrator who electronically signed for the company.';

