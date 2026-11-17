"""Names are always there; the organizer, and only the organizer, gets a hint of members' emails
(20261119090000)."""

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
    for k, meta in [('a', {'full_name': 'Prueba A'}), ('b', {'full_name': 'Prueba B'}), ('c', {'name': '   '})]:
        e = f'fantomio-prueba-nom-{k}@example.com'
        s, u = req('POST', U + '/auth/v1/admin/users', {'email': e, 'password': pw, 'email_confirm': True, 'user_metadata': meta}, key=SRV)
        ids[k] = u['id']
        T[k] = req('POST', U + '/auth/v1/token?grant_type=password', {'email': e, 'password': pw})[1]['access_token']

    name_c = sql(f"select full_name from profiles where id = '{ids['c']}'")[0]['full_name']
    check('signing up with a blank name falls back to the start of the email', name_c == 'fantomio-prueba-nom-c', name_c)

    s, _ = req('PATCH', R + f"profiles?id=eq.{ids['b']}", {'full_name': '   '}, T['b'], prefer='return=minimal')
    check('a blank name is refused', s >= 400, s)
    s, _ = req('PATCH', R + f"profiles?id=eq.{ids['b']}", {'full_name': None}, T['b'], prefer='return=minimal')
    check('no name at all is refused', s >= 400, s)

    s, g = req('POST', R + 'groups', {'name': 'QA nombres', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    G = g[0]['id']
    req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bc':
        req('POST', R + 'rpc/join_group', {'p_code': g[0]['invite_code']}, T[k])

    s, hints = req('POST', R + 'rpc/group_email_hints', {'p_group_id': G}, T['a'])
    by = {h['user_id']: h['hint'] for h in (hints or [])}
    check('the organizer gets a hint per member', s == 200 and len(by) == 3, (s, hints))
    check('the hint shows only the start of the address', by.get(ids['b']) == 'fa***@example.com', by.get(ids['b']))
    s, hints = req('POST', R + 'rpc/group_email_hints', {'p_group_id': G}, T['b'])
    check('a member who does not organize gets nothing', s == 200 and hints == [], (s, hints))
    s, _ = req('POST', R + 'rpc/group_email_hints', {'p_group_id': G})
    check('without a session it is closed', s >= 400, s)

    policy = sql("select with_check from pg_policies where tablename = 'objects' and policyname = 'Avatars: owners upload to their folder'")[0]['with_check']
    check('two photo files per person', '< 2' in policy, policy[-60:])
finally:
    if ids:
        sql("delete from groups where admin_id in (" + ",".join(f"'{v}'" for v in ids.values()) + ")")
    for uid in ids.values():
        req('DELETE', f'{U}/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
