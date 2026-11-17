"""Essential emails (draw, reveal, invitation) never get lost: past the daily room they wait in a
queue and go out when there is room again; a refused one is retried. Everyday notices keep
falling back to the bell. Uses a fake Brevo key, so nothing is delivered."""

import json
import sys
import time
import urllib.request
import uuid

from _env import SRV, U, sql

fails = []


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def count(q):
    return sql(f'select count(*) n from {q}')[0]['n']


body = {'email': f'esencial-{uuid.uuid4().hex[:8]}@example.com', 'email_confirm': True,
        'user_metadata': {'full_name': 'Prueba Esencial'}}
r = urllib.request.Request(U + '/auth/v1/admin/users', data=json.dumps(body).encode(), method='POST',
                           headers={'apikey': SRV, 'Authorization': 'Bearer ' + SRV, 'Content-Type': 'application/json'})
uid = json.loads(urllib.request.urlopen(r).read())['id']
gid = str(uuid.uuid4())
sql(f"""insert into groups (id, name, admin_id, currency) values ('{gid}', 'QA esenciales', '{uid}', 'CLP');
insert into members (group_id, user_id, is_admin) values ('{gid}', '{uid}', true);
select vault.create_secret('fake-key', 'brevo_api_key');""")

try:
    # A full day: 270 emails already sent.
    sql("""insert into email_log (request_id, kind, created_at)
      select -g, 'test', now() - interval '1 hour' from generate_series(1, 270) g""")
    logged = count('email_log')

    sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', 'draw', 'Se hizo el sorteo')")
    check('a draw email past the room waits instead of being dropped',
          count('email_log') == logged and count('email_pending') == 1)

    sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', 'question', 'Te preguntaron algo')")
    check('an everyday notice past the room stays in the bell only',
          count('email_log') == logged and count('email_pending') == 1)

    sent = sql('select public.flush_pending_emails() n')[0]['n']
    check('nothing goes out while the day is still full', sent == 0 and count('email_pending') == 1, sent)

    # The day frees up: the waiting email goes out.
    sql("update email_log set created_at = now() - interval '2 days' where kind = 'test'")
    sent = sql('select public.flush_pending_emails() n')[0]['n']
    out = sql("select request_id, notification_id from email_log where kind = 'draw' order by created_at desc limit 1")
    check('the waiting draw email goes out when there is room',
          sent == 1 and count('email_pending') == 0 and out and out[0]['notification_id'], (sent, out))

    # Brevo refuses it (fake key): the delivery check puts it back in the queue.
    answered = []
    for _ in range(30):
        answered = sql(f"select status_code, timed_out, error_msg from net._http_response where id = {out[0]['request_id']}")
        if answered:
            break
        time.sleep(1)
    sql("delete from email_log where kind = 'test'")
    # Keep the flush from resending right away, to see the requeue itself.
    sql("""insert into email_log (request_id, kind, created_at)
      select -g, 'test', now() - interval '1 hour' from generate_series(1, 270) g""")
    sql('select public.check_email_delivery()')
    check('a refused draw email is queued again', count('email_pending') == 1, str(answered))

    # Three tries at most: an address that always bounces doesn't loop forever.
    nid = out[0]['notification_id']
    sql(f"""delete from email_pending;
      insert into email_log (request_id, kind, notification_id, created_at)
      select -1000 - g, 'draw', '{nid}', now() from generate_series(1, 3) g""")
    sql('update email_log set checked = false')
    sql('select public.check_email_delivery()')
    check('after three tries it is not queued again', count('email_pending') == 0)
finally:
    sql(f"""delete from email_log where kind = 'test' or request_id < 0;
delete from groups where id = '{gid}'; delete from auth.users where id = '{uid}';
delete from vault.secrets where name = 'brevo_api_key';""")

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
