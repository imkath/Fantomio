"""Email delivery: every notice sent is logged without personal data, the daily reserve holds
notices back past 200, and the delivery check marks answered requests and drops old rows.

Uses a fake Brevo key, so nothing is delivered (Brevo answers 401, or the call times out). There is no sentry_dsn in
this database, so failures are detected but never reported."""

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


body = {'email': f'mail-{uuid.uuid4().hex[:8]}@example.com', 'email_confirm': True,
        'user_metadata': {'full_name': 'Prueba Correo'}}
r = urllib.request.Request(U + '/auth/v1/admin/users', data=json.dumps(body).encode(), method='POST',
                           headers={'apikey': SRV, 'Authorization': 'Bearer ' + SRV, 'Content-Type': 'application/json'})
uid = json.loads(urllib.request.urlopen(r).read())['id']
gid = str(uuid.uuid4())
sql(f"""insert into groups (id, name, admin_id, currency) values ('{gid}', 'QA correos', '{uid}', 'CLP');
insert into members (group_id, user_id, is_admin) values ('{gid}', '{uid}', true);
select vault.create_secret('fake-key', 'brevo_api_key');""")

columns = {r['column_name'] for r in sql(
    "select column_name from information_schema.columns where table_name = 'email_log'")}
check('log keeps no address or user', columns == {'request_id', 'kind', 'created_at', 'checked'}, str(columns))
check('log closed to the API', not sql(
    "select 1 from information_schema.role_table_grants where table_name = 'email_log' and grantee in ('anon', 'authenticated')"))

before = sql('select count(*) n from email_log')[0]['n']
sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', 'draw', 'Se hizo el sorteo')")
logged = sql('select request_id, kind from email_log order by created_at desc limit 1')
check('notice logged', sql('select count(*) n from email_log')[0]['n'] == before + 1 and logged[0]['kind'] == 'draw', str(logged))

answered = []
for _ in range(30):
    answered = sql(f"select status_code, timed_out, error_msg from net._http_response where id = {logged[0]['request_id']}")
    if answered:
        break
    time.sleep(1)
# A rejection, a timeout or a network error all count: the fake key never delivers.
failed = bool(answered) and (answered[0]['timed_out'] or answered[0]['error_msg'] or (answered[0]['status_code'] or 0) >= 400)
check('the fake key does not deliver', bool(failed), str(answered))

sql('select public.check_email_delivery()')
check('answered request marked as checked',
      sql(f"select checked from email_log where request_id = {logged[0]['request_id']}")[0]['checked'])

# Reserve: with 200 notices in the last 24 hours, the next one stays in the bell only.
sql("""insert into email_log (request_id, kind, created_at)
  select -g, 'test', now() - interval '1 hour' from generate_series(1, 200) g""")
n = sql('select count(*) n from email_log')[0]['n']
sql(f"insert into notifications (user_id, group_id, type, body) values ('{uid}', '{gid}', 'question', 'Te preguntaron algo')")
check('reserve holds the notice back', sql('select count(*) n from email_log')[0]['n'] == n)
check('notice still in the bell', sql(
    f"select count(*) n from notifications where user_id = '{uid}' and type = 'question'")[0]['n'] == 1)

sql("update email_log set created_at = now() - interval '8 days' where kind = 'test'")
sql('select public.check_email_delivery()')
check('rows older than a week dropped', sql("select count(*) n from email_log where kind = 'test'")[0]['n'] == 0)

sql(f"""delete from groups where id = '{gid}'; delete from auth.users where id = '{uid}';
delete from vault.secrets where name = 'brevo_api_key';""")
print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
