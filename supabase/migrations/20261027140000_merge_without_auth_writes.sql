-- Merging accounts no longer edits Supabase's own auth tables. The database moves only GhostSwap
-- data and deletes the other account; its Google sign-in is connected to the account that stays
-- through Supabase's own linkIdentity flow, from the browser, right after the merge.
--
-- Also fixes two things the merge used to leave behind: pending invitations of the deleted
-- account were dropped by the cascade, and so were the "invited by" marks it had made.

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
  -- Wishlists follow members through their foreign key (ON UPDATE CASCADE).
  UPDATE members SET user_id = dst WHERE user_id = src;
  UPDATE matches SET giver_id = dst WHERE giver_id = src;
  UPDATE matches SET receiver_id = dst WHERE receiver_id = src;
  UPDATE exclusions SET giver_id = dst WHERE giver_id = src;
  UPDATE exclusions SET excluded_receiver_id = dst WHERE excluded_receiver_id = src;
  UPDATE activities SET user_id = dst WHERE user_id = src;
  UPDATE notifications SET user_id = dst WHERE user_id = src;
  UPDATE blind_guesses SET user_id = dst WHERE user_id = src;
  UPDATE blind_guesses SET guessed_user_id = dst WHERE guessed_user_id = src;
  -- An invitation moves unless the account that stays already has one for that group or is
  -- already in it; those duplicates go away with the deleted account.
  UPDATE group_invitations i SET user_id = dst
  WHERE i.user_id = src
    AND NOT EXISTS (SELECT 1 FROM group_invitations x WHERE x.group_id = i.group_id AND x.user_id = dst)
    AND NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = i.group_id AND m.user_id = dst);
  UPDATE group_invitations SET invited_by = dst WHERE invited_by = src;

  DELETE FROM merge_requests WHERE target = dst;
  DELETE FROM auth.users WHERE id = src;
  SELECT email INTO dst_email FROM auth.users WHERE id = dst;
  RETURN dst_email;
END;
$function$
;

-- Registers the password of a Google-only account as a sign-in method, so Google can be
-- disconnected later. Supabase doesn't do it on its own when a password is added, and offers no
-- endpoint for it, so this is the one place left that writes to auth.identities. It now answers
-- whether it worked instead of failing loudly: the password itself is already saved by then, and
-- if Supabase ever changes that table the person keeps signing in and sees a clear message.
DROP FUNCTION IF EXISTS public.ensure_email_identity();

CREATE FUNCTION public.ensure_email_identity()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  u auth.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL OR coalesce(u.encrypted_password, '') = '' OR u.email_confirmed_at IS NULL THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u.id AND provider = 'email') THEN
    RETURN TRUE;
  END IF;
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ensure_email_identity failed for %: %', u.id, SQLERRM;
    RETURN FALSE;
  END;
  RETURN TRUE;
END;
$function$
;

REVOKE ALL ON FUNCTION public.ensure_email_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_email_identity() TO authenticated;
