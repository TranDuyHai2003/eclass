# Math World — realtime server

WebSocket server (Node 22 + `ws`, ~16 MB RAM idle) for presence (10 Hz snapshots, rooms of 40 per realm) and voxel edits (persisted in `data/edits-expanse.jsonl`). It never grants rewards — those only go through the web app's server actions + DB.

## Deploy (`<user>@<host>`, folder `<install-dir>` — real values are kept outside the repo)
```bash
scp package.json server.mjs Dockerfile docker-compose.yml .dockerignore <user>@<host>:<install-dir>/
ssh <user>@<host> 'cd <install-dir> && docker compose --profile tunnel up -d --build'
```
`.env` on the server (created once, never committed): `WORLD_RT_SECRET=<random>` · `ALLOW_ANON=1` (LAN/dev only — set to 0 for production).

## Without opening ports
- LAN: `ws://<host-lan-ip>:2567`.
- Internet: Cloudflare **quick tunnel** (profile `tunnel`) → `./tunnel-url.sh` prints the current `wss://…trycloudflare.com` (changes on every restart).
- Stable subdomain: needs the Cloudflare account owner to grant the logged-in user the "Cloudflare One Connector: cloudflared Write" permission (or run `cloudflared tunnel login` themselves), then switch the tunnel service to a named tunnel.

## Web app env
- Production `/world`: `WORLD_RT_URL=wss://…` and `WORLD_RT_SECRET=<same as server>` (Next signs 10-minute HMAC tokens).
- Dev preview: `NEXT_PUBLIC_WORLD_RT_URL=wss://…` (uses anonymous tokens; requires `ALLOW_ANON=1`).

## Health
`curl https://<tunnel>/health` → `{"ok":true,"rooms":N,"players":M}`
