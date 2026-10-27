-- Saying "Esta vez no" by mistake: the decline is kept (declined_at) instead of deleting the
-- invitation, the organizer sees who declined and can invite them again.

ALTER TABLE group_invitations ADD COLUMN declined_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION my_invitations()
RETURNS TABLE (group_id UUID, name TEXT, organizer TEXT, exchange_date DATE, budget NUMERIC, currency TEXT, invited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name, initcap(lower(p.full_name)), g.exchange_date, g.budget, g.currency, i.created_at
  FROM group_invitations i
  JOIN groups g ON g.id = i.group_id
  LEFT JOIN profiles p ON p.id = g.admin_id
  WHERE i.user_id = auth.uid() AND i.declined_at IS NULL
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION answer_invitation(p_group_id UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM group_invitations
                 WHERE group_id = p_group_id AND user_id = auth.uid() AND declined_at IS NULL) THEN
    RAISE EXCEPTION 'Esta invitación ya no está vigente';
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO person FROM profiles WHERE id = auth.uid();
  DELETE FROM notifications WHERE group_id = p_group_id AND user_id = auth.uid() AND type = 'invitation';
  IF p_accept THEN
    IF NOT group_is_open(p_group_id) THEN
      RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
    END IF;
    DELETE FROM group_invitations WHERE group_id = p_group_id AND user_id = auth.uid();
    INSERT INTO members (group_id, user_id, is_admin) VALUES (p_group_id, auth.uid(), FALSE)
    ON CONFLICT (group_id, user_id) DO NOTHING;
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'USER_JOINED', person || ' se unió al grupo');
  ELSE
    UPDATE group_invitations SET declined_at = NOW() WHERE group_id = p_group_id AND user_id = auth.uid();
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (p_group_id, auth.uid(), 'INVITATION_DECLINED', person || ' no va a participar esta vez');
  END IF;
END;
$$;

DROP FUNCTION group_pending_invitations(UUID);
CREATE FUNCTION group_pending_invitations(p_group_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, avatar_url TEXT, invited_at TIMESTAMPTZ, declined BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.user_id, initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))), p.avatar_url,
         i.created_at, i.declined_at IS NOT NULL
  FROM group_invitations i JOIN profiles p ON p.id = i.user_id
  WHERE i.group_id = p_group_id AND user_is_member_of_group(p_group_id)
    -- Someone who declined and then joined with the link is simply a member now.
    AND NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = i.group_id AND m.user_id = i.user_id)
  ORDER BY p.full_name;
$$;

CREATE OR REPLACE FUNCTION reinvite(p_group_id UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g groups%ROWTYPE;
  organizer TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede volver a invitar';
  END IF;
  IF NOT group_is_open(p_group_id) THEN
    RAISE EXCEPTION 'Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.';
  END IF;
  UPDATE group_invitations SET declined_at = NULL, created_at = NOW()
  WHERE group_id = p_group_id AND user_id = p_user AND declined_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona no tiene una invitación rechazada en este grupo';
  END IF;
  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO organizer FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  VALUES (p_user, p_group_id, 'invitation', organizer || ' te volvió a invitar a ' || g.name);
END;
$$;

REVOKE EXECUTE ON FUNCTION group_pending_invitations(UUID), reinvite(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION group_pending_invitations(UUID), reinvite(UUID, UUID) TO authenticated;
