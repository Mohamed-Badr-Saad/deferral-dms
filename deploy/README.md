# Local IT Server Deployment

This setup runs one Next.js application, PostgreSQL 16, an Nginx gateway and a
scheduler in Linux containers. A one-off migration container initializes both the
business schema and Better Auth tables before the application starts.

Docker Compose suits a single server if IT supports Docker. If IT already manages
a PostgreSQL service with backups and monitoring, using that service instead of
the database container is also a good option. This setup is not a high-availability
cluster: an outage of the host affects all services.

## Server Requirements

- Linux server/VM with Docker Engine and Docker Compose v2. Windows Server should
  use an IT-managed Linux VM for these Linux containers.
- A practical starting allocation is 2 CPU cores and 4 GB RAM, with extra memory
  for image builds and disk capacity sized for attachments and backups. Measure
  actual usage before deciding production capacity.
- Internet access during image builds/pulls. Runtime needs no Neon or Blob access
  for a fresh local installation. For an offline server, build and transfer images
  and pull the PostgreSQL/Nginx/Node images in advance.
- An internal DNS name and HTTPS certificate supplied by IT. IT's reverse proxy
  forwards to this server's loopback port 8080, preserving Host and setting
  X-Forwarded-Proto=https. Only that trusted proxy should reach this port in
  production; it must overwrite incoming forwarding headers.

## Configuration And First Start

The existing docker-compose.yml, .env, .env.local and vercel.json are preserved.
They are not used by the server stack. Commented prototype examples are included
in .env.docker.example. No real credentials or user uploads enter the Docker build.

From the repository root, generate a separate environment file once:

```sh
node deploy/init-env.mjs
```

This refuses to overwrite an existing .env.docker. It generates three independent
random secrets. If Node is unavailable on the server, generate this file on the
development PC and transfer it securely. Restrict access to IT administrators.

Edit .env.docker:

```dotenv
APP_URL=https://dms.your-internal-domain
BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
```

Use the actual URL, not the example domain. All staff access that same server URL;
their individual device IPs do not need to be listed. For temporary LAN testing,
use APP_URL=http://SERVER_LAN_IP:8080 and BIND_ADDRESS=0.0.0.0, and allow TCP 8080
only from the intended internal subnet in the host firewall. Use HTTPS for normal
operation. PostgreSQL has no published host port.

```sh
docker compose --env-file .env.docker -f compose.server.yml config --quiet
docker compose --env-file .env.docker -f compose.server.yml up -d --build
docker compose --env-file .env.docker -f compose.server.yml ps -a
docker compose --env-file .env.docker -f compose.server.yml logs --tail=100 migrate app scheduler web
```

Expected: migrate exits with code 0, db/app are healthy, web/scheduler are running.
Open APP_URL. The default generated configuration is http://localhost:8080 for a
test on the server itself. Do not use pnpm dev for production.

The PostgreSQL password is used inside a connection URL; keep the generated hex
password or use URL-safe characters. Changing POSTGRES_PASSWORD in the file does
not change the password of an already initialized database; coordinate credential
rotation with IT. Changing APP_URL/secrets requires recreating the app containers.

## Initial Administrator

Register your own account through Sign up. Then, on the server, open PostgreSQL:

```sh
docker compose --env-file .env.docker -f compose.server.yml exec db psql -U dms -d deferral_dms
```

Use your registered email in the following SQL, then sign out and sign in again:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-registered-email@example.com'
RETURNING id, email, role;
```

Exactly one row should be returned. Exit psql with \q. Manage other users through
the app. Do not run scripts/seed-users.mjs on production; it contains demo accounts.

## Browser Push Notifications

Signed-in users are prompted once to allow browser notifications. When allowed,
the app can push a notification to their browser even when the DMS tab isn't
open (the browser process itself still needs to be running — this is how web
push works everywhere, not a DMS limitation).

This requires a VAPID key pair in `.env.docker`:

```dotenv
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@your-domain
```

`node deploy/init-env.mjs` generates a real key pair automatically for a brand
new `.env.docker`. For an **existing** `.env.docker` (init-env.mjs refuses to
touch it), add the three lines above by hand — generate a key pair with:

```sh
node -e '
const { createECDH } = require("crypto");
const b64url = (b) => b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const pad = (b,n) => b.length===n ? b : Buffer.concat([Buffer.alloc(n-b.length), b]);
const e = createECDH("prime256v1"); e.generateKeys();
console.log("VAPID_PUBLIC_KEY=" + b64url(e.getPublicKey()));
console.log("VAPID_PRIVATE_KEY=" + b64url(pad(e.getPrivateKey(), 32)));
'
```

Recreate the `app` container after editing `.env.docker` so it picks up the
new values. If these three variables are left unset, push notifications are
silently skipped — the rest of the app (including in-app notifications) keeps
working normally.

## Scheduled Jobs

The scheduler calls the existing protected endpoints at 02:00 UTC for expiry
notifications and 02:05 UTC for marking expired deferrals, matching vercel.json.
It retries failures each minute and catches up after startup if today's scheduled
time has passed. Restarting the scheduler after that time can run the jobs again;
the existing notification cooldown and expiry status checks still apply. Run only
one scheduler. Monitor its logs through IT's existing monitoring system.

To exercise both jobs immediately on test data:

```sh
docker compose --env-file .env.docker -f compose.server.yml exec scheduler node /scheduler.mjs --once
```

This changes eligible records and creates notifications; it is not a dry run.

## Uploads And Existing Prototype Data

New files live in the persistent uploads volume mounted at /app/public/uploads.
Nginx serves /uploads/ immediately, including files written after application
startup. The PDF generator uses the internal gateway to retrieve signatures.
The existing public-file access behavior is preserved.

This deployment starts with an EMPTY database. It does not transfer Neon data or
Vercel Blob files automatically. Choose either a clean installation or a planned
data transfer before users start working.

To preserve prototype data, first freeze writes and export a full PostgreSQL dump
(including the drizzle migration-history schema and Better Auth tables). Restore
into an empty target before running migrations. Confirm the source PostgreSQL
version: use a compatible pg_dump client and a target version at least as new as
the source; do not assume a newer Neon database can be restored to PostgreSQL 16.
Never resolve migration-history conflicts by deleting tables or dropping data.

Copy locally stored uploads into the new uploads volume, retaining directory
names. Blob URLs in attachments, user signatures and approval signature snapshots
still refer to the cloud until the actual files are downloaded and those database
references are deliberately migrated. Keep the old cloud storage available until
that transfer is tested; switching FILE_STORAGE_DRIVER alone does not transfer it.

## Backups And Restore

Persistent volumes survive container replacement, but are NOT backups. Schedule
backups to another machine/disk and test restoration. Back up the database,
uploads, .env.docker, configuration files and the deployed Git commit together.
Do not commit secrets or backups. Never run docker compose down -v on this stack:
it deletes persistent data. The old development stack uses different volumes.

Example consistent backup during a maintenance window (Linux shell, repo root):

```sh
mkdir -p backups
docker compose --env-file .env.docker -f compose.server.yml stop scheduler web app
docker compose --env-file .env.docker -f compose.server.yml exec -T db pg_dump -U dms -d deferral_dms -Fc -f /tmp/dms.dump
docker compose --env-file .env.docker -f compose.server.yml cp db:/tmp/dms.dump backups/dms.dump
docker compose --env-file .env.docker -f compose.server.yml run --rm --no-deps --user root --entrypoint tar -v "$(pwd)/backups:/backup" app -czf /backup/uploads.tar.gz -C /app/public/uploads .
docker compose --env-file .env.docker -f compose.server.yml start app web scheduler
```

Check every command succeeds. If backup fails, investigate and restart the stopped
services. Use timestamped backup folders for retention instead of overwriting the
last backup. Copy the resulting files off the host.

Restore on a SEPARATE, empty recovery server with the same configuration/images:

```sh
docker compose --env-file .env.docker -f compose.server.yml up -d db
docker compose --env-file .env.docker -f compose.server.yml cp backups/dms.dump db:/tmp/dms.dump
docker compose --env-file .env.docker -f compose.server.yml exec -T db pg_restore -U dms -d deferral_dms --no-owner --no-privileges --exit-on-error /tmp/dms.dump
docker compose --env-file .env.docker -f compose.server.yml run --rm --no-deps --user root --entrypoint sh -v "$(pwd)/backups:/backup:ro" app -c 'tar -xzf /backup/uploads.tar.gz -C /app/public/uploads && chown -R node:node /app/public/uploads'
docker compose --env-file .env.docker -f compose.server.yml up -d
```

Wait for db to become healthy before pg_restore. These restore commands assume
the target is empty; do not run them over an active database. Verify row counts,
login, file downloads and PDFs before accepting a recovered installation.

## Updates

Back up first, record the current Git commit/images, and use a maintenance window.
Stop scheduler/web/app, pull the approved code, then run:

```sh
docker compose --env-file .env.docker -f compose.server.yml build
docker compose --env-file .env.docker -f compose.server.yml run --rm migrate
docker compose --env-file .env.docker -f compose.server.yml up -d --force-recreate
```

Do not start the app if migrations fail. Inspect migration logs first. A rollback
may require the matching database backup as well as the previous application
image; changing only the image cannot undo a schema change.

## Acceptance Tests

On a test installation, an automated smoke test creates a test account and a tiny
signature image (both retained for inspection):

```sh
node deploy/smoke-test.mjs --create-test-data
```

It defaults to http://localhost:8080; set TEST_BASE_URL for a different address.
It checks signup/login/logout, search, immediate signature/attachment upload and
download, PDF export, and draft deletion. Then perform
the role/workflow and recovery checks below.

1. Sign up, sign in and sign out using the actual LAN/HTTPS address, including mobile.
2. Promote the initial admin; create test users for each approval role.
3. Create/save/submit a draft, complete the approval sequence, return/reject a test
   deferral, and check department visibility and search filters.
4. Upload an attachment and signature AFTER startup. Download/view both immediately.
   Export a PDF and verify all signature images, including mitigations.
5. Restart app/web and verify the same records, attachments and signatures remain.
6. Run the scheduler once with suitable test dates and verify notifications/expiry.
7. Check the existing database health endpoint reports the schema and local driver
   correctly. /api/health/live checks only app liveness, not database readiness.
8. Restore a backup on an isolated server and repeat login/download/PDF tests.

References: https://nextjs.org/docs/app/guides/self-hosting and
https://docs.docker.com/compose/how-tos/startup-order/.
