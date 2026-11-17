-- Second batch after the security review of 17-nov-2026: automatic history, frozen exclusions,
-- daily limits, an email share per organizer, hidden emails between members and length caps.

-- 1. The group history is written only by the database. "Created" and "updated" lines come from
--    a trigger on groups; nobody (organizer included) can insert, edit or delete history rows.
CREATE OR REPLACE FUNCTION public.log_group_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A repeated edition logs its own line (repeat_group), with who repeated it.
    IF NEW.previous_group_id IS NULL THEN
      INSERT INTO activities (group_id, user_id, type, message)
      VALUES (NEW.id, NEW.admin_id, 'GROUP_CREATED', 'Grupo "' || left(NEW.name, 200) || '" creado');
    END IF;
  ELSIF auth.uid() IS NOT NULL AND auth.uid() = NEW.admin_id
    AND (OLD.name, OLD.budget, OLD.currency, OLD.exchange_date, OLD.place_kind, OLD.place_name,
         OLD.place_detail, OLD.time_zone, OLD.mode, OLD.reveal_at)
        IS DISTINCT FROM
        (NEW.name, NEW.budget, NEW.currency, NEW.exchange_date, NEW.place_kind, NEW.place_name,
         NEW.place_detail, NEW.time_zone, NEW.mode, NEW.reveal_at) THEN
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (NEW.id, NEW.admin_id, 'GROUP_UPDATED', 'Grupo actualizado');
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_group_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_group_logged
  AFTER INSERT OR UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.log_group_change();

DROP POLICY "Organizers log their own group changes" ON public.activities;
REVOKE INSERT, UPDATE, DELETE ON public.activities FROM authenticated;

-- 2. Exclusions can only change before the draw. After a reset the group is planning again and
--    they can be edited for the next draw.
DROP POLICY "Admin can insert exclusions" ON public.exclusions;
CREATE POLICY "Admin can insert exclusions" ON public.exclusions
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM groups
    WHERE groups.id = exclusions.group_id AND groups.admin_id = auth.uid()
      AND groups.archived_at IS NULL AND groups.status = 'PLANNING'));
DROP POLICY "Admin can delete exclusions" ON public.exclusions;
CREATE POLICY "Admin can delete exclusions" ON public.exclusions
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM groups
    WHERE groups.id = exclusions.group_id AND groups.admin_id = auth.uid()
      AND groups.archived_at IS NULL AND groups.status = 'PLANNING'));

-- 3. Daily limits no real use reaches: 10 groups a day per person (5 of them repeated editions),
--    20 draws a day per organizer, 30 anonymous messages an hour per side of a pair.
CREATE OR REPLACE FUNCTION public.limit_new_groups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM groups WHERE admin_id = NEW.admin_id
      AND created_at > NOW() - INTERVAL '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Ya creaste muchos grupos hoy. Vuelve a intentarlo mañana.';
  END IF;
  IF NEW.previous_group_id IS NOT NULL AND (SELECT count(*) FROM groups
      WHERE admin_id = NEW.admin_id AND previous_group_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '24 hours') >= 5 THEN
    RAISE EXCEPTION 'Ya repetiste muchos grupos hoy. Vuelve a intentarlo mañana.';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.limit_new_groups() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_group_limit
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.limit_new_groups();

CREATE OR REPLACE FUNCTION public.limit_draws()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'DRAWN' AND OLD.status IS DISTINCT FROM 'DRAWN' AND auth.uid() IS NOT NULL
     AND (SELECT count(*) FROM activities WHERE user_id = auth.uid() AND type = 'DRAW'
          AND created_at > NOW() - INTERVAL '24 hours') >= 20 THEN
    RAISE EXCEPTION 'Hiciste muchos sorteos hoy. Vuelve a intentarlo mañana.';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.limit_draws() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_draw_limit
  BEFORE UPDATE OF status ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.limit_draws();

CREATE OR REPLACE FUNCTION public.limit_messages()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM anonymous_messages WHERE match_id = NEW.match_id
      AND sender_role = NEW.sender_role AND created_at > NOW() - INTERVAL '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Mandaste muchos mensajes en poco rato. Espera un poco antes de seguir.';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.limit_messages() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_message_limit
  BEFORE INSERT ON public.anonymous_messages
  FOR EACH ROW EXECUTE FUNCTION public.limit_messages();

-- Profile photos: at most 5 files per person (the app keeps one; the rest is margin).
DROP POLICY "Avatars: owners upload to their folder" ON storage.objects;
CREATE POLICY "Avatars: owners upload to their folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'avatars'
         AND (storage.foldername(o.name))[1] = auth.uid()::text) < 5);

-- 4. Email: a share per organizer (in email_notification) and an early warning at 70%.
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS email_log_group ON public.email_log (group_id, created_at);

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

  -- Each organizer has their own share of that: the groups they run can't send more than 60
  -- notices a day. Past it, theirs stay in the bell and everyone else's still go out.
  IF (SELECT count(*) FROM email_log l JOIN groups g ON g.id = l.group_id
      WHERE l.created_at > NOW() - INTERVAL '24 hours'
        AND g.admin_id = (SELECT admin_id FROM groups WHERE id = NEW.group_id)) >= 60 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO tpl FROM email_templates WHERE name = NEW.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = NEW.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type IN ('draw', 'unveil', 'remind_soon', 'remind_soon_list', 'remind_list') THEN
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
  -- Names are data, never template: a group or a person called "{{NAME}}" must stay as written.
  -- Every brace followed by another gets a space, so no run of braces can rebuild "{{".
  group_name := regexp_replace(group_name, '\{(?=\{)', '{ ', 'g');
  other_name := regexp_replace(other_name, '\{(?=\{)', '{ ', 'g');
  url := CASE WHEN NEW.type = 'invitation' THEN 'https://fantomio.com/dashboard'
              ELSE 'https://fantomio.com/groups?id=' || NEW.group_id END;

  INSERT INTO email_log (request_id, kind, group_id) VALUES (net.http_post(
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
  ), NEW.type, NEW.group_id);
  RETURN NEW;
END;
$function$
;

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
  ELSIF sent_today >= 140 THEN
    -- 70% of the notices' share: time to look, and to buy credits if the growth is real.
    PERFORM report_to_sentry('email-quota-70', 'warning',
      'Van ' || sent_today || ' avisos en 24 horas, el 70% del cupo diario de avisos (200).');
  END IF;

  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$;
REVOKE ALL ON FUNCTION public.check_email_delivery() FROM PUBLIC, anon, authenticated;

-- 5. Members see each other's name and photo, not their email. The app never needed it; the
--    database functions (definer) still read it to send the notices.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, created_at, updated_at, theme, email_notifications)
  ON public.profiles TO authenticated;

-- 6. A technical ceiling for names: no real name gets near 300 characters (the longest on
--    18-nov-2026 was 32), but a huge text would travel in every email.
ALTER TABLE public.groups
  ADD CONSTRAINT groups_name_length CHECK (char_length(name) <= 300) NOT VALID;
ALTER TABLE public.groups VALIDATE CONSTRAINT groups_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length CHECK (char_length(full_name) <= 300) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_full_name_length;
