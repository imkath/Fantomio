"""Reminders: three days before (merged with the empty-list nudge), the empty-list nudge once,
only at 10:00 on the group calendar, and never twice."""

import json
import sys
import urllib.request
import uuid

from _env import ANON, SRV, U, R, sql

fails = []


def req(method, url, body=None, token=None, key=ANON):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json',
         'Prefer': 'return=representation'}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def user():
    email, pw = f'fantomio-prueba-rec-{uuid.uuid4().hex[:6]}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, key=SRV)[1]['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return uid, tok


a, ta = user()
b, tb = user()
c, tc = user()
# A zone where it is 10:xx right now, so the 10:00 rule matches whatever time CI runs.
TZ = sql("select name from pg_timezone_names where extract(hour from now() at time zone name) = 10 "
         "and name like '%/%' order by name limit 1")[0]['name']


def group(name, exchange_in, drawn_days_ago=0):
    g = req('POST', R + 'groups', {'name': name, 'admin_id': a, 'time_zone': TZ}, ta)[1][0]['id']
    sql(f"insert into members (group_id, user_id, is_admin) values ('{g}', '{a}', true), ('{g}', '{b}', false), "
        f"('{g}', '{c}', false) on conflict do nothing")
    # a and c have a list; b does not.
    sql(f"insert into wishlists (group_id, user_id, items) values ('{g}', '{a}', '[{{\"description\": \"libro\"}}]'), "
        f"('{g}', '{c}', '[{{\"description\": \"taza\"}}]') on conflict do nothing")
    req('POST', R + 'rpc/draw_group', {'p_group_id': g}, ta)
    if exchange_in is not None:
        sql(f"update groups set exchange_date = public.group_today('{TZ}') + {exchange_in} where id = '{g}'")
    if drawn_days_ago:
        sql(f"update matches set created_at = now() - interval '{drawn_days_ago} days' where group_id = '{g}'")
    return g


def kinds(g):
    rows = sql(f"select user_id, type from notifications where group_id = '{g}' and type like 'remind%'")
    return {r['user_id']: r['type'] for r in rows} if rows else {}


G1 = group('QA tres dias', 3)
check('draw happened', sql(f"select status from groups where id = '{G1}'")[0]['status'] == 'DRAWN')
sql('select public.send_reminders()')
k = kinds(G1)
check('3 days: one email, merged with the empty list', k == {a: 'remind_soon', b: 'remind_soon_list', c: 'remind_soon'}, str(k))
sql('select public.send_reminders()')
check('3 days: never twice', sql(f"select count(*) n from notifications where group_id = '{G1}' and type like 'remind%'")[0]['n'] == 3)

G2 = group('QA lista vacia', 10, drawn_days_ago=3)
sql('select public.send_reminders()')
check('empty list: only who has none', kinds(G2) == {b: 'remind_list'}, str(kinds(G2)))
sql('select public.send_reminders()')
check('empty list: never twice', len(sql(f"select 1 from notifications where group_id = '{G2}' and type like 'remind%'")) == 1)

G3 = group('QA cubre el de 3 dias', 4, drawn_days_ago=3)
sql('select public.send_reminders()')
check('empty list waits when the 3-day reminder is coming', kinds(G3) == {}, str(kinds(G3)))

G4 = group('QA recien sorteado', 10)
sql('select public.send_reminders()')
check('empty list waits two days after the draw', kinds(G4) == {}, str(kinds(G4)))

other = sql(f"select name from pg_timezone_names where extract(hour from now() at time zone name) = 3 and name like '%/%' limit 1")[0]['name']
G5 = group('QA otra hora', 3)
sql(f"update groups set time_zone = '{other}', exchange_date = public.group_today('{other}') + 3 where id = '{G5}'")
sql('select public.send_reminders()')
check('only at 10:00 on the group calendar', kinds(G5) == {}, str(kinds(G5)))

for uid in (a, b, c):
    req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
