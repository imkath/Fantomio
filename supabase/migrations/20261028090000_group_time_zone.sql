-- Each group keeps the time zone of the device that created it, so "today" means the same
-- calendar day for the server and for everyone in the group. The database runs on UTC: before
-- this, CURRENT_DATE flipped to the next day at 20:00 or 21:00 in Chile, which let people reveal
-- themselves on the eve of the exchange. Existing groups were all made from Chile.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/Santiago';

-- Only names Postgres knows (IANA), so AT TIME ZONE can never fail later.
CREATE OR REPLACE FUNCTION public.check_group_time_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.time_zone) THEN
    RAISE EXCEPTION 'Zona horaria no reconocida: %', NEW.time_zone;
  END IF;
  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS check_group_time_zone ON public.groups;
CREATE TRIGGER check_group_time_zone BEFORE INSERT OR UPDATE OF time_zone ON public.groups
  FOR EACH ROW EXECUTE FUNCTION check_group_time_zone();

-- The calendar day it is right now in a time zone.
CREATE OR REPLACE FUNCTION public.group_today(p_time_zone text)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (NOW() AT TIME ZONE p_time_zone)::date;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_due_groups()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gid UUID;
  n INTEGER := 0;
BEGIN
  FOR gid IN
    SELECT g.id FROM groups g
    WHERE g.archived_at IS NULL AND g.auto_archive AND (
      (g.exchange_date IS NOT NULL AND g.exchange_date + 7 < group_today(g.time_zone))
      OR (g.exchange_date IS NULL AND g.status = 'DRAWN' AND coalesce(
            (SELECT max(created_at) FROM activities a WHERE a.group_id = g.id AND a.type = 'DRAW'),
            g.created_at) < NOW() - INTERVAL '3 months')
    )
  LOOP
    PERFORM do_reveal(gid);
    UPDATE groups SET archived_at = NOW() WHERE id = gid;
    n := n + 1;
  END LOOP;
  DELETE FROM group_invitations WHERE group_id IN (SELECT id FROM groups WHERE archived_at IS NOT NULL);
  RETURN n;
END;
$function$
;

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

  INSERT INTO groups (name, budget, currency, exchange_date, admin_id, previous_group_id, mode, time_zone)
  VALUES (trim(p_name), p_budget, src.currency, p_exchange_date, auth.uid(), src.id, src.mode, src.time_zone)
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

CREATE OR REPLACE FUNCTION public.reveal_myself(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
  mt matches%ROWTYPE;
  person TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  SELECT * INTO mt FROM matches WHERE group_id = p_group_id AND giver_id = auth.uid();
  IF mt.id IS NULL THEN
    RAISE EXCEPTION 'No tienes a quién revelarte en este grupo';
  END IF;
  IF blind_hidden(p_group_id) THEN
    RAISE EXCEPTION 'Primero tiene que revelarse el sorteo a ciegas';
  END IF;
  IF g.archived_at IS NULL AND (g.exchange_date IS NULL OR g.exchange_date > group_today(g.time_zone)) THEN
    RAISE EXCEPTION 'Podrás revelarte después del intercambio';
  END IF;
  IF mt.revealed_at IS NOT NULL THEN
    RETURN;
  END IF;
  UPDATE matches SET revealed_at = NOW() WHERE id = mt.id;
  SELECT coalesce(initcap(lower(full_name)), 'Tu amigo secreto') INTO person FROM profiles WHERE id = auth.uid();
  INSERT INTO notifications (user_id, group_id, type, body)
  VALUES (mt.receiver_id, p_group_id, 'reveal', person || ' te regaló en ' || g.name);
END;
$function$
;

REVOKE ALL ON FUNCTION public.group_today(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_group_time_zone() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_group_time_zone() TO authenticated;
