-- Email delivery gets a minimal log and an alert. email_log keeps only the pg_net request id, the
-- kind of notice and when it went out (no address, no names), so a cron job can match it with
-- Brevo's answer and report failures to Sentry, and email_notification can keep a daily reserve
-- for account emails. Rows are kept for 7 days.

CREATE TABLE public.email_log (
  request_id BIGINT PRIMARY KEY,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX email_log_created_at ON public.email_log (created_at);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl email_templates%ROWTYPE;
  to_email TEXT;
  group_name TEXT;
  other_name TEXT;
  api_key TEXT;
  url TEXT;
  quiet INTERVAL;
BEGIN
  quiet := CASE NEW.type
    WHEN 'wishlist' THEN INTERVAL '12 hours'
    WHEN 'draw' THEN INTERVAL '1 hour'
    ELSE INTERVAL '15 minutes'
  END;
  IF quiet > INTERVAL '0' AND EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND type = NEW.type
      AND id <> NEW.id AND created_at > NOW() - quiet
  ) THEN
    RETURN NEW;
  END IF;

  -- People can turn emails off in their account; the notification stays in the app.
  IF NOT coalesce((SELECT email_notifications FROM profiles WHERE id = NEW.user_id), TRUE) THEN
    RETURN NEW;
  END IF;

  -- Brevo's free plan sends 300 emails a day, account emails (sign-up, password) included.
  -- Past 200 notices in 24 hours the rest stay in the bell, so account emails always fit.
  IF (SELECT count(*) FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours') >= 200 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO tpl FROM email_templates WHERE name = NEW.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = NEW.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type IN ('draw', 'unveil') THEN
    -- The draw email greets the recipient; it never names their match.
    SELECT initcap(lower(full_name)) INTO other_name FROM profiles WHERE id = NEW.user_id;
  ELSIF NEW.type = 'invitation' THEN
    -- Who invited them: the organizer of the new edition.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM groups g JOIN profiles p ON p.id = g.admin_id WHERE g.id = NEW.group_id;
  ELSIF NEW.type = 'reveal' THEN
    -- The giver who chose to reveal themselves to this person.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.giver_id
    WHERE mt.group_id = NEW.group_id AND mt.receiver_id = NEW.user_id AND mt.revealed_at IS NOT NULL;
  ELSIF blind_hidden(NEW.group_id) THEN
    other_name := 'Tu amigo secreto';
  ELSE
    -- For replies and wishlist changes, the other person is the recipient's own receiver.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
    WHERE mt.group_id = NEW.group_id AND mt.giver_id = NEW.user_id;
  END IF;
  url := CASE WHEN NEW.type = 'invitation' THEN 'https://ghostswap.nvrkth.com/dashboard'
              ELSE 'https://ghostswap.nvrkth.com/groups?id=' || NEW.group_id END;

  INSERT INTO email_log (request_id, kind) VALUES (net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', 'GhostSwap', 'email', 'hello@nvrkth.com'),
      'to', jsonb_build_array(jsonb_build_object('email', to_email)),
      'subject', replace(replace(tpl.subject, '{{GROUP}}', group_name),
                         '{{NAME}}', coalesce(other_name, '')),
      'htmlContent', replace(replace(replace(tpl.html,
                       '{{GROUP}}', html_escape(group_name)),
                       '{{NAME}}', html_escape(coalesce(other_name, ''))),
                       '{{URL}}', url)
    )
  ), NEW.type);
  RETURN NEW;
END;
$function$
;

-- Sends one event to Sentry through its JSON endpoint. The DSN lives in Vault as sentry_dsn;
-- without it (local databases, CI) nothing is sent. The fingerprint carries the day, so each day
-- with trouble opens one new issue, which is what triggers the email alert.
CREATE FUNCTION public.report_to_sentry(p_kind TEXT, p_level TEXT, p_message TEXT)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dsn TEXT;
  parts TEXT[];
BEGIN
  SELECT decrypted_secret INTO dsn FROM vault.decrypted_secrets WHERE name = 'sentry_dsn';
  -- https://<key>@<host>/<project>
  parts := regexp_match(coalesce(dsn, ''), '^https://([^@]+)@([^/]+)/(\d+)$');
  IF parts IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://' || parts[2] || '/api/' || parts[3] || '/store/',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sentry-auth', 'Sentry sentry_version=7, sentry_client=ghostswap-db/1.0, sentry_key=' || parts[1]),
    body := jsonb_build_object(
      'platform', 'other',
      'logger', 'database',
      'level', p_level,
      'message', jsonb_build_object('formatted', p_message),
      'fingerprint', jsonb_build_array(p_kind, to_char(NOW() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')),
      'tags', jsonb_build_object('source', p_kind)
    )
  );
END;
$function$
;

-- Every 15 minutes: matches sent notices with Brevo's answers (pg_net keeps them for 6 hours),
-- reports failures, warns when the daily reserve kicks in, and drops log rows older than a week.
CREATE FUNCTION public.check_email_delivery()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  failed INT;
  detail TEXT;
  sent_today INT;
BEGIN
  SELECT count(*),
         string_agg(DISTINCT coalesce(r.status_code::TEXT, 'sin respuesta') || ' ' ||
           regexp_replace(left(coalesce(r.error_msg, r.content::TEXT, ''), 160),
                          '[^\s@"]+@[^\s@"]+', '[correo]', 'g'), ' | ')
  INTO failed, detail
  FROM email_log l JOIN net._http_response r ON r.id = l.request_id
  WHERE NOT l.checked AND (r.timed_out OR r.error_msg IS NOT NULL OR r.status_code >= 300);

  UPDATE email_log l SET checked = TRUE
  WHERE NOT l.checked
    AND (EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id)
         OR l.created_at < NOW() - INTERVAL '6 hours');

  IF failed > 0 THEN
    PERFORM report_to_sentry('email-failure', 'error',
      'Brevo rechazó ' || failed || ' correo(s) de aviso: ' || detail);
  END IF;

  SELECT count(*) INTO sent_today FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours';
  IF sent_today >= 200 THEN
    PERFORM report_to_sentry('email-reserve', 'warning',
      'Se enviaron ' || sent_today || ' avisos en 24 horas: los siguientes quedan solo en la campanita hasta que baje.');
  END IF;

  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$
;

REVOKE ALL ON FUNCTION public.report_to_sentry(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_email_delivery() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('ghostswap-email-check', '*/15 * * * *', 'SELECT public.check_email_delivery()');
