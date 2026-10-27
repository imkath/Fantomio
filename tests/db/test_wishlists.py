"""Classic draw: each member reads only their own list and, after the draw, the one of the person
they give to. Nobody else, the organizer included; visitors read nothing."""

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


def user(tag):
    email, pw = f'wl-{tag}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, key=SRV)[1]['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return uid, tok


ids, T = {}, {}
for k in 'abcd':
    ids[k], T[k] = user(k)
s, g = req('POST', R + 'groups', {'name': 'Listas', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
G = g[0]['id']
req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
for k in 'bcd':
    req('POST', R + 'rpc/join_group', {'p_code': g[0]['invite_code']}, T[k])
for k in 'abcd':
    req('POST', R + 'wishlists', {'group_id': G, 'user_id': ids[k], 'items': [{'description': 'algo de ' + k}]}, T[k])

for k in 'abcd':
    rows = req('GET', R + f'wishlists?group_id=eq.{G}&select=user_id', token=T[k])[1]
    check(f'before the draw {k} reads only their own list', [r['user_id'] for r in rows] == [ids[k]])
check('draw', req('POST', R + 'rpc/draw_group', {'p_group_id': G}, T['a'])[0] in (200, 204))
pairs = {r['giver_id']: r['receiver_id'] for r in sql(f"select giver_id, receiver_id from matches where group_id = '{G}'")}
for k in 'abcd':
    rows = sorted(r['user_id'] for r in req('GET', R + f'wishlists?group_id=eq.{G}&select=user_id', token=T[k])[1])
    check(f'after the draw {k} reads own + receiver', rows == sorted([ids[k], pairs[ids[k]]]))
    m = req('GET', R + f'matches?group_id=eq.{G}&select=giver_id', token=T[k])[1]
    check(f'{k} sees only their own match', [r['giver_id'] for r in m] == [ids[k]])
check('visitor reads no lists', req('GET', R + 'wishlists?select=user_id')[0] >= 400)
check('nobody edits another list',
      req('PATCH', R + f"wishlists?group_id=eq.{G}&user_id=eq.{ids['b']}", {'items': []}, T['a'])[1] == [])
check('eleven items rejected',
      req('PATCH', R + f"wishlists?group_id=eq.{G}&user_id=eq.{ids['a']}",
          {'items': [{'description': 'x'}] * 11}, T['a'])[0] >= 400)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
