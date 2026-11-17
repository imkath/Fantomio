-- Essential emails never get lost (Kath, 18-nov-2026): the draw, the reveal and invitations are
-- what a family waits for, and many people (older relatives, for instance) only read their email.
-- Everyday notices keep their caps and fall back to the bell; essential ones get a larger share of
-- the daily quota and, if even that runs out or Brevo refuses one, wait in a queue and go out as
-- soon as there is room. Sentry warns while anything is waiting, so credits can be bought.

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS notification_id uuid;

CREATE TABLE IF NOT EXISTS public.email_pending (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public.email_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_pending FROM PUBLIC, anon, authenticated;

-- Builds and sends the email for one notification. False when it can't (no template, key or address).
CREATE OR REPLACE FUNCTION public.send_notification_email(p_notification uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n notifications%ROWTYPE;
  tpl email_templates%ROWTYPE;
  to_email TEXT;
  group_name TEXT;
  other_name TEXT;
  api_key TEXT;
  url TEXT;
  quiet INTERVAL;
  organizer UUID;
BEGIN
  SELECT * INTO n FROM notifications WHERE id = p_notification;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  organizer := (SELECT admin_id FROM groups WHERE id = n.group_id);
  SELECT * INTO tpl FROM email_templates WHERE name = n.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = n.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN FALSE;
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

  INSERT INTO email_log (request_id, kind, group_id, organizer_id, notification_id) VALUES (net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', 'Fantomio', 'email', 'hola@fantomio.com'),
      'to', jsonb_build_array(jsonb_build_object('email', to_email)),
      -- Mail providers show their own "unsubscribe" with this; it leads to the switch that turns
      -- these notices off. Account emails (sign-up, password) never carry it.
      'headers', jsonb_build_object('List-Unsubscribe', '<https://fantomio.com/account#preferencias>'),
      'subject', replace(replace(tpl.subject, '{{GROUP}}', group_name),
                         '{{NAME}}', coalesce(other_name, '')),
      'htmlContent', replace(replace(replace(tpl.html,
                       '{{GROUP}}', html_escape(group_name)),
                       '{{NAME}}', html_escape(coalesce(other_name, ''))),
                       '{{URL}}', url)
    )
  ), n.type, n.group_id, organizer, n.id);
  RETURN TRUE;
END;
$function$;
REVOKE ALL ON FUNCTION public.send_notification_email(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  quiet INTERVAL;
  organizer UUID;
  essential BOOLEAN := NEW.type IN ('draw', 'unveil', 'invitation');
  sent_today INT;
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
  SELECT count(*) INTO sent_today FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours';

  IF essential THEN
    -- Up to 270, leaving room for account emails; past that, they wait instead of being dropped.
    IF sent_today >= 270 THEN
      INSERT INTO email_pending (notification_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NEW;
    END IF;
  ELSE
    -- Everyday notices stop at 200 and stay in the bell.
    IF sent_today >= 200 THEN
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
  END IF;

  PERFORM send_notification_email(NEW.id);
  RETURN NEW;
END;
$function$;

-- Sends what is waiting, oldest first, while there is room. Runs with the delivery check.
CREATE OR REPLACE FUNCTION public.flush_pending_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  sent INT := 0;
BEGIN
  FOR p IN SELECT notification_id FROM email_pending ORDER BY created_at LOOP
    EXIT WHEN (SELECT count(*) FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours') >= 270;
    UPDATE email_pending SET attempts = attempts + 1 WHERE notification_id = p.notification_id;
    IF send_notification_email(p.notification_id) THEN
      DELETE FROM email_pending WHERE notification_id = p.notification_id;
      sent := sent + 1;
    ELSIF (SELECT attempts FROM email_pending WHERE notification_id = p.notification_id) >= 5 THEN
      -- No template, key or address after several tries: nothing left to retry.
      DELETE FROM email_pending WHERE notification_id = p.notification_id;
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
BEGIN
  SELECT count(*),
         string_agg(DISTINCT coalesce(r.status_code::TEXT, 'sin respuesta') || ' ' ||
           regexp_replace(left(coalesce(r.error_msg, r.content::TEXT, ''), 160),
                          '[^\s@"]+@[^\s@"]+', '[correo]', 'g'), ' | ')
  INTO failed, detail
  FROM email_log l JOIN net._http_response r ON r.id = l.request_id
  WHERE NOT l.checked AND (r.timed_out OR r.error_msg IS NOT NULL OR r.status_code >= 300);

  -- An essential email Brevo refused (quota, a hiccup) goes back to the queue to be retried.
  INSERT INTO email_pending (notification_id)
  SELECT l.notification_id
  FROM email_log l JOIN net._http_response r ON r.id = l.request_id
  WHERE NOT l.checked AND l.notification_id IS NOT NULL
    AND l.kind IN ('draw', 'unveil', 'invitation')
    AND (r.timed_out OR r.error_msg IS NOT NULL OR r.status_code >= 300)
    AND EXISTS (SELECT 1 FROM notifications WHERE id = l.notification_id)
    -- Three tries per email at most, so an address that always bounces does not loop forever.
    AND (SELECT count(*) FROM email_log x WHERE x.notification_id = l.notification_id) < 3
  ON CONFLICT DO NOTHING;

  UPDATE email_log l SET checked = TRUE
  WHERE NOT l.checked
    AND (EXISTS (SELECT 1 FROM net._http_response r WHERE r.id = l.request_id)
         OR l.created_at < NOW() - INTERVAL '6 hours');

  IF failed > 0 THEN
    PERFORM report_to_sentry('email-failure', 'error',
      'Brevo rechazó ' || failed || ' correo(s) de aviso: ' || detail);
  END IF;

  PERFORM flush_pending_emails();

  SELECT count(*) INTO waiting FROM email_pending;
  IF waiting > 0 THEN
    PERFORM report_to_sentry('email-pending', 'error',
      waiting || ' correo(s) de sorteo, revelación o invitación esperan cupo de Brevo. Salen solos cuando hay cupo; para que salgan ya, comprar créditos.');
  END IF;

  SELECT count(*) INTO sent_today FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours';
  IF sent_today >= 200 THEN
    PERFORM report_to_sentry('email-reserve', 'warning',
      'Se enviaron ' || sent_today || ' correos en 24 horas: los avisos del día a día quedan en la campanita; sorteos, revelaciones e invitaciones siguen saliendo hasta 270 y después esperan en cola.');
  ELSIF sent_today >= 140 THEN
    PERFORM report_to_sentry('email-quota-70', 'warning',
      'Van ' || sent_today || ' correos en 24 horas, el 70% del cupo de avisos.');
  END IF;

  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$;
REVOKE ALL ON FUNCTION public.check_email_delivery() FROM PUBLIC, anon, authenticated;
