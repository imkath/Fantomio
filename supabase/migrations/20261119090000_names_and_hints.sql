-- Names are always there, organizers get a hint of each member's email, and two photo files per
-- person are enough (Kath, 18-nov-2026).

-- 1. Everyone has a name: nobody draws with "no name". On 18-nov-2026 all 29 accounts had one.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_present
  CHECK (full_name IS NOT NULL AND char_length(btrim(full_name)) >= 1) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_full_name_present;

-- New accounts: an empty name from sign-up or Google falls back to the start of the email.
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
    left(COALESCE(nullif(btrim(NEW.raw_user_meta_data->>'name'), ''),
                  nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
                  split_part(NEW.email, '@', 1)), 300),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- 2. The organizer sees a hint of each member's email ("an***@gmail.com"): enough to tell two
--    people with the same name apart, or to notice someone who joined twice, without being able
--    to collect addresses. Nobody else sees any of it.
CREATE OR REPLACE FUNCTION public.group_email_hints(p_group_id uuid)
 RETURNS TABLE (user_id uuid, hint text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.user_id,
         -- First two letters and the last one: "an***a@gmail.com" (short ones keep only the first).
         CASE WHEN char_length(split_part(p.email, '@', 1)) >= 4
              THEN left(split_part(p.email, '@', 1), 2) || '***' || right(split_part(p.email, '@', 1), 1)
              ELSE left(split_part(p.email, '@', 1), 1) || '***' END
         || '@' || split_part(p.email, '@', 2)
  FROM members m JOIN profiles p ON p.id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.admin_id = auth.uid())
$function$;
REVOKE ALL ON FUNCTION public.group_email_hints(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_email_hints(uuid) TO authenticated;

-- 3. One profile photo per account: two files leave room for the swap when it changes.
DROP POLICY "Avatars: owners upload to their folder" ON storage.objects;
CREATE POLICY "Avatars: owners upload to their folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'avatars'
         AND o.name LIKE auth.uid()::text || '/%') < 2);
