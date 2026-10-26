-- "Mi cuenta": profile, sign-in methods, preferences and your data.
--
-- Profile: name and photo (own upload in the avatars bucket, the Google one, or none).
-- Sign-in: a password can be added to a Google-only account, and that registers an email
-- identity so Google can later be disconnected without locking the person out. Two accounts
-- of the same person (e.g. one with a work email and password, one with Google) can be merged
-- into the one they are signed in to, keeping its password.
-- Preferences: default theme and email notifications, stored in the profile.
-- Data: export everything about you as JSON, and delete your account.

-- Preferences -----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

GRANT UPDATE (theme, email_notifications) ON profiles TO authenticated;

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

-- Photos ------------------------------------------------------------------------------------
-- One folder per person (<user id>/...), public to read so the group can see it, writable
-- only by its owner. Small images only; the app resizes to 256 px before uploading.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars: owners read their folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatars: owners upload to their folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatars: owners replace their files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatars: owners delete their files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- A photo can only come from Google or from our own bucket (no third-party tracking pixels).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_https;
ALTER TABLE profiles ADD CONSTRAINT profiles_avatar_url_source CHECK (
  avatar_url IS NULL
  OR avatar_url ~ '^https://lh3\.googleusercontent\.com/'
  OR avatar_url ~ '^https://ocgmlgldrmdemdjphcrv\.supabase\.co/storage/v1/object/public/avatars/'
);

-- Sign-in methods ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION account_status()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'has_password', coalesce(u.encrypted_password, '') <> '',
    'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider) FROM auth.identities i WHERE i.user_id = u.id), '[]'::jsonb)
  )
  FROM auth.users u WHERE u.id = auth.uid();
$$;

-- Supabase lets a Google-only account set a password but doesn't register it as a sign-in
-- method, so it refuses to disconnect Google ("at least 1 identity"). Once the password is
-- set (and the email is verified), this adds the email identity Supabase would have created.
CREATE OR REPLACE FUNCTION ensure_email_identity()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Merging two accounts ----------------------------------------------------------------------
-- Signed in to the account that stays, the person asks for a code (start_merge). Then they
-- sign in to the other account and confirm with that code (confirm_merge): proof that both are
-- theirs. Everything of the other account moves over, its Google sign-in included, and it is
-- deleted. The account that stays keeps its email and password.
CREATE TABLE merge_requests (
  code TEXT PRIMARY KEY,
  target UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE merge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON merge_requests FROM anon, authenticated;

-- Lists follow their membership when it moves to the other account.
ALTER TABLE wishlists DROP CONSTRAINT wishlists_group_id_user_id_fkey;
ALTER TABLE wishlists ADD CONSTRAINT wishlists_group_id_user_id_fkey
  FOREIGN KEY (group_id, user_id) REFERENCES members (group_id, user_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION start_merge()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- What the other account will be merged into, so the person can check before confirming.
CREATE OR REPLACE FUNCTION merge_preview(p_code TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('email', u.email, 'same', u.id = auth.uid())
  FROM merge_requests r JOIN auth.users u ON u.id = r.target
  WHERE r.code = p_code AND r.created_at > NOW() - INTERVAL '15 minutes';
$$;

CREATE OR REPLACE FUNCTION confirm_merge(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Your data -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION export_my_data()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
      WHERE x.giver_id = me.id), '[]'::jsonb),
    'mensajes_que_enviaste', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'grupo', g.name, 'como', CASE a.sender_role WHEN 'giver' THEN 'quien regala' ELSE 'quien recibe' END,
      'mensaje', a.content, 'fecha', a.created_at) ORDER BY a.created_at)
      FROM anonymous_messages a JOIN matches x ON x.id = a.match_id JOIN groups g ON g.id = x.group_id, me
      WHERE (a.sender_role = 'giver' AND x.giver_id = me.id) OR (a.sender_role = 'receiver' AND x.receiver_id = me.id)), '[]'::jsonb),
    'avisos', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', n.type, 'texto', n.body, 'fecha', n.created_at) ORDER BY n.created_at)
      FROM notifications n, me WHERE n.user_id = me.id), '[]'::jsonb)
  );
$$;

-- Deleting your account. Groups you organize must be handed over or deleted first if anyone
-- else is in them; groups where you are alone go with you. Everything else is removed by the
-- foreign keys (memberships, lists, draws, messages, notifications). The app removes your
-- photo files from storage before calling this.
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION account_status(), ensure_email_identity(), start_merge(), merge_preview(TEXT),
  confirm_merge(TEXT), export_my_data(), delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_status(), ensure_email_identity(), start_merge(), merge_preview(TEXT),
  confirm_merge(TEXT), export_my_data(), delete_my_account() TO authenticated;
