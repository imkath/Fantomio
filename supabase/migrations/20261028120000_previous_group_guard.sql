-- Audit 2026-10-27, L1: an organizer could learn who gave to whom in a group they don't belong
-- to. Two holes closed together:
--   1. previous_group_id could be set from the app to any group's id. Now only repeat_group
--      (which runs as the owner) links an edition to the one before.
--   2. draw_group failed with its own message when last edition's pairs made the draw
--      impossible, so success or failure leaked those pairs. Now avoiding them is a silent
--      preference, and only for an edition the organizer was part of.

CREATE OR REPLACE FUNCTION public.guard_previous_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Inside repeat_group the statement runs as the function's owner, not as "authenticated".
  IF current_user = 'authenticated' AND (
       (TG_OP = 'INSERT' AND NEW.previous_group_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.previous_group_id IS DISTINCT FROM OLD.previous_group_id)
     ) THEN
    RAISE EXCEPTION 'La edición anterior solo se enlaza al repetir un grupo';
  END IF;
  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS guard_previous_group ON public.groups;
CREATE TRIGGER guard_previous_group BEFORE INSERT OR UPDATE OF previous_group_id ON public.groups
  FOR EACH ROW EXECUTE FUNCTION guard_previous_group();

REVOKE ALL ON FUNCTION public.guard_previous_group() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_previous_group() TO authenticated;

CREATE OR REPLACE FUNCTION public.draw_group(p_group_id uuid, p_avoid_previous boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
  givers UUID[];
  receivers UUID[];
  excluded TEXT[];
  previous TEXT[] := '{}';
  n INT;
  ok BOOLEAN := FALSE;
  missing TEXT;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;
  IF g.admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien organiza puede hacer el sorteo';
  END IF;
  IF g.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este grupo está archivado. Restáuralo para sortear.';
  END IF;
  IF g.status = 'DRAWN' THEN
    RAISE EXCEPTION 'El sorteo ya está hecho';
  END IF;

  givers := ARRAY(SELECT user_id FROM members WHERE group_id = p_group_id ORDER BY user_id);
  n := coalesce(array_length(givers, 1), 0);
  IF n < 3 THEN
    RAISE EXCEPTION 'Hacen falta al menos 3 personas para sortear';
  END IF;
  -- A blind draw only gives a wishlist to go on: everyone needs one first.
  IF g.mode = 'blind' THEN
    SELECT string_agg(initcap(lower(coalesce(p.full_name, split_part(p.email, '@', 1)))), ', ' ORDER BY p.full_name)
    INTO missing
    FROM members m JOIN profiles p ON p.id = m.user_id
    LEFT JOIN wishlists w ON w.group_id = m.group_id AND w.user_id = m.user_id
    WHERE m.group_id = p_group_id AND coalesce(jsonb_array_length(w.items), 0) = 0;
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'Para sortear a ciegas, todos tienen que anotar su lista. Todavía falta la de %.', missing;
    END IF;
  END IF;

  excluded := ARRAY(
    SELECT giver_id::text || ':' || excluded_receiver_id::text
    FROM exclusions WHERE group_id = p_group_id
  );
  -- Last edition's pairs, read here and never shown to anyone, and only from an edition the
  -- organizer took part in. They are a preference, not a rule: if they make the draw
  -- impossible it goes ahead without them and says nothing. A failure that depended on them
  -- would let the organizer test pairs nobody is meant to see (audit 2026-10-27, L1).
  IF p_avoid_previous AND g.previous_group_id IS NOT NULL AND (
       EXISTS (SELECT 1 FROM members WHERE group_id = g.previous_group_id AND user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM groups WHERE id = g.previous_group_id AND admin_id = auth.uid())
     ) THEN
    previous := ARRAY(
      SELECT giver_id::text || ':' || receiver_id::text
      FROM matches WHERE group_id = g.previous_group_id
    );
  END IF;

  FOR attempt IN 1..5000 LOOP
    receivers := ARRAY(SELECT x FROM unnest(givers) AS x ORDER BY gen_random_uuid());
    ok := TRUE;
    FOR i IN 1..n LOOP
      IF receivers[i] = givers[i]
         OR (givers[i]::text || ':' || receivers[i]::text) = ANY (excluded)
         -- The first half of the attempts also avoid last edition's pairs.
         OR (attempt <= 2500 AND (givers[i]::text || ':' || receivers[i]::text) = ANY (previous)) THEN
        ok := FALSE;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN ok;
  END LOOP;

  IF NOT ok THEN
    RAISE EXCEPTION 'No se pudo sortear con las restricciones actuales. Revisa quién no le puede regalar a quién.';
  END IF;

  INSERT INTO matches (group_id, giver_id, receiver_id)
  SELECT p_group_id, givers[i], receivers[i] FROM generate_series(1, n) AS i;

  PERFORM set_config('ghostswap.status_change', 'on', true);
  UPDATE groups SET status = 'DRAWN' WHERE id = p_group_id;
  -- Whoever didn't answer is left out of this one.
  DELETE FROM group_invitations WHERE group_id = p_group_id;

  INSERT INTO activities (group_id, user_id, type, message)
  VALUES (p_group_id, auth.uid(), 'DRAW', 'Se hizo el sorteo de "' || g.name || '"');

  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, p_group_id, 'draw',
         'Ya se hizo el sorteo de ' || g.name || '. Mira a quién te tocó.'
  FROM members m WHERE m.group_id = p_group_id;
END;
$function$
;
