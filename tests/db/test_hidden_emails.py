"""Members read each other's name and photo, never their email (20261120090000)."""

from _env import ANON, SRV, U, R, sql  # noqa: E402
import json, secrets, sys, urllib.request


def req(method, url, body=None, token=None, key=ANON, prefer='return=representation'):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json', 'Prefer': prefer}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')


fails = []


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


pw = 'Qa-' + secrets.token_hex(8)
ids, T = {}, {}
try:
    for k in 'ab':
        e = f'fantomio-prueba-mail-{k}@example.com'
        ids[k] = req('POST', U + '/auth/v1/admin/users', {'email': e, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': 'Prueba ' + k.upper()}}, key=SRV)[1]['id']
        T[k] = req('POST', U + '/auth/v1/token?grant_type=password', {'email': e, 'password': pw})[1]['access_token']
    s, g = req('POST', R + 'groups', {'name': 'QA correos', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    G = g[0]['id']
    req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    req('POST', R + 'rpc/join_group', {'p_code': g[0]['invite_code']}, T['b'])

    s, r = req('GET', R + f"profiles?id=eq.{ids['a']}&select=full_name,avatar_url", token=T['b'])
    check('a member reads the name of another', s == 200 and r and r[0]['full_name'], (s, r))
    s, _ = req('GET', R + f"profiles?id=eq.{ids['a']}&select=email", token=T['b'])
    check('a member cannot read the email of another', s >= 400, s)
    s, _ = req('GET', R + f"members?group_id=eq.{G}&select=user_id,profiles:user_id(full_name,avatar_url)", token=T['b'])
    check('the group page query still works', s == 200, s)
    s, _ = req('PATCH', R + f"profiles?id=eq.{ids['b']}", {'theme': 'dark'}, T['b'], prefer='return=minimal')
    check('people still edit their own profile', s == 204, s)
    s, r = req('POST', R + 'rpc/export_my_data', {}, T['b'])
    check('own data export still includes the email', s == 200 and 'fantomio-prueba-mail-b' in json.dumps(r), s)
finally:
    if ids:
        sql("delete from groups where admin_id in (" + ",".join(f"'{v}'" for v in ids.values()) + ")")
    for uid in ids.values():
        req('DELETE', f'{U}/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
