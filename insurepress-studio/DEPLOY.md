# Deploying InsurePress Studio to a VPS

This runs three containers with Docker Compose on a server you own:

| Container | What it does | Reachable from the internet? |
|---|---|---|
| `caddy` | HTTPS (free Let's Encrypt certificate) and a username/password prompt | Yes, ports 80 and 443 |
| `app` | InsurePress Studio (API, web app, headless Chromium for PDF export) | No, only through Caddy |
| `db` | MySQL 8.0 | No |

> **Why the password prompt?** The app has no user accounts yet. Without the prompt, anyone who found your URL could read your books and use your AI credits. Keep it on until real logins are added.

## 1. What you need

- A VPS running **Ubuntu 22.04 or 24.04** with **at least 2 GB RAM** (4 GB is better; Chromium uses a lot of memory while making PDFs). For example DigitalOcean, Hetzner, AWS Lightsail or Contabo.
- A domain or subdomain, e.g. `studio.yourbrokerage.ng`.
- Optional: an Anthropic API key for live AI. Without one, the AI Co-Pilot runs in mock mode.

## 2. Point your domain at the server

At your domain registrar, add an **A record** for `studio.yourbrokerage.ng` pointing to the server's public IP address. Wait until `ping studio.yourbrokerage.ng` shows that IP. This can take a few minutes to an hour.

## 3. Install Docker and open the firewall

SSH into the server, then:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # then log out and back in
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

Also allow ports 80 and 443 in your provider's cloud firewall, if it has one.

## 4. Get the code

```bash
git clone -b ccr-c74a1e40-x4h3hv https://github.com/segunadebanjo/segunadebanjo.git
cd segunadebanjo/insurepress-studio
```

If the repository is private, GitHub will ask you to sign in. Use a personal access token as the password.

## 5. Configure

```bash
cp .env.production.example .env
docker run --rm caddy:2 caddy hash-password --plaintext 'choose-a-strong-password'
nano .env
```

In `.env`, set:

- `DOMAIN` and `PUBLIC_URL`: your domain, e.g. `studio.yourbrokerage.ng` and `https://studio.yourbrokerage.ng`
- `BASIC_AUTH_USER`: the login name you want
- `BASIC_AUTH_HASH`: paste the hash printed above, **inside single quotes** (it contains `$` signs)
- `MYSQL_ROOT_PASSWORD` and `DB_PASSWORD`: two different long random passwords (`openssl rand -hex 24` makes one)
- `ANTHROPIC_API_KEY`: optional

## 6. Start it

```bash
docker compose up -d --build                    # first build takes ~5 minutes
docker compose exec app node server/db/seed.js  # optional: load the "Sleep Soundly" sample book
docker compose ps                               # app and db should say "healthy"
```

Open `https://studio.yourbrokerage.ng` and sign in with your username and password.

## Day-to-day

| Task | Command (run inside `insurepress-studio/`) |
|---|---|
| View logs | `docker compose logs -f app` |
| Update to the latest code | `git pull && docker compose up -d --build` |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` (your data is kept) |
| Back up the database | `docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" insurepress_studio' > backup-$(date +%F).sql` |
| Restore a backup | `docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" insurepress_studio' < backup-YYYY-MM-DD.sql` |
| Change the password | Generate a new hash (step 5), update `.env`, then `docker compose up -d caddy` |

Books live in the `dbdata` volume and exported files in the `exports` volume. Both survive restarts and rebuilds. **Do not run `docker compose down -v`**: the `-v` deletes them.

## Troubleshooting

- **The browser shows a certificate error, or Caddy logs mention "challenge failed":** the domain doesn't point at this server yet, or port 80/443 is blocked. Check DNS (step 2) and the firewall (step 3), then run `docker compose restart caddy`.
- **"set DOMAIN in .env" or a similar error:** a required value is missing from `.env`.
- **PDF export fails or the app restarts during exports:** the server is short of memory. Add swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) or use a 4 GB server.
- **PDFs use plain fonts:** the server couldn't reach Google Fonts, so it fell back to the bundled DejaVu fonts. Everything still works.
