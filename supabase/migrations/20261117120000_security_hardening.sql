-- Hardening after the security review of 17-nov-2026.

-- 1. The group history: only the organizer writes "created" and "updated" lines from the app.
--    Joins, leaves and draws are written by the database itself. Before, any member could add
--    a fake line in the organizer's name of the group.
DROP POLICY "Members log their own group changes" ON public.activities;
CREATE POLICY "Organizers log their own group changes" ON public.activities
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM groups g WHERE g.id = activities.group_id AND g.admin_id = auth.uid())
    AND NOT group_archived(group_id)
    AND type = ANY (ARRAY['GROUP_CREATED'::text, 'GROUP_UPDATED'::text])
    AND char_length(message) <= 300
  );

-- 2. Wish lists: every item is an object with a text description and, optionally, a text link,
--    of sensible length. A malformed item used to break the page of whoever gives the gift.
--    Production had no malformed list on 17-nov-2026, so the rule is validated for every row.
CREATE OR REPLACE FUNCTION public.wishlist_items_valid(p_items jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN jsonb_typeof(p_items) <> 'array' THEN false
    ELSE jsonb_array_length(p_items) <= 10
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_items) e
        WHERE jsonb_typeof(e) <> 'object'
           OR jsonb_typeof(e -> 'description') IS DISTINCT FROM 'string'
           OR char_length(e ->> 'description') > 1000
           OR coalesce(jsonb_typeof(e -> 'url'), 'null') NOT IN ('string', 'null')
           OR char_length(coalesce(e ->> 'url', '')) > 2048
      )
  END
$function$;
REVOKE ALL ON FUNCTION public.wishlist_items_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wishlist_items_valid(jsonb) TO authenticated;

ALTER TABLE public.wishlists
  ADD CONSTRAINT wishlists_items_shape CHECK (public.wishlist_items_valid(items)) NOT VALID;
ALTER TABLE public.wishlists VALIDATE CONSTRAINT wishlists_items_shape;

-- 3. Emails: names are inserted as data, never read again as template placeholders.
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

  INSERT INTO email_log (request_id, kind) VALUES (net.http_post(
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
  ), NEW.type);
  RETURN NEW;
END;
$function$
;

-- 4. Deleting an account and merging two accounts ask for a recent sign-in. With a stolen
--    session (a token copied from a shared computer, say) someone could otherwise delete the
--    account or fold it into theirs. The access token says when the person signed in (amr).
CREATE OR REPLACE FUNCTION public.signed_in_recently(p_minutes integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(max((e ->> 'timestamp')::bigint) > extract(epoch FROM now()) - p_minutes * 60, false)
  FROM jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
$function$;
REVOKE ALL ON FUNCTION public.signed_in_recently(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signed_in_recently(integer) TO authenticated;

-- A sign-in method linked to the account in the last day (not the one it was created with) also
-- blocks these actions: with a stolen session someone could link their own Google, sign in
-- with it and get a "recent" sign-in. The real owner gets an email when that happens.
CREATE OR REPLACE FUNCTION public.identity_linked_recently()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.identities i JOIN auth.users u ON u.id = i.user_id
    WHERE i.user_id = auth.uid()
      AND i.created_at > now() - interval '24 hours'
      AND i.created_at > u.created_at + interval '5 minutes'
  )
$function$;
REVOKE ALL ON FUNCTION public.identity_linked_recently() FROM PUBLIC, anon, authenticated;

-- What would stop the account from being deleted, asked before anything is removed (the page
-- deletes profile photos first, and those can't come back).
CREATE OR REPLACE FUNCTION public.account_deletion_blockers()
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT string_agg(g.name, ', ')
  FROM groups g
  WHERE g.admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id <> auth.uid())
$function$;
REVOKE ALL ON FUNCTION public.account_deletion_blockers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_deletion_blockers() TO authenticated;

ALTER FUNCTION public.delete_my_account() RENAME TO delete_my_account_now;
REVOKE ALL ON FUNCTION public.delete_my_account_now() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF identity_linked_recently() THEN
    RAISE EXCEPTION 'Hace menos de un día se conectó una forma nueva de entrar a tu cuenta. Por seguridad, espera hasta mañana para esto.';
  END IF;
  IF NOT signed_in_recently() THEN
    RAISE EXCEPTION 'Por seguridad, vuelve a confirmar que eres tú antes de borrar la cuenta.'
      USING HINT = 'reauthentication_needed';
  END IF;
  PERFORM delete_my_account_now();
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

ALTER FUNCTION public.start_merge() RENAME TO start_merge_now;
REVOKE ALL ON FUNCTION public.start_merge_now() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.start_merge()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF identity_linked_recently() THEN
    RAISE EXCEPTION 'Hace menos de un día se conectó una forma nueva de entrar a tu cuenta. Por seguridad, espera hasta mañana para esto.';
  END IF;
  IF NOT signed_in_recently() THEN
    RAISE EXCEPTION 'Por seguridad, vuelve a confirmar que eres tú antes de unir cuentas.'
      USING HINT = 'reauthentication_needed';
  END IF;
  RETURN start_merge_now();
END;
$function$;
REVOKE ALL ON FUNCTION public.start_merge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_merge() TO authenticated;

ALTER FUNCTION public.confirm_merge(text) RENAME TO confirm_merge_now;
REVOKE ALL ON FUNCTION public.confirm_merge_now(text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.confirm_merge(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF identity_linked_recently() THEN
    RAISE EXCEPTION 'Hace menos de un día se conectó una forma nueva de entrar a tu cuenta. Por seguridad, espera hasta mañana para esto.';
  END IF;
  IF NOT signed_in_recently() THEN
    RAISE EXCEPTION 'Por seguridad, vuelve a confirmar que eres tú antes de unir cuentas.'
      USING HINT = 'reauthentication_needed';
  END IF;
  RETURN confirm_merge_now(p_code);
END;
$function$;
REVOKE ALL ON FUNCTION public.confirm_merge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_merge(text) TO authenticated;

-- 5. Privileges that were never used: templates are read only by the database, and pairs are
--    written only by the draw. RLS already stopped these; now the grant isn't there either.
REVOKE ALL ON public.email_templates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM authenticated;

-- 6. Closed by default: functions and tables created from now on are not reachable by signed-in
--    users until a migration grants it on purpose (anon and PUBLIC were already closed).
--    Every migration that adds something the app calls must GRANT it explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
