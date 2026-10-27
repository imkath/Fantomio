"""Runs every database test against the local Supabase and fails if any of them fails."""

import pathlib
import subprocess
import sys

here = pathlib.Path(__file__).parent
failed = []
for test in sorted(here.glob('test_*.py')):
    print(f'\n=== {test.name}', flush=True)
    if subprocess.run([sys.executable, test.name], cwd=here).returncode != 0:
        failed.append(test.name)

print('\nFailed:', ', '.join(failed) if failed else 'none')
sys.exit(1 if failed else 0)
