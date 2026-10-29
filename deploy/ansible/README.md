# Deploying the Abia Executive Dashboard with Ansible

Deploys the web dashboard (`webapp/`) to **https://dashboard.abiaworkspace.com** and the
PWA (`../pwa`) to **https://pwa-dashboard.abiaworkspace.com**, on the shared EC2 host that
also runs Lawyers Deck. Everything on the server lives in one folder,
**`/home/ubuntu/containers/abia-dashboard`**, next to the other projects in `~/containers`.
It replaces AWS Amplify for both apps once DNS is switched (see Route 53 below).

## Configuration: two files, both gitignored

| File | What | Template |
|---|---|---|
| `deploy/ansible/.env` | Where and how to deploy: host, SSH user, key path, server folder, both domains, port, memory cap | `.env.example` |
| `deploy/ansible/.env.production` | The web app's production env (Supabase, SendGrid, Gemini, `CRON_SECRET`…) | `webapp/.env.example` |

`group_vars/all.yml` reads `.env` with Ansible's `ini` lookup, so plain `ansible-playbook`
works without exporting anything. `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PWA_URL` are always
forced to `https://<DEPLOY_DOMAIN>` and `https://<DEPLOY_PWA_DOMAIN>`. Values in
`.env.production` must not contain `$` unless they are single-quoted, because Compose
expands `${…}` in env files.

`.env.production` needs these names (values from the Supabase dashboard and the
current Amplify console env):

| Name | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, in the browser and on the server (also become the PWA's `VITE_SUPABASE_*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin access (`/manage`, uploads, PWA config) |
| `NEXT_PUBLIC_EVIDENCE_BUCKET` | Storage bucket for evidence files (default `evidence`; also the PWA's) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI chat |
| `SENDGRID_API_KEY`, `DIGEST_FROM_EMAIL` | Weekly digest email |
| `CRON_SECRET` | Protects `/api/cron/weekly-digest` (must match the EventBridge connection) |
| `PWA_LOCAL_ORIGINS` | Optional: extra origins allowed to call AI chat (local dev) |
| `DATABASE_URL`, `DIRECT_URL` | Not read by the running app (Prisma CLI only); harmless to include |

There is no second env file for the PWA. Its build env is derived from `.env.production`
during the deploy.

## Why it's built this way

The host is **Ubuntu 18.04** (glibc 2.27, Python 3.6) with **3.7 GB RAM** shared with
Lawyers Deck, Antly services, Postgres, Qdrant and Redis. **nginx already owns 80/443**,
and certbot renews the other sites. So, the same way as Lawyers Deck:

- **Node runs in Docker** (`node:22-bookworm-slim`), with Yarn 4 via Corepack (`packageManager`).
  `yarn.lock` already lists the Linux native binaries, so no extra step is needed for them.
- **The image is built on your Mac** (`linux/amd64`) and shipped with `docker save | docker load`.
  There's no registry, and `next build` never runs on the server.
- **The container publishes on `127.0.0.1:7401` only**, capped at 768 MB, with logs capped at 30 MB.
  (Lawyers Deck uses 7301.)
- **The PWA is plain static files.** It is built in a throwaway container on the Mac, which
  keeps `pwa/.env.local` (dev URLs) out of it. Each build is uploaded to `pwa/releases/<id>`,
  and the host nginx serves `pwa/current` directly, so it needs no container and almost no memory.
  `sw.js`, `index.html`, `build.json` and the manifest are sent `no-cache`, as on Amplify, so
  installed apps pick up new builds. `build.json` carries the release id, so `make app-update`
  in `pwa/` still reads the live build.
- **The host nginx terminates TLS** for both names, with one certificate. The site file lives
  in the folder and is symlinked into `sites-enabled`. It's applied only if `nginx -t` passes;
  otherwise it's unlinked again. Certificates come from `certbot certonly --webroot`, so certbot
  never edits the file.
- **Ansible is pinned to ansible-core 2.16**, the newest release that supports a Python 3.6 target.
- **The database stays on Supabase.** Nothing here migrates it.

```
/home/ubuntu/containers/abia-dashboard/
├── compose.yml              service web (rendered)
├── .env                     IMAGE_TAG=<release being served>
├── app.env                  production env, 0600
├── pwa/releases/<id>/       PWA builds (last 5); pwa/current → the one served
├── nginx/dashboard.abiaworkspace.com.conf  → symlinked from /etc/nginx/sites-enabled/
├── acme/                    certbot webroot
└── images/                  tarball, only while loading
```
Outside the folder: that one symlink, `/etc/letsencrypt/live/dashboard.abiaworkspace.com/`,
and the `abia-dashboard-web:<id>` images in Docker (the last 5 are kept).

## Commands (from `webapp/`)

```bash
make deploy-setup     # once: pinned Ansible + ansible.posix into deploy/ansible/.venv
make deploy-ping      # SSH + Python check against DEPLOY_HOST
make deploy-check     # syntax check
make deploy           # build image + PWA → upload → start → switch PWA → nginx → certificate
make redeploy         # restart the current release with a fresh .env.production (no rebuild)
make deploy-rollback  # serve the previous release, web + PWA (DEPLOY_ARGS="-e to=<release id>")
make deploy-status    # container state, served release, PWA build
make deploy-logs      # last 100 lines of the web log
make deploy-amplify   # the old Amplify release trigger (AMPLIFY_APP_ID=…), until cut-over
```

`make redeploy` is for server-side values (SendGrid, Gemini, `CRON_SECRET`, the service role
key) or `DEPLOY_*` settings. `NEXT_PUBLIC_*` values are built into the app, so changing
those needs `make deploy`.

A deploy:
1. Builds `abia-dashboard-web:<UTC timestamp>` locally, with the prod env as a BuildKit
   secret (it never lands in a layer), and the PWA with the same timestamp as its build id.
2. Uploads both, loads the image, and unpacks the PWA into `pwa/releases/<id>`.
3. Writes `IMAGE_TAG` and runs `docker compose up -d --wait`. If the new container isn't
   healthy within 180 s, the previous tag is restored, the PWA is left as it was, and the deploy fails.
4. Points `pwa/current` at the new PWA build.
5. Installs the nginx site, over HTTP until a certificate exists.
6. Once both names resolve to `DEPLOY_HOST`, requests the certificate and switches to HTTPS.
   Before then it prints a note and keeps serving HTTP. Re-running `make deploy` after DNS
   propagates finishes this step.
7. Checks the app answers, and that nginx serves the new PWA's `build.json`.

On the server:
```bash
cd ~/containers/abia-dashboard
docker compose ps
docker compose logs -f web
docker compose restart web
readlink pwa/current
```

## Weekly digest

Amplify never ran `vercel.json` crons. The Friday digest is sent by the EventBridge rule in
`webapp/infrastructure/terraform`, which POSTs `https://dashboard.abiaworkspace.com/api/cron/weekly-digest`.
The hostname stays the same, so nothing changes. Just keep `CRON_SECRET` in `.env.production`
the same as the one in that stack.

## Route 53 (hosted zone `abiaworkspace.com`)

Today both names are CNAMEs to Amplify's CloudFront. To move them:

1. Run `make deploy` first. The app and PWA start on the server, but nobody reaches them yet.
   Check `make deploy-status`.
2. Lower the TTL on both records to 60 a few hours ahead.
3. Replace each CNAME with an A record to the host's Elastic IP (the same `DEPLOY_HOST` as
   Lawyers Deck). A name can't have a CNAME and an A record at once, so delete and create in
   one change batch. If the records are managed by Amplify's domain association, remove the
   custom domain in the Amplify console first, or Amplify may put them back.
4. Run `make deploy` again straight away. It sees the names resolve here and gets the
   certificate. Until it does, visitors reach the new server over plain HTTP only, and the
   PWA can't install or work offline. Keep the gap short.

| Record name | Type | Value | TTL |
|---|---|---|---|
| `dashboard.abiaworkspace.com` | A | `<DEPLOY_HOST>` | 300 |
| `pwa-dashboard.abiaworkspace.com` | A | `<DEPLOY_HOST>` | 300 |

- **No AAAA record.** The instance has no public IPv6 address, and Let's Encrypt tries IPv6 first.
- Once both apps are served from here and look right, the Amplify apps can be deleted.
