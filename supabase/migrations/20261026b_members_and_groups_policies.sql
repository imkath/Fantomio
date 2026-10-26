-- Two policy fixes on members and groups.
--
-- 1. Joining a group that already drew was only blocked by the join screen. members_insert let
--    anyone add themselves to any group whose id they knew, drawn or not, and let the organizer
--    add other people. Now you can only add yourself, and only while the group is PLANNING.
-- 2. groups and members kept the original policies next to the newer ones. Permissive policies
--    are OR'ed, so the duplicates opened nothing extra, but they made the rules harder to read.

-- The person joining isn't a member yet, so groups' RLS hides the row from them.
CREATE OR REPLACE FUNCTION group_is_open(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND status = 'PLANNING');
$$;

DROP POLICY IF EXISTS "members_insert" ON members;
CREATE POLICY "members_insert" ON members
  FOR INSERT WITH CHECK (user_id = auth.uid() AND group_is_open(group_id));

-- Nothing updates members anymore (the wishlist moved to its own table). Without a WITH CHECK
-- this let people move their own row to another group or mark themselves as admin.
DROP POLICY IF EXISTS "members_update" ON members;

-- Duplicates of groups_select, groups_insert, groups_update, groups_delete and members_select.
DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can update their groups" ON groups;
DROP POLICY IF EXISTS "Admins can delete their groups" ON groups;
DROP POLICY IF EXISTS "Users can view members in their groups" ON members;

-- The organizer can edit the group but not hand it to someone else from the browser.
DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups
  FOR UPDATE USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);
