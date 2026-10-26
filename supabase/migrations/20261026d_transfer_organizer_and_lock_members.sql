-- Handing over a group, and who can leave it.
--
-- 1. The app tells an organizer who tries to leave to delete the group or hand it over, but
--    there was no way to hand it over. transfer_group() does it in one step.
-- 2. Leaving or removing people after the draw was only blocked by the screen. Whoever gave to
--    the person who left was left without anyone to give to. Now the database refuses it, and
--    the organizer can't leave their own group either (they hand it over or delete it).
-- 3. Joining with is_admin = true showed the "Organiza" label on someone who doesn't organize.
--    The flag now has to match groups.admin_id.

CREATE OR REPLACE FUNCTION transfer_group(p_group_id UUID, p_new_admin UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
  old_name TEXT;
  new_name TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
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
$$;

REVOKE EXECUTE ON FUNCTION transfer_group(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transfer_group(UUID, UUID) TO authenticated;

-- While the group is open, people can leave (except the organizer) and the organizer can
-- remove others. After the draw nobody leaves; deleting the group removes members by cascade.
DROP POLICY IF EXISTS "members_delete" ON members;
CREATE POLICY "members_delete" ON members
  FOR DELETE USING (
    group_is_open(group_id) AND (
      (user_id = auth.uid() AND group_id NOT IN (SELECT auth_user_admin_group_ids()))
      OR (user_id <> auth.uid() AND group_id IN (SELECT auth_user_admin_group_ids()))
    )
  );

DROP POLICY IF EXISTS "members_insert" ON members;
CREATE POLICY "members_insert" ON members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND group_is_open(group_id)
    AND is_admin = (group_id IN (SELECT auth_user_admin_group_ids()))
  );
