-- Fixes from the code-audit of 2026-10-26.
--
-- 1. Draw emails had no quiet window, and the organizer could draw and reset in a loop: each
--    round sent one email per member through Brevo, enough to burn the daily quota for
--    everyone. Now the draw email waits 1 hour per person and group, and a group can reset its
--    draw at most 3 times a day (which also stops re-rolling until you get the person you want).
-- 2. Joining only checked the invite code in the browser: anyone who knew a group's id could
--    insert themselves. Joining now goes through join_group(code), and the direct insert is
--    left only for the organizer adding themselves right after creating the group.
-- 3. activities accepted any user_id, type and message, so a member could log things in
--    someone else's name. Joins, departures and removals are now logged by the database; the
--    browser can only log its own group creation and edits.
-- 4. profiles let users change their email (others see it as their identity, and the column
--    is unique, so it could squat someone else's address). Only name and photo are editable.
-- 5. Least privilege: anon gets no table privileges, nobody gets TRUNCATE/TRIGGER/REFERENCES,
--    and the two SECURITY DEFINER functions without a fixed search_path get one.

-- 1 ---------------------------------------------------------------------------------------
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

  SELECT * INTO tpl FROM email_templates WHERE name = NEW.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = NEW.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type = 'draw' THEN
    -- The draw email greets the recipient; it never names their match.
    SELECT initcap(lower(full_name)) INTO other_name FROM profiles WHERE id = NEW.user_id;
  ELSE
    -- For replies and wishlist changes, the other person is the recipient's own receiver.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
    WHERE mt.group_id = NEW.group_id AND mt.giver_id = NEW.user_id;
  END IF;
  url := 'https://ghostswap.nvrkth.com/groups/' || NEW.group_id;

  PERFORM net.http_post(
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
  );
  RETURN NEW;
END;
$function$

;

CREATE OR REPLACE FUNCTION reset_group_draw(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede reiniciar el sorteo';
  END IF;
  IF g.status <> 'DRAWN' THEN
    RAISE EXCEPTION 'El grupo todavía no tiene sorteo';
  END IF;
  IF (SELECT count(*) FROM activities
      WHERE group_id = p_group_id AND type = 'DRAW_RESET'
        AND created_at > NOW() - INTERVAL '24 hours') >= 3 THEN
    RAISE EXCEPTION 'El sorteo ya se reinició 3 veces hoy. Podrás volver a hacerlo mañana.';
  END IF;

  DELETE FROM matches WHERE group_id = p_group_id;
  PERFORM set_config('ghostswap.status_change', 'on', true);
  UPDATE groups SET status = 'PLANNING' WHERE id = p_group_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'DRAW_RESET', 'Se reinició el sorteo de "' || g.name || '"');
  RETURN TRUE;
END;
$$;

-- 2 ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_group(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar a tu cuenta para unirte';
  END IF;
  SELECT * INTO g FROM groups WHERE invite_code = lower(trim(p_code)) FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos un grupo con ese código. Revisa que esté completo.';
  END IF;
  IF EXISTS (SELECT 1 FROM members WHERE group_id = g.id AND user_id = auth.uid()) THEN
    RETURN g.id;
  END IF;
  IF g.status <> 'PLANNING' THEN
    RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
  END IF;

  INSERT INTO members (group_id, user_id, is_admin) VALUES (g.id, auth.uid(), FALSE);
  INSERT INTO activities (group_id, user_id, type, message)
  SELECT g.id, auth.uid(), 'USER_JOINED',
         coalesce(initcap(lower(p.full_name)), 'Alguien') || ' se unió al grupo'
  FROM profiles p WHERE p.id = auth.uid();
  RETURN g.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION join_group(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION join_group(TEXT) TO authenticated;

DROP POLICY IF EXISTS "members_insert" ON members;
CREATE POLICY "members_insert" ON members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_admin
    AND group_id IN (SELECT auth_user_admin_group_ids())
    AND group_is_open(group_id)
  );

-- 3 ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_member_left()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person TEXT;
BEGIN
  -- Deleting the whole group cascades here; there is nothing left to log into.
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id) THEN
    RETURN OLD;
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO person FROM profiles WHERE id = OLD.user_id;
  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (
    OLD.group_id, auth.uid(),
    CASE WHEN OLD.user_id = auth.uid() THEN 'MEMBER_LEFT' ELSE 'MEMBER_REMOVED' END,
    coalesce(person, 'Alguien') ||
      CASE WHEN OLD.user_id = auth.uid() THEN ' salió del grupo' ELSE ' fue quitado del grupo' END
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_member_left ON members;
CREATE TRIGGER on_member_left
  AFTER DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION log_member_left();

DROP POLICY IF EXISTS "Members can create activities" ON activities;
CREATE POLICY "Members log their own group changes" ON activities
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND user_is_member_of_group(group_id)
    AND type IN ('GROUP_CREATED', 'GROUP_UPDATED')
    AND char_length(message) <= 300
  );

-- 4 ---------------------------------------------------------------------------------------
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON profiles TO authenticated;
ALTER TABLE profiles ADD CONSTRAINT profiles_avatar_url_https
  CHECK (avatar_url IS NULL OR avatar_url ~ '^https://');

-- 5 ---------------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

ALTER FUNCTION handle_new_user() SET search_path = public;
ALTER FUNCTION user_is_member_of_group(UUID) SET search_path = public;
REVOKE EXECUTE ON FUNCTION log_member_left() FROM PUBLIC, anon;
