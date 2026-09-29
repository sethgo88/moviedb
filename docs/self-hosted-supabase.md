# Self-Hosted Supabase Setup — MovieDB

MovieDB uses a dedicated self-hosted Supabase stack separate from betaapp. See `/c/web/betaapp/tauri/betaapp/docs/self-hosted-supabase.md` for general prerequisites (Docker, Tailscale).

## Instance details

| Setting | Value |
|---|---|
| Directory | `~/supabase-moviedb/docker/` |
| Tailscale IP | `100.85.209.13` |
| API port | `8100` |
| Postgres port (host) | `5433` |
| Pooler port | `6544` |
| Studio URL | `http://100.85.209.13:8100` |
| Auth email | `seth.oharra@gmail.com` |

App config: `src/lib/supabase.ts` — `SUPABASE_URL` hardcoded to `http://100.85.209.13:8100`. Password in `.env.local` (`VITE_SUPABASE_PASSWORD`).

---

## Setup from scratch

### Step 1 — Clone

```bash
cd ~
git clone --depth 1 https://github.com/supabase/supabase supabase-moviedb
cd supabase-moviedb/docker
cp .env.example .env
```

### Step 2 — Generate secrets (hex only — no base64)

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 16   # DASHBOARD_PASSWORD
```

Generate ANON_KEY and SERVICE_ROLE_KEY using Python (Node.js v24 cannot require jose):

```bash
python3 -c "
import hmac, hashlib, base64, json, time

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def make_jwt(payload, secret):
    h = b64url(json.dumps({'alg':'HS256','typ':'JWT'}, separators=(',',':')))
    p = b64url(json.dumps(payload, separators=(',',':')))
    sig = b64url(hmac.new(secret.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest())
    return f'{h}.{p}.{sig}'

secret = 'YOUR_JWT_SECRET'
now = int(time.time())
print('ANON_KEY=' + make_jwt({'role':'anon','iss':'supabase','iat':now,'exp':2524608000}, secret))
print('SERVICE_ROLE_KEY=' + make_jwt({'role':'service_role','iss':'supabase','iat':now,'exp':2524608000}, secret))
"
```

### Step 3 — Configure `.env`

```env
COMPOSE_PROJECT_NAME=supabase-moviedb
POSTGRES_PASSWORD=<hex>
JWT_SECRET=<hex>
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>
SITE_URL=http://100.85.209.13:8100
API_EXTERNAL_URL=http://100.85.209.13:8100
API_GW_HTTP_PORT=8100
POSTGRES_PORT=5433
POOLER_PROXY_PORT_TRANSACTION=6544
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<hex>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seth.oharra@gmail.com
SMTP_PASS=<gmail-app-password>
SMTP_SENDER_NAME=MovieDB
```

### Step 4 — Rename containers to avoid collision with betaapp

```bash
sed -i 's/container_name: supabase-/container_name: moviedb-/g' docker-compose.yml
sed -i 's/container_name: realtime-dev\.supabase-realtime/container_name: moviedb-realtime/g' docker-compose.yml
sed -i 's/supabase_network/moviedb_network/g' docker-compose.yml
```

### Step 5 — Start

```bash
docker compose up -d
docker compose ps
```

### Step 6 — Fix internal role passwords

The Supabase Postgres image bakes role passwords from `POSTGRES_PASSWORD` at first init. If containers are recreated after a password change, run:

```bash
docker exec moviedb-db psql -U supabase_admin -c "ALTER USER authenticator WITH PASSWORD '<POSTGRES_PASSWORD>';"
docker exec moviedb-db psql -U supabase_admin -c "ALTER USER supabase_auth_admin WITH PASSWORD '<POSTGRES_PASSWORD>';"
docker exec moviedb-db psql -U supabase_admin -c "ALTER USER postgres WITH PASSWORD '<POSTGRES_PASSWORD>';"
```

Then restart the affected services:

```bash
docker compose restart rest auth supavisor
```

### Step 7 — Create schema

```bash
docker exec moviedb-db psql -U supabase_admin -d postgres -c "
CREATE TABLE movies (
    id             uuid PRIMARY KEY,
    tmdb_id        integer,
    title          text NOT NULL,
    year           integer,
    poster_url     text,
    tmdb_rating    float8,
    personal_rating float8,
    status         text NOT NULL,
    format         text NOT NULL,
    is_physical    boolean NOT NULL DEFAULT false,
    is_digital     boolean NOT NULL DEFAULT false,
    is_backed_up   boolean NOT NULL DEFAULT false,
    notes          text,
    deleted_at     timestamptz,
    created_at     timestamptz NOT NULL,
    updated_at     timestamptz NOT NULL,
    type           text NOT NULL DEFAULT 'MOVIE',
    show_id        uuid,
    season_number  integer,
    user_id        uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_movies_tmdb_id ON movies(tmdb_id);
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY \"Users can only access their own movies\" ON movies FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
"
```

### Step 8 — Create auth user

Studio → `http://100.85.209.13:8100` → Authentication → Users → Add user: `seth.oharra@gmail.com`.

### Step 9 — Systemd auto-start

```bash
sudo nano /etc/systemd/system/supabase-moviedb.service
```

```ini
[Unit]
Description=Supabase MovieDB
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/<user>/supabase-moviedb/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=<user>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable supabase-moviedb
sudo systemctl start supabase-moviedb
```

---

## First sync (Android → Supabase)

Because the remote is empty, the sync service pushes all local movies automatically on first sync — no data migration needed. Open the Sync tab in the app and tap Sync Now.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `auth` or `rest` restarting — password auth failed | Run the ALTER USER commands in Step 6 |
| `openssl rand -base64` password breaks services | Regenerate with `openssl rand -hex 24` and wipe volumes (`docker compose down -v`) on fresh instance |
| Container name conflict with betaapp | Run the sed rename commands in Step 4 |
| Port 8000 conflict with betaapp | Set `API_GW_HTTP_PORT=8100` in `.env` |
| Pooler port conflict | Set `POOLER_PROXY_PORT_TRANSACTION=6544` in `.env` |
| Studio "failed to retrieve users" | Run `ALTER USER postgres WITH PASSWORD '...'` — meta service uses postgres user |
| 905 movies fail to sync with timestamp error | See Known Issues below |

---

## Known Issues

### Empty `created_at` / `updated_at` on sync push

Some older SQLite records have empty string `""` for `created_at` or `updated_at`. Postgres rejects these as invalid `timestamptz`. Fixed in `src/features/sync/sync.service.ts` — the push payload falls back to `new Date().toISOString()` for empty strings:

```ts
created_at: row.created_at || new Date().toISOString(),
updated_at: row.updated_at || new Date().toISOString(),
```
