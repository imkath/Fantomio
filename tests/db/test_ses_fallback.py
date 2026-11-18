"""Amazon SES backs up Brevo for essential emails (20261121090000). Brevo goes first; SES takes an
email that Brevo failed, or any when Brevo's day is full. Answers are simulated in
net._http_response and the keys are fake, so nothing is delivered."""

import datetime
import hashlib
import hmac
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


def sigv4(key_id, secret, region, service, host, path, payload, at):
    """AWS Signature Version 4 for a JSON POST, written from the AWS docs, independent of the SQL."""
    amz = at.strftime('%Y%m%dT%H%M%SZ')
    day = amz[:8]
    scope = f'{day}/{region}/{service}/aws4_request'
    signed = 'content-type;host;x-amz-date'
    creq = '\n'.join(['POST', path, '', 'content-type:application/json', f'host:{host}',
                      f'x-amz-date:{amz}', '', signed, hashlib.sha256(payload.encode()).hexdigest()])
    sts = '\n'.join(['AWS4-HMAC-SHA256', amz, scope, hashlib.sha256(creq.encode()).hexdigest()])
    k = ('AWS4' + secret).encode()
    for part in (day, region, service, 'aws4_request'):
        k = hmac.new(k, part.encode(), hashlib.sha256).digest()
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    return {'content-type': 'application/json', 'x-amz-date': amz,
            'authorization': f'AWS4-HMAC-SHA256 Credential={key_id}/{scope}, SignedHeaders={signed}, Signature={sig}'}


def notify(kind):
    sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', '{kind}', 'x')")
    return one(f"select id from notifications where user_id = '{uid}' and type = '{kind}' order by created_at desc limit 1")['id']


def pending(nid):
    return one(f"""select attempts, last_request, last_provider, next_try <= now() ready
                   from email_pending where notification_id = '{nid}'""")


def answer(nid, status):
    rid = -(abs(hash((nid, status, uuid.uuid4().hex))) % 10**12 + 1)
    sql(f"""update email_pending set last_request = {rid} where notification_id = '{nid}';
      insert into net._http_response (id, status_code, timed_out, created) values ({rid}, {status}, false, now());""")


def fill(provider, n):
    sql(f"""insert into email_log (request_id, kind, created_at, provider)
      select -900000 - g, 'test', now() - interval '1 hour', '{provider}' from generate_series(1, {n}) g""")


def clear():
    sql("delete from email_log where kind = 'test'; delete from email_pending;")


# 1. The signature matches the AWS algorithm, byte for byte, with non-ASCII text in the body.
at = datetime.datetime(2026, 11, 17, 12, 34, 56, tzinfo=datetime.timezone.utc)
payload = '{"Data": "Ñandú {{NAME}} 🎁", "x": 1}'
args = ('AKIDEXAMPLE', 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', 'us-east-1', 'ses',
        'email.us-east-1.amazonaws.com', '/v2/email/outbound-emails')
got = one("select public.aws_sigv4_headers(" + ", ".join(f"'{a}'" for a in args)
          + f", $p${payload}$p$, '{at.isoformat()}') h")['h']
check('the SQL signature matches AWS Signature V4', got == sigv4(*args, payload, at), got)

body = {'email': f'ses-{uuid.uuid4().hex[:8]}@example.com', 'email_confirm': True,
        'user_metadata': {'full_name': 'Prueba Respaldo'}}
r = urllib.request.Request(U + '/auth/v1/admin/users', data=json.dumps(body).encode(), method='POST',
                           headers={'apikey': SRV, 'Authorization': 'Bearer ' + SRV, 'Content-Type': 'application/json'})
uid = json.loads(urllib.request.urlopen(r).read())['id']
gid = str(uuid.uuid4())
sql(f"""insert into groups (id, name, admin_id, currency) values ('{gid}', 'QA respaldo', '{uid}', 'CLP');
insert into members (group_id, user_id, is_admin) values ('{gid}', '{uid}', true);
select vault.create_secret('fake-key', 'brevo_api_key');""")

try:
    # 2. Without the SES key nothing changes: a Brevo failure waits its turn for Brevo again.
    check('without its key SES is off', one('select public.ses_ready() r')['r'] is False)
    a = notify('draw')
    answer(a, 503)
    sql('select public.check_email_delivery()')
    p = pending(a)
    check('without SES a Brevo failure waits, as before', p and p['last_request'] is None and not p['ready'], p)
    clear()

    sql("""select vault.create_secret('AKIDEXAMPLE', 'ses_access_key_id');
           select vault.create_secret('fake-secret', 'ses_secret_access_key');""")
    check('with its key SES is on', one('select public.ses_ready() r')['r'] is True)

    # 3. Brevo first.
    b = notify('draw')
    p = pending(b)
    check('an essential email goes through Brevo first', p and p['last_provider'] == 'brevo' and p['last_request'], p)

    # 4. Brevo fails: the next try goes through SES right away.
    answer(b, 503)
    sql('select public.check_email_delivery()')
    p = pending(b)
    check('after a Brevo failure it goes out through SES at once',
          p and p['last_provider'] == 'ses' and p['last_request'] and p['attempts'] == 2, p)
    check('and the SES attempt is logged as SES',
          one(f"select count(*) n from email_log where notification_id = '{b}' and provider = 'ses'")['n'] == 1)

    # 5. SES confirms: done.
    answer(b, 200)
    sql('select public.check_email_delivery()')
    check('confirmed by SES, it leaves the outbox', pending(b) is None)

    # 6. SES fails too: it waits, then Brevo gets it back.
    c = notify('unveil')
    answer(c, 503)
    sql('select public.check_email_delivery()')
    answer(c, 429)
    sql('select public.check_email_delivery()')
    p = pending(c)
    check('after an SES failure it waits instead of hurrying', p and p['last_request'] is None and not p['ready'], p)
    sql(f"update email_pending set next_try = now() - interval '1 minute' where notification_id = '{c}'")
    sql('select public.flush_pending_emails()')
    check('and then Brevo gets it back', pending(c)['last_provider'] == 'brevo', pending(c))
    clear()

    # 7. Brevo's free day is full: straight to SES, and SES never eats into Brevo's count.
    fill('brevo', 240)
    before = one('select public.emails_sent_today() n')['n']
    d = notify('invitation')
    p = pending(d)
    check('with the Brevo day full it goes through SES at once', p and p['last_provider'] == 'ses' and p['last_request'], p)
    check('SES emails do not count against the Brevo day', one('select public.emails_sent_today() n')['n'] == before)
    clear()

    # 8. Spending ceiling: with Brevo full and 1000 SES emails in the day, it waits unsent.
    fill('brevo', 240)
    fill('ses', 1000)
    e = notify('draw')
    p = pending(e)
    check('past the SES ceiling it waits unsent', p and p['last_request'] is None and p['attempts'] == 0, p)
    clear()

    # 9. Everyday notices never use SES, even with Brevo full for them.
    notify('question')
    check('everyday notices never go through SES',
          one("select count(*) n from email_log where provider = 'ses' and kind = 'question'")['n'] == 0)
finally:
    sql(f"""delete from email_log where kind = 'test' or request_id < 0;
delete from net._http_response where id < 0;
delete from email_pending;
delete from groups where id = '{gid}'; delete from auth.users where id = '{uid}';
delete from vault.secrets where name in ('brevo_api_key', 'ses_access_key_id', 'ses_secret_access_key');""")

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
