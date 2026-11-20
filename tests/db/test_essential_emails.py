"""Essential emails (draw, reveal, invitation) go through an outbox and leave it only when Brevo
answers 2xx. Brevo's answers are simulated in net._http_response, so these tests don't depend on
the network. A fake Brevo key is used, so nothing is delivered."""

import json
import sys
import urllib.request
import uuid

from _env import SRV, U, sql

fails = []


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def one(q):
    rows = sql(q)
    return rows[0] if rows else None


def notify(kind):
    sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', '{kind}', 'x')")
    return one(f"select id from notifications where user_id = '{uid}' and type = '{kind}' order by created_at desc limit 1")['id']


def pending(nid):
    return one(f"select attempts, last_request, next_try <= now() ready from email_pending where notification_id = '{nid}'")


def answer(nid, status, timed_out=False):
    """Simulates Brevo's answer to the request in flight for that email."""
    rid = -(abs(hash((nid, status, timed_out))) % 10**12 + 1)
    sql(f"""update email_pending set last_request = {rid} where notification_id = '{nid}';
      insert into net._http_response (id, status_code, timed_out, created) values ({rid}, {status if status else 'null'}, {str(timed_out).lower()}, now());""")


def full_day(n):
    sql(f"""delete from email_log where kind = 'test';
      insert into email_log (request_id, kind, created_at) select -g, 'test', now() - interval '1 hour' from generate_series(1, {n}) g""")


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
    # 1. Into the outbox and out right away; it stays until Brevo confirms.
    a = notify('draw')
    p = pending(a)
    check('a draw email goes out at once and waits for confirmation', p and p['last_request'] and p['attempts'] == 1, p)
    answer(a, 201)
    sql('select public.check_email_delivery()')
    check('confirmed by Brevo, it leaves the outbox', pending(a) is None)

    # 2. A second draw within the hour (reset and draw again) is still emailed.
    b = notify('draw')
    check('a redraw within the hour is emailed too', pending(b) and pending(b)['last_request'])
    answer(b, 201)
    sql('select public.check_email_delivery()')

    # 3. Essential emails ignore the "email notices" switch; everyday ones don't.
    sql(f"update profiles set email_notifications = false where id = '{uid}'")
    c = notify('invitation')
    check('an invitation arrives even with notices turned off', pending(c) and pending(c)['last_request'])
    logged = one('select count(*) n from email_log')['n']
    notify('question')
    check('an everyday notice respects the switch', one('select count(*) n from email_log')['n'] == logged)
    sql(f"update profiles set email_notifications = true where id = '{uid}'; delete from email_pending;")

    # 4. Refusals, quota, errors, timeouts and silence all lead to another try, with a wait.
    for label, status, timed_out in [('quota (429)', 429, False), ('server error', 503, False),
                                     ('timeout', None, True), ('bad key (401)', 401, False)]:
        d = notify('draw')
        answer(d, status, timed_out)
        sql('select public.check_email_delivery()')
        p = pending(d)
        check(f'{label}: back in the outbox to try again', p and p['last_request'] is None and not p['ready'], p)
        sql(f"delete from email_pending where notification_id = '{d}'")
    e = notify('draw')
    sql(f"update email_pending set last_request = -999999, next_try = now() - interval '20 minutes' where notification_id = '{e}'")
    sql('select public.check_email_delivery()')
    p = pending(e)
    check('no answer at all after half an hour: tried again', p and p['last_request'] != -999999, p)
    sql('delete from email_pending')

    # 5. A full day: it waits, unsent, and goes out when there is room.
    full_day(240)
    f = notify('draw')
    p = pending(f)
    check('past the daily room it waits unsent', p and p['last_request'] is None and p['attempts'] == 0, p)
    sql("update email_log set created_at = now() - interval '2 days' where kind = 'test'")
    sql('select public.check_email_delivery()')
    check('when the day frees up it goes out', pending(f) and pending(f)['last_request'])
    sql('delete from email_pending')

    # 5b. Failed attempts don't use up the day.
    sql("""delete from email_log where kind = 'test';
      insert into email_log (request_id, kind, created_at) select -5000 - g, 'test', now() - interval '1 hour' from generate_series(1, 240) g;
      insert into net._http_response (id, status_code, timed_out, created) select -5000 - g, 429, false, now() from generate_series(1, 240) g;""")
    f2 = notify('draw')
    check('240 refused attempts leave the day free', pending(f2) and pending(f2)['last_request'])
    sql("delete from email_log where kind = 'test'; delete from email_pending;")

    # 6. Without the Brevo key it is kept in the outbox, never dropped.
    sql("delete from vault.secrets where name = 'brevo_api_key'")
    g = notify('unveil')
    p = pending(g)
    check('without the Brevo key the email stays in the outbox', p is not None and p['last_request'] is None, p)
    check('and that is reported once', one("select count(*) n from email_alerts where key = 'email-config'")['n'] == 1)
    sql("select vault.create_secret('fake-key', 'brevo_api_key')")

    # 7. An address Brevo refuses three times is given up and reported; 72 hours is the limit.
    sql(f"update email_pending set attempts = 3 where notification_id = '{g}'")
    sql("update email_pending set next_try = now() - interval '1 minute'")
    sql('select public.flush_pending_emails()')
    answer(g, 400)
    sql('select public.check_email_delivery()')
    p = pending(g)
    check('refused as invalid: never dropped before 72 hours, tried again', p is not None and p['last_request'] is None, p)
    check('and the refusal is reported', one("select count(*) n from email_alerts where key = 'email-refused'")['n'] == 1)
    h = notify('draw')
    sql(f"update email_pending set created_at = now() - interval '73 hours' where notification_id = '{h}'")
    sql('select public.check_email_delivery()')
    check('after 72 hours it stops waiting', pending(h) is None)

    # 8. Sentry is told at most once per period.
    sql("delete from email_alerts where key = 'zz-test'")
    for _ in range(3):
        sql("select public.alert_once('zz-test', 'warning', 'x', interval '1 hour')")
    check('alerts are rate limited', one("select count(*) n from email_alerts where key = 'zz-test'")['n'] == 1)
finally:
    sql(f"""delete from email_log where kind = 'test' or request_id < 0; delete from email_alerts where key = 'zz-test';
delete from net._http_response where id < 0;
delete from groups where id = '{gid}'; delete from auth.users where id = '{uid}';
delete from vault.secrets where name = 'brevo_api_key';""")

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
