-- Where the exchange happens: in person (a name like "Casa de la abuela" and an address or a
-- Google Maps link) or online (a call link: Meet, Zoom, Discord...). Only members read it, like
-- the rest of the group (groups_select); the invite preview does not include it.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS place_kind text,
  ADD COLUMN IF NOT EXISTS place_name text,
  ADD COLUMN IF NOT EXISTS place_detail text;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_place_kind_check CHECK (place_kind IS NULL OR place_kind IN ('in_person', 'online')),
  ADD CONSTRAINT groups_place_lengths_check CHECK (
    char_length(place_name) <= 80 AND char_length(place_detail) <= 300),
  -- No kind, no place: nothing half filled.
  ADD CONSTRAINT groups_place_empty_check CHECK (
    place_kind IS NOT NULL OR (place_name IS NULL AND place_detail IS NULL)),
  -- An online place's detail is a web link, never javascript: or similar.
  ADD CONSTRAINT groups_place_link_check CHECK (
    place_kind IS DISTINCT FROM 'online' OR place_detail IS NULL OR place_detail ~* '^https://[^\s]+$');

-- The next edition keeps the place; most groups meet in the same spot every year.
CREATE OR REPLACE FUNCTION public.repeat_group(p_group_id uuid, p_name text, p_exchange_date date, p_budget numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  src groups%ROWTYPE;
  new_id UUID;
  organizer TEXT;
BEGIN
  SELECT * INTO src FROM groups WHERE id = p_group_id;
  IF src.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF src.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede repetir el grupo';
  END IF;
  IF char_length(trim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Ponle un nombre al grupo nuevo';
  END IF;

  INSERT INTO groups (name, budget, currency, exchange_date, admin_id, previous_group_id, mode, time_zone,
                      place_kind, place_name, place_detail)
  VALUES (trim(p_name), p_budget, src.currency, p_exchange_date, auth.uid(), src.id, src.mode, src.time_zone,
          src.place_kind, src.place_name, src.place_detail)
  RETURNING id INTO new_id;
  INSERT INTO members (group_id, user_id, is_admin) VALUES (new_id, auth.uid(), TRUE);

  -- Exclusions only matter between people who end up joining, so copying them all is safe.
  INSERT INTO exclusions (group_id, giver_id, excluded_receiver_id)
  SELECT new_id, giver_id, excluded_receiver_id FROM exclusions WHERE group_id = src.id;

  INSERT INTO group_invitations (group_id, user_id, invited_by)
  SELECT new_id, m.user_id, auth.uid() FROM members m
  WHERE m.group_id = src.id AND m.user_id <> auth.uid();

  SELECT coalesce(initcap(lower(full_name)), 'Alguien') INTO organizer FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT i.user_id, new_id, 'invitation', organizer || ' te invitó a ' || trim(p_name)
  FROM group_invitations i WHERE i.group_id = new_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (new_id, auth.uid(), 'GROUP_CREATED', organizer || ' repitió "' || src.name || '" con las mismas personas');
  RETURN new_id;
END;
$function$
;
