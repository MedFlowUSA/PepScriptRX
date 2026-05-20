-- ============================================================
-- PepScriptRX — Crypto Payment Fields
-- ============================================================

ALTER TABLE public.patient_submissions
  ADD COLUMN IF NOT EXISTS crypto_asset              text,
  ADD COLUMN IF NOT EXISTS crypto_address            text,
  ADD COLUMN IF NOT EXISTS crypto_destination_tag    text,
  ADD COLUMN IF NOT EXISTS crypto_expected_amount_usd  numeric,
  ADD COLUMN IF NOT EXISTS crypto_expected_amount_asset numeric,
  ADD COLUMN IF NOT EXISTS crypto_tx_hash            text,
  ADD COLUMN IF NOT EXISTS crypto_payment_status     text
    CHECK (crypto_payment_status IN (
      'unpaid','awaiting_confirmation','confirmed',
      'underpaid','overpaid','wrong_network','refunded'
    )),
  ADD COLUMN IF NOT EXISTS crypto_notes              text,
  ADD COLUMN IF NOT EXISTS paid_at                   timestamptz;
