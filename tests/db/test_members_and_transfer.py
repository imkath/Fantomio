from _env import ANON, SRV, U, R, sql  # noqa: E402
import json, urllib.request, secrets, subprocess
def req(method, url, body=None, token=None, key=ANON):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or 'null')
fails=[]
def check(label, res, ok):
    s,b = res
    good = ok(s,b)
    msg = b.get('message') if isinstance(b,dict) else (f'{len(b)} rows' if isinstance(b,list) else b)
    print(('PASS ' if good else 'FAIL ')+f'{label}: {s} {msg}')
    if not good: fails.append(label)
rows = lambda n: (lambda s,b: s<300 and isinstance(b,list) and len(b)==n)
denied = lambda s,b: s>=400
okay = lambda s,b: s<300
pw='Qa-'+secrets.token_hex(8); ids={}; T={}
for k in 'abcd':
    e=f'ghostswap-prueba-{k}@example.com'
    ids[k]=req('POST', U+'/auth/v1/admin/users', {'email':e,'password':pw,'email_confirm':True,'user_metadata':{'full_name':'Prueba '+k.upper()}}, key=SRV)[1]['id']
    T[k]=req('POST', U+'/auth/v1/token?grant_type=password', {'email':e,'password':pw})[1]['access_token']
G=req('POST', R+'groups', {'name':'QA traspaso','admin_id':ids['a'],'currency':'CLP'}, T['a'])[1][0]['id']
json.dump({**ids,'G':G}, open('ids5.json','w'))
m=lambda k,adm=False: {'group_id':G,'user_id':ids[k],'is_admin':adm}
check('a joins own group as admin', req('POST', R+'members', m('a',True), T['a']), rows(1))
check('b joins claiming is_admin', req('POST', R+'members', m('b',True), T['b']), denied)
check('b joins normally', req('POST', R+'members', m('b'), T['b']), rows(1))
check('c joins', req('POST', R+'members', m('c'), T['c']), rows(1))
tr=lambda tok,new: req('POST', R+'rpc/transfer_group', {'p_group_id':G,'p_new_admin':new}, tok)
check('b (not organizer) transfers to self', tr(T['b'], ids['b']), denied)
check('a transfers to d (not a member)', tr(T['a'], ids['d']), denied)
check('a transfers to self', tr(T['a'], ids['a']), denied)
check('a leaves while organizing', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['a']}", token=T['a']), rows(0))
check('a transfers to b', tr(T['a'], ids['b']), okay)
st=sql(f"select (select admin_id from groups where id='{G}') admin, (select json_agg(json_build_object('u',user_id,'adm',is_admin)) from members where group_id='{G}') m, (select message from activities where group_id='{G}' and type='ADMIN_TRANSFERRED') act")[0]
print('     state:', 'admin=b' if st['admin']==ids['b'] else 'admin WRONG', {('a' if x['u']==ids['a'] else 'b' if x['u']==ids['b'] else 'c'):x['adm'] for x in st['m']}, '|', st['act'])
if st['admin']!=ids['b'] or not st['act']: fails.append('state after transfer')
check('a (old organizer) edits group', req('PATCH', R+f'groups?id=eq.{G}', {'name':'x'}, T['a']), rows(0))
check('b (new organizer) edits group', req('PATCH', R+f'groups?id=eq.{G}', {'name':'QA traspaso 2'}, T['b']), rows(1))
check('b (organizer) leaves', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['b']}", token=T['b']), rows(0))
check('b removes c', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['c']}", token=T['b']), rows(1))
check('c rejoins', req('POST', R+'members', m('c'), T['c']), rows(1))
check('d joins', req('POST', R+'members', m('d'), T['d']), rows(1))
check('d leaves before draw', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['d']}", token=T['d']), rows(1))
check('c removes a (not organizer)', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['a']}", token=T['c']), rows(0))
check('b draws', req('POST', R+'rpc/draw_group', {'p_group_id':G}, T['b']), okay)
check('a leaves after draw', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['a']}", token=T['a']), rows(0))
check('b removes c after draw', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['c']}", token=T['b']), rows(0))
check('b transfers to c after draw', tr(T['b'], ids['c']), okay)
check('c resets draw (new organizer)', req('POST', R+'rpc/reset_group_draw', {'p_group_id':G}, T['c']), okay)
check('c draws again', req('POST', R+'rpc/draw_group', {'p_group_id':G}, T['c']), okay)
check('c deletes drawn group', req('DELETE', R+f'groups?id=eq.{G}', token=T['c']), rows(1))
left=sql(f"select (select count(*) from members where group_id='{G}') m, (select count(*) from matches where group_id='{G}') x, (select count(*) from activities where group_id='{G}') a")[0]
print('     after delete:', left)
if any(left.values()): fails.append('cascade')
print('FAILS:', fails or 'none')
import sys  # noqa: E402
sys.exit(1 if fails else 0)
