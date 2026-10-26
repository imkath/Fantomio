-- Functions callable without a session.
--
-- Supabase grants EXECUTE on every new function in public to anon. Most of ours read
-- auth.uid() and answer nothing to a visitor, but get_user_group_ids(user_uuid) returned the
-- groups of any user id it was given, to anyone. Nothing used it.
--
-- Now only signed-in users can call the helpers. The one exception is the invite preview
-- (get_group_by_invite_code), which the join page shows before you log in.

DROP FUNCTION IF EXISTS get_user_group_ids(UUID);

REVOKE EXECUTE ON FUNCTION auth_user_admin_group_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION auth_user_group_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_receiver_match_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_receiver_messages(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION gives_to(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION group_is_open(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION is_match_receiver(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION user_is_member_of_group(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION html_escape(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION auth_user_admin_group_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_group_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_receiver_match_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receiver_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION gives_to(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION group_is_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_match_receiver(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_is_member_of_group(UUID) TO authenticated;

-- The invite preview only returns what the join page shows. It used to include the
-- organizer's user id and the budget for anyone holding the code.
DROP FUNCTION IF EXISTS get_group_by_invite_code(TEXT);
CREATE FUNCTION get_group_by_invite_code(code TEXT)
RETURNS TABLE (id UUID, name TEXT, exchange_date DATE, status group_status, member_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name, g.exchange_date, g.status, count(m.id)
  FROM groups g
  LEFT JOIN members m ON m.group_id = g.id
  WHERE g.invite_code = code
  GROUP BY g.id;
$$;
GRANT EXECUTE ON FUNCTION get_group_by_invite_code(TEXT) TO anon, authenticated;

-- New functions start closed to visitors. anon gets EXECUTE twice by default: from Supabase's
-- grant on the schema and from Postgres' built-in grant to PUBLIC, which can only be revoked
-- globally. authenticated and service_role keep their own schema grant.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
