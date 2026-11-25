# Advanced calls

### Python fallback for approved-command contexts

When a shell command requires `request_smart_mode_approval: true`, use Python to invoke the same helper with absolute paths. On Windows the interpreter is `py`, and `python3` is often the Microsoft Store stub.

```python
import subprocess

HELPER = r'{CURSOR}/skills/api-auth/scripts/api.mjs'

def api_request(*args, actor='default'):
    output = subprocess.check_output(['node', HELPER, 'call', *args, '--as', actor], encoding='utf-8')
    body, http_code = output.rsplit('\n', 1)
    return http_code, body

http_code, body = api_request('GET', '/api/widgets', actor='admin')
print(http_code, body[:200])

http_code, body = api_request(
    'POST', '/api/widgets/import',
    '--form', 'tenantId=8',
    '--form', 'file=@/absolute/path/input.xlsx;filename=input.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    actor='admin',
)
```

All positional arguments are forwarded unchanged, including repeated `--form` pairs. Add `'--base-url', url` when the credentials file has no `API_BASE_URL`.

### Two actors at once

Each `--as` name has its own cookie jar and token, so two sessions run side by side without collision:

```bash
node {CURSOR}/skills/api-auth/scripts/api.mjs login /api/auth/login '{"email":"${ADMIN_EMAIL}","password":"${ADMIN_PASSWORD}"}' --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs login /api/auth/login '{"email":"${STANDARD_EMAIL}","password":"${STANDARD_PASSWORD}"}' --as standard

node {CURSOR}/skills/api-auth/scripts/api.mjs call POST /api/widgets '{"name":"test"}' --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs call POST /api/widgets '{"name":"test"}' --as standard
```

In the Python template, pass `actor='standard'`.

### Request bodies on Windows PowerShell 5.1

Windows PowerShell 5.1 can mangle double quotes inside native-command arguments, and its default ASCII pipeline encoding replaces non-ASCII characters with `?`. Pipe JSON bodies and login templates on stdin with UTF-8 encoding there, restoring the previous encoding afterwards. Keep the single quotes: in double quotes PowerShell would expand `${ADMIN_EMAIL}` itself.

```powershell
$previousOutputEncoding = $OutputEncoding
try {
  $OutputEncoding = New-Object System.Text.UTF8Encoding $false
  '{"email":"${ADMIN_EMAIL}","password":"${ADMIN_PASSWORD}"}' | node "{CURSOR}/skills/api-auth/scripts/api.mjs" login /api/auth/login - --as admin
  '{"name":"José 東京"}' | node "{CURSOR}/skills/api-auth/scripts/api.mjs" call POST /api/widgets - --as admin
} finally {
  $OutputEncoding = $previousOutputEncoding
}
```

The positional form is fine on macOS, Linux and PowerShell 7.3+.
