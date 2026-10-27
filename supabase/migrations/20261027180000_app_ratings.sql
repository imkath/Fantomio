-- Ratings of Fantomio itself, asked once inside the app after a draw. One per account (stars
-- only, no text), so the public figure can't be padded. Only the count and the average leave the
-- database, through app_rating_summary(); the landing shows them and its WebApplication JSON-LD
-- carries them once there are enough real ratings.

CREATE TABLE public.app_ratings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_ratings FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rate_app(p_stars INT)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tienes que entrar a tu cuenta';
  END IF;
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'La nota va de 1 a 5';
  END IF;
  INSERT INTO app_ratings (user_id, stars) VALUES (auth.uid(), p_stars)
  ON CONFLICT (user_id) DO UPDATE SET stars = EXCLUDED.stars, updated_at = NOW();
END;
$function$
;

CREATE FUNCTION public.my_app_rating()
 RETURNS INT
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT stars FROM app_ratings WHERE user_id = auth.uid();
$function$
;

CREATE FUNCTION public.app_rating_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('count', count(*), 'average', round(avg(stars)::numeric, 1))
  FROM app_ratings;
$function$
;

REVOKE ALL ON FUNCTION public.rate_app(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_app(INT) TO authenticated;
REVOKE ALL ON FUNCTION public.my_app_rating() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_app_rating() TO authenticated;
REVOKE ALL ON FUNCTION public.app_rating_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_rating_summary() TO anon, authenticated;

-- The data export includes the person's own rating.
CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS id)
  SELECT jsonb_build_object(
    'exportado', NOW(),
    'cuenta', (SELECT jsonb_build_object(
      'correo', u.email, 'creada', u.created_at, 'ultimo_ingreso', u.last_sign_in_at,
      'metodos_de_entrada', (SELECT jsonb_agg(DISTINCT provider) FROM auth.identities WHERE user_id = u.id))
      FROM auth.users u, me WHERE u.id = me.id),
    'perfil', (SELECT jsonb_build_object('nombre', p.full_name, 'foto', p.avatar_url,
      'tema', p.theme, 'avisos_por_correo', p.email_notifications)
      FROM profiles p, me WHERE p.id = me.id),
    'grupos', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'nombre', g.name, 'estado', g.status, 'organizas', g.admin_id = me.id,
      'fecha_intercambio', g.exchange_date, 'presupuesto', g.budget, 'moneda', g.currency,
      'te_uniste', m.joined_at) ORDER BY m.joined_at)
      FROM members m JOIN groups g ON g.id = m.group_id, me WHERE m.user_id = me.id), '[]'::jsonb),
    'listas_de_deseos', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'cosas', w.items))
      FROM wishlists w JOIN groups g ON g.id = w.group_id, me WHERE w.user_id = me.id), '[]'::jsonb),
    'a_quien_le_regalas', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'persona', p.full_name))
      FROM matches x JOIN groups g ON g.id = x.group_id JOIN profiles p ON p.id = x.receiver_id, me
      WHERE x.giver_id = me.id AND NOT blind_hidden(x.group_id)), '[]'::jsonb),
    'mensajes_que_enviaste', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'grupo', g.name, 'como', CASE a.sender_role WHEN 'giver' THEN 'quien regala' ELSE 'quien recibe' END,
      'mensaje', a.content, 'fecha', a.created_at) ORDER BY a.created_at)
      FROM anonymous_messages a JOIN matches x ON x.id = a.match_id JOIN groups g ON g.id = x.group_id, me
      WHERE (a.sender_role = 'giver' AND x.giver_id = me.id) OR (a.sender_role = 'receiver' AND x.receiver_id = me.id)), '[]'::jsonb),
    'apuestas', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', g.name, 'creias_que_era', p.full_name))
      FROM blind_guesses b JOIN groups g ON g.id = b.group_id JOIN profiles p ON p.id = b.guessed_user_id, me
      WHERE b.user_id = me.id), '[]'::jsonb),
    'avisos', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', n.type, 'texto', n.body, 'fecha', n.created_at) ORDER BY n.created_at)
      FROM notifications n, me WHERE n.user_id = me.id), '[]'::jsonb),
    'valoracion', (SELECT jsonb_build_object('estrellas', r.stars, 'fecha', r.updated_at)
      FROM app_ratings r, me WHERE r.user_id = me.id)
  );
$function$
;
