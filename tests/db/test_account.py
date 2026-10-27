from _env import ANON, SRV, U, R, sql  # noqa: E402
import json, urllib.request, subprocess, uuid, sys


def req(method, url, body=None, token=None, key=ANON, prefer='return=representation'):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json', 'Prefer': prefer}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')




fails = []
created = []


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def user(tag, google=False, pw=None):
    email = f'ghostswap-prueba-{tag}@example.com'
    body = {'email': email, 'email_confirm': True, 'user_metadata': {'full_name': 'Prueba ' + tag.upper()}}
    if pw:
        body['password'] = pw
    s, u = req('POST', U + '/auth/v1/admin/users', body, key=SRV)
    uid = u['id']
    created.append(uid)
    if google:
        gid = str(uuid.uuid4().int)[:21]
        sql(f"""delete from auth.identities where user_id='{uid}';
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('{gid}', '{uid}', jsonb_build_object('sub','{gid}','email','{email}','email_verified',true), 'google', now(), now(), now());
update auth.users set encrypted_password='', raw_app_meta_data=jsonb_build_object('provider','google','providers',jsonb_build_array('google')) where id='{uid}';""")
    s, l = req('POST', U + '/auth/v1/admin/generate_link', {'type': 'magiclink', 'email': email}, key=SRV)
    th = l.get('hashed_token') or l.get('properties', {}).get('hashed_token')
    s, sess = req('POST', U + '/auth/v1/verify', {'type': 'magiclink', 'token_hash': th})
    return uid, email, sess['access_token']


def identities(tok):
    return sorted(i['provider'] for i in req('GET', U + '/auth/v1/user', token=tok)[1]['identities'])


def pw_login(email, pw):
    return req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[0] == 200


try:
    # 1. Google-only account adds a password, then disconnects Google -------------------------
    g, gmail, gt = user('g', google=True)
    check('google-only status', req('POST', R + 'rpc/account_status', {}, gt)[1] == {'has_password': False, 'providers': ['google']})
    s, r = req('POST', R + 'rpc/ensure_email_identity', {}, gt)
    check('ensure_email_identity without password does nothing', r is False and identities(gt) == ['google'], str(r))
    pw = 'Qa-' + uuid.uuid4().hex[:12]
    check('set password', req('PUT', U + '/auth/v1/user', {'password': pw}, gt)[0] == 200)
    s, r = req('POST', R + 'rpc/ensure_email_identity', {}, gt)
    check('ensure_email_identity reports success', r is True, f'{s} {r}')
    check('email identity added', identities(gt) == ['email', 'google'], str(identities(gt)))
    gi = [i for i in req('GET', U + '/auth/v1/user', token=gt)[1]['identities'] if i['provider'] == 'google'][0]
    s, r = req('DELETE', U + f"/auth/v1/user/identities/{gi['identity_id']}", token=gt)
    check('unlink google', s in (200, 204), f'{s} {r}')
    check('only email left', identities(gt) == ['email'])
    check('password login after unlink', pw_login(gmail, pw))

    # 2. Merge: B (Google) into A (email + password) ------------------------------------------
    apw = 'Qa-' + uuid.uuid4().hex[:12]
    a, amail, at = user('a', pw=apw)
    b, bmail, bt = user('b', google=True)
    c, cmail, ct = user('c', pw='Qa-' + uuid.uuid4().hex[:12])
    s, gx = req('POST', R + 'groups', {'name': 'QA grupo B', 'admin_id': b, 'currency': 'CLP'}, bt)
    X = gx[0]['id']
    req('POST', R + 'members', {'group_id': X, 'user_id': b, 'is_admin': True}, bt)
    req('POST', R + 'rpc/join_group', {'p_code': gx[0]['invite_code']}, ct)
    req('POST', R + 'wishlists', {'group_id': X, 'user_id': b, 'items': [{'description': 'libro'}]}, bt)
    s, gy = req('POST', R + 'groups', {'name': 'QA grupo A', 'admin_id': a, 'currency': 'CLP'}, at)
    Y = gy[0]['id']
    req('POST', R + 'members', {'group_id': Y, 'user_id': a, 'is_admin': True}, at)
    # Invitations: one only for B, one for both A and B, and one B sent.
    zs = []
    for name in ('QA invita B', 'QA invita A y B'):
        s, gz = req('POST', R + 'groups', {'name': name, 'admin_id': c, 'currency': 'CLP'}, ct)
        zs.append(gz[0]['id'])
        req('POST', R + 'members', {'group_id': gz[0]['id'], 'user_id': c, 'is_admin': True}, ct)
    Z1, Z2 = zs
    sql(f"""insert into group_invitations (group_id, user_id, invited_by) values
      ('{Z1}', '{b}', '{c}'), ('{Z2}', '{a}', '{c}'), ('{Z2}', '{b}', '{c}'), ('{X}', '{g}', '{b}')""")
    s, code = req('POST', R + 'rpc/start_merge', {}, at)
    check('start_merge', s == 200 and isinstance(code, str) and len(code) == 48)
    s, prev = req('POST', R + 'rpc/merge_preview', {'p_code': code}, bt)
    check('merge_preview shows target', prev == {'email': amail, 'same': False}, str(prev))
    check('confirm with same account refused', req('POST', R + 'rpc/confirm_merge', {'p_code': code}, at)[0] >= 400)
    check('bad code refused', req('POST', R + 'rpc/confirm_merge', {'p_code': 'x' * 48}, bt)[0] >= 400)
    s, r = req('POST', R + 'rpc/confirm_merge', {'p_code': code}, bt)
    check('confirm_merge', s == 200 and r == amail, f'{s} {r}')
    st = sql(f"""select (select count(*) from auth.users where id='{b}') b_left,
      (select admin_id from groups where id='{X}') = '{a}' admin_moved,
      (select count(*) from members where group_id='{X}' and user_id='{a}') a_in_x,
      (select items from wishlists where group_id='{X}' and user_id='{a}') list,
      (select jsonb_agg(provider order by provider) from auth.identities where user_id='{a}') providers,
      (select count(*) from auth.identities where user_id='{b}') b_identities,
      (select count(*) from group_invitations where user_id='{a}' and group_id='{Z1}') inv_moved,
      (select count(*) from group_invitations where group_id='{Z2}') inv_z2,
      (select invited_by from group_invitations where group_id='{X}' and user_id='{g}') = '{a}' inviter_moved""")[0]
    check('B deleted', st['b_left'] == 0)
    check('group admin moved', st['admin_moved'])
    check('membership moved', st['a_in_x'] == 1)
    check('wishlist moved', st['list'] == [{'description': 'libro'}], str(st['list']))
    # Google is connected afterwards from the browser (linkIdentity); the database leaves it alone.
    check('auth identities of A untouched', st['providers'] == ['email'], str(st['providers']))
    check("B's identities gone with B", st['b_identities'] == 0)
    check('invitation moved to A', st['inv_moved'] == 1)
    check('duplicate invitation dropped', st['inv_z2'] == 1, str(st['inv_z2']))
    check('invited-by moved to A', st['inviter_moved'])
    check('A password still works', pw_login(amail, apw))
    check('code is single use', req('POST', R + 'rpc/merge_preview', {'p_code': code}, at)[1] is None)

    # 3. Shared group refuses merge -----------------------------------------------------------
    s, code2 = req('POST', R + 'rpc/start_merge', {}, at)
    s, r = req('POST', R + 'rpc/confirm_merge', {'p_code': code2}, ct)
    check('merge refused when both in same group', s >= 400 and 'mismo grupo' in str(r), str(r)[:120])

    # 4. Export and delete --------------------------------------------------------------------
    s, data = req('POST', R + 'rpc/export_my_data', {}, at)
    check('export has sections', s == 200 and {'cuenta', 'perfil', 'grupos', 'listas_de_deseos'} <= set(data or {}), str(s))
    s, r = req('POST', R + 'rpc/delete_my_account', {}, at)
    check('delete blocked while organizing a group with others', s >= 400 and 'Organizas' in str(r), str(r)[:120])
    s, r = req('POST', R + 'rpc/delete_my_account', {}, ct)
    check('member deletes own account', s in (200, 204), f'{s} {r}')
    st = sql(f"select (select count(*) from auth.users where id='{c}') c_left, (select count(*) from members where group_id='{X}') members_x")[0]
    check('C gone with its membership', st['c_left'] == 0 and st['members_x'] == 1, str(st))
    # preferences
    check('theme update', req('PATCH', R + f'profiles?id=eq.{g}', {'theme': 'dark', 'email_notifications': False}, gt)[0] == 200)
    check('bad theme rejected', req('PATCH', R + f'profiles?id=eq.{g}', {'theme': 'pink'}, gt)[0] >= 400)
    check('foreign avatar rejected', req('PATCH', R + f'profiles?id=eq.{g}', {'avatar_url': 'https://evil.example/a.png'}, gt)[0] >= 400)
finally:
    sql("delete from groups where name like 'QA %'")
    for uid in created:
        req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)
    left = sql("select count(*) n from auth.users where email like 'ghostswap-prueba-%'")[0]['n']
    print('cleanup, test users left:', left)
print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
