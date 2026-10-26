-- Names that are also everyday words ("rosa", "luz", "castillo") were masked even as
-- preferences ("me gusta el rosa"). Those are now masked only where they work as a name:
-- after a cue ("soy", "eres", "hola", "tía"...), next to another masked name ("Rosa Pérez"),
-- alone as a question or exclamation ("¿Rosa?"), or capitalized mid-sentence ("creo que es
-- Rosa"). Every other name is still masked everywhere. Like before, the rule is the same for
-- all members, so a masked word never confirms a guess.

CREATE OR REPLACE FUNCTION common_word_names()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'rosa', 'rosas', 'luz', 'paz', 'sol', 'mar', 'flor', 'flores', 'pilar', 'blanca', 'cruz',
    'alba', 'aurora', 'esperanza', 'consuelo', 'dolores', 'mercedes', 'amparo', 'socorro',
    'rocio', 'victoria', 'angeles', 'gloria', 'pura', 'soledad', 'estrella', 'cielo', 'perla',
    'violeta', 'margarita', 'azucena', 'jazmin', 'alegria', 'clemente', 'franco', 'justo',
    'santos', 'rey', 'leon', 'oro', 'plata', 'nieves', 'prado', 'vega', 'rio', 'rios', 'campos',
    'castillo', 'torres', 'montes', 'mora', 'rivera', 'calle', 'bosque', 'fuentes', 'reyes',
    'vidal', 'leal', 'bravo', 'blanco', 'moreno', 'rubio', 'delgado', 'alegre', 'caro', 'salas'
  ];
$$;

-- Same as name_pattern but with the first letter uppercase, for "capitalized mid-sentence".
CREATE OR REPLACE FUNCTION cap_name_pattern(p_word TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE left(w, 1)
           WHEN 'a' THEN '[AÁÀÂÄ]' WHEN 'e' THEN '[EÉÈÊË]' WHEN 'i' THEN '[IÍÌÎÏ]'
           WHEN 'o' THEN '[OÓÒÔÖ]' WHEN 'u' THEN '[UÚÙÛÜ]' WHEN 'n' THEN '[NÑ]'
           ELSE upper(left(w, 1)) END
         || name_pattern(substr(w, 2))
  FROM (SELECT translate(lower(p_word), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') AS w) x;
$$;

-- The group's name words, split into always-masked and context-masked.
CREATE OR REPLACE FUNCTION group_name_words(p_group UUID)
RETURNS TABLE (word TEXT, ambiguous BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT w2, w2 = ANY (common_word_names())
  FROM (
    SELECT translate(lower(w), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') AS w2
    FROM members m JOIN profiles p ON p.id = m.user_id,
         regexp_split_to_table(coalesce(p.full_name, '') || ' ' ||
                               regexp_replace(split_part(coalesce(p.email, ''), '@', 1), '[._+0-9-]+', ' ', 'g'),
                               '[^[:alpha:]]+') AS w
    WHERE m.group_id = p_group
  ) x
  WHERE length(w2) >= 3 AND w2 ~ '^[a-z]+$' AND w2 NOT IN ('del', 'las', 'los', 'van', 'von', 'des', 'der');
$$;
REVOKE EXECUTE ON FUNCTION group_name_words(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION censor_names(p_group UUID, p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sure TEXT;
  maybe TEXT;
  maybe_cap TEXT;
  cues CONSTANT TEXT := '(?:soy|eres|sea|es|era|llamo|llamas|llama|hola|chao|holi|querid[ao]|t[ií][ao]|prim[ao]|herman[ao]|amig[ao]|doña|don|señora|señor|sra|sr)';
  t TEXT := p_text;
BEGIN
  SELECT string_agg(name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE NOT ambiguous),
         string_agg(name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE ambiguous),
         string_agg(cap_name_pattern(word), '|' ORDER BY length(word) DESC) FILTER (WHERE ambiguous)
  INTO sure, maybe, maybe_cap
  FROM group_name_words(p_group);

  IF sure IS NOT NULL THEN
    t := regexp_replace(t, '\m(' || sure || ')\M', '•••', 'gi');
  END IF;
  IF maybe IS NOT NULL THEN
    -- after a cue: "soy rosa", "¿eres luz?", "tía rosa"
    t := regexp_replace(t, '(\m' || cues || '\s+)(' || maybe || ')\M', '\1•••', 'gi');
    -- next to another masked name: "rosa •••", "••• luz"
    t := regexp_replace(t, '\m(' || maybe || ')\M(\s+•••)', '•••\2', 'gi');
    t := regexp_replace(t, '(•••\s+)(' || maybe || ')\M', '\1•••', 'gi');
    -- alone as a question or exclamation: "¿Rosa?", "luz!"
    t := regexp_replace(t, '(^|[¿¡.,;:]\s*)(' || maybe || ')(\s*[?!])', '\1•••\3', 'gi');
    -- calling someone with a colon: "Rosa: ¿qué talla usas?"
    t := regexp_replace(t, '(^|[.!?¿¡]\s*)(' || maybe || ')(\s*:)', '\1•••\3', 'gi');
    -- capitalized mid-sentence (case-sensitive): "creo que es Rosa", "le gusta Luz"
    t := regexp_replace(t, '([^\s.!?¿¡]\s+)(' || maybe_cap || ')\M', '\1•••', 'g');
  END IF;
  RETURN t;
END;
$$;
REVOKE EXECUTE ON FUNCTION censor_names(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION censor_blind_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
BEGIN
  SELECT group_id INTO gid FROM matches WHERE id = NEW.match_id;
  IF blind_hidden(gid) THEN
    NEW.content := censor_names(gid, NEW.content);
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS group_name_regex(UUID);
