# Credential setup

Check only the keys the planned or current checks need: `API_BASE_URL` for any call, `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the admin actor, `STANDARD_EMAIL`/`STANDARD_PASSWORD` for the standard actor, and any other key a login template references. The helper, like `node --env-file`, takes each value from the environment first, then `~/.agent-tooling/credentials`. A missing or empty value, or one still starting with `replace-with-`, needs setup; the helper treats a `replace-with-` value as unset and stops with an error naming the key.

Never print values while checking. Some lines use `KEY = "value"` with spaces, so a filter written for `KEY=value` can leak them. This reports only set, placeholder or missing per key, with the same precedence as the helper; when the file does not exist, node stops with `not found`, which also means setup is needed:

```bash
node --env-file="$HOME/.agent-tooling/credentials" -p "['API_BASE_URL','ADMIN_EMAIL','ADMIN_PASSWORD'].map(k => k + ': ' + (process.env[k] ? (process.env[k].startsWith('replace-with-') ? 'placeholder' : 'set') : 'missing')).join('\n')"
```

When effective credentials need setup and the file is absent, create it from the bundled template without another permission question within an authorized writable planning task. Explicit read-only planning prohibits creation; report the setup needed instead. The file is user-owned, outside the installed plugin, and must never enter source control or plan snapshots.

On macOS/Linux, create new directories and files with owner-only access and never overwrite an existing file:

```bash
(
  umask 077
  mkdir -p ~/.agent-tooling
  if [ ! -e ~/.agent-tooling/credentials ] && [ ! -L ~/.agent-tooling/credentials ]; then
    cp -n "{CURSOR}/skills/api-auth/scripts/credentials.example" ~/.agent-tooling/credentials
  fi
)
```

On Windows, the destination inherits the user's profile permissions. The copy refuses to overwrite even if another process creates the file after the existence check:

```powershell
New-Item -ItemType Directory -Force "$HOME/.agent-tooling" | Out-Null
if (-not (Test-Path -LiteralPath "$HOME/.agent-tooling/credentials")) {
  [System.IO.File]::Copy("{CURSOR}/skills/api-auth/scripts/credentials.example", "$HOME/.agent-tooling/credentials", $false)
}
```

Preserve existing file contents and working pairs. Prompt the user to edit the required fields at `~/.agent-tooling/credentials` and confirm when saved; do not ask them to paste credentials into chat or invent login values. The base URL is not secret: when the file lacks it, pass the URL found in Step 1 of [SKILL.md](SKILL.md) with `--base-url`. Continue independent planning while awaiting the edit. If the effective credentials are already usable, no template creation or user edit is needed.

Validate the required role with `login` (Step 2 in [SKILL.md](SKILL.md)) when the local API is available. Inspect the response for the endpoint's success payload: the helper's zero exit alone does not distinguish a 200 that carries a password-expired or first-login response. Prompt for user correction after rejected credentials or account-setup responses. Status 000, 502 and 504 mean runtime validation is pending, not that credentials are invalid; use the bounded login recovery for them. Log each role in under its own `--as` actor so one login does not replace another role's session.

Record only the role, the preparation and validation outcome and any outstanding prerequisite in planning artifacts, never credential values or cookies. Missing or placeholder values remain a prerequisite for the user. If the API is unavailable during planning, record validation as pending and put a mandatory Build-entry preflight before implementation dispatch in the plan. Do not claim verification readiness while required setup or validation is unresolved.
