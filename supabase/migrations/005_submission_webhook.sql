-- ============================================================
-- PepScriptRX — Email notification trigger on new submissions
-- Calls the notify-new-submission Edge Function via pg_net
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_new_submission_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://ubfruugzofftwlomkqcl.supabase.co/functions/v1/notify-new-submission',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('record', row_to_json(NEW))::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_submissions_notify ON public.patient_submissions;
CREATE TRIGGER patient_submissions_notify
  AFTER INSERT ON public.patient_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_submission_webhook();
