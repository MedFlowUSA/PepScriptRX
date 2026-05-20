-- Public RPC so patients can submit their crypto TX hash without logging in.
-- Only updates if the order is in payment_sent and not yet confirmed.

create or replace function public.submit_crypto_tx_hash(
  p_submission_id uuid,
  p_tx_hash       text,
  p_asset         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.patient_submissions
  set
    crypto_tx_hash        = trim(p_tx_hash),
    crypto_asset          = p_asset,
    crypto_payment_status = 'awaiting_confirmation',
    updated_at            = now()
  where id = p_submission_id
    and status = 'payment_sent'
    and (crypto_payment_status is null
         or crypto_payment_status in ('unpaid', 'awaiting_confirmation'));
end;
$$;

grant execute on function public.submit_crypto_tx_hash(uuid, text, text) to anon, authenticated;
