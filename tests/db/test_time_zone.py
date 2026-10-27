"""Group time zone: only real IANA names, "today" is the group's calendar day (not UTC), and
revealing yourself waits for the exchange day on that calendar."""

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
    email, pw = f'fantomio-prueba-tz-{uuid.uuid4().hex[:6]}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, key=SRV)[1]['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return uid, tok


a, ta = user()
b, tb = user()

s, g = req('POST', R + 'groups', {'name': 'QA zona', 'admin_id': a, 'time_zone': 'America/Santiago'}, ta)
check('create with a real zone', s == 201 and g[0]['time_zone'] == 'America/Santiago', str(g)[:120])
G = g[0]['id']
s, bad = req('POST', R + 'groups', {'name': 'QA zona mala', 'admin_id': a, 'time_zone': 'Marte/Olympus'}, ta)
check('unknown zone rejected', s >= 400, str(bad)[:120])
check('default zone for old clients', req('POST', R + 'groups', {'name': 'QA sin zona', 'admin_id': a}, ta)[1][0]['time_zone'] == 'America/Santiago')

# Pago Pago (UTC-11) and Kiritimati (UTC+14) are always on different calendar days.
d = sql("select public.group_today('Pacific/Pago_Pago') p, public.group_today('Pacific/Kiritimati') k, "
        "(now() at time zone 'Pacific/Pago_Pago')::date pp")[0]
check('group_today follows the zone', d['p'] == d['pp'] and d['k'] > d['p'], str(d))

# A drawn classic pair, so reveal_myself only depends on the date.
sql(f"insert into members (group_id, user_id, is_admin) values ('{G}', '{a}', true), ('{G}', '{b}', false) on conflict do nothing")
sql(f"insert into matches (group_id, giver_id, receiver_id) values ('{G}', '{a}', '{b}'), ('{G}', '{b}', '{a}')")
sql(f"update groups set status = 'DRAWN', time_zone = 'Pacific/Pago_Pago', exchange_date = '{d['k']}' where id = '{G}'")
check('reveal waits while the exchange day has not come on the group calendar',
      req('POST', R + 'rpc/reveal_myself', {'p_group_id': G}, ta)[0] >= 400)
sql(f"update groups set exchange_date = '{d['p']}' where id = '{G}'")
check('reveal opens on the exchange day of the group calendar',
      req('POST', R + 'rpc/reveal_myself', {'p_group_id': G}, ta)[0] in (200, 204))

s, rep = req('POST', R + 'rpc/repeat_group', {'p_group_id': G, 'p_name': 'QA zona 2027', 'p_exchange_date': None, 'p_budget': None}, ta)
check('next edition keeps the zone', s == 200 and sql(f"select time_zone from groups where id = '{rep}'")[0]['time_zone'] == 'Pacific/Pago_Pago', str(rep)[:120])

for uid in (a, b):
    req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
