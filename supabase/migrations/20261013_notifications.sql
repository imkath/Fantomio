-- Notifications: the bell in the app header, plus an email for questions and replies.
--
-- Everything is created by triggers running as the table owner, so the app never needs
-- elevated rights, and the receiver of an anonymous question never learns who asked:
-- the asker's address is only read here, inside the database, to send the reply email.
--
-- Requires the Brevo API key in Vault, created once outside this file:
--   select vault.create_secret('<brevo api key>', 'brevo_api_key');
-- Email templates come from supabase/templates/notification-emails.sql (generated).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('question', 'reply', 'wishlist')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users mark their own notifications as read" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Users may only touch read_at; rows are only ever created by the triggers below.
REVOKE INSERT, UPDATE, DELETE ON notifications FROM anon, authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;

-- Email bodies, filled with {{GROUP}}, {{NAME}} and {{URL}}. Not readable by users.
CREATE TABLE email_templates (
  name TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  html TEXT NOT NULL
);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION html_escape(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- New question -> notify the receiver (without naming the giver).
-- New reply -> notify the giver (naming the receiver, whom the giver already knows).
CREATE OR REPLACE FUNCTION notify_anonymous_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m matches%ROWTYPE;
  group_name TEXT;
  receiver_name TEXT;
BEGIN
  SELECT * INTO m FROM matches WHERE id = NEW.match_id;
  SELECT name INTO group_name FROM groups WHERE id = m.group_id;

  IF NEW.sender_role = 'giver' THEN
    INSERT INTO notifications (user_id, group_id, type, body)
    VALUES (m.receiver_id, m.group_id, 'question',
            'Quien te regala te hizo una pregunta en ' || group_name);
  ELSE
    SELECT initcap(lower(full_name)) INTO receiver_name FROM profiles WHERE id = m.receiver_id;
    INSERT INTO notifications (user_id, group_id, type, body)
    VALUES (m.giver_id, m.group_id, 'reply',
            coalesce(receiver_name, 'Tu amigo secreto') || ' respondió tu pregunta en ' || group_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_anonymous_message
  AFTER INSERT ON anonymous_messages
  FOR EACH ROW EXECUTE FUNCTION notify_anonymous_message();

-- Wishlist changed -> notify whoever gives to this person. Several edits in a row update one
-- unread notification instead of piling up new ones.
CREATE OR REPLACE FUNCTION notify_wishlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  giver UUID;
  person TEXT;
  group_name TEXT;
  text_body TEXT;
BEGIN
  SELECT giver_id INTO giver FROM matches
  WHERE group_id = NEW.group_id AND receiver_id = NEW.user_id;
  IF giver IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT initcap(lower(full_name)) INTO person FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  text_body := coalesce(person, 'Tu amigo secreto') || ' actualizó su lista en ' || group_name;

  UPDATE notifications SET body = text_body, created_at = NOW()
  WHERE user_id = giver AND group_id = NEW.group_id AND type = 'wishlist' AND read_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, group_id, type, body)
    VALUES (giver, NEW.group_id, 'wishlist', text_body);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_wishlist_change
  AFTER UPDATE OF wishlist ON members
  FOR EACH ROW
  WHEN (OLD.wishlist IS DISTINCT FROM NEW.wishlist)
  EXECUTE FUNCTION notify_wishlist_change();

-- Email for questions and replies, at most one per person, group and type every 15 minutes.
CREATE OR REPLACE FUNCTION email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl email_templates%ROWTYPE;
  to_email TEXT;
  group_name TEXT;
  other_name TEXT;
  api_key TEXT;
  url TEXT;
BEGIN
  IF NEW.type NOT IN ('question', 'reply') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND type = NEW.type
      AND id <> NEW.id AND created_at > NOW() - INTERVAL '15 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO tpl FROM email_templates WHERE name = NEW.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = NEW.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  -- For a reply, the person who answered is the giver's receiver.
  SELECT initcap(lower(p.full_name)) INTO other_name
  FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
  WHERE mt.group_id = NEW.group_id AND mt.giver_id = NEW.user_id;
  url := 'https://ghostswap.nvrkth.com/groups/' || NEW.group_id;

  PERFORM net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', 'GhostSwap', 'email', 'hello@nvrkth.com'),
      'to', jsonb_build_array(jsonb_build_object('email', to_email)),
      'subject', replace(replace(tpl.subject, '{{GROUP}}', group_name),
                         '{{NAME}}', coalesce(other_name, 'Tu amigo secreto')),
      'htmlContent', replace(replace(replace(tpl.html,
                       '{{GROUP}}', html_escape(group_name)),
                       '{{NAME}}', html_escape(coalesce(other_name, 'Tu amigo secreto'))),
                       '{{URL}}', url)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION email_notification();

-- Live updates for the bell and the chat. Realtime applies each table's RLS per subscriber.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications, anonymous_messages;
