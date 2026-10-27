-- Deleting an account cascades into members, and on_member_left tried to log the departure
-- in the name of a profile that was being deleted (activities.user_id FK). Now it logs it
-- without a person when the profile is already gone.

CREATE OR REPLACE FUNCTION log_member_left()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person TEXT;
  actor UUID;
BEGIN
  -- Deleting the whole group cascades here; there is nothing left to log into.
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id) THEN
    RETURN OLD;
  END IF;
  SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = OLD.user_id;
  SELECT id INTO actor FROM profiles WHERE id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = OLD.user_id) THEN
    INSERT INTO activities (group_id, user_id, type, message)
    VALUES (OLD.group_id, NULL, 'MEMBER_LEFT', 'Una persona eliminó su cuenta y salió del grupo');
    RETURN OLD;
  END IF;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (
    OLD.group_id, actor,
    CASE WHEN OLD.user_id = auth.uid() THEN 'MEMBER_LEFT' ELSE 'MEMBER_REMOVED' END,
    coalesce(person, 'Alguien') ||
      CASE WHEN OLD.user_id = auth.uid() THEN ' salió del grupo' ELSE ' fue quitado del grupo' END
  );
  RETURN OLD;
END;
$$;
