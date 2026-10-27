"""Exchange place: only members read it, the invite preview leaves it out, online links are
https only, nothing half filled, and the next edition keeps it."""

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
    email, pw = f'fantomio-prueba-lugar-{uuid.uuid4().hex[:6]}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, key=SRV)[1]['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return uid, tok


a, ta = user()
outsider, to = user()

G = req('POST', R + 'groups', {'name': 'QA lugar', 'admin_id': a}, ta)[1][0]['id']
sql(f"insert into members (group_id, user_id, is_admin) values ('{G}', '{a}', true) on conflict do nothing")


def patch(body):
    return req('PATCH', R + f'groups?id=eq.{G}', body, ta)[0]


check('in person with name and address', patch({'place_kind': 'in_person', 'place_name': 'Casa de la abuela',
                                                'place_detail': 'Av. Providencia 1234, Providencia'}) == 200)
check('online with an https link', patch({'place_kind': 'online', 'place_name': None,
                                          'place_detail': 'https://discord.gg/abc'}) == 200)
check('online refuses javascript:', patch({'place_kind': 'online', 'place_detail': 'javascript:alert(1)'}) >= 400)
check('online refuses plain http', patch({'place_kind': 'online', 'place_detail': 'http://zoom.us/j/1'}) >= 400)
check('unknown kind refused', patch({'place_kind': 'luna'}) >= 400)
check('no kind, no leftovers', patch({'place_kind': None, 'place_name': 'x', 'place_detail': None}) >= 400)
check('too long refused', patch({'place_kind': 'in_person', 'place_detail': 'x' * 301}) >= 400)
check('back to a valid place', patch({'place_kind': 'in_person', 'place_name': 'Casa de la abuela',
                                      'place_detail': 'Av. Providencia 1234, Providencia'}) == 200)

s, seen = req('GET', R + f'groups?id=eq.{G}&select=place_detail', token=to)
check('someone outside the group cannot read it', s == 200 and seen == [], str(seen))
code = sql(f"select invite_code from groups where id = '{G}'")[0]['invite_code']
s, prev = req('POST', R + 'rpc/get_group_by_invite_code', {'code': code}, to)
check('invite preview leaves the place out', 'Providencia' not in json.dumps(prev), str(prev)[:160])

s, rep = req('POST', R + 'rpc/repeat_group', {'p_group_id': G, 'p_name': 'QA lugar 2027', 'p_exchange_date': None, 'p_budget': None}, ta)
row = sql(f"select place_kind, place_name from groups where id = '{rep}'")[0] if s == 200 else {}
check('next edition keeps the place', row == {'place_kind': 'in_person', 'place_name': 'Casa de la abuela'}, str(rep)[:120])

for uid in (a, outsider):
    req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
