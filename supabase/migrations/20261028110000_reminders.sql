-- Reminders, at most two emails per person and group and usually one:
--   * three days before the exchange (remind_soon), merged with "your list is empty"
--     (remind_soon_list) when it is, so nobody gets both in the same week;
--   * "your list is empty" on its own (remind_list), once, two days after the draw, unless the
--     three-day reminder is about to cover it.
-- They go out at 10:00 on the group's own calendar. Blind groups need every list before the
-- draw, so they only get the date reminder. Turning notices off in the account stops the emails;
-- the notice still shows in the bell. Every notice email now carries List-Unsubscribe.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'question', 'reply', 'wishlist', 'draw', 'invitation', 'reveal', 'unveil',
  'remind_soon', 'remind_soon_list', 'remind_list']));

CREATE OR REPLACE FUNCTION public.send_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n integer := 0;
  k integer;
BEGIN
  -- Three days before.
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, g.id,
         CASE WHEN g.mode = 'classic' AND NOT has_list THEN 'remind_soon_list' ELSE 'remind_soon' END,
         CASE WHEN g.mode = 'classic' AND NOT has_list
              THEN 'Faltan 3 días para ' || g.name || ' y tu lista sigue vacía.'
              ELSE 'Faltan 3 días para ' || g.name || '.' END
  FROM groups g
  JOIN members m ON m.group_id = g.id
  CROSS JOIN LATERAL (
    SELECT coalesce((SELECT jsonb_array_length(w.items) > 0 FROM wishlists w
                     WHERE w.group_id = g.id AND w.user_id = m.user_id), FALSE) AS has_list
  ) l
  WHERE g.status = 'DRAWN' AND g.archived_at IS NULL
    AND extract(hour FROM NOW() AT TIME ZONE g.time_zone) = 10
    AND g.exchange_date = group_today(g.time_zone) + 3
    AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = m.user_id AND x.group_id = g.id
                    AND x.type IN ('remind_soon', 'remind_soon_list'));
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Empty list, once, two days after the draw.
  INSERT INTO notifications (user_id, group_id, type, body)
  SELECT m.user_id, g.id, 'remind_list',
         'Tu lista de ' || g.name || ' está vacía. Anota dos o tres ideas para quien te regala.'
  FROM groups g
  JOIN members m ON m.group_id = g.id
  WHERE g.status = 'DRAWN' AND g.archived_at IS NULL AND g.mode = 'classic'
    AND extract(hour FROM NOW() AT TIME ZONE g.time_zone) = 10
    AND (SELECT min(created_at) FROM matches WHERE group_id = g.id) < NOW() - INTERVAL '2 days'
    AND (g.exchange_date IS NULL OR g.exchange_date >= group_today(g.time_zone))
    -- The three-day reminder is coming and will say it.
    AND NOT (g.exchange_date IS NOT NULL
             AND g.exchange_date BETWEEN group_today(g.time_zone) + 3 AND group_today(g.time_zone) + 5)
    AND NOT coalesce((SELECT jsonb_array_length(w.items) > 0 FROM wishlists w
                      WHERE w.group_id = g.id AND w.user_id = m.user_id), FALSE)
    AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = m.user_id AND x.group_id = g.id
                    AND x.type IN ('remind_list', 'remind_soon_list'));
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  RETURN n;
END;
$function$
;

REVOKE ALL ON FUNCTION public.send_reminders() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl email_templates%ROWTYPE;
  to_email TEXT;
  group_name TEXT;
  other_name TEXT;
  api_key TEXT;
  url TEXT;
  quiet INTERVAL;
BEGIN
  quiet := CASE NEW.type
    WHEN 'wishlist' THEN INTERVAL '12 hours'
    WHEN 'draw' THEN INTERVAL '1 hour'
    ELSE INTERVAL '15 minutes'
  END;
  IF quiet > INTERVAL '0' AND EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND type = NEW.type
      AND id <> NEW.id AND created_at > NOW() - quiet
  ) THEN
    RETURN NEW;
  END IF;

  -- People can turn emails off in their account; the notification stays in the app.
  IF NOT coalesce((SELECT email_notifications FROM profiles WHERE id = NEW.user_id), TRUE) THEN
    RETURN NEW;
  END IF;

  -- Brevo's free plan sends 300 emails a day, account emails (sign-up, password) included.
  -- Past 200 notices in 24 hours the rest stay in the bell, so account emails always fit.
  IF (SELECT count(*) FROM email_log WHERE created_at > NOW() - INTERVAL '24 hours') >= 200 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO tpl FROM email_templates WHERE name = NEW.type;
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'brevo_api_key';
  SELECT email INTO to_email FROM auth.users WHERE id = NEW.user_id;
  IF tpl.name IS NULL OR api_key IS NULL OR to_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type IN ('draw', 'unveil', 'remind_soon', 'remind_soon_list', 'remind_list') THEN
    -- The draw email greets the recipient; it never names their match.
    SELECT initcap(lower(full_name)) INTO other_name FROM profiles WHERE id = NEW.user_id;
  ELSIF NEW.type = 'invitation' THEN
    -- Who invited them: the organizer of the new edition.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM groups g JOIN profiles p ON p.id = g.admin_id WHERE g.id = NEW.group_id;
  ELSIF NEW.type = 'reveal' THEN
    -- The giver who chose to reveal themselves to this person.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.giver_id
    WHERE mt.group_id = NEW.group_id AND mt.receiver_id = NEW.user_id AND mt.revealed_at IS NOT NULL;
  ELSIF blind_hidden(NEW.group_id) THEN
    other_name := 'Tu amigo secreto';
  ELSE
    -- For replies and wishlist changes, the other person is the recipient's own receiver.
    SELECT initcap(lower(p.full_name)) INTO other_name
    FROM matches mt JOIN profiles p ON p.id = mt.receiver_id
    WHERE mt.group_id = NEW.group_id AND mt.giver_id = NEW.user_id;
  END IF;
  url := CASE WHEN NEW.type = 'invitation' THEN 'https://fantomio.com/dashboard'
              ELSE 'https://fantomio.com/groups?id=' || NEW.group_id END;

  INSERT INTO email_log (request_id, kind) VALUES (net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', 'Fantomio', 'email', 'hola@fantomio.com'),
      'to', jsonb_build_array(jsonb_build_object('email', to_email)),
      -- Mail providers show their own "unsubscribe" with this; it leads to the switch that turns
      -- these notices off. Account emails (sign-up, password) never carry it.
      'headers', jsonb_build_object('List-Unsubscribe', '<https://fantomio.com/account#preferencias>'),
      'subject', replace(replace(tpl.subject, '{{GROUP}}', group_name),
                         '{{NAME}}', coalesce(other_name, '')),
      'htmlContent', replace(replace(replace(tpl.html,
                       '{{GROUP}}', html_escape(group_name)),
                       '{{NAME}}', html_escape(coalesce(other_name, ''))),
                       '{{URL}}', url)
    )
  ), NEW.type);
  RETURN NEW;
END;
$function$
;

-- Generated by scripts/build-auth-emails.ts. Do not edit by hand.
INSERT INTO email_templates (name, subject, html) VALUES
  ($tpl$draw$tpl$, $tpl$Ya hicimos el sorteo de {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Ya hicimos el sorteo</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Ya hicimos el sorteo</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Hola {{NAME}},</p>
                <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">El sorteo de <strong style="color: #1b1b1a;">{{GROUP}}</strong> ya está hecho. Entra para ver a quién le regalas y qué le gustaría recibir.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver a quién me tocó</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Solo tú puedes ver a quién te tocó. Si no esperabas este correo, puedes ignorarlo.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$question$tpl$, $tpl$Te hicieron una pregunta en {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Tienes una pregunta</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Tienes una pregunta</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Quien te regala en <strong style="color: #1b1b1a;">{{GROUP}}</strong> te hizo una pregunta para acertar con tu regalo.</p>
                <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Entra para leerla y responder. Quién la hizo sigue siendo secreto.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver la pregunta</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Te avisamos como máximo una vez cada 15 minutos por grupo.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$reply$tpl$, $tpl${{NAME}} te respondió en {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Te respondieron</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Te respondieron</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;"><strong style="color: #1b1b1a;">{{NAME}}</strong> respondió tu pregunta en <strong style="color: #1b1b1a;">{{GROUP}}</strong>. No sabe que fuiste tú.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver la respuesta</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Te avisamos como máximo una vez cada 15 minutos por grupo.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$wishlist$tpl$, $tpl${{NAME}} actualizó su lista en {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Tu amigo secreto cambió su lista</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Tu amigo secreto cambió su lista</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;"><strong style="color: #1b1b1a;">{{NAME}}</strong> agregó o cambió cosas en su lista de <strong style="color: #1b1b1a;">{{GROUP}}</strong>. Puede que te dé una idea para el regalo.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver su lista</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Te avisamos como máximo una vez cada 12 horas por grupo.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$invitation$tpl$, $tpl${{NAME}} te invitó a {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Te invitaron a un nuevo amigo secreto</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Te invitaron a un nuevo amigo secreto</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;"><strong style="color: #1b1b1a;">{{NAME}}</strong> armó <strong style="color: #1b1b1a;">{{GROUP}}</strong> con las mismas personas de la vez anterior y te invitó.</p>
                <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Entra para decir si participas. Si esta vez no puedes, también puedes decirlo ahí.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver la invitación</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Si no respondes antes del sorteo, quedas fuera de esta vuelta.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$unveil$tpl$, $tpl$Llegó la hora en {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Ya puedes ver a quién le regalas</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Ya puedes ver a quién le regalas</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Hola {{NAME}},</p>
                <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Se reveló el sorteo a ciegas de <strong style="color: #1b1b1a;">{{GROUP}}</strong>. Entra para ver de quién era la lista que te tocó y si acertaste.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver a quién le regalo</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Solo tú ves a quién le regalas.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$reveal$tpl$, $tpl${{NAME}} fue tu amigo secreto en {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Tu amigo secreto se reveló</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Tu amigo secreto se reveló</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Ya pasó el intercambio de <strong style="color: #1b1b1a;">{{GROUP}}</strong> y quien te regaló quiso contarte que fue <strong style="color: #1b1b1a;">{{NAME}}</strong>.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver el grupo</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Solo tú ves quién te regaló, y solo porque esa persona lo decidió.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$remind_soon$tpl$, $tpl$Faltan 3 días para {{GROUP}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Faltan 3 días</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Faltan 3 días</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">El intercambio de <strong style="color: #1b1b1a;">{{GROUP}}</strong> es en 3 días. Si aún no tienes el regalo, todavía estás a tiempo.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Ver el grupo</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Es el único recordatorio de la fecha que te mandamos.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$remind_soon_list$tpl$, $tpl$Faltan 3 días para {{GROUP}} y tu lista está vacía$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Faltan 3 días</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Faltan 3 días</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">El intercambio de <strong style="color: #1b1b1a;">{{GROUP}}</strong> es en 3 días. Si aún no tienes el regalo, todavía estás a tiempo.</p>
                <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Tu lista sigue vacía, así que quien te regala no tiene pistas. Con dos o tres ideas le ayudas a acertar.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Anotar mi lista</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Es el único recordatorio de la fecha que te mandamos.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$),
  ($tpl$remind_list$tpl$, $tpl$Quien te regala en {{GROUP}} no tiene pistas$tpl$, $tpl$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Tu lista está vacía</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1b1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://fantomio.com" style="text-decoration: none;">
                <img src="https://fantomio.com/email-logo.png" width="175" height="30" alt="fantomio" style="display: block; border: 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e7e7e3; border-radius: 4px; padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #4f4f49;">{{GROUP}}</p>
                    <h1 style="margin: 0 0 20px; font-size: 26px; line-height: 32px; font-weight: 400; color: #1b1b1a;">Tu lista está vacía</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 14px; font-size: 17px; line-height: 26px; color: #4f4f49;">Ya se hizo el sorteo de <strong style="color: #1b1b1a;">{{GROUP}}</strong> y todavía no anotas qué te gustaría. Con dos o tres ideas, quien te regala puede acertar.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 12px 0 4px;">
                <tr>
                  <td style="background-color: #1b1b1a; border-radius: 2px;">
                    <a href="{{URL}}" style="display: inline-block; padding: 15px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">Anotar mi lista</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0;">
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; color: #7d7d76;">Te lo recordamos una sola vez.</p>
              <p style="margin: 0; font-size: 14px; color: #7d7d76;">
                Fantomio &middot; <a href="https://fantomio.com" style="color: #7d7d76;">fantomio.com</a> &middot; <a href="https://fantomio.com/account#preferencias" style="color: #7d7d76;">Dejar de recibir avisos</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html = EXCLUDED.html;

SELECT cron.unschedule('fantomio-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fantomio-reminders');
SELECT cron.schedule('fantomio-reminders', '7 * * * *', 'SELECT public.send_reminders()');
