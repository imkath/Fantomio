-- Anonymous Q&A between giver and receiver
-- The giver can ask questions to their receiver without revealing identity
-- The receiver can reply without knowing who is asking
--
-- Applied to production on 2026-10-13 (it had never been run, so the chat failed silently).
-- Fixed before applying: the receiver could not reply, because the matches RLS only shows
-- a user the rows where they are the giver, so a policy subquery on matches came back empty
-- for the receiver. is_match_receiver() checks it without exposing who the giver is.

CREATE TABLE anonymous_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('giver', 'receiver')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anon_messages_match_id ON anonymous_messages(match_id);

-- True when the current user is the receiver of the match. Returns only a boolean, so it
-- never reveals the giver.
CREATE OR REPLACE FUNCTION is_match_receiver(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches WHERE id = p_match_id AND receiver_id = auth.uid()
  );
$$;

ALTER TABLE anonymous_messages ENABLE ROW LEVEL SECURITY;

-- Giver (visible through matches RLS) and receiver (through is_match_receiver) can read.
CREATE POLICY "Match participants can view messages" ON anonymous_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = anonymous_messages.match_id
      AND matches.giver_id = auth.uid()
    )
    OR is_match_receiver(match_id)
  );

-- Each side can only write as itself.
CREATE POLICY "Match participants can send messages" ON anonymous_messages
  FOR INSERT WITH CHECK (
    (sender_role = 'giver' AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = anonymous_messages.match_id
      AND matches.giver_id = auth.uid()
    ))
    OR
    (sender_role = 'receiver' AND is_match_receiver(match_id))
  );

-- Messages for the receiver of a group, without exposing the giver.
CREATE OR REPLACE FUNCTION get_receiver_messages(p_group_id UUID)
RETURNS TABLE (
  message_id UUID,
  match_id UUID,
  sender_role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT am.id, am.match_id, am.sender_role, am.content, am.created_at
  FROM anonymous_messages am
  JOIN matches m ON m.id = am.match_id
  WHERE m.group_id = p_group_id
  AND m.receiver_id = auth.uid()
  ORDER BY am.created_at ASC;
END;
$$;

-- The match where the current user is the receiver, without exposing the giver.
CREATE OR REPLACE FUNCTION get_receiver_match_id(p_group_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM matches
  WHERE group_id = p_group_id AND receiver_id = auth.uid()
  LIMIT 1;
$$;
