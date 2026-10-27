-- Repeating a secret santa, its history, archiving and the voluntary reveal.
--
-- Editions: "Repetir con las mismas personas" creates a new group linked to the previous one
-- (previous_group_id), copying name, budget, currency and exclusions, and invites the same
-- people. Invited people are not members until they accept, so the draw only pairs people who
-- said yes; pending invitations close when the draw happens. The draw can avoid last
-- edition's pairs.
-- Archive: a group becomes a keepsake 7 days after the exchange date (or 3 months after the
-- draw if it has no date), or when its organizer archives it. Archived groups are read-only:
-- no lists, draws, members, exclusions or anonymous messages change. The organizer can
-- restore it. Anyone can also hide a group from their own list.
-- Reveal: after the exchange, a giver can choose to tell their receiver who they were.
-- Nobody else ever learns any pair, the organizer included.

ALTER TABLE groups
  ADD COLUMN previous_group_id UUID REFERENCES groups (id) ON DELETE SET NULL,
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN auto_archive BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE members ADD COLUMN hidden_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN revealed_at TIMESTAMPTZ;

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('question', 'reply', 'wishlist', 'draw', 'invitation', 'reveal'));

CREATE OR REPLACE FUNCTION group_archived(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT archived_at IS NOT NULL FROM groups WHERE id = p_group), FALSE);
$$;
REVOKE EXECUTE ON FUNCTION group_archived(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION group_archived(UUID) TO authenticated;

-- An archived group can't be joined either.
CREATE OR REPLACE FUNCTION group_is_open(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND status = 'PLANNING' AND archived_at IS NULL);
$$;

-- Read-only once archived
DROP POLICY "Members write their own wishlist" ON wishlists;
CREATE POLICY "Members write their own wishlist" ON wishlists
  FOR INSERT WITH CHECK (user_id = auth.uid() AND user_is_member_of_group(group_id) AND NOT group_archived(group_id));
DROP POLICY "Owners update their wishlist" ON wishlists;
CREATE POLICY "Owners update their wishlist" ON wishlists
  FOR UPDATE USING (user_id = auth.uid() AND NOT group_archived(group_id))
  WITH CHECK (user_id = auth.uid() AND NOT group_archived(group_id));
DROP POLICY "Owners delete their wishlist" ON wishlists;
CREATE POLICY "Owners delete their wishlist" ON wishlists
  FOR DELETE USING (user_id = auth.uid() AND NOT group_archived(group_id));

DROP POLICY "Match participants can send messages" ON anonymous_messages;
CREATE POLICY "Match participants can send messages" ON anonymous_messages
  FOR INSERT WITH CHECK (
    NOT group_archived((SELECT group_id FROM matches WHERE id = match_id))
    AND (
      (sender_role = 'giver' AND EXISTS (SELECT 1 FROM matches WHERE matches.id = anonymous_messages.match_id AND matches.giver_id = auth.uid()))
      OR (sender_role = 'receiver' AND is_match_receiver(match_id))
    )
  );

DROP POLICY "Admin can delete exclusions" ON exclusions;
CREATE POLICY "Admin can delete exclusions" ON exclusions
  FOR DELETE USING (EXISTS (SELECT 1 FROM groups WHERE groups.id = exclusions.group_id AND groups.admin_id = auth.uid() AND groups.archived_at IS NULL));
DROP POLICY "Admin can insert exclusions" ON exclusions;
CREATE POLICY "Admin can insert exclusions" ON exclusions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM groups WHERE groups.id = exclusions.group_id AND groups.admin_id = auth.uid() AND groups.archived_at IS NULL));

DROP POLICY "Members log their own group changes" ON activities;
CREATE POLICY "Members log their own group changes" ON activities
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND user_is_member_of_group(group_id) AND NOT group_archived(group_id)
    AND type IN ('GROUP_CREATED', 'GROUP_UPDATED') AND char_length(message) <= 300
  );

-- Editing goes through the normal update while active; archiving and restoring are functions.
DROP POLICY "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups
  FOR UPDATE USING (auth.uid() = admin_id AND archived_at IS NULL)
  WITH CHECK (auth.uid() = admin_id AND archived_at IS NULL);

-- The draw: refuses archived groups, can avoid last edition's pairs, closes invitations ----
DROP FUNCTION IF EXISTS draw_group(UUID);
CREATE FUNCTION draw_group(p_group_id UUID, p_avoid_previous BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
  givers UUID[];
  receivers UUID[];
  excluded TEXT[];
  n INT;
  ok BOOLEAN := FALSE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede hacer el sorteo';
  END IF;
  IF g.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este grupo está archivado. Restáuralo para sortear.';
  END IF;
  IF g.status = 'DRAWN' THEN
    RAISE EXCEPTION 'El sorteo ya está hecho';
  END IF;

  givers := ARRAY(SELECT user_id FROM members WHERE group_id = p_group_id ORDER BY user_id);
  n := coalesce(array_length(givers, 1), 0);
  IF n < 3 THEN
    RAISE EXCEPTION 'Hacen falta al menos 3 personas para sortear';
  END IF;

  excluded := ARRAY(
    SELECT giver_id::text || ':' || excluded_receiver_id::text
    FROM exclusions WHERE group_id = p_group_id
  );
  -- Last edition's pairs, read here and never shown to anyone.
  IF p_avoid_previous AND g.previous_group_id IS NOT NULL THEN
    excluded := excluded || ARRAY(
      SELECT giver_id::text || ':' || receiver_id::text
      FROM matches WHERE group_id = g.previous_group_id
    );
  END IF;

  FOR attempt IN 1..5000 LOOP
    receivers := ARRAY(SELECT x FROM unnest(givers) AS x ORDER BY gen_random_uuid());
    ok := TRUE;
    FOR i IN 1..n LOOP
      IF receivers[i] = givers[i]
         OR (givers[i]::text || ':' || receivers[i]::text) = ANY (excluded) THEN
        ok := FALSE;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN ok;
  END LOOP;

  IF NOT ok THEN
    IF p_avoid_previous THEN
      RAISE EXCEPTION 'No se pudo sortear sin repetir las parejas del año pasado. Prueba sin esa opción.';
    END IF;
    RAISE EXCEPTION 'No se pudo sortear con las restricciones actuales. Revisa quién no le puede regalar a quién.';
  END IF;

  INSERT INTO matches (group_id, giver_id, receiver_id)
  SELECT p_group_id, givers[i], receivers[i] FROM generate_series(1, n) AS i;

  PERFORM set_config('ghostswap.status_change', 'on', true);
  UPDATE groups SET status = 'DRAWN' WHERE id = p_group_id;
  -- Whoever didn't answer is left out of this one.
  DELETE FROM group_invitations WHERE group_id = p_group_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'DRAW', 'Se hizo el sorteo de "' || g.name || '"');

  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, p_group_id, 'draw',
         'Ya se hizo el sorteo de ' || g.name || '. Mira a quién te tocó.'
  FROM members m WHERE m.group_id = p_group_id;
END;
$$;

-- Archived groups also refuse resets, hand-overs and joins
CREATE OR REPLACE FUNCTION public.reset_group_draw(p_group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este grupo está archivado. Quien organiza puede restaurarlo.';
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
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_group(p_group_id uuid, p_new_admin uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
  old_name TEXT;
  new_name TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este grupo está archivado. Quien organiza puede restaurarlo.';
  END IF;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede pasar la organización';
  END IF;
  IF p_new_admin IS NULL OR p_new_admin = g.admin_id THEN
    RAISE EXCEPTION 'Elige a otra persona del grupo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE group_id = p_group_id AND user_id = p_new_admin) THEN
    RAISE EXCEPTION 'Esa persona no está en el grupo';
  END IF;

  UPDATE groups SET admin_id = p_new_admin WHERE id = p_group_id;
  UPDATE members SET is_admin = (user_id = p_new_admin) WHERE group_id = p_group_id;

  SELECT initcap(lower(coalesce(full_name, 'Alguien'))) INTO old_name FROM profiles WHERE id = auth.uid();
  SELECT initcap(lower(coalesce(full_name, 'otra persona'))) INTO new_name FROM profiles WHERE id = p_new_admin;
  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'ADMIN_TRANSFERRED',
          coalesce(old_name, 'Alguien') || ' le pasó la organización a ' || coalesce(new_name, 'otra persona'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.join_group(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF g.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este grupo está archivado. Quien organiza puede restaurarlo.';
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
$function$
;

-- Invitations
CREATE TABLE group_invitations (
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;
-- The invited person sees theirs; the group sees who is pending (the same people as last year).
CREATE POLICY "Invited people and group members see invitations" ON group_invitations
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_is_member_of_group(group_id));
GRANT SELECT ON group_invitations TO authenticated;

-- Repeat a group with the same people. Only its organizer can.
CREATE OR REPLACE FUNCTION repeat_group(p_group_id UUID, p_name TEXT, p_exchange_date DATE, p_budget NUMERIC)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src groups%ROWTYPE;
  new_id UUID;
  organizer TEXT;
BEGIN
  SELECT * INTO src FROM groups WHERE id = p_group_id;
  IF src.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF src.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede repetir el grupo';
  END IF;
  IF char_length(trim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Ponle un nombre al grupo nuevo';
  END IF;

  INSERT INTO groups (name, budget, currency, exchange_date, admin_id, previous_group_id)
  VALUES (trim(p_name), p_budget, src.currency, p_exchange_date, auth.uid(), src.id)
  RETURNING id INTO new_id;
  INSERT INTO members (group_id, user_id, is_admin) VALUES (new_id, auth.uid(), TRUE);

  -- Exclusions only matter between people who end up joining, so copying them all is safe.
  INSERT INTO exclusions (group_id, giver_id, excluded_receiver_id)
  SELECT new_id, giver_id, excluded_receiver_id FROM exclusions WHERE group_id = src.id;

  INSERT INTO group_invitations (group_id, user_id, invited_by)
  SELECT new_id, m.user_id, auth.uid() FROM members m
  WHERE m.group_id = src.id AND m.user_id <> auth.uid();

  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO organizer FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT i.user_id, new_id, 'invitation', organizer || ' te invitó a ' || trim(p_name)
  FROM group_invitations i WHERE i.group_id = new_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (new_id, auth.uid(), 'GROUP_CREATED', organizer || ' repitió "' || src.name || '" con las mismas personas');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION my_invitations()
RETURNS TABLE (group_id UUID, name TEXT, organizer TEXT, exchange_date DATE, budget NUMERIC, currency TEXT, invited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name, initcap(lower(p.full_name)), g.exchange_date, g.budget, g.currency, i.created_at
  FROM group_invitations i
  JOIN groups g ON g.id = i.group_id
  LEFT JOIN profiles p ON p.id = g.admin_id
  WHERE i.user_id = auth.uid()
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION answer_invitation(p_group_id UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM group_invitations WHERE group_id = p_group_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Esta invitación ya no está vigente';
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO person FROM profiles WHERE id = auth.uid();
  DELETE FROM group_invitations WHERE group_id = p_group_id AND user_id = auth.uid();
  DELETE FROM notifications WHERE group_id = p_group_id AND user_id = auth.uid() AND type = 'invitation';
  IF p_accept THEN
    IF NOT group_is_open(p_group_id) THEN
      RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
    END IF;
    INSERT INTO members (group_id, user_id, is_admin) VALUES (p_group_id, auth.uid(), FALSE)
    ON CONFLICT (group_id, user_id) DO NOTHING;
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'USER_JOINED', person || ' se unió al grupo');
  ELSE
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'INVITATION_DECLINED', person || ' no va a participar esta vez');
  END IF;
END;
$$;

-- The organizer can withdraw a pending invitation.
CREATE OR REPLACE FUNCTION cancel_invitation(p_group_id UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo quien organiza puede quitar una invitación';
  END IF;
  DELETE FROM group_invitations WHERE group_id = p_group_id AND user_id = p_user;
  DELETE FROM notifications WHERE group_id = p_group_id AND user_id = p_user AND type = 'invitation';
END;
$$;

-- Archive, restore, hide
CREATE OR REPLACE FUNCTION set_group_archived(p_group_id UUID, p_archived BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo quien organiza puede archivar o restaurar el grupo';
  END IF;
  -- Restoring turns automatic archiving off for this group, or it would archive again tonight.
  UPDATE groups
  SET archived_at = CASE WHEN p_archived THEN NOW() ELSE NULL END,
      auto_archive = CASE WHEN p_archived THEN auto_archive ELSE FALSE END
  WHERE id = p_group_id;
  IF p_archived THEN
    DELETE FROM group_invitations WHERE group_id = p_group_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_group_hidden(p_group_id UUID, p_hidden BOOLEAN)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE members SET hidden_at = CASE WHEN p_hidden THEN NOW() ELSE NULL END
  WHERE group_id = p_group_id AND user_id = auth.uid();
$$;

-- Runs daily (pg_cron below): keepsake 7 days after the exchange, or 3 months after a draw
-- when the group has no date.
CREATE OR REPLACE FUNCTION archive_due_groups()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  WITH due AS (
    UPDATE groups g SET archived_at = NOW()
    WHERE g.archived_at IS NULL AND g.auto_archive AND (
      (g.exchange_date IS NOT NULL AND g.exchange_date + 7 < CURRENT_DATE)
      OR (g.exchange_date IS NULL AND g.status = 'DRAWN' AND coalesce(
            (SELECT max(created_at) FROM activities a WHERE a.group_id = g.id AND a.type = 'DRAW'),
            g.created_at) < NOW() - INTERVAL '3 months')
    )
    RETURNING g.id
  )
  SELECT count(*) INTO n FROM due;
  DELETE FROM group_invitations WHERE group_id IN (SELECT id FROM groups WHERE archived_at IS NOT NULL);
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION archive_due_groups() FROM PUBLIC, anon, authenticated;

-- History of editions
-- Earlier editions of a group that the caller took part in. Only their own pair is included.
CREATE OR REPLACE FUNCTION group_history(p_group_id UUID)
RETURNS TABLE (group_id UUID, name TEXT, exchange_date DATE, budget NUMERIC, currency TEXT,
               participants TEXT[], you_gave_to TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT g.previous_group_id AS id, 1 AS depth FROM groups g WHERE g.id = p_group_id
    UNION ALL
    SELECT g.previous_group_id, c.depth + 1 FROM groups g JOIN chain c ON g.id = c.id
    WHERE c.depth < 50
  )
  SELECT g.id, g.name, g.exchange_date, g.budget, g.currency,
         ARRAY(SELECT initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1))))
               FROM members m JOIN profiles p ON p.id = m.user_id
               WHERE m.group_id = g.id ORDER BY p.full_name),
         (SELECT initcap(lower(p.full_name)) FROM matches x JOIN profiles p ON p.id = x.receiver_id
          WHERE x.group_id = g.id AND x.giver_id = auth.uid())
  FROM chain c JOIN groups g ON g.id = c.id
  WHERE EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id = auth.uid())
  ORDER BY c.depth;
$$;

-- Voluntary reveal
-- After the exchange (or once archived) a giver can tell their receiver who they were.
CREATE OR REPLACE FUNCTION reveal_myself(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
  mt matches%ROWTYPE;
  person TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  SELECT * INTO mt FROM matches WHERE group_id = p_group_id AND giver_id = auth.uid();
  IF mt.id IS NULL THEN
    RAISE EXCEPTION 'No tienes a quién revelarte en este grupo';
  END IF;
  IF g.archived_at IS NULL AND (g.exchange_date IS NULL OR g.exchange_date > CURRENT_DATE) THEN
    RAISE EXCEPTION 'Podrás revelarte después del intercambio';
  END IF;
  IF mt.revealed_at IS NOT NULL THEN
    RETURN;
  END IF;
  UPDATE matches SET revealed_at = NOW() WHERE id = mt.id;
  SELECT coalesce(initcap(lower(full_name)), 'Tu amigo secreto') INTO person FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  VALUES (mt.receiver_id, p_group_id, 'reveal', person || ' te regaló en ' || g.name);
END;
$$;

-- Who gave to me, only if they chose to say it.
CREATE OR REPLACE FUNCTION my_revealed_giver(p_group_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT initcap(lower(p.full_name)) FROM matches x JOIN profiles p ON p.id = x.giver_id
  WHERE x.group_id = p_group_id AND x.receiver_id = auth.uid() AND x.revealed_at IS NOT NULL;
$$;

-- Matches: the giver can see whether they already revealed themselves (own row only, as before).

-- Emails for the new notification types
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
  ELSIF NEW.type = 'invitation' THEN
    -- Who invited them: the organizer of the new edition.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM groups g JOIN profiles p ON p.id = g.admin_id WHERE g.id = NEW.group_id;
  ELSIF NEW.type = 'reveal' THEN
    -- The giver who chose to reveal themselves to this person.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.giver_id
    WHERE mt.group_id = NEW.group_id AND mt.receiver_id = NEW.user_id AND mt.revealed_at IS NOT NULL;
  ELSE
    -- For replies and wishlist changes, the other person is the recipient's own receiver.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
    WHERE mt.group_id = NEW.group_id AND mt.giver_id = NEW.user_id;
  END IF;
  url := CASE WHEN NEW.type = 'invitation' THEN 'https://ghostswap.nvrkth.com/dashboard'
              ELSE 'https://ghostswap.nvrkth.com/groups?id=' || NEW.group_id END;

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

-- Daily archiving
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ghostswap-archive';
SELECT cron.schedule('ghostswap-archive', '15 6 * * *', 'SELECT public.archive_due_groups()');

-- Who can call what
REVOKE EXECUTE ON FUNCTION draw_group(UUID, BOOLEAN), repeat_group(UUID, TEXT, DATE, NUMERIC), my_invitations(),
  answer_invitation(UUID, BOOLEAN), cancel_invitation(UUID, UUID), set_group_archived(UUID, BOOLEAN),
  set_group_hidden(UUID, BOOLEAN), group_history(UUID), reveal_myself(UUID), my_revealed_giver(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION draw_group(UUID, BOOLEAN), repeat_group(UUID, TEXT, DATE, NUMERIC), my_invitations(),
  answer_invitation(UUID, BOOLEAN), cancel_invitation(UUID, UUID), set_group_archived(UUID, BOOLEAN),
  set_group_hidden(UUID, BOOLEAN), group_history(UUID), reveal_myself(UUID), my_revealed_giver(UUID)
  TO authenticated;
