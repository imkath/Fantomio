-- Reworded error and notice messages from the blind draw.
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
  -- Last edition's pairs, read here and never shown to anyone.
  IF p_avoid_previous AND g.previous_group_id IS NOT NULL THEN
    excluded := excluded || ARRAY(
      SELECT giver_id::text || ':' || receiver_id::text
      FROM matches WHERE group_id = g.previous_group_id
    );
  END IF;

  FOR attempt IN 1..5000 LOOP
    receivers := ARRAY(SELECT x FROM unnest(givers) AS x ORDER BY gen_random_uuid());
    ok := TRUE;
    FOR i IN 1..n LOOP
      IF receivers[i] = givers[i]
         OR (givers[i]::text || ':' || receivers[i]::text) = ANY (excluded) THEN
        ok := FALSE;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN ok;
  END LOOP;

  IF NOT ok THEN
    IF p_avoid_previous THEN
      RAISE EXCEPTION 'No se pudo sortear sin repetir las parejas del año pasado. Prueba sin esa opción.';
    END IF;
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

CREATE OR REPLACE FUNCTION public.keep_blind_lists()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id AND status = 'DRAWN') AND blind_hidden(OLD.group_id) THEN
    IF TG_OP = 'DELETE' OR coalesce(jsonb_array_length(NEW.items), 0) = 0 THEN
      RAISE EXCEPTION 'En el sorteo a ciegas tu lista es la única pista de quien te regala. Puedes cambiarla, pero no dejarla vacía.';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.place_guess(p_group_id uuid, p_guessed uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND mode = 'blind' AND status = 'DRAWN') THEN
    RAISE EXCEPTION 'Solo se apuesta en un sorteo a ciegas ya hecho';
  END IF;
  IF NOT blind_hidden(p_group_id) THEN
    RAISE EXCEPTION 'Ya se reveló el sorteo, así que las apuestas están cerradas';
  END IF;
  IF NOT user_is_member_of_group(p_group_id) THEN
    RAISE EXCEPTION 'No estás en este grupo';
  END IF;
  IF p_guessed = auth.uid()
     OR NOT EXISTS (SELECT 1 FROM members WHERE group_id = p_group_id AND user_id = p_guessed) THEN
    RAISE EXCEPTION 'Elige a otra persona del grupo';
  END IF;
  INSERT INTO blind_guesses (group_id, user_id, guessed_user_id) VALUES (p_group_id, auth.uid(), p_guessed)
  ON CONFLICT (group_id, user_id) DO UPDATE SET guessed_user_id = EXCLUDED.guessed_user_id, updated_at = NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.do_reveal(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id FOR UPDATE;
  IF g.mode <> 'blind' OR g.status <> 'DRAWN' OR g.revealed_at IS NOT NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('ghostswap.reveal', 'on', true);
  UPDATE groups SET revealed_at = NOW() WHERE id = p_group_id;
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, p_group_id, 'unveil', 'Llegó la hora. Ya puedes ver a quién le regalas en ' || g.name
  FROM members m WHERE m.group_id = p_group_id;
END;
$function$
;
