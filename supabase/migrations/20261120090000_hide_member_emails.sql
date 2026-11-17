-- Members see each other's name and photo, not their email. The app stopped asking for it on
-- 18-nov-2026; this waits until no open tab runs the version that did. Database functions
-- (security definer) still read it to send the notices; your own email comes from your session.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, created_at, updated_at, theme, email_notifications)
  ON public.profiles TO authenticated;
