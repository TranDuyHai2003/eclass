# Math World — realtime server

WebSocket server (Node 22 + `ws`, ~16 MB RAM idle) for presence (10 Hz snapshots, rooms of 40 per realm) and voxel edits (persisted in `data/edits-expanse.jsonl`). It never grants rewards — those only go through the web app's server actions + DB.

## Deploy (`<user>@<host>`, folder `<install-dir>` — real values are kept outside the repo)
```bash
scp package.json server.mjs Dockerfile docker-compose.yml .dockerignore <user>@<host>:<install-dir>/
ssh <user>@<host> 'cd <install-dir> && docker compose --profile tunnel up -d --build'
```
`.env` on the server (created once, never committed): `WORLD_RT_SECRET=<random>` · `ALLOW_ANON=1` (LAN/dev only — set to 0 for production).

## Production: Cloudflare named tunnel (stable hostnames)
- `docker compose --profile named up -d` starts `realtime`, `assets` (nginx serving `./assets/world` = a copy of the whole `public/world`: VRM/GLB, KTX2, textures, audio, Basis decoder) and `tunnel-named`.
- `TUNNEL_TOKEN=<token>` lives only in the server's `.env` (copied by the account owner from the dashboard; never committed).
- Routing is local (`cloudflared.yml`): `eclass-rt.<domain>` → `realtime:2567`, `eclass-cdn.<domain>` → `assets:80`; DNS = proxied CNAMEs to `<tunnel-id>.cfargotunnel.com`.
- A Cache Rule (`https://eclass-cdn.<domain>/world/*` → eligible for cache) keeps the server sending each model once per edge location.
- After any change under `public/world`: run `node scripts/world-asset-versions.mjs` (content hashes → `?v=` on CDN URLs, so the 7-day Cloudflare cache never serves a stale file), commit `lib/world/assetVersions.json`, then upload assets BEFORE pushing master (push = deploy).
- Upload assets (after every change under `public/world`, including the git-ignored VRM/KTX2 files): `cd public && tar cf - world | ssh <user>@<host> 'tar xf - -C <install-dir>/assets'`.
- Web app (Heroku, read at runtime — no rebuild when it changes): `WORLD_RT_URL=wss://eclass-rt.<domain>`, `WORLD_HEAVY_ASSET_BASE=https://eclass-cdn.<domain>/world`. With it set, ALL world assets load from the CDN (`worldAsset()` in `lib/world/avatars.ts`); without it (dev) they load from the app's own `/world`.

## Without opening ports
- LAN: `ws://<host-lan-ip>:2567`.
- Internet: Cloudflare **quick tunnel** (profile `tunnel`) → `./tunnel-url.sh` prints the current `wss://…trycloudflare.com` (changes on every restart).
- Stable subdomain: needs the Cloudflare account owner to grant the logged-in user the "Cloudflare One Connector: cloudflared Write" permission (or run `cloudflared tunnel login` themselves), then switch the tunnel service to a named tunnel.

## Web app env
- Production `/world`: `WORLD_RT_URL=wss://…` and `WORLD_RT_SECRET=<same as server>` (Next signs 10-minute HMAC tokens).
- Dev preview: `NEXT_PUBLIC_WORLD_RT_URL=wss://…` (uses anonymous tokens; requires `ALLOW_ANON=1`).

## Health
`curl https://<tunnel>/health` → `{"ok":true,"rooms":N,"players":M}`
