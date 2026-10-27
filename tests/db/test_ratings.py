"""App ratings: one per account, 1 to 5, only the count and average are public, and the
rating leaves with the account."""

import json
import sys
import urllib.request
import uuid

from _env import ANON, SRV, U, R, sql

fails = []


def req(method, url, body=None, token=None, key=ANON):
    h = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json'}
    r = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')


def check(label, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(label)


def user():
    email, pw = f'fantomio-prueba-rate-{uuid.uuid4().hex[:6]}@example.com', 'Qa-' + uuid.uuid4().hex[:12]
    uid = req('POST', U + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, key=SRV)[1]['id']
    tok = req('POST', U + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw})[1]['access_token']
    return uid, tok


a, ta = user()
b, tb = user()
check('no rating yet', req('POST', R + 'rpc/my_app_rating', {}, ta)[1] is None)
check('visitor cannot rate', req('POST', R + 'rpc/rate_app', {'p_stars': 5})[0] >= 400)
check('out of range rejected', req('POST', R + 'rpc/rate_app', {'p_stars': 6}, ta)[0] >= 400)
check('a rates 5', req('POST', R + 'rpc/rate_app', {'p_stars': 5}, ta)[0] in (200, 204))
check('a changes to 4, still one row', req('POST', R + 'rpc/rate_app', {'p_stars': 4}, ta)[0] in (200, 204)
      and sql(f"select count(*) n from app_ratings where user_id = '{a}'")[0]['n'] == 1)
check('b rates 2', req('POST', R + 'rpc/rate_app', {'p_stars': 2}, tb)[0] in (200, 204))
check('own rating readable', req('POST', R + 'rpc/my_app_rating', {}, ta)[1] == 4)
s, summary = req('POST', R + 'rpc/app_rating_summary', {})
total = sql('select count(*) n, round(avg(stars)::numeric, 1) a from app_ratings')[0]
check('visitor reads only the summary', s == 200 and summary['count'] == total['n'], str(summary))
check('table closed to the API', req('GET', R + 'app_ratings?select=*', token=ta)[0] >= 400)
check('export includes the rating', req('POST', R + 'rpc/export_my_data', {}, ta)[1]['valoracion']['estrellas'] == 4)
for uid in (a, b):
    req('DELETE', U + f'/auth/v1/admin/users/{uid}', key=SRV)
check('ratings leave with the account', sql(f"select count(*) n from app_ratings where user_id in ('{a}', '{b}')")[0]['n'] == 0)

print('FAILS:', fails or 'none')
sys.exit(1 if fails else 0)
