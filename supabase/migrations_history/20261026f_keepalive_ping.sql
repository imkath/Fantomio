-- The keep-alive (Worker every 6 hours, GitHub Actions daily) read groups with the anon key.
-- Since 20261026e anon has no table privileges, so it got 401 and the project would pause.
-- It now calls this function: a real query against Postgres that returns nothing about anyone.

CREATE OR REPLACE FUNCTION keepalive()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT FROM groups LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION keepalive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION keepalive() TO anon, authenticated;
