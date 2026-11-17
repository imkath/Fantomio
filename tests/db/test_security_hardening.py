"""Hardening of 17-nov-2026: group history, wish list shape, email placeholders, recent sign-in
for account deletion and merges, unused grants and closed-by-default privileges."""

from _env import ANON, SRV, U, R, DB_URL, sql  # noqa: E402
import json, secrets, subprocess, sys, time, urllib.request


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


def as_user(uid, auth_time, query):
    """Runs a query as `authenticated` with JWT claims whose sign-in happened at `auth_time`."""
    claims = json.dumps({'sub': uid, 'role': 'authenticated', 'amr': [{'method': 'password', 'timestamp': auth_time}]})
    script = f"""BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{claims}', true) \\g /dev/null
{query};
ROLLBACK;"""
    p = subprocess.run(['psql', DB_URL, '-q', '-At', '-v', 'ON_ERROR_STOP=1'], input=script, capture_output=True, text=True)
    return p.returncode, (p.stdout.strip().splitlines() or [''])[-1], p.stderr


pw = 'Qa-' + secrets.token_hex(8)
ids, T = {}, {}
try:
    for k in 'ab':
        e = f'fantomio-prueba-sec-{k}@example.com'
        ids[k] = req('POST', U + '/auth/v1/admin/users', {'email': e, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': 'Prueba ' + k.upper()}}, key=SRV)[1]['id']
        T[k] = req('POST', U + '/auth/v1/token?grant_type=password', {'email': e, 'password': pw})[1]['access_token']

    s, g = req('POST', R + 'groups', {'name': '{{NAME}} y {{URL}}', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    G, code = g[0]['id'], g[0]['invite_code']
    req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    req('POST', R + 'rpc/join_group', {'p_code': code}, T['b'])

    # 1. Group history: the organizer can log; a member can't, not even under their own name.
    s, _ = req('POST', R + 'activities', {'group_id': G, 'user_id': ids['a'], 'type': 'GROUP_UPDATED', 'message': 'ok'}, T['a'])
    check('the history is written only by the database (organizer included)', s >= 400, s)
    s, _ = req('POST', R + 'activities', {'group_id': G, 'user_id': ids['b'], 'type': 'GROUP_UPDATED', 'message': 'falso'}, T['b'])
    check('member cannot write the group history', s >= 400, s)

    # 2. Wish list shape.
    def save(items):
        return req('POST', R + 'wishlists?on_conflict=group_id,user_id', {'group_id': G, 'user_id': ids['b'], 'items': items}, T['b'], prefer='resolution=merge-duplicates,return=representation')[0]
    check('valid list saves', save([{'description': 'Un libro', 'url': 'https://example.com/libro'}, {'description': 'Algo rico'}]) < 300)
    check('null link is fine', save([{'description': 'Un libro', 'url': None}]) < 300)
    check('link that is not text is refused', save([{'description': 'Un libro', 'url': 42}]) >= 400)
    check('item without description is refused', save([{'url': 'https://example.com'}]) >= 400)
    check('item that is not an object is refused', save(['Un libro']) >= 400)
    check('huge description is refused', save([{'description': 'x' * 1001}]) >= 400)
    check('more than 10 items is refused', save([{'description': f'n{i}'} for i in range(11)]) >= 400)

    # 3. Email placeholders: names are escaped before the template is filled.
    # Since 18-nov-2026 the sending half lives in send_notification_email.
    body = sql("select pg_get_functiondef('public.send_notification_email(uuid)'::regprocedure) d")[0]['d']
    check('email names are neutralized before filling the template', "regexp_replace(group_name" in body and "regexp_replace(other_name" in body)
    out = sql("select regexp_replace('{{{NAME}}', '\\{(?=\\{)', '{ ', 'g') r")[0]['r']
    check('no run of braces rebuilds a placeholder', '{{' not in out, out)

    # 4. Recent sign-in for deleting and merging.
    now, old = int(time.time()), int(time.time()) - 2 * 3600
    rc, out, _ = as_user(ids['a'], now, 'SELECT public.signed_in_recently()')
    check('fresh sign-in counts as recent', rc == 0 and out == 't', out)
    rc, out, _ = as_user(ids['a'], old, 'SELECT public.signed_in_recently()')
    check('sign-in two hours ago is not recent', rc == 0 and out == 'f', out)
    rc, _, err = as_user(ids['a'], old, 'SELECT public.delete_my_account()')
    check('stale session cannot delete the account', rc != 0 and 'confirmar que eres' in err, err.strip()[:80])
    rc, _, err = as_user(ids['a'], old, 'SELECT public.start_merge()')
    check('stale session cannot start a merge', rc != 0 and 'confirmar que eres' in err, err.strip()[:80])
    rc, _, err = as_user(ids['b'], old, "SELECT public.confirm_merge('x')")
    check('stale session cannot confirm a merge', rc != 0 and 'confirmar que eres' in err, err.strip()[:80])
    s, _ = req('POST', R + 'rpc/delete_my_account_now', {}, T['a'])
    check('the unchecked deletion is not callable', s >= 400, s)
    s, _ = req('POST', R + 'rpc/start_merge', {}, T['a'])
    check('fresh session still starts a merge', s == 200, s)

    # 4b. A refreshed session keeps the original sign-in time: a stolen refresh token can't
    #     make itself "recent".
    import base64
    def amr_time(token):
        part = token.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
        return max(a['timestamp'] for a in claims.get('amr', []))
    s, first = req('POST', U + '/auth/v1/token?grant_type=password', {'email': 'fantomio-prueba-sec-a@example.com', 'password': pw})
    time.sleep(2)
    s, again = req('POST', U + '/auth/v1/token?grant_type=refresh_token', {'refresh_token': first['refresh_token']})
    check('refreshing keeps the sign-in time', s == 200 and amr_time(again['access_token']) == amr_time(first['access_token']), s)

    # 4c. A sign-in method linked in the last day blocks deletion and merges, even when fresh.
    fresh = req('POST', U + '/auth/v1/token?grant_type=password', {'email': 'fantomio-prueba-sec-a@example.com', 'password': pw})[1]['access_token']
    sql(f"""update auth.users set created_at = now() - interval '10 days' where id = '{ids['a']}';
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values ('linked-{ids['a']}', '{ids['a']}', jsonb_build_object('sub','linked-{ids['a']}'), 'google', now(), now());""")
    s, r = req('POST', R + 'rpc/start_merge', {}, fresh)
    check('recently linked Google blocks a merge', s >= 400 and 'forma nueva de entrar' in json.dumps(r, ensure_ascii=False), s)
    sql(f"delete from auth.identities where provider_id = 'linked-{ids['a']}'")

    # 4d. What blocks a deletion is asked before anything is removed.
    s, r = req('POST', R + 'rpc/account_deletion_blockers', {}, T['a'])
    check('organizer of a group with others is told first', s == 200 and isinstance(r, str) and 'NAME' in r, r)
    s, r = req('POST', R + 'rpc/account_deletion_blockers', {}, T['b'])
    check('a plain member has nothing blocking', s == 200 and r is None, r)

    # 5. Unused grants are gone.
    s, _ = req('GET', R + 'email_templates?select=name', token=T['a'])
    check('templates are not readable', s >= 400, s)
    priv = sql("select has_table_privilege('authenticated','public.matches','INSERT') i, has_table_privilege('authenticated','public.matches','SELECT') s")[0]
    check('pairs: no insert, select kept for RLS', priv['i'] is False and priv['s'] is True, priv)

    # 6. Closed by default: something new in public is not reachable until granted.
    sql('create function public.zz_probe() returns int language sql as $$ select 1 $$; create table public.zz_probe_t (id int);')
    probe = sql("select has_function_privilege('authenticated','public.zz_probe()','execute') f, has_table_privilege('authenticated','public.zz_probe_t','SELECT') t")[0]
    sql('drop function public.zz_probe(); drop table public.zz_probe_t;')
    check('new functions and tables are closed to signed-in users', probe['f'] is False and probe['t'] is False, probe)

    req('DELETE', R + f'groups?id=eq.{G}', token=T['a'])
finally:
    for uid in ids.values():
        req('DELETE', f'{U}/auth/v1/admin/users/{uid}', key=SRV)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
