-- Amazon SES as the backup for essential emails (Kath, 17-nov-2026). Brevo stays first, because
-- its 300 a day are free; SES is paid per email (credits first), so it is used only when Brevo
-- failed that email or the Brevo day is full. Everyday notices never use SES.
--
-- The database signs the SES request itself (AWS Signature Version 4 with pgcrypto), so there is
-- no relay in between. SES is on only when its key is in Vault (ses_access_key_id and
-- ses_secret_access_key); without it everything behaves as before.

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'brevo';
ALTER TABLE public.email_pending ADD COLUMN IF NOT EXISTS last_provider text;

-- Signature V4 headers for a JSON POST. Pure: same inputs, same headers (the tests rely on it).
CREATE OR REPLACE FUNCTION public.aws_sigv4_headers(
  p_key_id text, p_secret text, p_region text, p_service text,
  p_host text, p_path text, p_payload text, p_at timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  amz text := to_char(p_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
  day text := left(amz, 8);
  scope text := day || '/' || p_region || '/' || p_service || '/aws4_request';
  signed text := 'content-type;host;x-amz-date';
  creq text;
  k bytea;
BEGIN
  creq := 'POST' || E'\n' || p_path || E'\n' || E'\n'
       || 'content-type:application/json' || E'\n'
       || 'host:' || p_host || E'\n'
       || 'x-amz-date:' || amz || E'\n' || E'\n'
       || signed || E'\n'
       || encode(extensions.digest(convert_to(p_payload, 'UTF8'), 'sha256'), 'hex');
  k := extensions.hmac(convert_to(day, 'UTF8'), convert_to('AWS4' || p_secret, 'UTF8'), 'sha256');
  k := extensions.hmac(convert_to(p_region, 'UTF8'), k, 'sha256');
  k := extensions.hmac(convert_to(p_service, 'UTF8'), k, 'sha256');
  k := extensions.hmac(convert_to('aws4_request', 'UTF8'), k, 'sha256');
  RETURN jsonb_build_object(
    'content-type', 'application/json',
    'x-amz-date', amz,
    'authorization', 'AWS4-HMAC-SHA256 Credential=' || p_key_id || '/' || scope
      || ', SignedHeaders=' || signed || ', Signature='
      || encode(extensions.hmac(convert_to(
           'AWS4-HMAC-SHA256' || E'\n' || amz || E'\n' || scope || E'\n'
           || encode(extensions.digest(convert_to(creq, 'UTF8'), 'sha256'), 'hex'),
           'UTF8'), k, 'sha256'), 'hex'));
END;
$function$;
REVOKE ALL ON FUNCTION public.aws_sigv4_headers(text, text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ses_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*) = 2 FROM vault.decrypted_secrets
  WHERE name IN ('ses_access_key_id', 'ses_secret_access_key') AND decrypted_secret <> ''
$function$;
REVOKE ALL ON FUNCTION public.ses_ready() FROM PUBLIC, anon, authenticated;

-- What counts against Brevo's free day: Brevo attempts it didn't refuse.
CREATE OR REPLACE FUNCTION public.emails_sent_today()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM email_log l
  WHERE l.created_at > now() - interval '24 hours' AND l.provider = 'brevo'
    AND NOT EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id
                    AND (r.timed_out OR r.error_msg IS NOT NULL
                         OR coalesce(r.status_code, 0) NOT BETWEEN 200 AND 299))
$function$;
REVOKE ALL ON FUNCTION public.emails_sent_today() FROM PUBLIC, anon, authenticated;

-- SES attempts in 24 hours, failed ones included: a ceiling on spending, not a quota.
CREATE OR REPLACE FUNCTION public.ses_sent_today()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM email_log
  WHERE created_at > now() - interval '24 hours' AND provider = 'ses'
$function$;
REVOKE ALL ON FUNCTION public.ses_sent_today() FROM PUBLIC, anon, authenticated;

-- One signature per provider: drop the old one so calls stay unambiguous.
DROP FUNCTION IF EXISTS public.send_notification_email(uuid);

-- Builds and sends the email for one notification through Brevo or SES. Returns the request id,
-- or NULL when it can't (no template, key or address).
CREATE OR REPLACE FUNCTION public.send_notification_email(p_notification uuid, p_provider text DEFAULT 'brevo')
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n notifications%ROWTYPE;
  rid bigint;
  tpl email_templates%ROWTYPE;
  to_email TEXT;
  group_name TEXT;
  other_name TEXT;
  api_key TEXT;
  key_id TEXT;
  url TEXT;
  organizer UUID;
  subj TEXT;
  html TEXT;
  payload jsonb;
BEGIN
  SELECT * INTO n FROM notifications WHERE id = p_notification;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  organizer := (SELECT admin_id FROM groups WHERE id = n.group_id);
  SELECT * INTO tpl FROM email_templates WHERE name = n.type;
  IF p_provider = 'ses' THEN
    SELECT decrypted_secret INTO key_id FROM vault.decrypted_secrets WHERE name = 'ses_access_key_id';
    SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'ses_secret_access_key';
  ELSE
    SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  END IF;
  SELECT email INTO to_email FROM auth.users WHERE id = n.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL OR (p_provider = 'ses' AND key_id IS NULL) THEN
    RETURN NULL;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = n.group_id;
  IF n.type IN ('draw', 'unveil', 'remind_soon', 'remind_soon_list', 'remind_list') THEN
    -- The draw email greets the recipient; it never names their match.
    SELECT initcap(lower(full_name)) INTO other_name FROM profiles WHERE id = n.user_id;
  ELSIF n.type = 'invitation' THEN
    -- Who invited them: the organizer of the new edition.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM groups g JOIN profiles p ON p.id = g.admin_id WHERE g.id = n.group_id;
  ELSIF n.type = 'reveal' THEN
    -- The giver who chose to reveal themselves to this person.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.giver_id
    WHERE mt.group_id = n.group_id AND mt.receiver_id = n.user_id AND mt.revealed_at IS NOT NULL;
  ELSIF blind_hidden(n.group_id) THEN
    other_name := 'Tu amigo secreto';
  ELSE
    -- For replies and wishlist changes, the other person is the recipient's own receiver.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
    WHERE mt.group_id = n.group_id AND mt.giver_id = n.user_id;
  END IF;
  -- Names are data, never template: a group or a person called "{{NAME}}" must stay as written.
  -- Every brace followed by another gets a space, so no run of braces can rebuild "{{".
  group_name := regexp_replace(group_name, '\{(?=\{)', '{ ', 'g');
  other_name := regexp_replace(other_name, '\{(?=\{)', '{ ', 'g');
  url := CASE WHEN n.type = 'invitation' THEN 'https://fantomio.com/dashboard'
              ELSE 'https://fantomio.com/groups?id=' || n.group_id END;
  subj := replace(replace(tpl.subject, '{{GROUP}}', group_name), '{{NAME}}', coalesce(other_name, ''));
  html := replace(replace(replace(tpl.html,
            '{{GROUP}}', html_escape(group_name)),
            '{{NAME}}', html_escape(coalesce(other_name, ''))),
            '{{URL}}', url);

  IF p_provider = 'ses' THEN
    -- Only essential emails come this way, and they carry no List-Unsubscribe.
    payload := jsonb_build_object(
      'FromEmailAddress', 'Fantomio <hola@fantomio.com>',
      'Destination', jsonb_build_object('ToAddresses', jsonb_build_array(to_email)),
      'Content', jsonb_build_object('Simple', jsonb_build_object(
        'Subject', jsonb_build_object('Data', subj, 'Charset', 'UTF-8'),
        'Body', jsonb_build_object('Html', jsonb_build_object('Data', html, 'Charset', 'UTF-8'))))
    );
    -- pg_net sends body::text, so that exact text is what gets signed.
    rid := net.http_post(
      url := 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails',
      timeout_milliseconds := 20000,
      headers := aws_sigv4_headers(key_id, api_key, 'us-east-1', 'ses',
                   'email.us-east-1.amazonaws.com', '/v2/email/outbound-emails',
                   payload::text, clock_timestamp()),
      body := payload
    );
  ELSE
    rid := net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      timeout_milliseconds := 20000,
      headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json'),
      body := jsonb_build_object(
        'sender', jsonb_build_object('name', 'Fantomio', 'email', 'hola@fantomio.com'),
        'to', jsonb_build_array(jsonb_build_object('email', to_email)),
        -- Mail providers show their own "unsubscribe" with this; it leads to the switch that turns
        -- these notices off. Account emails (sign-up, password) never carry it.
        'headers', CASE WHEN n.type IN ('draw', 'unveil', 'invitation') THEN '{}'::jsonb
                    ELSE jsonb_build_object('List-Unsubscribe', '<https://fantomio.com/account#preferencias>') END,
        'subject', subj,
        'htmlContent', html
      )
    );
  END IF;
  INSERT INTO email_log (request_id, kind, group_id, organizer_id, notification_id, provider)
  VALUES (rid, n.type, n.group_id, organizer, n.id, p_provider);
  RETURN rid;
END;
$function$;
REVOKE ALL ON FUNCTION public.send_notification_email(uuid, text) FROM PUBLIC, anon, authenticated;

-- Sends what the outbox has ready, oldest first. Brevo first; SES when Brevo failed this email
-- last time or Brevo's day is full. One failing row never stops the others.
CREATE OR REPLACE FUNCTION public.flush_pending_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  rid bigint;
  sent INT := 0;
  brevo_room boolean;
  ses_room boolean;
  prov text;
BEGIN
  FOR p IN SELECT notification_id, attempts, last_provider FROM email_pending
           WHERE last_request IS NULL AND next_try <= now() ORDER BY created_at
           FOR UPDATE SKIP LOCKED LOOP
    brevo_room := emails_sent_today() < 240;
    -- 1000 SES emails a day is a spending ceiling (about US$0.16), far above what is expected.
    ses_room := ses_ready() AND ses_sent_today() < 1000;
    EXIT WHEN NOT brevo_room AND NOT ses_room;
    prov := CASE WHEN ses_room AND (NOT brevo_room OR p.last_provider = 'brevo') THEN 'ses'
                 ELSE 'brevo' END;
    BEGIN
      rid := send_notification_email(p.notification_id, prov);
    EXCEPTION WHEN OTHERS THEN
      rid := NULL;
    END;
    -- Waits grow 15 min, 30, 1 h, 2 h... up to 6 h between tries.
    UPDATE email_pending
    SET attempts = attempts + 1, last_request = rid, last_provider = prov,
        next_try = now() + least(interval '15 minutes' * power(2, p.attempts), interval '6 hours')
    WHERE notification_id = p.notification_id AND last_request IS NULL;
    IF rid IS NULL THEN
      PERFORM alert_once('email-config', 'error',
        'Un correo de sorteo, revelación o invitación no se pudo armar (¿falta la clave de Brevo o de SES en Vault, o la plantilla?). Sigue en cola.',
        interval '6 hours');
    ELSE
      sent := sent + 1;
    END IF;
  END LOOP;
  RETURN sent;
END;
$function$;
REVOKE ALL ON FUNCTION public.flush_pending_emails() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_email_delivery()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  failed INT;
  detail TEXT;
  sent_today INT;
  waiting INT;
  oldest INTERVAL;
BEGIN
  -- Outbox: delivered when Brevo or SES answered 2xx.
  DELETE FROM email_pending p USING net._http_response r
  WHERE r.id = p.last_request AND coalesce(r.status_code, 0) BETWEEN 200 AND 299
    AND NOT coalesce(r.timed_out, false);

  -- Refused as a bad request: could be the address or our own setup. Reported, and retried like
  -- any other failure until the 72-hour limit (never dropped earlier: a setup error must not
  -- empty the queue).
  SELECT count(*), string_agg(DISTINCT p.last_provider, ', ') INTO failed, detail
  FROM email_pending p JOIN net._http_response r ON r.id = p.last_request
  WHERE r.status_code IN (400, 422);
  IF failed > 0 THEN
    PERFORM alert_once('email-refused', 'error',
      failed || ' correo(s) esenciales rechazados como inválidos por ' || coalesce(detail, '?')
        || ' (¿dirección o configuración?). Se siguen intentando hasta 72 horas.',
      interval '1 hour');
  END IF;

  -- Anything else (refused, quota, error, timeout, or no answer after 30 minutes): try again.
  -- After a Brevo failure the next try goes through SES at once; after an SES failure, Brevo
  -- waits its turn.
  UPDATE email_pending p SET last_request = NULL,
    next_try = CASE WHEN p.last_provider = 'brevo' AND ses_ready() THEN now() ELSE p.next_try END
  WHERE p.last_request IS NOT NULL AND (
    EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = p.last_request
            AND (r.timed_out OR r.error_msg IS NOT NULL
                 OR coalesce(r.status_code, 0) NOT BETWEEN 200 AND 299))
    OR (NOT EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = p.last_request)
        AND p.next_try < now() - interval '15 minutes'));

  -- After 72 hours an essential email stops waiting, and that is always reported.
  WITH old AS (DELETE FROM email_pending WHERE created_at < now() - interval '72 hours'
               RETURNING notification_id)
  SELECT count(*) INTO failed FROM old;
  IF failed > 0 THEN
    PERFORM report_to_sentry('email-expired', 'error',
      failed || ' correo(s) de sorteo, revelación o invitación no salieron en 72 horas. Siguen en la campanita de cada persona.');
  END IF;

  PERFORM flush_pending_emails();

  SELECT count(*), max(now() - created_at) INTO waiting, oldest FROM email_pending;
  IF waiting > 0 AND oldest > interval '30 minutes' THEN
    PERFORM alert_once('email-pending', 'error',
      waiting || ' correo(s) de sorteo, revelación o invitación esperan hace más de media hora. Salen solos cuando Brevo o SES los aceptan.',
      interval '6 hours');
  END IF;

  -- Everyday notices Brevo refused: reported, not retried (they are also in the bell).
  SELECT count(*),
         string_agg(DISTINCT coalesce(r.status_code::TEXT, 'sin respuesta') || ' ' ||
           regexp_replace(left(coalesce(r.error_msg, r.content::TEXT, ''), 160),
                          '[^\s@"]+@[^\s@"]+', '[correo]', 'g'), ' | ')
  INTO failed, detail
  FROM email_log l JOIN net._http_response r ON r.id = l.request_id
  WHERE NOT l.checked AND l.provider = 'brevo'
    AND (r.timed_out OR r.error_msg IS NOT NULL OR r.status_code >= 300);
  IF failed > 0 THEN
    PERFORM alert_once('email-failure', 'error',
      'Brevo rechazó ' || failed || ' correo(s): ' || detail, interval '1 hour');
  END IF;

  UPDATE email_log l SET checked = TRUE
  WHERE NOT l.checked
    AND (EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id)
         OR l.created_at < NOW() - INTERVAL '6 hours');

  -- The backup is working, so Brevo is not: worth knowing once a day.
  IF ses_sent_today() > 0 THEN
    PERFORM alert_once('email-ses-used', 'warning',
      'Se usó el respaldo SES: ' || ses_sent_today() || ' correo(s) en 24 horas. Revisar Brevo (cupo, clave o caída).',
      interval '1 day');
  END IF;

  sent_today := emails_sent_today();
  IF sent_today >= 200 THEN
    PERFORM alert_once('email-reserve', 'warning',
      'Se enviaron ' || sent_today || ' correos por Brevo en 24 horas: los avisos del día a día quedan en la campanita; sorteos, revelaciones e invitaciones siguen hasta 240 por Brevo y después por SES.',
      interval '1 day');
  ELSIF sent_today >= 140 THEN
    PERFORM alert_once('email-quota-70', 'warning',
      'Van ' || sent_today || ' correos por Brevo en 24 horas, el 70% del cupo de avisos.', interval '1 day');
  END IF;

  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$;
REVOKE ALL ON FUNCTION public.check_email_delivery() FROM PUBLIC, anon, authenticated;
