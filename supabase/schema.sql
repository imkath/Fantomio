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
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
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
  CONSTRAINT groups_invite_code_key UNIQUE (invite_code),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_admin boolean DEFAULT false,
  joined_at timestamp with time zone DEFAULT now(),
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
  CONSTRAINT wishlists_group_id_user_id_fkey FOREIGN KEY (group_id, user_id) REFERENCES members(group_id, user_id) ON DELETE CASCADE,
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
  CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['question'::text, 'reply'::text, 'wishlist'::text, 'draw'::text])))
);

CREATE TABLE email_templates (
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  CONSTRAINT email_templates_pkey PRIMARY KEY (name)
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

CREATE OR REPLACE FUNCTION public.draw_group(p_group_id uuid)
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
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede hacer el sorteo';
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
    RAISE EXCEPTION 'No se pudo sortear con las restricciones actuales. Revisa quién no le puede regalar a quién.';
  END IF;

  INSERT INTO matches (group_id, giver_id, receiver_id)
  SELECT p_group_id, givers[i], receivers[i] FROM generate_series(1, n) AS i;

  PERFORM set_config('ghostswap.status_change', 'on', true);
  UPDATE groups SET status = 'DRAWN' WHERE id = p_group_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'DRAW', 'Se hizo el sorteo de "' || g.name || '"');

  -- One notification per person; its email goes out through email_notification().
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
    WHEN 'draw' THEN INTERVAL '0'
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

CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(code text)
 RETURNS TABLE(id uuid, name text, admin_id uuid, budget numeric, exchange_date date, status group_status, member_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.admin_id,
    g.budget,
    g.exchange_date,
    g.status,
    COUNT(m.id) as member_count
  FROM groups g
  LEFT JOIN members m ON m.group_id = g.id
  WHERE g.invite_code = code
  GROUP BY g.id;
END;
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

CREATE OR REPLACE FUNCTION public.get_user_group_ids(user_uuid uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT group_id FROM members WHERE user_id = user_uuid;
$function$
;

CREATE OR REPLACE FUNCTION public.gives_to(p_group uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE group_id = p_group AND receiver_id = p_user AND giver_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.group_is_open(p_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND status = 'PLANNING');
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
    SELECT initcap(lower(full_name)) INTO receiver_name FROM profiles WHERE id = m.receiver_id;
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

  SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  PERFORM push_notification(giver, NEW.group_id, 'wishlist',
    coalesce(person, 'Tu amigo secreto') || ' actualizó su lista en ' || group_name);
  RETURN NEW;
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
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede reiniciar el sorteo';
  END IF;
  IF g.status <> 'DRAWN' THEN
    RAISE EXCEPTION 'El grupo todavía no tiene sorteo';
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
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM members WHERE group_id = gid AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.wishlist_status(p_group_id uuid)
 RETURNS TABLE(user_id uuid, has_items boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.user_id, coalesce(jsonb_array_length(w.items) > 0, FALSE)
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid());
$function$
;

-- ==========================================================================================
-- Triggers
-- ==========================================================================================

CREATE TRIGGER on_anonymous_message AFTER INSERT ON public.anonymous_messages FOR EACH ROW EXECUTE FUNCTION notify_anonymous_message();

CREATE TRIGGER guard_group_status BEFORE UPDATE OF status ON public.groups FOR EACH ROW EXECUTE FUNCTION guard_group_status();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_notification_email AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION email_notification();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_wishlist_change AFTER INSERT OR UPDATE OF items ON public.wishlists FOR EACH ROW EXECUTE FUNCTION notify_wishlist_change();

CREATE TRIGGER touch_wishlist BEFORE UPDATE ON public.wishlists FOR EACH ROW EXECUTE FUNCTION touch_wishlist();

-- ==========================================================================================
-- Row Level Security
-- ==========================================================================================

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE anonymous_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- ==========================================================================================
-- Policies
-- ==========================================================================================

CREATE POLICY "Members can create activities" ON activities
  FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.group_id = activities.group_id) AND (members.user_id = auth.uid())))));

CREATE POLICY "Members can view group activities" ON activities
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.group_id = activities.group_id) AND (members.user_id = auth.uid())))));

CREATE POLICY "Match participants can send messages" ON anonymous_messages
  FOR INSERT
  WITH CHECK ((((sender_role = 'giver'::text) AND (EXISTS ( SELECT 1
   FROM matches
  WHERE ((matches.id = anonymous_messages.match_id) AND (matches.giver_id = auth.uid()))))) OR ((sender_role = 'receiver'::text) AND is_match_receiver(match_id))));

CREATE POLICY "Match participants can view messages" ON anonymous_messages
  FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM matches
  WHERE ((matches.id = anonymous_messages.match_id) AND (matches.giver_id = auth.uid())))) OR is_match_receiver(match_id)));

CREATE POLICY "Admin can delete exclusions" ON exclusions
  FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM groups
  WHERE ((groups.id = exclusions.group_id) AND (groups.admin_id = auth.uid())))));

CREATE POLICY "Admin can insert exclusions" ON exclusions
  FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM groups
  WHERE ((groups.id = exclusions.group_id) AND (groups.admin_id = auth.uid())))));

CREATE POLICY "Members can view group exclusions" ON exclusions
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.group_id = exclusions.group_id) AND (members.user_id = auth.uid())))));

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
  USING ((auth.uid() = admin_id))
  WITH CHECK ((auth.uid() = admin_id));

CREATE POLICY "Users can only view their own match" ON matches
  FOR SELECT
  USING ((auth.uid() = giver_id));

CREATE POLICY "members_delete" ON members
  FOR DELETE
  USING (((user_id = auth.uid()) OR (group_id IN ( SELECT auth_user_admin_group_ids() AS auth_user_admin_group_ids))));

CREATE POLICY "members_insert" ON members
  FOR INSERT
  WITH CHECK (((user_id = auth.uid()) AND group_is_open(group_id)));

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
  WITH CHECK (((user_id = auth.uid()) AND user_is_member_of_group(group_id)));

CREATE POLICY "Owner and their giver can read a wishlist" ON wishlists
  FOR SELECT
  USING (((user_id = auth.uid()) OR gives_to(group_id, user_id)));

CREATE POLICY "Owners delete their wishlist" ON wishlists
  FOR DELETE
  USING ((user_id = auth.uid()));

CREATE POLICY "Owners update their wishlist" ON wishlists
  FOR UPDATE
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

-- ==========================================================================================
-- Functions only signed-in users can call
-- ==========================================================================================

REVOKE EXECUTE ON FUNCTION draw_group(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION push_notification(p_user uuid, p_group uuid, p_type text, p_body text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION reset_group_draw(p_group_id uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION shares_group_with(target uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION wishlist_status(p_group_id uuid) FROM PUBLIC, anon;

-- ==========================================================================================
-- Realtime
-- ==========================================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE anonymous_messages;

ALTER PUBLICATION supabase_realtime ADD TABLE groups;

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
