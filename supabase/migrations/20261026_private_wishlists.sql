-- Wishlists become private: the app promises "solo la ve quien te regala", but they lived in
-- members.wishlist and the members policy let anyone in the group read the whole row.
--
-- Now they have their own table. A list can be read by its owner and, once there is a
-- draw, by the one person who gives to its owner. Nobody else, the organizer included.
-- The group only learns whether someone has written a list (wishlist_status), never what.

CREATE TABLE wishlists (
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id),
  -- Leaving or being removed from a group deletes the list with the membership.
  FOREIGN KEY (group_id, user_id) REFERENCES members (group_id, user_id) ON DELETE CASCADE
);

-- True when the current user gives to p_user in p_group. Returns only a boolean.
CREATE OR REPLACE FUNCTION gives_to(p_group UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE group_id = p_group AND receiver_id = p_user AND giver_id = auth.uid()
  );
$$;

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and their giver can read a wishlist" ON wishlists
  FOR SELECT USING (user_id = auth.uid() OR gives_to(group_id, user_id));

CREATE POLICY "Members write their own wishlist" ON wishlists
  FOR INSERT WITH CHECK (user_id = auth.uid() AND user_is_member_of_group(group_id));

CREATE POLICY "Owners update their wishlist" ON wishlists
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete their wishlist" ON wishlists
  FOR DELETE USING (user_id = auth.uid());

-- Who in the group has written a list, for the participants' checkmarks. Only for members
-- of that group, and only a yes/no per person.
CREATE OR REPLACE FUNCTION wishlist_status(p_group_id UUID)
RETURNS TABLE (user_id UUID, has_items BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, coalesce(jsonb_array_length(w.items) > 0, FALSE)
  FROM members m
  LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION wishlist_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION wishlist_status(UUID) TO authenticated;

-- Move the existing lists before any trigger exists, so copying them doesn't notify anyone.
DROP TRIGGER IF EXISTS on_wishlist_change ON members;

INSERT INTO wishlists (group_id, user_id, items)
SELECT group_id, user_id, wishlist
FROM members
WHERE wishlist IS NOT NULL AND jsonb_typeof(wishlist) = 'array' AND jsonb_array_length(wishlist) > 0;

-- The readable copy goes away.
ALTER TABLE members DROP COLUMN wishlist;

-- Wishlist changes still notify the giver (same function, now on the new table).
CREATE OR REPLACE FUNCTION notify_wishlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  giver UUID;
  person TEXT;
  group_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.items IS NOT DISTINCT FROM NEW.items THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND jsonb_array_length(NEW.items) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT giver_id INTO giver FROM matches
  WHERE group_id = NEW.group_id AND receiver_id = NEW.user_id;
  IF giver IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  PERFORM push_notification(giver, NEW.group_id, 'wishlist',
    coalesce(person, 'Tu amigo secreto') || ' actualizó su lista en ' || group_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_wishlist_change
  AFTER INSERT OR UPDATE OF items ON wishlists
  FOR EACH ROW EXECUTE FUNCTION notify_wishlist_change();

CREATE OR REPLACE FUNCTION touch_wishlist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_wishlist
  BEFORE UPDATE ON wishlists
  FOR EACH ROW EXECUTE FUNCTION touch_wishlist();
