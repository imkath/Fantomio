-- Restrict profile visibility
-- The old policy "Users can view all profiles" used USING (true), so anyone holding the
-- public anon key could read every user's email, name and avatar without signing in.
-- Now a user can read their own profile and the profiles of people who share a group.

CREATE OR REPLACE FUNCTION shares_group_with(target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION shares_group_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION shares_group_with(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Users can view own and co-member profiles" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR shares_group_with(id));
