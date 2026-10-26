-- Pending invitations of a group with the invited person's name, for its members. A member
-- who joined this edition without being in the previous one can't read those profiles directly.
CREATE OR REPLACE FUNCTION group_pending_invitations(p_group_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, avatar_url TEXT, invited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.user_id, initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))), p.avatar_url, i.created_at
  FROM group_invitations i JOIN profiles p ON p.id = i.user_id
  WHERE i.group_id = p_group_id AND user_is_member_of_group(p_group_id)
  ORDER BY p.full_name;
$$;
REVOKE EXECUTE ON FUNCTION group_pending_invitations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION group_pending_invitations(UUID) TO authenticated;
