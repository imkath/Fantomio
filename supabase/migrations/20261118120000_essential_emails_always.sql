-- Essential emails never get lost (Kath, 18-nov-2026). The draw, the reveal and invitations are
-- what a family waits for, and many people (older relatives, for instance) only read their email.
--
-- They go through an outbox: every essential notice is written to email_pending first and leaves
-- it only when Brevo answers 2xx. A refusal, a timeout or no answer at all sends it back for
-- another try, with growing waits, for up to 72 hours; past that, Sentry says so. They ignore the
-- quiet windows and the "email notices" switch, which from now on covers everyday notices only.
-- Everyday notices keep their caps (200 a day, 60 per organizer) and fall back to the bell.
-- Essential ones may use up to 240 a day, leaving the rest of Brevo's 300 for account emails.

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS notification_id uuid;

CREATE TABLE IF NOT EXISTS public.email_pending (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  -- The request in flight, if any; NULL means "ready to send when next_try comes".
  last_request bigint,
  next_try timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_pending FROM PUBLIC, anon, authenticated;

-- Emails that count against the day: attempts Brevo didn't refuse (failed ones don't use quota).
CREATE OR REPLACE FUNCTION public.emails_sent_today()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM email_log l
  WHERE l.created_at > now() - interval '24 hours'
    AND NOT EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id
                    AND (r.timed_out OR r.error_msg IS NOT NULL
                         OR coalesce(r.status_code, 0) NOT BETWEEN 200 AND 299))
$function$;
REVOKE ALL ON FUNCTION public.emails_sent_today() FROM PUBLIC, anon, authenticated;

-- Sentry, at most once per key and period, so a long queue doesn't burn the free event quota.
CREATE TABLE IF NOT EXISTS public.email_alerts (
  key text PRIMARY KEY,
  last_sent timestamptz NOT NULL
);
ALTER TABLE public.email_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_alerts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.alert_once(p_key text, p_level text, p_message text, p_every interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO email_alerts (key, last_sent) VALUES (p_key, now())
  ON CONFLICT (key) DO UPDATE SET last_sent = now()
    WHERE email_alerts.last_sent < now() - p_every;
  IF FOUND THEN
    PERFORM report_to_sentry(p_key, p_level, p_message);
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.alert_once(text, text, text, interval) FROM PUBLIC, anon, authenticated;

-- Builds and sends the email for one notification. Returns the request id, or NULL when it can't
-- (no template, Brevo key or address).
CREATE OR REPLACE FUNCTION public.send_notification_email(p_notification uuid)
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
  url TEXT;
  organizer UUID;
BEGIN
  SELECT * INTO n FROM notifications WHERE id = p_notification;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  organizer := (SELECT admin_id FROM groups WHERE id = n.group_id);
  SELECT * INTO tpl FROM email_templates WHERE name = n.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = n.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
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
      'subject', replace(replace(tpl.subject, '{{GROUP}}', group_name),
                         '{{NAME}}', coalesce(other_name, '')),
      'htmlContent', replace(replace(replace(tpl.html,
                       '{{GROUP}}', html_escape(group_name)),
                       '{{NAME}}', html_escape(coalesce(other_name, ''))),
                       '{{URL}}', url)
    )
  );
  INSERT INTO email_log (request_id, kind, group_id, organizer_id, notification_id)
  VALUES (rid, n.type, n.group_id, organizer, n.id);
  RETURN rid;

END;
$function$;
REVOKE ALL ON FUNCTION public.send_notification_email(uuid) FROM PUBLIC, anon, authenticated;

-- Sends what the outbox has ready, oldest first, while the day has room. One failing row never
-- stops the others.
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
BEGIN
  FOR p IN SELECT notification_id, attempts FROM email_pending
           WHERE last_request IS NULL AND next_try <= now() ORDER BY created_at
           FOR UPDATE SKIP LOCKED LOOP
    EXIT WHEN emails_sent_today() >= 240;
    BEGIN
      rid := send_notification_email(p.notification_id);
    EXCEPTION WHEN OTHERS THEN
      rid := NULL;
    END;
    -- Waits grow 15 min, 30, 1 h, 2 h... up to 6 h between tries.
    UPDATE email_pending
    SET attempts = attempts + 1, last_request = rid,
        next_try = now() + least(interval '15 minutes' * power(2, p.attempts), interval '6 hours')
    WHERE notification_id = p.notification_id AND last_request IS NULL;
    IF rid IS NULL THEN
      PERFORM alert_once('email-config', 'error',
        'Un correo de sorteo, revelación o invitación no se pudo armar (¿falta la clave de Brevo en Vault o la plantilla?). Sigue en cola.',
        interval '6 hours');
    ELSE
      sent := sent + 1;
    END IF;
  END LOOP;
  RETURN sent;
END;
$function$;
REVOKE ALL ON FUNCTION public.flush_pending_emails() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  quiet INTERVAL;
  organizer UUID;
BEGIN
  -- Essential: into the outbox, and out right away if the day has room.
  IF NEW.type IN ('draw', 'unveil', 'invitation') THEN
    INSERT INTO email_pending (notification_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    BEGIN
      PERFORM flush_pending_emails();
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN NEW;
  END IF;

  quiet := CASE NEW.type
    WHEN 'wishlist' THEN INTERVAL '12 hours'
    ELSE INTERVAL '15 minutes'
  END;
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND type = NEW.type
      AND id <> NEW.id AND created_at > NOW() - quiet
  ) THEN
    RETURN NEW;
  END IF;

  -- People can turn everyday notices off in their account; they stay in the app.
  IF NOT coalesce((SELECT email_notifications FROM profiles WHERE id = NEW.user_id), TRUE) THEN
    RETURN NEW;
  END IF;

  -- Everyday notices stop at 200 a day and stay in the bell.
  IF emails_sent_today() >= 200 THEN
    RETURN NEW;
  END IF;

  -- And each organizer has a share of 60 of them a day.
  organizer := (SELECT admin_id FROM groups WHERE id = NEW.group_id);
  IF (SELECT count(*) FROM email_log
      WHERE organizer_id = organizer AND created_at > NOW() - INTERVAL '24 hours'
        AND kind NOT IN ('draw', 'unveil', 'invitation')) >= 60 THEN
    INSERT INTO email_cap_alerts (organizer_id, day) VALUES (organizer, current_date)
      ON CONFLICT DO NOTHING;
    IF FOUND THEN
      PERFORM report_to_sentry('email-organizer-cap', 'warning',
        'Un organizador llegó a sus 60 avisos del día; los siguientes quedan solo en la campanita.');
    END IF;
    RETURN NEW;
  END IF;

  PERFORM send_notification_email(NEW.id);
  RETURN NEW;
END;
$function$;

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
  -- Outbox: delivered when Brevo answered 2xx.
  DELETE FROM email_pending p USING net._http_response r
  WHERE r.id = p.last_request AND coalesce(r.status_code, 0) BETWEEN 200 AND 299
    AND NOT coalesce(r.timed_out, false);

  -- Refused as a bad request: could be the address or our own setup. Reported, and retried like
  -- any other failure until the 72-hour limit (never dropped earlier: a setup error must not
  -- empty the queue).
  SELECT count(*) INTO failed FROM email_pending p JOIN net._http_response r ON r.id = p.last_request
  WHERE r.status_code IN (400, 422);
  IF failed > 0 THEN
    PERFORM alert_once('email-refused', 'error',
      failed || ' correo(s) esenciales rechazados por Brevo como inválidos (¿dirección o configuración?). Se siguen intentando hasta 72 horas.',
      interval '1 hour');
  END IF;

  -- Anything else (refused, quota, error, timeout, or no answer after 30 minutes): try again.
  UPDATE email_pending p SET last_request = NULL
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
      waiting || ' correo(s) de sorteo, revelación o invitación esperan hace más de media hora. Salen solos cuando Brevo los acepta; si es por cupo, comprar créditos.',
      interval '6 hours');
  END IF;

  -- Everyday notices Brevo refused: reported, not retried (they are also in the bell).
  SELECT count(*),
         string_agg(DISTINCT coalesce(r.status_code::TEXT, 'sin respuesta') || ' ' ||
           regexp_replace(left(coalesce(r.error_msg, r.content::TEXT, ''), 160),
                          '[^\s@"]+@[^\s@"]+', '[correo]', 'g'), ' | ')
  INTO failed, detail
  FROM email_log l JOIN net._http_response r ON r.id = l.request_id
  WHERE NOT l.checked AND (r.timed_out OR r.error_msg IS NOT NULL OR r.status_code >= 300);
  IF failed > 0 THEN
    PERFORM alert_once('email-failure', 'error',
      'Brevo rechazó ' || failed || ' correo(s): ' || detail, interval '1 hour');
  END IF;

  UPDATE email_log l SET checked = TRUE
  WHERE NOT l.checked
    AND (EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id)
         OR l.created_at < NOW() - INTERVAL '6 hours');

  sent_today := emails_sent_today();
  IF sent_today >= 200 THEN
    PERFORM alert_once('email-reserve', 'warning',
      'Se enviaron ' || sent_today || ' correos en 24 horas: los avisos del día a día quedan en la campanita; sorteos, revelaciones e invitaciones siguen hasta 240 y después esperan en cola.',
      interval '1 day');
  ELSIF sent_today >= 140 THEN
    PERFORM alert_once('email-quota-70', 'warning',
      'Van ' || sent_today || ' correos en 24 horas, el 70% del cupo de avisos.', interval '1 day');
  END IF;

  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$;
REVOKE ALL ON FUNCTION public.check_email_delivery() FROM PUBLIC, anon, authenticated;
