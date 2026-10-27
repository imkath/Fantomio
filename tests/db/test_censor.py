"""Blind-draw chat: names are masked where they work as names, everyday words are kept."""

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
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read() or 'null')


def user(name):
    email, pw = f'cz-{uuid.uuid4().hex[:6]}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users',
              {'email': email, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': name}}, key=SRV)['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})['access_token']
    return uid, tok


a, ta = user('Rosa Pérez')
b, tb = user('María Luz Castillo')
c, tc = user('Diego Soto')
g = req('POST', R + 'groups', {'name': 'Censura', 'admin_id': a, 'currency': 'CLP'}, ta)[0]
req('POST', R + 'members', {'group_id': g['id'], 'user_id': a, 'is_admin': True}, ta)
for t in (tb, tc):
    req('POST', R + 'rpc/join_group', {'p_code': g['invite_code']}, t)

CASES = {
    'me gusta el color rosa': 'me gusta el color rosa',
    'una lámpara con luz cálida': 'una lámpara con luz cálida',
    'un castillo de lego': 'un castillo de lego',
    'soy rosa jaja': 'soy ••• jaja',
    '¿eres luz?': '¿eres •••?',
    'hola Rosa, ¿qué talla usas?': 'hola •••, ¿qué talla usas?',
    'creo que es Rosa': 'creo que es •••',
    '¿Rosa?': '¿•••?',
    'rosa pérez?': '••• •••?',
    'eres diego?': 'eres •••?',
    'DIEGO': '•••',
    'Rosa: me encanta el rosa': '•••: me encanta el rosa',
}
for text, expected in CASES.items():
    got = sql(f"select public.censor_names('{g['id']}', $${text}$$) as t")[0]['t']
    ok = got == expected
    print(('PASS ' if ok else 'FAIL ') + f'{text!r} -> {got!r}')
    if not ok:
        fails.append(text)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
