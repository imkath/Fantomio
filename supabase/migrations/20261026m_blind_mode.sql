-- "Sorteo a ciegas": each person knows what to give but not to whom.
--
-- The organizer picks the mode when creating the group (classic stays exactly as it was).
-- In a blind group, after the draw each giver gets their receiver's wishlist with no name,
-- photo or id, can place a guess, and everyone learns their person at the reveal: when the
-- organizer taps "Revelar ahora" or, as a backup, at a scheduled time (pg_cron, every 5 min).
--
-- Hiding the name only on screen would leak it, so until the reveal the database withholds
-- it everywhere: the match row, the receiver's wishlist row, gives_to(), the wishlist and
-- reply notifications and emails, the data export and the editions history.

ALTER TABLE groups
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'classic' CHECK (mode IN ('classic', 'blind')),
  ADD COLUMN reveal_at TIMESTAMPTZ,
  ADD COLUMN revealed_at TIMESTAMPTZ;

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('question', 'reply', 'wishlist', 'draw', 'invitation', 'reveal', 'unveil'));

-- True while a blind group's pairs must stay secret from the givers themselves.
CREATE OR REPLACE FUNCTION blind_hidden(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT mode = 'blind' AND revealed_at IS NULL FROM groups WHERE id = p_group), FALSE);
$$;
REVOKE EXECUTE ON FUNCTION blind_hidden(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION blind_hidden(UUID) TO authenticated;

-- The mode can't change once there is a draw; it would expose or scramble the game.
CREATE OR REPLACE FUNCTION guard_group_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode IS DISTINCT FROM OLD.mode AND OLD.status = 'DRAWN' THEN
    RAISE EXCEPTION 'El tipo de sorteo no se puede cambiar después de sortear';
  END IF;
  IF NEW.revealed_at IS DISTINCT FROM OLD.revealed_at
     AND coalesce(current_setting('ghostswap.reveal', true), '') <> 'on' THEN
    RAISE EXCEPTION 'La revelación solo se hace desde el botón o a la hora fijada';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_group_mode BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION guard_group_mode();

-- Leak 1: the match row (who you give to) ------------------------------------------------------
DROP POLICY "Users can only view their own match" ON matches;
CREATE POLICY "Users can only view their own match" ON matches
  FOR SELECT USING (auth.uid() = giver_id AND NOT blind_hidden(group_id));

-- The chat checked "is this my match" by reading matches as the user; now that the row can be
-- hidden, it asks a definer function instead.
CREATE OR REPLACE FUNCTION is_match_giver(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id AND giver_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION is_match_giver(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_match_giver(UUID) TO authenticated;

DROP POLICY "Match participants can send messages" ON anonymous_messages;
CREATE POLICY "Match participants can send messages" ON anonymous_messages
  FOR INSERT WITH CHECK (
    NOT group_archived((SELECT group_id FROM matches WHERE id = match_id))
    AND ((sender_role = 'giver' AND is_match_giver(match_id))
         OR (sender_role = 'receiver' AND is_match_receiver(match_id)))
  );
DROP POLICY "Match participants can view messages" ON anonymous_messages;
CREATE POLICY "Match participants can view messages" ON anonymous_messages
  FOR SELECT USING (is_match_giver(match_id) OR is_match_receiver(match_id));

-- Leak 2: the receiver's wishlist row and gives_to() ------------------------------------------
-- gives_to() could be asked about each member in turn; in a hidden blind group it says no to
-- everyone, which also keeps the wishlist row (and its user_id) out of the giver's reach.
CREATE OR REPLACE FUNCTION gives_to(p_group UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT blind_hidden(p_group) AND EXISTS (
    SELECT 1 FROM matches
    WHERE group_id = p_group AND receiver_id = p_user AND giver_id = auth.uid()
  );
$$;

-- What a blind giver gets instead: the list and the chat id, nothing that identifies the person.
CREATE OR REPLACE FUNCTION my_blind_assignment(p_group_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'match_id', x.id,
    'items', coalesce((SELECT w.items FROM wishlists w WHERE w.group_id = x.group_id AND w.user_id = x.receiver_id), '[]'::jsonb)
  )
  FROM matches x
  WHERE x.group_id = p_group_id AND x.giver_id = auth.uid() AND blind_hidden(p_group_id);
$$;

-- Leak 3: notifications and emails --------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_anonymous_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m matches%ROWTYPE;
  group_name TEXT;
  receiver_name TEXT;
BEGIN
  SELECT * INTO m FROM matches WHERE id = NEW.match_id;
  SELECT name INTO group_name FROM groups WHERE id = m.group_id;

  IF NEW.sender_role = 'giver' THEN
    PERFORM push_notification(m.receiver_id, m.group_id, 'question',
      'Quien te regala te hizo una pregunta en ' || group_name);
  ELSE
    IF NOT blind_hidden(m.group_id) THEN
      SELECT initcap(lower(full_name)) INTO receiver_name FROM profiles WHERE id = m.receiver_id;
    END IF;
    PERFORM push_notification(m.giver_id, m.group_id, 'reply',
      coalesce(receiver_name, 'Tu amigo secreto') || ' respondió tu pregunta en ' || group_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_wishlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  giver UUID;
  person TEXT;
  group_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.items IS NOT DISTINCT FROM NEW.items THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND jsonb_array_length(NEW.items) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT giver_id INTO giver FROM matches
  WHERE group_id = NEW.group_id AND receiver_id = NEW.user_id;
  IF giver IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT blind_hidden(NEW.group_id) THEN
    SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = NEW.user_id;
  END IF;
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  PERFORM push_notification(giver, NEW.group_id, 'wishlist',
    coalesce(person, 'Tu amigo secreto') || ' actualizó su lista en ' || group_name);
  RETURN NEW;
END;
$$;

-- Guesses (A11): one per person, never for oneself, changeable until the reveal. Read and
-- written only through functions; the table itself is closed.
CREATE TABLE blind_guesses (
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  guessed_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id),
  CHECK (user_id <> guessed_user_id)
);
ALTER TABLE blind_guesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON blind_guesses FROM anon, authenticated;

-- The email for wishlist changes and replies names the giver's person: not in a hidden game.
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

CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS id)
  SELECT jsonb_build_object(
    'exportado', NOW(),
    'cuenta', (SELECT jsonb_build_object(
      'correo', u.email, 'creada', u.created_at, 'ultimo_ingreso', u.last_sign_in_at,
      'metodos_de_entrada', (SELECT jsonb_agg(DISTINCT provider) FROM auth.identities WHERE user_id = u.id))
      FROM auth.users u, me WHERE u.id = me.id),
    'perfil', (SELECT jsonb_build_object('nombre', p.full_name, 'foto', p.avatar_url,
      'tema', p.theme, 'avisos_por_correo', p.email_notifications)
      FROM profiles p, me WHERE p.id = me.id),
    'grupos', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'nombre', g.name, 'estado', g.status, 'organizas', g.admin_id = me.id,
      'fecha_intercambio', g.exchange_date, 'presupuesto', g.budget, 'moneda', g.currency,
      'te_uniste', m.joined_at) ORDER BY m.joined_at)
      FROM members m JOIN groups g ON g.id = m.group_id, me WHERE m.user_id = me.id), '[]'::jsonb),
    'listas_de_deseos', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'cosas', w.items))
      FROM wishlists w JOIN groups g ON g.id = w.group_id, me WHERE w.user_id = me.id), '[]'::jsonb),
    'a_quien_le_regalas', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'persona', p.full_name))
      FROM matches x JOIN groups g ON g.id = x.group_id JOIN profiles p ON p.id = x.receiver_id, me
      WHERE x.giver_id = me.id AND NOT blind_hidden(x.group_id)), '[]'::jsonb),
    'mensajes_que_enviaste', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'grupo', g.name, 'como', CASE a.sender_role WHEN 'giver' THEN 'quien regala' ELSE 'quien recibe' END,
      'mensaje', a.content, 'fecha', a.created_at) ORDER BY a.created_at)
      FROM anonymous_messages a JOIN matches x ON x.id = a.match_id JOIN groups g ON g.id = x.group_id, me
      WHERE (a.sender_role = 'giver' AND x.giver_id = me.id) OR (a.sender_role = 'receiver' AND x.receiver_id = me.id)), '[]'::jsonb),
    'apuestas', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'creias_que_era', p.full_name))
      FROM blind_guesses b JOIN groups g ON g.id = b.group_id JOIN profiles p ON p.id = b.guessed_user_id, me
      WHERE b.user_id = me.id), '[]'::jsonb),
    'avisos', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', n.type, 'texto', n.body, 'fecha', n.created_at) ORDER BY n.created_at)
      FROM notifications n, me WHERE n.user_id = me.id), '[]'::jsonb)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.group_history(p_group_id uuid)
 RETURNS TABLE(group_id uuid, name text, exchange_date date, budget numeric, currency text, participants text[], you_gave_to text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          WHERE x.group_id = g.id AND x.giver_id = auth.uid() AND NOT blind_hidden(g.id))
  FROM chain c JOIN groups g ON g.id = c.id
  WHERE EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id = auth.uid())
  ORDER BY c.depth;
$function$
;

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
  PERFORM set_config('ghostswap.reveal', 'on', true);
  UPDATE groups SET status = 'PLANNING', revealed_at = NULL WHERE id = p_group_id;
  DELETE FROM blind_guesses WHERE group_id = p_group_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'DRAW_RESET', 'Se reinició el sorteo de "' || g.name || '"');
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.repeat_group(p_group_id uuid, p_name text, p_exchange_date date, p_budget numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO groups (name, budget, currency, exchange_date, admin_id, previous_group_id, mode)
  VALUES (trim(p_name), p_budget, src.currency, p_exchange_date, auth.uid(), src.id, src.mode)
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
$function$
;
CREATE OR REPLACE FUNCTION public.confirm_merge(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  src UUID := auth.uid();
  dst UUID;
  dst_email TEXT;
  shared TEXT;
BEGIN
  IF src IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar a tu cuenta';
  END IF;
  SELECT target INTO dst FROM merge_requests
  WHERE code = p_code AND created_at > NOW() - INTERVAL '15 minutes' FOR UPDATE;
  IF dst IS NULL THEN
    RAISE EXCEPTION 'El enlace para unir cuentas venció. Vuelve a empezar desde Mi cuenta.';
  END IF;
  IF dst = src THEN
    RAISE EXCEPTION 'Entraste con la misma cuenta. Entra con la otra para unirlas.';
  END IF;
  SELECT string_agg(g.name, ', ') INTO shared
  FROM members a JOIN members b ON a.group_id = b.group_id JOIN groups g ON g.id = a.group_id
  WHERE a.user_id = src AND b.user_id = dst;
  IF shared IS NOT NULL THEN
    RAISE EXCEPTION 'Las dos cuentas están en el mismo grupo (%). Sal de ese grupo con una de ellas y vuelve a intentarlo.', shared;
  END IF;

  UPDATE groups SET admin_id = dst WHERE admin_id = src;
  UPDATE members SET user_id = dst WHERE user_id = src;
  UPDATE matches SET giver_id = dst WHERE giver_id = src;
  UPDATE matches SET receiver_id = dst WHERE receiver_id = src;
  UPDATE exclusions SET giver_id = dst WHERE giver_id = src;
  UPDATE exclusions SET excluded_receiver_id = dst WHERE excluded_receiver_id = src;
  UPDATE activities SET user_id = dst WHERE user_id = src;
  UPDATE notifications SET user_id = dst WHERE user_id = src;
  UPDATE blind_guesses SET user_id = dst WHERE user_id = src;
  UPDATE blind_guesses SET guessed_user_id = dst WHERE guessed_user_id = src;
  -- Google (and any other provider) moves over; the other account's password does not.
  UPDATE auth.identities SET user_id = dst, updated_at = NOW()
  WHERE user_id = src AND provider <> 'email';
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{providers}',
    coalesce((SELECT jsonb_agg(DISTINCT provider) FROM auth.identities WHERE user_id = dst), '[]'::jsonb))
  WHERE id = dst;

  DELETE FROM merge_requests WHERE target = dst;
  DELETE FROM auth.users WHERE id = src;
  SELECT email INTO dst_email FROM auth.users WHERE id = dst;
  RETURN dst_email;
END;
$function$
;

-- A8: per-person checkmarks would let a giver narrow down an empty list by elimination. In a
-- blind group only your own status and the total are given.
CREATE OR REPLACE FUNCTION wishlist_status(p_group_id UUID)
RETURNS TABLE (user_id UUID, has_items BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         CASE WHEN m.user_id = auth.uid() OR NOT blind_hidden(p_group_id)
                OR (SELECT mode FROM groups WHERE id = p_group_id) = 'classic'
              THEN coalesce(jsonb_array_length(w.items) > 0, FALSE) END
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION wishlist_count(p_group_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'with_list', count(*) FILTER (WHERE coalesce(jsonb_array_length(w.items), 0) > 0),
    'total', count(*))
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id AND user_is_member_of_group(p_group_id);
$$;

-- A10: names in the chat --------------------------------------------------------------------------
-- Every member's names are masked, not only the two people in the conversation: masking just
-- theirs would confirm a right guess. Case and accents don't matter ("maria" = "María").
CREATE OR REPLACE FUNCTION name_pattern(p_word TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(replace(replace(
    translate(lower(p_word), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun'),
    'a', '[aáàâä]'), 'e', '[eéèêë]'), 'i', '[iíìîï]'), 'o', '[oóòôö]'), 'u', '[uúùûü]'), 'n', '[nñ]');
$$;

CREATE OR REPLACE FUNCTION group_name_regex(p_group UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH words AS (
    SELECT DISTINCT translate(lower(w), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') AS word
    FROM members m JOIN profiles p ON p.id = m.user_id,
         regexp_split_to_table(coalesce(p.full_name, '') || ' ' ||
                               regexp_replace(split_part(coalesce(p.email, ''), '@', 1), '[._+0-9-]+', ' ', 'g'),
                               '[^[:alpha:]]+') AS w
    WHERE m.group_id = p_group
  )
  SELECT '\m(' || string_agg(name_pattern(word), '|' ORDER BY length(word) DESC) || ')\M'
  FROM words
  WHERE length(word) >= 3 AND word ~ '^[a-z]+$'
    AND word NOT IN ('del', 'las', 'los', 'van', 'von', 'des', 'der');
$$;
REVOKE EXECUTE ON FUNCTION group_name_regex(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION censor_blind_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
  pattern TEXT;
BEGIN
  SELECT group_id INTO gid FROM matches WHERE id = NEW.match_id;
  IF NOT blind_hidden(gid) THEN
    RETURN NEW;
  END IF;
  pattern := group_name_regex(gid);
  IF pattern IS NOT NULL THEN
    NEW.content := regexp_replace(NEW.content, pattern, '•••', 'gi');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER censor_blind_message BEFORE INSERT ON anonymous_messages
  FOR EACH ROW EXECUTE FUNCTION censor_blind_message();

-- A11-A13: guesses, reveal, results ------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_guess(p_group_id UUID, p_guessed UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND mode = 'blind' AND status = 'DRAWN') THEN
    RAISE EXCEPTION 'Solo se apuesta en un sorteo a ciegas ya hecho';
  END IF;
  IF NOT blind_hidden(p_group_id) THEN
    RAISE EXCEPTION 'Ya se reveló: las apuestas están cerradas';
  END IF;
  IF NOT user_is_member_of_group(p_group_id) THEN
    RAISE EXCEPTION 'No estás en este grupo';
  END IF;
  IF p_guessed = auth.uid()
     OR NOT EXISTS (SELECT 1 FROM members WHERE group_id = p_group_id AND user_id = p_guessed) THEN
    RAISE EXCEPTION 'Elige a otra persona del grupo';
  END IF;
  INSERT INTO blind_guesses (group_id, user_id, guessed_user_id) VALUES (p_group_id, auth.uid(), p_guessed)
  ON CONFLICT (group_id, user_id) DO UPDATE SET guessed_user_id = EXCLUDED.guessed_user_id, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION my_guess(p_group_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT guessed_user_id FROM blind_guesses WHERE group_id = p_group_id AND user_id = auth.uid();
$$;

-- Shared by the button and the scheduled reveal.
CREATE OR REPLACE FUNCTION do_reveal(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.mode <> 'blind' OR g.status <> 'DRAWN' OR g.revealed_at IS NOT NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('ghostswap.reveal', 'on', true);
  UPDATE groups SET revealed_at = NOW() WHERE id = p_group_id;
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, p_group_id, 'unveil', 'Llegó la hora: ya puedes ver a quién le regalas en ' || g.name
  FROM members m WHERE m.group_id = p_group_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION do_reveal(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION reveal_blind(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede revelar';
  END IF;
  IF g.mode <> 'blind' OR g.status <> 'DRAWN' THEN
    RAISE EXCEPTION 'No hay un sorteo a ciegas que revelar';
  END IF;
  PERFORM do_reveal(p_group_id);
END;
$$;

CREATE OR REPLACE FUNCTION process_scheduled_reveals()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
  n INTEGER := 0;
BEGIN
  FOR gid IN
    SELECT id FROM groups
    WHERE mode = 'blind' AND status = 'DRAWN' AND revealed_at IS NULL AND reveal_at <= NOW()
  LOOP
    PERFORM do_reveal(gid);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION process_scheduled_reveals() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION blind_results(p_group_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'my_guess', (SELECT initcap(lower(p.full_name)) FROM blind_guesses b JOIN profiles p ON p.id = b.guessed_user_id
                 WHERE b.group_id = p_group_id AND b.user_id = auth.uid()),
    'correct', (SELECT b.guessed_user_id = x.receiver_id FROM blind_guesses b
                JOIN matches x ON x.group_id = b.group_id AND x.giver_id = b.user_id
                WHERE b.group_id = p_group_id AND b.user_id = auth.uid()),
    'correct_count', (SELECT count(*) FROM blind_guesses b
                      JOIN matches x ON x.group_id = b.group_id AND x.giver_id = b.user_id
                      WHERE b.group_id = p_group_id AND b.guessed_user_id = x.receiver_id),
    'guess_count', (SELECT count(*) FROM blind_guesses WHERE group_id = p_group_id),
    'total', (SELECT count(*) FROM members WHERE group_id = p_group_id)
  )
  WHERE user_is_member_of_group(p_group_id) AND NOT blind_hidden(p_group_id)
    AND (SELECT mode FROM groups WHERE id = p_group_id) = 'blind';
$$;

-- The voluntary "tell them it was me" makes no sense before a blind reveal.
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
  IF blind_hidden(p_group_id) THEN
    RAISE EXCEPTION 'Primero tiene que revelarse el sorteo a ciegas';
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

-- A14: archiving a blind group reveals it first, or it would stay hidden forever --------------
CREATE OR REPLACE FUNCTION set_group_archived(p_group_id UUID, p_archived BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo quien organiza puede archivar o restaurar el grupo';
  END IF;
  IF p_archived THEN
    PERFORM do_reveal(p_group_id);
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

CREATE OR REPLACE FUNCTION archive_due_groups()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
  n INTEGER := 0;
BEGIN
  FOR gid IN
    SELECT g.id FROM groups g
    WHERE g.archived_at IS NULL AND g.auto_archive AND (
      (g.exchange_date IS NOT NULL AND g.exchange_date + 7 < CURRENT_DATE)
      OR (g.exchange_date IS NULL AND g.status = 'DRAWN' AND coalesce(
            (SELECT max(created_at) FROM activities a WHERE a.group_id = g.id AND a.type = 'DRAW'),
            g.created_at) < NOW() - INTERVAL '3 months')
    )
  LOOP
    PERFORM do_reveal(gid);
    UPDATE groups SET archived_at = NOW() WHERE id = gid;
    n := n + 1;
  END LOOP;
  DELETE FROM group_invitations WHERE group_id IN (SELECT id FROM groups WHERE archived_at IS NOT NULL);
  RETURN n;
END;
$$;

-- Scheduled reveal checked every minute ----------------------------------------------------------
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ghostswap-reveal';
SELECT cron.schedule('ghostswap-reveal', '* * * * *', 'SELECT public.process_scheduled_reveals()');

REVOKE EXECUTE ON FUNCTION my_blind_assignment(UUID), wishlist_count(UUID), place_guess(UUID, UUID),
  my_guess(UUID), reveal_blind(UUID), blind_results(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_blind_assignment(UUID), wishlist_count(UUID), place_guess(UUID, UUID),
  my_guess(UUID), reveal_blind(UUID), blind_results(UUID) TO authenticated;
