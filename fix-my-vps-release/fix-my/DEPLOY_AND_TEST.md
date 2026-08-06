# FIX MY — Deploy and test guide

This package is prepared for Ubuntu 22.04/24.04 with Docker Engine and Docker Compose v2. It contains the client app, Pro Fixer app, Admin, API, Prisma migrations, Redis, PostgreSQL/PostGIS, demo seed data, and durable business/technical logs.

## Demo credentials

These are for testing only. Change all passwords and secrets before exposing the VPS publicly.

| Role | URL | Email | Password |
| --- | --- | --- | --- |
| Admin | `http://YOUR_HOST:3001` | `admin@fixmy.demo` | `Admin123!` |
| Client | `http://YOUR_HOST:3000` | `client@fixmy.demo` | `Client123!` |
| Pro Fixer | `http://YOUR_HOST:3002` | `pro@fixmy.demo` | `Pro123!` |

A compatibility local admin account is also seeded: `admin@fixmy.local` / `Admin123!`.

## 1. Install prerequisites on Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl git unzip openssl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# Sign out and in once if Docker commands require sudo.
docker --version
docker compose version
```

## 2. Upload and configure

Upload the ZIP to the VPS, then:

```bash
unzip fix-my-vps-release.zip
cd fix-my
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
nano .env
```

Set at minimum: `POSTGRES_PASSWORD`, `JWT_SECRET`, `INTEGRATION_MASTER_KEY`, and `CORS_ORIGINS`. For a first private smoke test, the localhost defaults are acceptable except the required secrets. Never commit `.env` or send it back with the source bundle.

## 3. Start the stack

```bash
docker compose up -d --build
# The migration container runs automatically before API/web services.
docker compose ps
docker compose logs --tail=200 api web-client web-admin web-pro
```

The services are exposed as:

- Client: `http://YOUR_HOST:3000`
- Admin: `http://YOUR_HOST:3001`
- Pro: `http://YOUR_HOST:3002`
- API health: `http://YOUR_HOST:4000/health`
- Swagger: `http://YOUR_HOST:4000/docs`

For production, put Nginx, Caddy, or Traefik in front of these services with TLS. Keep PostgreSQL port 5432 and Redis port 6379 private; remove their host port mappings if your reverse proxy and administration workflow do not need them.

## 4. Seed / reset demo data

Demo data is idempotent and safe to run repeatedly. Run it explicitly after the first migration if you want the demo accounts and sample request:

```bash
docker compose run --rm migrate pnpm --filter @fixmy/database seed
```

The seed creates multilingual service categories, an approved/online Pro, a Client, an Admin, a paid in-progress demo request, job history, a mock payment provider, business activity, and an example system log.

## 5. Test the full marketplace flow

From the release root, with the API reachable:

```bash
API_URL=http://127.0.0.1:4000/api node tests/marketplace-flow.mjs
```

Expected output contains `"ok": true`, a paid publication gate, and final `COMPLETED` job/payment states. On Windows PowerShell use:

```powershell
$env:API_URL="http://127.0.0.1:4000/api"; C:\Program Files\nodejs\node.exe tests/marketplace-flow.mjs
```

## 6. Admin logs

Open Admin and choose **Actividad** for business events or **Logs técnicos** for API/system logs. Logs include level, source, message, route, HTTP status, request ID, actor ID when known, stack for server errors, metadata, and timestamp. Passwords, JWTs, payment secrets, and full credentials are intentionally excluded.

Use the request ID from a client error toast or API response header (`x-request-id`) to find the corresponding technical record.

## 7. Operations

```bash
docker compose restart api
docker compose logs -f --tail=200 api
docker compose exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose down
# Add -v only when you intentionally want to destroy database/Redis volumes.
```

Back up the Postgres volume/database before upgrades. Keep a firewall enabled and expose only 80/443 (and temporary SSH). Rotate demo credentials, JWT secret, database password, and integration key before production.

## Release contents

The ZIP excludes `node_modules`, `.next`, build `dist` folders, local caches, `.env`, secrets, and `.workbuddy-ai` project data. The release hash is provided beside the ZIP as `SHA256SUMS.txt`.
