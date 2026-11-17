"""Second batch of 18-nov-2026: automatic history, frozen exclusions, daily limits, hidden
emails between members and the name length ceiling."""

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


def history(G, kind):
    return sql(f"select count(*) n from activities where group_id='{G}' and type='{kind}'")[0]['n']


pw = 'Qa-' + secrets.token_hex(8)
ids, T = {}, {}
try:
    for k in 'abcd':
        e = f'fantomio-prueba-lim-{k}@example.com'
        ids[k] = req('POST', U + '/auth/v1/admin/users', {'email': e, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': 'Prueba ' + k.upper()}}, key=SRV)[1]['id']
        T[k] = req('POST', U + '/auth/v1/token?grant_type=password', {'email': e, 'password': pw})[1]['access_token']

    s, g = req('POST', R + 'groups', {'name': 'QA limites', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    G, code = g[0]['id'], g[0]['invite_code']
    req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bc':
        req('POST', R + 'rpc/join_group', {'p_code': code}, T[k])

    # 1. History written by the database.
    check('creating a group logs it', history(G, 'GROUP_CREATED') == 1)
    req('PATCH', R + f'groups?id=eq.{G}', {'name': 'QA limites 2'}, T['a'])
    check('editing the group logs it', history(G, 'GROUP_UPDATED') == 1)
    req('PATCH', R + f'groups?id=eq.{G}', {'name': 'QA limites 2'}, T['a'])
    check('a save without changes logs nothing', history(G, 'GROUP_UPDATED') == 1)
    s, _ = req('POST', R + 'activities', {'group_id': G, 'user_id': ids['a'], 'type': 'GROUP_UPDATED', 'message': 'x'}, T['a'])
    check('nobody inserts history rows', s >= 400, s)

    # 2. Exclusions only before the draw.
    s, ex = req('POST', R + 'exclusions', {'group_id': G, 'giver_id': ids['b'], 'excluded_receiver_id': ids['c']}, T['a'])
    check('exclusion before the draw', s < 300, s)
    s, _ = req('POST', R + 'rpc/draw_group', {'p_group_id': G}, T['a'])
    check('draw', s < 300, s)
    check('the draw does not log a group update', history(G, 'GROUP_UPDATED') == 1)
    s, _ = req('POST', R + 'exclusions', {'group_id': G, 'giver_id': ids['c'], 'excluded_receiver_id': ids['b']}, T['a'])
    check('no new exclusion after the draw', s >= 400, s)
    s, r = req('DELETE', R + f"exclusions?id=eq.{ex[0]['id']}", token=T['a'])
    check('no removed exclusion after the draw', s >= 400 or r == [], (s, r))
    req('POST', R + 'rpc/reset_group_draw', {'p_group_id': G}, T['a'])
    s, r = req('DELETE', R + f"exclusions?id=eq.{ex[0]['id']}", token=T['a'])
    check('after a reset exclusions can change again', s < 300 and r != [], (s, r))

    # 3. Daily limits.
    for i in range(9):  # a already created 1 today
        req('POST', R + 'groups', {'name': f'QA lote {i}', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    s, r = req('POST', R + 'groups', {'name': 'QA uno de mas', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    check('11th group of the day is refused', s >= 400 and 'muchos grupos' in json.dumps(r, ensure_ascii=False), s)
    sql(f"insert into activities (group_id, user_id, type, message) select '{G}', '{ids['a']}', 'DRAW', 'x' from generate_series(1, 20)")
    s, r = req('POST', R + 'rpc/draw_group', {'p_group_id': G}, T['a'])
    check('21st draw of the day is refused', s >= 400 and 'muchos sorteos' in json.dumps(r, ensure_ascii=False), s)
    sql(f"delete from activities where group_id='{G}' and type='DRAW' and message='x'")
    s, _ = req('POST', R + 'rpc/draw_group', {'p_group_id': G}, T['a'])
    m = sql(f"select id from matches where group_id='{G}' and giver_id='{ids['b']}'")[0]['id']
    sql(f"insert into anonymous_messages (match_id, sender_role, content) select '{m}', 'giver', 'hola' from generate_series(1, 30)")
    s, r = req('POST', R + 'anonymous_messages', {'match_id': m, 'sender_role': 'giver', 'content': 'otra'}, T['b'])
    check('31st message in an hour is refused', s >= 400 and 'muchos mensajes' in json.dumps(r, ensure_ascii=False), s)

    # 5. Members see each other's name, not their email.
    s, r = req('GET', R + f"profiles?id=eq.{ids['c']}&select=full_name,avatar_url", token=T['b'])
    check('a member reads the name of another', s == 200 and r and r[0]['full_name'], (s, r))
    s, r = req('GET', R + f"profiles?id=eq.{ids['c']}&select=email", token=T['b'])
    check('a member cannot read the email of another', s >= 400, s)
    s, r = req('GET', R + f"profiles?id=eq.{ids['b']}&select=email", token=T['b'])
    check('the email column is closed for everyone (own email comes from the session)', s >= 400, s)

    # 6. Name ceiling.
    s, _ = req('PATCH', R + f"profiles?id=eq.{ids['d']}", {'full_name': 'María del Carmen de la Santísima Trinidad González Pérez'}, T['d'])
    check('a long real name is fine', s < 300, s)
    s, _ = req('PATCH', R + f"profiles?id=eq.{ids['d']}", {'full_name': 'x' * 301}, T['d'])
    check('301 characters is refused', s >= 400, s)
    s, _ = req('POST', R + 'groups', {'name': 'y' * 301, 'admin_id': ids['d'], 'currency': 'CLP'}, T['d'])
    check('a 301-character group name is refused', s >= 400, s)

    # 4. Email share per organizer (needs Brevo, so only checked in the function).
    body = sql("select pg_get_functiondef('public.email_notification()'::regprocedure) d")[0]['d']
    check('notices count against the organizer share', '>= 60' in body and 'l.group_id' in body)
finally:
    sql("delete from groups where admin_id in (" + ",".join(f"'{v}'" for v in ids.values()) + ")") if ids else None
    for uid in ids.values():
        req('DELETE', f'{U}/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
