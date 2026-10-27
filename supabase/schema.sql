-- GhostSwap database schema, generated from the production database on 2026-10-26.
--
-- This is the current state, not a history: the changes that led here are in migrations/.
-- Regenerate it from the database after applying a migration instead of editing it by hand.
--
-- Privacy rests on these policies, because the site is static and every query comes from the
-- browser with the user's session:
--   * matches: each person reads only the row where they give. Nobody, the organizer included,
--     can read who gives to whom. The draw runs inside the database (draw_group).
--   * wishlists: readable by their owner and, after the draw, by the person who gives to them.
--     The rest of the group only learns whether someone wrote a list (wishlist_status).
--   * profiles: your own and those of people you share a group with.
--   * anonymous_messages: only the two people of a match; the receiver never learns who asks.
--
-- Requires the pg_net and supabase_vault extensions (notification emails, Brevo key in Vault
-- as brevo_api_key). Email templates are data: supabase/templates/notification-emails.sql.

SET check_function_bodies = false;

-- ==========================================================================================
-- Tables
-- ==========================================================================================

CREATE TABLE profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  theme text NOT NULL DEFAULT 'system'::text,
  email_notifications boolean NOT NULL DEFAULT true,
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_avatar_url_source CHECK (((avatar_url IS NULL) OR (avatar_url ~ '^https://lh3\.googleusercontent\.com/'::text) OR (avatar_url ~ '^https://ocgmlgldrmdemdjphcrv\.supabase\.co/storage/v1/object/public/avatars/'::text))),
  CONSTRAINT profiles_theme_check CHECK ((theme = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text])))
);

CREATE TABLE groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  admin_id uuid NOT NULL,
  budget numeric(10,2),
  exchange_date date,
  status group_status DEFAULT 'PLANNING'::group_status,
  invite_code text DEFAULT encode(gen_random_bytes(6), 'hex'::text),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  currency text DEFAULT 'USD'::text,
  previous_group_id uuid,
  archived_at timestamp with time zone,
  auto_archive boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'classic'::text,
  reveal_at timestamp with time zone,
  revealed_at timestamp with time zone,
  CONSTRAINT groups_invite_code_key UNIQUE (invite_code),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT groups_previous_group_id_fkey FOREIGN KEY (previous_group_id) REFERENCES groups(id) ON DELETE SET NULL,
  CONSTRAINT groups_mode_check CHECK ((mode = ANY (ARRAY['classic'::text, 'blind'::text])))
);

CREATE TABLE members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_admin boolean DEFAULT false,
  joined_at timestamp with time zone DEFAULT now(),
  hidden_at timestamp with time zone,
  CONSTRAINT members_group_id_user_id_key UNIQUE (group_id, user_id),
  CONSTRAINT members_pkey PRIMARY KEY (id),
  CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE wishlists (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wishlists_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT wishlists_group_id_user_id_fkey FOREIGN KEY (group_id, user_id) REFERENCES members(group_id, user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT wishlists_items_check CHECK (((jsonb_typeof(items) = 'array'::text) AND (jsonb_array_length(items) <= 10)))
);

CREATE TABLE exclusions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  giver_id uuid NOT NULL,
  excluded_receiver_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exclusions_group_id_giver_id_excluded_receiver_id_key UNIQUE (group_id, giver_id, excluded_receiver_id),
  CONSTRAINT exclusions_pkey PRIMARY KEY (id),
  CONSTRAINT exclusions_excluded_receiver_id_fkey FOREIGN KEY (excluded_receiver_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT exclusions_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT exclusions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT exclusions_check CHECK ((giver_id <> excluded_receiver_id))
);

CREATE TABLE matches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  giver_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  revealed_at timestamp with time zone,
  CONSTRAINT matches_group_id_giver_id_key UNIQUE (group_id, giver_id),
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT matches_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT matches_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  user_id uuid,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE anonymous_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  sender_role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anonymous_messages_pkey PRIMARY KEY (id),
  CONSTRAINT anonymous_messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT anonymous_messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 500))),
  CONSTRAINT anonymous_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['giver'::text, 'receiver'::text])))
);

CREATE TABLE notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  type text NOT NULL,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['question'::text, 'reply'::text, 'wishlist'::text, 'draw'::text, 'invitation'::text, 'reveal'::text, 'unveil'::text])))
);

CREATE TABLE email_templates (
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  CONSTRAINT email_templates_pkey PRIMARY KEY (name)
);

CREATE TABLE merge_requests (
  code text NOT NULL,
  target uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT merge_requests_pkey PRIMARY KEY (code),
  CONSTRAINT merge_requests_target_fkey FOREIGN KEY (target) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE group_invitations (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  declined_at timestamp with time zone,
  CONSTRAINT group_invitations_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_invitations_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT group_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT group_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE blind_guesses (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  guessed_user_id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blind_guesses_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT blind_guesses_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT blind_guesses_guessed_user_id_fkey FOREIGN KEY (guessed_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT blind_guesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT blind_guesses_check CHECK ((user_id <> guessed_user_id))
);

-- ==========================================================================================
-- Indexes
-- ==========================================================================================

CREATE INDEX idx_activities_group_id ON public.activities USING btree (group_id);

CREATE INDEX idx_anon_messages_match_id ON public.anonymous_messages USING btree (match_id);

CREATE INDEX idx_exclusions_giver_id ON public.exclusions USING btree (giver_id);
CREATE INDEX idx_exclusions_group_id ON public.exclusions USING btree (group_id);

CREATE INDEX idx_groups_invite_code ON public.groups USING btree (invite_code);

CREATE INDEX idx_matches_giver_id ON public.matches USING btree (giver_id);
CREATE INDEX idx_matches_group_id ON public.matches USING btree (group_id);

CREATE INDEX idx_members_group_id ON public.members USING btree (group_id);
CREATE INDEX idx_members_user_id ON public.members USING btree (user_id);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);

-- ==========================================================================================
-- Functions
-- ==========================================================================================

CREATE OR REPLACE FUNCTION public.account_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'has_password', coalesce(u.encrypted_password, '') <> '',
    'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider) FROM auth.identities i WHERE i.user_id = u.id), '[]'::jsonb)
  )
  FROM auth.users u WHERE u.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.answer_invitation(p_group_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  person TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM group_invitations
                 WHERE group_id = p_group_id AND user_id = auth.uid() AND declined_at IS NULL) THEN
    RAISE EXCEPTION 'Esta invitación ya no está vigente';
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO person FROM profiles WHERE id = auth.uid();
  DELETE FROM notifications WHERE group_id = p_group_id AND user_id = auth.uid() AND type = 'invitation';
  IF p_accept THEN
    IF NOT group_is_open(p_group_id) THEN
      RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
    END IF;
    DELETE FROM group_invitations WHERE group_id = p_group_id AND user_id = auth.uid();
    INSERT INTO members (group_id, user_id, is_admin) VALUES (p_group_id, auth.uid(), FALSE)
    ON CONFLICT (group_id, user_id) DO NOTHING;
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'USER_JOINED', person || ' se unió al grupo');
  ELSE
    UPDATE group_invitations SET declined_at = NOW() WHERE group_id = p_group_id AND user_id = auth.uid();
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'INVITATION_DECLINED', person || ' no va a participar esta vez');
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_due_groups()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.auth_user_admin_group_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM groups WHERE admin_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.auth_user_group_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT group_id FROM members WHERE user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.blind_hidden(p_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT mode = 'blind' AND revealed_at IS NULL FROM groups WHERE id = p_group), FALSE);
$function$
;

CREATE OR REPLACE FUNCTION public.blind_missing_lists(p_group_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))) ORDER BY p.full_name), '{}')
  FROM members m JOIN profiles p ON p.id = m.user_id
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id AND coalesce(jsonb_array_length(w.items), 0) = 0
    AND user_is_member_of_group(p_group_id)
    AND (SELECT status FROM groups WHERE id = p_group_id) = 'PLANNING';
$function$
;

CREATE OR REPLACE FUNCTION public.blind_results(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_invitation(p_group_id uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Solo quien organiza puede quitar una invitación';
  END IF;
  DELETE FROM group_invitations WHERE group_id = p_group_id AND user_id = p_user;
  DELETE FROM notifications WHERE group_id = p_group_id AND user_id = p_user AND type = 'invitation';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cap_name_pattern(p_word text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE left(w, 1)
           WHEN 'a' THEN '[AÁÀÂÄ]' WHEN 'e' THEN '[EÉÈÊË]' WHEN 'i' THEN '[IÍÌÎÏ]'
           WHEN 'o' THEN '[OÓÒÔÖ]' WHEN 'u' THEN '[UÚÙÛÜ]' WHEN 'n' THEN '[NÑ]'
           ELSE upper(left(w, 1)) END
         || name_pattern(substr(w, 2))
  FROM (SELECT translate(lower(p_word), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') AS w) x;
$function$
;

CREATE OR REPLACE FUNCTION public.censor_blind_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gid UUID;
BEGIN
  SELECT group_id INTO gid FROM matches WHERE id = NEW.match_id;
  IF blind_hidden(gid) THEN
    NEW.content := censor_names(gid, NEW.content);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.censor_names(p_group uuid, p_text text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sure TEXT;
  maybe TEXT;
  maybe_cap TEXT;
  cues CONSTANT TEXT := '(?:soy|eres|sea|es|era|llamo|llamas|llama|hola|chao|holi|querid[ao]|t[ií][ao]|prim[ao]|herman[ao]|amig[ao]|doña|don|señora|señor|sra|sr)';
  t TEXT := p_text;
BEGIN
  SELECT string_agg(name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE NOT ambiguous),
         string_agg(name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE ambiguous),
         string_agg(cap_name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE ambiguous)
  INTO sure, maybe, maybe_cap
  FROM group_name_words(p_group);

  IF sure IS NOT NULL THEN
    t := regexp_replace(t, '\m(' || sure || ')\M', '•••', 'gi');
  END IF;
  IF maybe IS NOT NULL THEN
    -- after a cue: "soy rosa", "¿eres luz?", "tía rosa"
    t := regexp_replace(t, '(\m' || cues || '\s+)(' || maybe || ')\M', '\1•••', 'gi');
    -- next to another masked name: "rosa •••", "••• luz"
    t := regexp_replace(t, '\m(' || maybe || ')\M(\s+•••)', '•••\2', 'gi');
    t := regexp_replace(t, '(•••\s+)(' || maybe || ')\M', '\1•••', 'gi');
    -- alone as a question or exclamation: "¿Rosa?", "luz!"
    t := regexp_replace(t, '(^|[¿¡.,;:]\s*)(' || maybe || ')(\s*[?!])', '\1•••\3', 'gi');
    -- calling someone with a colon: "Rosa: ¿qué talla usas?"
    t := regexp_replace(t, '(^|[.!?¿¡]\s*)(' || maybe || ')(\s*:)', '\1•••\3', 'gi');
    -- capitalized mid-sentence (case-sensitive): "creo que es Rosa", "le gusta Luz"
    t := regexp_replace(t, '([^\s.!?¿¡]\s+)(' || maybe_cap || ')\M', '\1•••', 'g');
  END IF;
  RETURN t;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.common_word_names()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'rosa', 'rosas', 'luz', 'paz', 'sol', 'mar', 'flor', 'flores', 'pilar', 'blanca', 'cruz',
    'alba', 'aurora', 'esperanza', 'consuelo', 'dolores', 'mercedes', 'amparo', 'socorro',
    'rocio', 'victoria', 'angeles', 'gloria', 'pura', 'soledad', 'estrella', 'cielo', 'perla',
    'violeta', 'margarita', 'azucena', 'jazmin', 'alegria', 'clemente', 'franco', 'justo',
    'santos', 'rey', 'leon', 'oro', 'plata', 'nieves', 'prado', 'vega', 'rio', 'rios', 'campos',
    'castillo', 'torres', 'montes', 'mora', 'rivera', 'calle', 'bosque', 'fuentes', 'reyes',
    'vidal', 'leal', 'bravo', 'blanco', 'moreno', 'rubio', 'delgado', 'alegre', 'caro', 'salas'
  ];
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

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  blocking TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar a tu cuenta';
  END IF;
  SELECT string_agg(g.name, ', ') INTO blocking
  FROM groups g
  WHERE g.admin_id = uid AND EXISTS (SELECT 1 FROM members m WHERE m.group_id = g.id AND m.user_id <> uid);
  IF blocking IS NOT NULL THEN
    RAISE EXCEPTION 'Organizas grupos con más personas (%). Pasa la organización a alguien o elimina esos grupos primero.', blocking;
  END IF;
  DELETE FROM groups WHERE admin_id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.do_reveal(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT m.user_id, p_group_id, 'unveil', 'Llegó la hora. Ya puedes ver a quién le regalas en ' || g.name
  FROM members m WHERE m.group_id = p_group_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draw_group(p_group_id uuid, p_avoid_previous boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
  givers UUID[];
  receivers UUID[];
  excluded TEXT[];
  n INT;
  ok BOOLEAN := FALSE;
  missing TEXT;
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
  -- A blind draw only gives a wishlist to go on: everyone needs one first.
  IF g.mode = 'blind' THEN
    SELECT string_agg(initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))), ', ' ORDER BY p.full_name)
    INTO missing
    FROM members m JOIN profiles p ON p.id = m.user_id
    LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
    WHERE m.group_id = p_group_id AND coalesce(jsonb_array_length(w.items), 0) = 0;
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'Para sortear a ciegas, todos tienen que anotar su lista. Todavía falta la de %.', missing;
    END IF;
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
$function$
;

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

CREATE OR REPLACE FUNCTION public.ensure_email_identity()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  u auth.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL OR coalesce(u.encrypted_password, '') = '' OR u.email_confirmed_at IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u.id AND provider = 'email') THEN
    RETURN;
  END IF;
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    u.id::text, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', TRUE, 'phone_verified', FALSE),
    'email', NOW(), NOW(), NOW()
  );
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{providers}',
    (SELECT jsonb_agg(DISTINCT p) FROM jsonb_array_elements_text(
      coalesce(raw_app_meta_data->'providers', '[]'::jsonb) || '["email"]'::jsonb) AS p))
  WHERE id = u.id;
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

CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(code text)
 RETURNS TABLE(id uuid, name text, exchange_date date, status group_status, member_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.id, g.name, g.exchange_date, g.status, count(m.id)
  FROM groups g
  LEFT JOIN members m ON m.group_id = g.id
  WHERE g.invite_code = code
  GROUP BY g.id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_receiver_match_id(p_group_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM matches
  WHERE group_id = p_group_id AND receiver_id = auth.uid()
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_receiver_messages(p_group_id uuid)
 RETURNS TABLE(message_id uuid, match_id uuid, sender_role text, content text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT am.id, am.match_id, am.sender_role, am.content, am.created_at
  FROM anonymous_messages am
  JOIN matches m ON m.id = am.match_id
  WHERE m.group_id = p_group_id
  AND m.receiver_id = auth.uid()
  ORDER BY am.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gives_to(p_group uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT blind_hidden(p_group) AND EXISTS (
    SELECT 1 FROM matches
    WHERE group_id = p_group AND receiver_id = p_user AND giver_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.group_archived(p_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT archived_at IS NOT NULL FROM groups WHERE id = p_group), FALSE);
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

CREATE OR REPLACE FUNCTION public.group_is_open(p_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND status = 'PLANNING' AND archived_at IS NULL);
$function$
;

CREATE OR REPLACE FUNCTION public.group_name_words(p_group uuid)
 RETURNS TABLE(word text, ambiguous boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT w2, w2 = ANY (common_word_names())
  FROM (
    SELECT translate(lower(w), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') AS w2
    FROM members m JOIN profiles p ON p.id = m.user_id,
         regexp_split_to_table(coalesce(p.full_name, '') || ' ' ||
                               regexp_replace(split_part(coalesce(p.email, ''), '@', 1), '[._+0-9-]+', ' ', 'g'),
                               '[^[:alpha:]]+') AS w
    WHERE m.group_id = p_group
  ) x
  WHERE length(w2) >= 3 AND w2 ~ '^[a-z]+$' AND w2 NOT IN ('del', 'las', 'los', 'van', 'von', 'des', 'der');
$function$
;

CREATE OR REPLACE FUNCTION public.group_pending_invitations(p_group_id uuid)
 RETURNS TABLE(user_id uuid, name text, avatar_url text, invited_at timestamp with time zone, declined boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.user_id, initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))), p.avatar_url,
         i.created_at, i.declined_at IS NOT NULL
  FROM group_invitations i JOIN profiles p ON p.id = i.user_id
  WHERE i.group_id = p_group_id AND user_is_member_of_group(p_group_id)
    -- Someone who declined and then joined with the link is simply a member now.
    AND NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = i.group_id AND m.user_id = i.user_id)
  ORDER BY p.full_name;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_group_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_group_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(current_setting('ghostswap.status_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'El estado del sorteo solo cambia al sortear o reiniciar';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.html_escape(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT replace(replace(replace(replace(replace(coalesce(t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$function$
;

CREATE OR REPLACE FUNCTION public.is_match_giver(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id AND giver_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.is_match_receiver(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM matches WHERE id = p_match_id AND receiver_id = auth.uid()
  );
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

CREATE OR REPLACE FUNCTION public.keep_blind_lists()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id AND status = 'DRAWN') AND blind_hidden(OLD.group_id) THEN
    IF TG_OP = 'DELETE' OR coalesce(jsonb_array_length(NEW.items), 0) = 0 THEN
      RAISE EXCEPTION 'En el sorteo a ciegas tu lista es la única pista de quien te regala. Puedes cambiarla, pero no dejarla vacía.';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.keepalive()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT FROM groups LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.log_member_left()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  person TEXT;
  actor UUID;
BEGIN
  -- Deleting the whole group cascades here; there is nothing left to log into.
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id) THEN
    RETURN OLD;
  END IF;
  SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = OLD.user_id;
  SELECT id INTO actor FROM profiles WHERE id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = OLD.user_id) THEN
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (OLD.group_id, NULL, 'MEMBER_LEFT', 'Una persona eliminó su cuenta y salió del grupo');
    RETURN OLD;
  END IF;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (
    OLD.group_id, actor,
    CASE WHEN OLD.user_id = auth.uid() THEN 'MEMBER_LEFT' ELSE 'MEMBER_REMOVED' END,
    coalesce(person, 'Alguien') ||
      CASE WHEN OLD.user_id = auth.uid() THEN ' salió del grupo' ELSE ' fue quitado del grupo' END
  );
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_preview(p_code text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('email', u.email, 'same', u.id = auth.uid())
  FROM merge_requests r JOIN auth.users u ON u.id = r.target
  WHERE r.code = p_code AND r.created_at > NOW() - INTERVAL '15 minutes';
$function$
;

CREATE OR REPLACE FUNCTION public.my_blind_assignment(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'match_id', x.id,
    'items', coalesce((SELECT w.items FROM wishlists w WHERE w.group_id = x.group_id AND w.user_id = x.receiver_id), '[]'::jsonb)
  )
  FROM matches x
  WHERE x.group_id = p_group_id AND x.giver_id = auth.uid() AND blind_hidden(p_group_id);
$function$
;

CREATE OR REPLACE FUNCTION public.my_guess(p_group_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT guessed_user_id FROM blind_guesses WHERE group_id = p_group_id AND user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.my_invitations()
 RETURNS TABLE(group_id uuid, name text, organizer text, exchange_date date, budget numeric, currency text, invited_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.id, g.name, initcap(lower(p.full_name)), g.exchange_date, g.budget, g.currency, i.created_at
  FROM group_invitations i
  JOIN groups g ON g.id = i.group_id
  LEFT JOIN profiles p ON p.id = g.admin_id
  WHERE i.user_id = auth.uid() AND i.declined_at IS NULL
  ORDER BY i.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.my_revealed_giver(p_group_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT initcap(lower(p.full_name)) FROM matches x JOIN profiles p ON p.id = x.giver_id
  WHERE x.group_id = p_group_id AND x.receiver_id = auth.uid() AND x.revealed_at IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.name_pattern(p_word text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT replace(replace(replace(replace(replace(replace(
    translate(lower(p_word), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun'),
    'a', '[aáàâä]'), 'e', '[eéèêë]'), 'i', '[iíìîï]'), 'o', '[oóòôö]'), 'u', '[uúùûü]'), 'n', '[nñ]');
$function$
;

CREATE OR REPLACE FUNCTION public.notify_anonymous_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.notify_wishlist_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.place_guess(p_group_id uuid, p_guessed uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND mode = 'blind' AND status = 'DRAWN') THEN
    RAISE EXCEPTION 'Solo se apuesta en un sorteo a ciegas ya hecho';
  END IF;
  IF NOT blind_hidden(p_group_id) THEN
    RAISE EXCEPTION 'Ya se reveló el sorteo, así que las apuestas están cerradas';
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_scheduled_reveals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.push_notification(p_user uuid, p_group uuid, p_type text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE notifications SET body = p_body, created_at = NOW()
  WHERE user_id = p_user AND group_id = p_group AND type = p_type AND read_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, group_id, type, body)
    VALUES (p_user, p_group, p_type, p_body);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reinvite(p_group_id uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
  organizer TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede volver a invitar';
  END IF;
  IF NOT group_is_open(p_group_id) THEN
    RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
  END IF;
  UPDATE group_invitations SET declined_at = NULL, created_at = NOW()
  WHERE group_id = p_group_id AND user_id = p_user AND declined_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona no tiene una invitación rechazada en este grupo';
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO organizer FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  VALUES (p_user, p_group_id, 'invitation', organizer || ' te volvió a invitar a ' || g.name);
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

CREATE OR REPLACE FUNCTION public.reveal_blind(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reveal_myself(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_group_archived(p_group_id uuid, p_archived boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_group_hidden(p_group_id uuid, p_hidden boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE members SET hidden_at = CASE WHEN p_hidden THEN NOW() ELSE NULL END
  WHERE group_id = p_group_id AND user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.shares_group_with(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Group admins are not always present in members, so they count as part of the group too.
  WITH my_groups AS (
    SELECT group_id FROM members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM groups WHERE admin_id = auth.uid()
  )
  SELECT EXISTS (
    SELECT 1 FROM members m JOIN my_groups g ON g.group_id = m.group_id WHERE m.user_id = target
  ) OR EXISTS (
    SELECT 1 FROM groups gr JOIN my_groups g ON g.group_id = gr.id WHERE gr.admin_id = target
  );
$function$
;

CREATE OR REPLACE FUNCTION public.start_merge()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c TEXT := encode(extensions.gen_random_bytes(24), 'hex');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar a tu cuenta';
  END IF;
  DELETE FROM merge_requests WHERE target = auth.uid() OR created_at < NOW() - INTERVAL '1 day';
  INSERT INTO merge_requests (code, target) VALUES (c, auth.uid());
  RETURN c;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_wishlist()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_member_of_group(gid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM members WHERE group_id = gid AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.wishlist_count(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'with_list', count(*) FILTER (WHERE coalesce(jsonb_array_length(w.items), 0) > 0),
    'total', count(*))
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id AND user_is_member_of_group(p_group_id);
$function$
;

CREATE OR REPLACE FUNCTION public.wishlist_status(p_group_id uuid)
 RETURNS TABLE(user_id uuid, has_items boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.user_id,
         CASE WHEN m.user_id = auth.uid() OR NOT blind_hidden(p_group_id)
                OR (SELECT mode FROM groups WHERE id = p_group_id) = 'classic'
              THEN coalesce(jsonb_array_length(w.items) > 0, FALSE) END
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid());
$function$
;

-- ==========================================================================================
-- Triggers
-- ==========================================================================================

CREATE TRIGGER censor_blind_message BEFORE INSERT ON public.anonymous_messages FOR EACH ROW EXECUTE FUNCTION censor_blind_message();

CREATE TRIGGER on_anonymous_message AFTER INSERT ON public.anonymous_messages FOR EACH ROW EXECUTE FUNCTION notify_anonymous_message();

CREATE TRIGGER guard_group_mode BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION guard_group_mode();

CREATE TRIGGER guard_group_status BEFORE UPDATE OF status ON public.groups FOR EACH ROW EXECUTE FUNCTION guard_group_status();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_member_left AFTER DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION log_member_left();

CREATE TRIGGER on_notification_email AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION email_notification();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_auth_user_email_changed AFTER UPDATE OF email ON auth.users FOR EACH ROW WHEN (((old.email)::text IS DISTINCT FROM (new.email)::text)) EXECUTE FUNCTION sync_profile_email();

CREATE TRIGGER keep_blind_lists BEFORE DELETE OR UPDATE ON public.wishlists FOR EACH ROW WHEN ((pg_trigger_depth() = 0)) EXECUTE FUNCTION keep_blind_lists();

CREATE TRIGGER on_wishlist_change AFTER INSERT OR UPDATE OF items ON public.wishlists FOR EACH ROW EXECUTE FUNCTION notify_wishlist_change();

CREATE TRIGGER touch_wishlist BEFORE UPDATE ON public.wishlists FOR EACH ROW EXECUTE FUNCTION touch_wishlist();

-- ==========================================================================================
-- Row Level Security
-- ==========================================================================================

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE anonymous_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE blind_guesses ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

ALTER TABLE merge_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- ==========================================================================================
-- Policies
-- ==========================================================================================

CREATE POLICY "Members can view group activities" ON activities
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.group_id = activities.group_id) AND (members.user_id = auth.uid())))));

CREATE POLICY "Members log their own group changes" ON activities
  FOR INSERT
  WITH CHECK (((user_id = auth.uid()) AND user_is_member_of_group(group_id) AND (NOT group_archived(group_id)) AND (type = ANY (ARRAY['GROUP_CREATED'::text, 'GROUP_UPDATED'::text])) AND (char_length(message) <= 300)));

CREATE POLICY "Match participants can send messages" ON anonymous_messages
  FOR INSERT
  WITH CHECK (((NOT group_archived(( SELECT matches.group_id
   FROM matches
  WHERE (matches.id = anonymous_messages.match_id)))) AND (((sender_role = 'giver'::text) AND is_match_giver(match_id)) OR ((sender_role = 'receiver'::text) AND is_match_receiver(match_id)))));

CREATE POLICY "Match participants can view messages" ON anonymous_messages
  FOR SELECT
  USING ((is_match_giver(match_id) OR is_match_receiver(match_id)));

CREATE POLICY "Admin can delete exclusions" ON exclusions
  FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM groups
  WHERE ((groups.id = exclusions.group_id) AND (groups.admin_id = auth.uid()) AND (groups.archived_at IS NULL)))));

CREATE POLICY "Admin can insert exclusions" ON exclusions
  FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM groups
  WHERE ((groups.id = exclusions.group_id) AND (groups.admin_id = auth.uid()) AND (groups.archived_at IS NULL)))));

CREATE POLICY "Members can view group exclusions" ON exclusions
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.group_id = exclusions.group_id) AND (members.user_id = auth.uid())))));

CREATE POLICY "Invited people and group members see invitations" ON group_invitations
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR user_is_member_of_group(group_id)));

CREATE POLICY "groups_delete" ON groups
  FOR DELETE
  USING ((auth.uid() = admin_id));

CREATE POLICY "groups_insert" ON groups
  FOR INSERT
  WITH CHECK ((auth.uid() = admin_id));

CREATE POLICY "groups_select" ON groups
  FOR SELECT
  USING (((admin_id = auth.uid()) OR (id IN ( SELECT auth_user_group_ids() AS auth_user_group_ids))));

CREATE POLICY "groups_update" ON groups
  FOR UPDATE
  USING (((auth.uid() = admin_id) AND (archived_at IS NULL)))
  WITH CHECK (((auth.uid() = admin_id) AND (archived_at IS NULL)));

CREATE POLICY "Users can only view their own match" ON matches
  FOR SELECT
  USING (((auth.uid() = giver_id) AND (NOT blind_hidden(group_id))));

CREATE POLICY "members_delete" ON members
  FOR DELETE
  USING ((group_is_open(group_id) AND (((user_id = auth.uid()) AND (NOT (group_id IN ( SELECT auth_user_admin_group_ids() AS auth_user_admin_group_ids)))) OR ((user_id <> auth.uid()) AND (group_id IN ( SELECT auth_user_admin_group_ids() AS auth_user_admin_group_ids))))));

CREATE POLICY "members_insert" ON members
  FOR INSERT
  WITH CHECK (((user_id = auth.uid()) AND is_admin AND (group_id IN ( SELECT auth_user_admin_group_ids() AS auth_user_admin_group_ids)) AND group_is_open(group_id)));

CREATE POLICY "members_select" ON members
  FOR SELECT
  USING (((user_id = auth.uid()) OR (group_id IN ( SELECT auth_user_group_ids() AS auth_user_group_ids))));

CREATE POLICY "Users mark their own notifications as read" ON notifications
  FOR UPDATE
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users see their own notifications" ON notifications
  FOR SELECT
  USING ((user_id = auth.uid()));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING ((auth.uid() = id));

CREATE POLICY "Users can view own and co-member profiles" ON profiles
  FOR SELECT TO authenticated
  USING (((id = auth.uid()) OR shares_group_with(id)));

CREATE POLICY "Members write their own wishlist" ON wishlists
  FOR INSERT
  WITH CHECK (((user_id = auth.uid()) AND user_is_member_of_group(group_id) AND (NOT group_archived(group_id))));

CREATE POLICY "Owner and their giver can read a wishlist" ON wishlists
  FOR SELECT
  USING (((user_id = auth.uid()) OR gives_to(group_id, user_id)));

CREATE POLICY "Owners delete their wishlist" ON wishlists
  FOR DELETE
  USING (((user_id = auth.uid()) AND (NOT group_archived(group_id))));

CREATE POLICY "Owners update their wishlist" ON wishlists
  FOR UPDATE
  USING (((user_id = auth.uid()) AND (NOT group_archived(group_id))))
  WITH CHECK (((user_id = auth.uid()) AND (NOT group_archived(group_id))));

-- ==========================================================================================
-- Functions only signed-in users can call
-- ==========================================================================================

REVOKE EXECUTE ON FUNCTION account_status() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION answer_invitation(p_group_id uuid, p_accept boolean) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION archive_due_groups() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION auth_user_admin_group_ids() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION auth_user_group_ids() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION blind_hidden(p_group uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION blind_missing_lists(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION blind_results(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION cancel_invitation(p_group_id uuid, p_user uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION cap_name_pattern(p_word text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION censor_blind_message() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION censor_names(p_group uuid, p_text text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION common_word_names() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION confirm_merge(p_code text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION delete_my_account() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION do_reveal(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION draw_group(p_group_id uuid, p_avoid_previous boolean) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION ensure_email_identity() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION export_my_data() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION get_receiver_match_id(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION get_receiver_messages(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION gives_to(p_group uuid, p_user uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION group_archived(p_group uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION group_history(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION group_is_open(p_group uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION group_name_words(p_group uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION group_pending_invitations(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION guard_group_mode() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION html_escape(t text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION is_match_giver(p_match_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION is_match_receiver(p_match_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION join_group(p_code text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION keep_blind_lists() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION log_member_left() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION merge_preview(p_code text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION my_blind_assignment(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION my_guess(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION my_invitations() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION my_revealed_giver(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION name_pattern(p_word text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION place_guess(p_group_id uuid, p_guessed uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION process_scheduled_reveals() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION push_notification(p_user uuid, p_group uuid, p_type text, p_body text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION reinvite(p_group_id uuid, p_user uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION repeat_group(p_group_id uuid, p_name text, p_exchange_date date, p_budget numeric) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION reset_group_draw(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION reveal_blind(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION reveal_myself(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION set_group_archived(p_group_id uuid, p_archived boolean) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION set_group_hidden(p_group_id uuid, p_hidden boolean) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION shares_group_with(target uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION start_merge() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION sync_profile_email() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION transfer_group(p_group_id uuid, p_new_admin uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION user_is_member_of_group(gid uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION wishlist_count(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION wishlist_status(p_group_id uuid) FROM PUBLIC, anon;

-- ==========================================================================================
-- Realtime
-- ==========================================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE anonymous_messages;

ALTER PUBLICATION supabase_realtime ADD TABLE groups;

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ==========================================================================================
-- Table privileges (applied after REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated)
-- ==========================================================================================

GRANT DELETE, INSERT, SELECT, UPDATE ON activities TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON anonymous_messages TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON email_templates TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON exclusions TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON group_invitations TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON groups TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON matches TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON members TO authenticated;

GRANT SELECT ON notifications TO authenticated;

GRANT UPDATE (read_at) ON notifications TO authenticated;

GRANT DELETE, INSERT, SELECT ON profiles TO authenticated;

GRANT UPDATE (avatar_url, email_notifications, full_name, theme) ON profiles TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON wishlists TO authenticated;
