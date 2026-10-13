-- Follow-up to 20261013_notifications:
-- - Unread notifications of the same kind and group collapse into one (newest text and time)
--   instead of piling up in the bell. A new row, and so a new email, only appears once the
--   previous one was read.
-- - Wishlist changes also send an email, at most one per group every 12 hours.

CREATE OR REPLACE FUNCTION push_notification(p_user UUID, p_group UUID, p_type TEXT, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications SET body = p_body, created_at = NOW()
  WHERE user_id = p_user AND group_id = p_group AND type = p_type AND read_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, group_id, type, body)
    VALUES (p_user, p_group, p_type, p_body);
  END IF;
END;
$$;
-- Only the triggers call it.
REVOKE EXECUTE ON FUNCTION push_notification(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

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
    PERFORM push_notification(m.receiver_id, m.group_id, 'question',
      'Quien te regala te hizo una pregunta en ' || group_name);
  ELSE
    SELECT initcap(lower(full_name)) INTO receiver_name FROM profiles WHERE id = m.receiver_id;
    PERFORM push_notification(m.giver_id, m.group_id, 'reply',
      coalesce(receiver_name, 'Tu amigo secreto') || ' respondió tu pregunta en ' || group_name);
  END IF;
  RETURN NEW;
END;
$$;

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
  quiet INTERVAL;
BEGIN
  quiet := CASE NEW.type WHEN 'wishlist' THEN INTERVAL '12 hours' ELSE INTERVAL '15 minutes' END;
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND type = NEW.type
      AND id <> NEW.id AND created_at > NOW() - quiet
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
  -- For replies and wishlist changes, the other person is the recipient's own receiver.
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
