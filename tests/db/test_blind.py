from _env import ANON, SRV, U, R, sql  # noqa: E402
import json, urllib.request, subprocess, uuid, sys, time


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


NAMES = {'a': 'Ana Pérez', 'b': 'María José Soto', 'c': 'Carmen Ñúñez', 'd': 'Diego Rojas'}


def user(k):
    email = f'ghostswap-prueba-blind{k}@example.com'
    pw = 'Qa-' + uuid.uuid4().hex[:12]
    s, u = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True, 'user_metadata': {'full_name': NAMES[k]}}, key=SRV)
    created.append(u['id'])
    return u['id'], req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']


rpc = lambda n, b, t: req('POST', R + 'rpc/' + n, b, t)
try:
    ids, T = {}, {}
    for k in 'abcd':
        ids[k], T[k] = user(k)
    name_of = {ids[k]: NAMES[k] for k in ids}
    # Classic control group: must behave exactly as before
    s, gc = req('POST', R + 'groups', {'name': 'QA clasico', 'admin_id': ids['a'], 'currency': 'CLP'}, T['a'])
    GC = gc[0]['id']
    req('POST', R + 'members', {'group_id': GC, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bcd':
        rpc('join_group', {'p_code': gc[0]['invite_code']}, T[k])
    rpc('draw_group', {'p_group_id': GC}, T['a'])
    s, m = req('GET', R + f"matches?group_id=eq.{GC}&select=receiver_id", token=T['b'])
    check('classic: giver sees own match', s == 200 and len(m) == 1)
    check('classic: per-person checkmarks', all(r['has_items'] is not None for r in rpc('wishlist_status', {'p_group_id': GC}, T['b'])[1]))

    # Blind group
    s, gb = req('POST', R + 'groups', {'name': 'QA ciegas', 'admin_id': ids['a'], 'currency': 'CLP', 'mode': 'blind'}, T['a'])
    G = gb[0]['id']
    check('A1 create blind group', s == 201 and gb[0]['mode'] == 'blind')
    req('POST', R + 'members', {'group_id': G, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bcd':
        rpc('join_group', {'p_code': gb[0]['invite_code']}, T[k])
    for k in 'abc':
        req('POST', R + 'wishlists', {'group_id': G, 'user_id': ids[k], 'items': [{'description': 'regalo de ' + k}]}, T[k])
    check('A2 reveal not settable by hand', req('PATCH', R + f'groups?id=eq.{G}', {'revealed_at': '2026-01-01T00:00:00Z'}, T['a'])[0] >= 400)
    check('B3 count before draw', rpc('wishlist_count', {'p_group_id': G}, T['b'])[1] == {'with_list': 3, 'total': 4})
    s, r = rpc('draw_group', {'p_group_id': G}, T['a'])
    check('LISTS draw blocked while someone has no list', s >= 400 and 'Diego' in str(r), str(r)[:140])
    check('LISTS organizer sees who is missing', rpc('blind_missing_lists', {'p_group_id': G}, T['a'])[1] == ['Diego Rojas'])
    req('POST', R + 'wishlists', {'group_id': G, 'user_id': ids['d'], 'items': [{'description': 'regalo de d'}]}, T['d'])
    check('draw blind', rpc('draw_group', {'p_group_id': G}, T['a'])[0] in (200, 204))
    check('LISTS cannot empty own list after draw', req('PATCH', R + f"wishlists?group_id=eq.{G}&user_id=eq.{ids['c']}", {'items': []}, T['c'])[0] >= 400)
    check('LISTS cannot delete own list after draw', req('DELETE', R + f"wishlists?group_id=eq.{G}&user_id=eq.{ids['c']}", None, T['c'])[0] >= 400)
    check('LISTS can still change it', req('PATCH', R + f"wishlists?group_id=eq.{G}&user_id=eq.{ids['c']}", {'items': [{'description': 'cambio'}]}, T['c'])[0] == 200)
    check('LISTS missing list empty after draw', rpc('blind_missing_lists', {'p_group_id': G}, T['a'])[1] == [])
    check('A2 mode locked after draw', req('PATCH', R + f'groups?id=eq.{G}', {'mode': 'classic'}, T['a'])[0] >= 400)
    real = {r['giver_id']: r['receiver_id'] for r in sql(f"select giver_id, receiver_id from matches where group_id='{G}'")}
    b_receiver = real[ids['b']]

    # The curious giver: b tries every path
    s, m = req('GET', R + f"matches?group_id=eq.{G}&select=*", token=T['b'])
    check('A3 matches hidden', s == 200 and m == [], str(m)[:80])
    s, w = req('GET', R + f"wishlists?group_id=eq.{G}&select=user_id,items", token=T['b'])
    check('A4 only own wishlist row', s == 200 and [r['user_id'] for r in w] == [ids['b']], str(w)[:120])
    probes = [rpc('gives_to', {'p_group': G, 'p_user': ids[k]}, T['b'])[1] for k in 'acd']
    check('A4 gives_to says no to everyone', probes == [False, False, False], str(probes))
    s, asg = rpc('my_blind_assignment', {'p_group_id': G}, T['b'])
    check('A5 assignment: list + match id, no identity', s == 200 and set(asg) == {'match_id', 'items'} and b_receiver not in json.dumps(asg), str(asg)[:120])
    ws = rpc('wishlist_status', {'p_group_id': G}, T['b'])[1]
    check('A8 checkmarks: only own', [r for r in ws if r['has_items'] is not None] == [{'user_id': ids['b'], 'has_items': True}], str(ws)[:160])
    s, exp = rpc('export_my_data', {}, T['b'])
    check('A7 export hides the pair', not any(x['grupo'] == 'QA ciegas' for x in exp['a_quien_le_regalas']))
    check('A3 voluntary reveal blocked', rpc('reveal_myself', {'p_group_id': G}, T['b'])[0] >= 400)
    check('A13 results closed before reveal', rpc('blind_results', {'p_group_id': G}, T['b'])[1] is None)

    # A9 + A10 chat both ways, with censorship of every member name
    mid = asg['match_id']
    s, msg = req('POST', R + 'anonymous_messages', {'match_id': mid, 'sender_role': 'giver', 'content': '¿Eres maria jose? o CARMEN o carmen ñuñez, o ana? soy Diego. Rosado ok'}, T['b'])
    check('A9 giver can send', s == 201, str(msg)[:100])
    stored = sql(f"select content from anonymous_messages where match_id='{mid}' order by created_at desc limit 1")[0]['content']
    check('A10 names masked, other words kept', all(x not in stored.lower() for x in ['maria', 'jose', 'carmen', 'ñuñez', 'ana', 'diego']) and 'Rosado' in stored, stored)
    rk = [k for k in ids if ids[k] == b_receiver][0]
    s, rmid = rpc('get_receiver_match_id', {'p_group_id': G}, T[rk])
    s, r2 = req('POST', R + 'anonymous_messages', {'match_id': mid, 'sender_role': 'receiver', 'content': f'Hola, soy {NAMES[rk].split()[0]}'}, T[rk])
    check('A9 receiver can reply', s == 201)
    stored2 = sql(f"select content from anonymous_messages where match_id='{mid}' order by created_at desc limit 1")[0]['content']
    check('A10 receiver name masked', NAMES[rk].split()[0].lower() not in stored2.lower(), stored2)
    s, mine = req('GET', R + f"anonymous_messages?match_id=eq.{mid}&select=content", token=T['b'])
    check('A9 giver reads the thread', s == 200 and len(mine) == 2)
    time.sleep(1)
    notes = sql(f"select body from notifications where group_id='{G}' and user_id='{ids['b']}' and type='reply'")
    check('A6 reply notice has no name', notes and NAMES[rk].split()[0] not in notes[0]['body'], str(notes))
    req('PATCH', R + f"wishlists?group_id=eq.{G}&user_id=eq.{b_receiver}", {'items': [{'description': 'otra cosa'}]}, T[rk])
    time.sleep(1)
    wn = sql(f"select body from notifications where group_id='{G}' and user_id='{ids['b']}' and type='wishlist'")
    check('A6 wishlist notice has no name', wn and NAMES[rk].split()[0] not in wn[0]['body'], str(wn))

    # A11 guesses
    check('A11 cannot guess self', rpc('place_guess', {'p_group_id': G, 'p_guessed': ids['b']}, T['b'])[0] >= 400)
    wrong = [ids[k] for k in 'acd' if ids[k] != b_receiver][0]
    check('A11 guess', rpc('place_guess', {'p_group_id': G, 'p_guessed': wrong}, T['b'])[0] in (200, 204))
    check('A11 change guess', rpc('place_guess', {'p_group_id': G, 'p_guessed': b_receiver}, T['b'])[0] in (200, 204))
    check('A11 my_guess', rpc('my_guess', {'p_group_id': G}, T['b'])[1] == b_receiver)
    check('A11 table closed', req('GET', R + f"blind_guesses?group_id=eq.{G}", token=T['c'])[0] >= 400)
    for k in 'cd':
        other = [ids[x] for x in 'abcd' if x != k][0]
        rpc('place_guess', {'p_group_id': G, 'p_guessed': other}, T[k])

    # A12 reveal
    check('A12 non-organizer cannot reveal', rpc('reveal_blind', {'p_group_id': G}, T['b'])[0] >= 400)
    check('A12 organizer reveals', rpc('reveal_blind', {'p_group_id': G}, T['a'])[0] in (200, 204))
    s, m = req('GET', R + f"matches?group_id=eq.{G}&select=receiver_id", token=T['b'])
    check('A12 after reveal: giver sees match', m == [{'receiver_id': b_receiver}])
    check('A12 unveil notices', sql(f"select count(*) n from notifications where group_id='{G}' and type='unveil'")[0]['n'] == 4)
    check('A12 guessing closed', rpc('place_guess', {'p_group_id': G, 'p_guessed': wrong}, T['b'])[0] >= 400)
    s, res = rpc('blind_results', {'p_group_id': G}, T['b'])
    check('A13 results', res and res['correct'] is True and res['guess_count'] == 3 and res['total'] == 4, str(res))
    s, msg = req('POST', R + 'anonymous_messages', {'match_id': mid, 'sender_role': 'giver', 'content': 'ya sé que eres ' + NAMES[rk].split()[0]}, T['b'])
    after = sql(f"select content from anonymous_messages where match_id='{mid}' order by created_at desc limit 1")[0]['content']
    check('A10 no censorship after reveal', NAMES[rk].split()[0] in after, after)

    # A12 scheduled reveal + A15 reset clears + A14 archive reveals
    check('A15 reset', rpc('reset_group_draw', {'p_group_id': G}, T['a'])[0] in (200, 204))
    st = sql(f"select revealed_at is null r, (select count(*) from blind_guesses where group_id='{G}') g from groups where id='{G}'")[0]
    check('A15 reset clears reveal and guesses', st['r'] and st['g'] == 0, str(st))
    check('A15 redraw', rpc('draw_group', {'p_group_id': G}, T['a'])[0] in (200, 204))
    req('PATCH', R + f'groups?id=eq.{G}', {'reveal_at': '2020-01-01T00:00:00Z'}, T['a'])
    sql('select public.process_scheduled_reveals()')
    check('A12 scheduled reveal fires', sql(f"select revealed_at is not null r from groups where id='{G}'")[0]['r'])
    s, gb2 = req('POST', R + 'groups', {'name': 'QA ciegas 2', 'admin_id': ids['a'], 'currency': 'CLP', 'mode': 'blind'}, T['a'])
    G2 = gb2[0]['id']
    req('POST', R + 'members', {'group_id': G2, 'user_id': ids['a'], 'is_admin': True}, T['a'])
    for k in 'bc':
        rpc('join_group', {'p_code': gb2[0]['invite_code']}, T[k])
    for k in 'abc':
        req('POST', R + 'wishlists', {'group_id': G2, 'user_id': ids[k], 'items': [{'description': 'x'}]}, T[k])
    check('A14 draw second group', rpc('draw_group', {'p_group_id': G2}, T['a'])[0] in (200, 204))
    rpc('set_group_archived', {'p_group_id': G2, 'p_archived': True}, T['a'])
    check('A14 archiving reveals', sql(f"select revealed_at is not null r from groups where id='{G2}'")[0]['r'])
    s, rep = rpc('repeat_group', {'p_group_id': G, 'p_name': 'QA ciegas 2027', 'p_exchange_date': None, 'p_budget': None}, T['a'])
    check('A15 repeat keeps the mode', sql(f"select mode from groups where id='{rep}'")[0]['mode'] == 'blind')
    rpc('reset_group_draw', {'p_group_id': G}, T['a'])
    rpc('draw_group', {'p_group_id': G}, T['a'])
    check('LISTS deleting a drawn hidden blind group works', req('DELETE', R + f'groups?id=eq.{G}', None, T['a'])[0] == 200)
finally:
    sql("delete from groups where name like 'QA %'")
    for uid in created:
        req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)
    print('cleanup, users left:', sql("select count(*) n from auth.users where email like 'ghostswap-prueba-%'")[0]['n'])
print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
