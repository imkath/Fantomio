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
    s,b = res; good = ok(s,b)
    msg = b.get('message') if isinstance(b,dict) else (f'{len(b)} rows' if isinstance(b,list) else b)
    print(('PASS ' if good else 'FAIL ')+f'{label}: {s} {msg}')
    if not good: fails.append(label)
rows = lambda n: (lambda s,b: s<300 and isinstance(b,list) and len(b)==n)
denied = lambda s,b: s>=400
okay = lambda s,b: s<300
pw='Qa-'+secrets.token_hex(8); ids={}; T={}
for k in 'abcd':
    e=f'fantomio-prueba-{k}@example.com'
    ids[k]=req('POST', U+'/auth/v1/admin/users', {'email':e,'password':pw,'email_confirm':True,'user_metadata':{'full_name':'Prueba '+k.upper()}}, key=SRV)[1]['id']
    T[k]=req('POST', U+'/auth/v1/token?grant_type=password', {'email':e,'password':pw})[1]['access_token']
json.dump(ids, open('ids6.json','w'))
s,g=req('POST', R+'groups', {'name':'QA auditoria','admin_id':ids['a'],'currency':'CLP'}, T['a']); G=g[0]['id']; code=g[0]['invite_code']
ids['G']=G; json.dump(ids, open('ids6.json','w'))
check('a adds self as organizer', req('POST', R+'members', {'group_id':G,'user_id':ids['a'],'is_admin':True}, T['a']), rows(1))
check('a logs GROUP_CREATED', req('POST', R+'activities', {'group_id':G,'user_id':ids['a'],'type':'GROUP_CREATED','message':'creó'}, T['a']), rows(1))
check('b direct insert into members', req('POST', R+'members', {'group_id':G,'user_id':ids['b'],'is_admin':False}, T['b']), denied)
check('b joins with wrong code', req('POST', R+'rpc/join_group', {'p_code':'000000000000'}, T['b']), denied)
check('b joins with code', req('POST', R+'rpc/join_group', {'p_code':code}, T['b']), lambda s,b: s==200 and b==G)
check('b joins again (idempotent)', req('POST', R+'rpc/join_group', {'p_code':code.upper()}, T['b']), lambda s,b: s==200 and b==G)
check('c joins with code', req('POST', R+'rpc/join_group', {'p_code':code}, T['c']), okay)
check('d joins with code', req('POST', R+'rpc/join_group', {'p_code':code}, T['d']), okay)
check('b fakes activity as a', req('POST', R+'activities', {'group_id':G,'user_id':ids['a'],'type':'GROUP_UPDATED','message':'x'}, T['b']), denied)
check('b fakes DRAW_RESET type', req('POST', R+'activities', {'group_id':G,'user_id':ids['b'],'type':'DRAW_RESET','message':'x'}, T['b']), denied)
check('b changes own email', req('PATCH', R+f"profiles?id=eq.{ids['b']}", {'email':'a@x.com'}, T['b']), denied)
check('b changes own name', req('PATCH', R+f"profiles?id=eq.{ids['b']}", {'full_name':'Prueba B2'}, T['b']), rows(1))
check('b sets http avatar', req('PATCH', R+f"profiles?id=eq.{ids['b']}", {'avatar_url':'http://x.com/a.png'}, T['b']), denied)
check('d leaves', req('DELETE', R+f"members?group_id=eq.{G}&user_id=eq.{ids['d']}", token=T['d']), rows(1))
check('anon reads profiles', req('GET', R+'profiles?select=id'), denied)
check('anon invite preview', req('POST', R+'rpc/get_group_by_invite_code', {'p_code':code} if False else {'code':code}), rows(1))
for i in range(4):
    check(f'draw #{i+1}', req('POST', R+'rpc/draw_group', {'p_group_id':G}, T['a']), okay)
    r = req('POST', R+'rpc/reset_group_draw', {'p_group_id':G}, T['a'])
    check(f'reset #{i+1}', r, okay if i<3 else denied)
n=sql(f"select count(*) c from notifications where group_id='{G}' and type='draw'")[0]['c']
print('     draw notifications:', n, '(in-app, 4 rounds x 3)')
acts=sql(f"select type from activities where group_id='{G}' order by created_at")
print('     activities:', [a['type'] for a in acts])
if not any(a['type']=='USER_JOINED' for a in acts) or not any(a['type']=='MEMBER_LEFT' for a in acts): fails.append('activity log')
check('a deletes group', req('DELETE', R+f'groups?id=eq.{G}', token=T['a']), rows(1))
print('     leftovers:', sql(f"select (select count(*) from members where group_id='{G}') m, (select count(*) from activities where group_id='{G}') a")[0])
print('FAILS:', fails or 'none')
for k in 'abcd':
    req('DELETE', f"{U}/auth/v1/admin/users/{ids[k]}", key=SRV)
import sys
sys.exit(1 if fails else 0)
