from _env import ANON, SRV, U, R, sql  # noqa: E402
import json, urllib.request, subprocess, uuid, sys


def req(method, url, body=None, token=None, key=ANON):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')




fails, created = [], []


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def user(tag):
    email = f'ghostswap-prueba-{tag}@example.com'
    pw = 'Qa-' + uuid.uuid4().hex[:12]
    s, u = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': 'Prueba ' + tag.upper()}}, key=SRV)
    created.append(u['id'])
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return u['id'], tok


rpc = lambda name, body, tok: req('POST', R + 'rpc/' + name, body, tok)
try:
    ids, T = {}, {}
    for k in 'abcde':
        ids[k], T[k] = user(k)
    # Edition 1: a organizes; b, c, d join; a-b exclusion; draw.
    s, g = req('POST', R + 'groups', {'name': 'QA Navidad 2026', 'admin_id': ids['a'], 'currency': 'CLP', 'budget': 10000}, T['a'])
    G1 = g[0]['id']
    req('POST', R + 'members', {'group_id': G1, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bcd':
        rpc('join_group', {'p_code': g[0]['invite_code']}, T[k])
    req('POST', R + 'exclusions', {'group_id': G1, 'giver_id': ids['a'], 'excluded_receiver_id': ids['b']}, T['a'])
    req('POST', R + 'wishlists', {'group_id': G1, 'user_id': ids['b'], 'items': [{'description': 'libro'}]}, T['b'])
    check('draw edition 1', rpc('draw_group', {'p_group_id': G1}, T['a'])[0] in (200, 204))
    prev_pairs = {(r['giver_id'], r['receiver_id']) for r in sql(f"select giver_id, receiver_id from matches where group_id='{G1}'")}

    # Repeat
    check('non-organizer cannot repeat', rpc('repeat_group', {'p_group_id': G1, 'p_name': 'x', 'p_exchange_date': None, 'p_budget': None}, T['b'])[0] >= 400)
    s, G2 = rpc('repeat_group', {'p_group_id': G1, 'p_name': 'QA Navidad 2027', 'p_exchange_date': '2027-12-20', 'p_budget': 15000}, T['a'])
    check('repeat_group', s == 200 and isinstance(G2, str), f'{s} {G2}')
    st = sql(f"""select (select count(*) from members where group_id='{G2}') members,
      (select count(*) from group_invitations where group_id='{G2}') invites,
      (select count(*) from exclusions where group_id='{G2}') excl,
      (select previous_group_id from groups where id='{G2}') = '{G1}' linked,
      (select count(*) from notifications where group_id='{G2}' and type='invitation') notes""")[0]
    check('new edition: only organizer is member', st['members'] == 1)
    check('3 invitations + notifications', st['invites'] == 3 and st['notes'] == 3, str(st))
    check('exclusions copied and linked', st['excl'] == 1 and st['linked'])
    s, inv = rpc('my_invitations', {}, T['b'])
    check('b sees invitation', s == 200 and len(inv) == 1 and inv[0]['name'] == 'QA Navidad 2027' and inv[0]['organizer'] == 'Prueba A', str(inv)[:150])
    check('e (not invited) sees none', rpc('my_invitations', {}, T['e'])[1] == [])
    check('outsider cannot answer', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': True}, T['e'])[0] >= 400)
    check('b accepts', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': True}, T['b'])[0] in (200, 204))
    check('c accepts', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': True}, T['c'])[0] in (200, 204))
    check('d declines', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': False}, T['d'])[0] in (200, 204))
    check('d cannot answer twice', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': True}, T['d'])[0] >= 400)
    s, pend = rpc('group_pending_invitations', {'p_group_id': G2}, T['a'])
    check('organizer sees d as declined', [p['declined'] for p in pend if p['user_id'] == ids['d']] == [True], str(pend)[:150])
    check('d no longer sees the invitation', rpc('my_invitations', {}, T['d'])[1] == [])
    check('non-organizer cannot reinvite', rpc('reinvite', {'p_group_id': G2, 'p_user': ids['d']}, T['b'])[0] >= 400)
    check('organizer reinvites d', rpc('reinvite', {'p_group_id': G2, 'p_user': ids['d']}, T['a'])[0] in (200, 204))
    check('d sees the invitation again', len(rpc('my_invitations', {}, T['d'])[1]) == 1)
    check('d declines again', rpc('answer_invitation', {'p_group_id': G2, 'p_accept': False}, T['d'])[0] in (200, 204))
    acts = [r['type'] for r in sql(f"select type from activities where group_id='{G2}' order by created_at")]
    check('decline logged', 'INVITATION_DECLINED' in acts, str(acts))
    # b copies last year's list (client reads own previous list)
    s, prev = req('GET', R + f"wishlists?group_id=eq.{G1}&user_id=eq.{ids['b']}&select=items", token=T['b'])
    check('b can read own previous list', s == 200 and prev and prev[0]['items'] == [{'description': 'libro'}])

    # Draw avoiding previous pairs; 3 people (a,b,c) with a-b excluded => only a->c->b->a; check vs previous
    s, r = rpc('draw_group', {'p_group_id': G2, 'p_avoid_previous': True}, T['a'])
    new_pairs = {(r2['giver_id'], r2['receiver_id']) for r2 in sql(f"select giver_id, receiver_id from matches where group_id='{G2}'")}
    if s in (200, 204):
        check('avoid previous: no repeated pair', not (new_pairs & prev_pairs), f'{new_pairs & prev_pairs}')
    else:
        check('avoid previous impossible -> clear message', 'año pasado' in str(r), str(r)[:120])
        check('draw without avoid', rpc('draw_group', {'p_group_id': G2}, T['a'])[0] in (200, 204))

    # History from G2
    s, hist = rpc('group_history', {'p_group_id': G2}, T['b'])
    check('history shows edition 1 for b', s == 200 and len(hist) == 1 and hist[0]['name'] == 'QA Navidad 2026' and len(hist[0]['participants']) == 4, str(hist)[:200])
    b_gave = sql(f"select p.full_name from matches x join profiles p on p.id=x.receiver_id where x.group_id='{G1}' and x.giver_id='{ids['b']}'")[0]['full_name']
    check('history shows only own pair', hist[0]['you_gave_to'] == b_gave.title(), f"{hist[0]['you_gave_to']} vs {b_gave}")
    check('e sees no history', rpc('group_history', {'p_group_id': G2}, T['e'])[1] == [])

    # Reveal: not before the exchange
    check('reveal refused before exchange', rpc('reveal_myself', {'p_group_id': G1}, T['b'])[0] >= 400)
    # Archive edition 1
    check('non-organizer cannot archive', rpc('set_group_archived', {'p_group_id': G1, 'p_archived': True}, T['b'])[0] >= 400)
    check('organizer archives', rpc('set_group_archived', {'p_group_id': G1, 'p_archived': True}, T['a'])[0] in (200, 204))
    check('archived: list edit blocked', req('PATCH', R + f"wishlists?group_id=eq.{G1}&user_id=eq.{ids['b']}", {'items': []}, T['b'])[1] == [])
    check('archived: group edit blocked', req('PATCH', R + f"groups?id=eq.{G1}", {'name': 'x'}, T['a'])[1] == [])
    check('archived: reset blocked', rpc('reset_group_draw', {'p_group_id': G1}, T['a'])[0] >= 400)
    mid = sql(f"select id from matches where group_id='{G1}' and giver_id='{ids['b']}'")[0]['id']
    check('archived: chat closed', req('POST', R + 'anonymous_messages', {'match_id': mid, 'sender_role': 'giver', 'content': 'hola'}, T['b'])[0] >= 400)
    # Reveal now allowed
    receiver = sql(f"select receiver_id from matches where id='{mid}'")[0]['receiver_id']
    rtok = [T[k] for k in ids if ids[k] == receiver][0]
    check('receiver sees nothing before reveal', rpc('my_revealed_giver', {'p_group_id': G1}, rtok)[1] is None)
    check('b reveals', rpc('reveal_myself', {'p_group_id': G1}, T['b'])[0] in (200, 204))
    check('receiver sees b', rpc('my_revealed_giver', {'p_group_id': G1}, rtok)[1] == 'Prueba B')
    check('reveal notification', sql(f"select count(*) n from notifications where group_id='{G1}' and type='reveal' and user_id='{receiver}'")[0]['n'] == 1)
    others = [T[k] for k in 'acd' if ids[k] != receiver and ids[k] != ids['b']]
    check('third party learns nothing', all(rpc('my_revealed_giver', {'p_group_id': G1}, t)[1] is None for t in others))
    # Restore
    check('restore', rpc('set_group_archived', {'p_group_id': G1, 'p_archived': False}, T['a'])[0] in (200, 204))
    st = sql(f"select archived_at is null restored, auto_archive from groups where id='{G1}'")[0]
    check('restored and auto off', st['restored'] and st['auto_archive'] is False, str(st))
    # Hide
    check('hide', rpc('set_group_hidden', {'p_group_id': G1, 'p_hidden': True}, T['c'])[0] in (200, 204))
    check('hidden only for c', sql(f"select count(*) filter (where hidden_at is not null) n from members where group_id='{G1}'")[0]['n'] == 1)
    # Auto-archive job
    sql(f"update groups set exchange_date = current_date - 8, auto_archive = true where id='{G2}'")
    sql("select public.archive_due_groups()")
    check('auto-archive past exchange', sql(f"select archived_at is not null a from groups where id='{G2}'")[0]['a'])
finally:
    sql("delete from groups where name like 'QA %'")
    for uid in created:
        req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)
    print('cleanup, users left:', sql("select count(*) n from auth.users where email like 'ghostswap-prueba-%'")[0]['n'])
print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
