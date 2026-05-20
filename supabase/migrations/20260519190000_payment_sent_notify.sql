-- Fire the notify-payment-sent edge function whenever a submission's status
-- transitions TO 'payment_sent' for the first time.

CREATE OR REPLACE FUNCTION public.notify_payment_sent_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only trigger on the transition to payment_sent
  IF NEW.status = 'payment_sent' AND (OLD.status IS DISTINCT FROM 'payment_sent') THEN
    PERFORM net.http_post(
      url     := 'https://ubfruugzofftwlomkqcl.supabase.co/functions/v1/notify-payment-sent',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object('record', row_to_json(NEW))::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_submissions_payment_sent_notify ON public.patient_submissions;
CREATE TRIGGER patient_submissions_payment_sent_notify
  AFTER UPDATE ON public.patient_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_sent_webhook();
