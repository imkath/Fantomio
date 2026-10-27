"""Connection to the throwaway Supabase the database tests run against.

CI starts it with `supabase start` (see .github/workflows/deploy.yml) and exports its URLs and
keys. These tests create users, groups and draws freely, so they must never point at
production: the guard below refuses any URL that isn't local.
"""

import json
import os
import subprocess
import sys

U = os.environ.get('API_URL', 'http://127.0.0.1:54321').rstrip('/')
ANON = os.environ['ANON_KEY']
SRV = os.environ['SERVICE_ROLE_KEY']
DB_URL = os.environ.get('DB_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
R = U + '/rest/v1/'

if not (U.startswith('http://127.0.0.1') or U.startswith('http://localhost')):
    sys.exit(f'Refusing to run database tests against {U}: they only run on a local Supabase.')


def sql(query):
    """Runs SQL on the local database. SELECT/WITH queries return rows as dicts."""
    q = query.strip().rstrip(';')
    if q.lower().startswith(('select', 'with')) and ';' not in q:
        wrapped = f"select coalesce(json_agg(t), '[]'::json) from ({q}) t"
        out = subprocess.check_output(['psql', DB_URL, '-At', '-v', 'ON_ERROR_STOP=1', '-c', wrapped])
        return json.loads(out.decode() or '[]')
    subprocess.check_output(['psql', DB_URL, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query])
    return []
