# Deploying InsurePress Studio to a VPS

This runs three containers with Docker Compose on a server you own:

| Container | What it does | Reachable from the internet? |
|---|---|---|
| `caddy` | HTTPS (free Let's Encrypt certificate) | Yes, ports 80 and 443 |
| `app` | InsurePress Studio (API, web app, headless Chromium for PDF export) | No, only through Caddy |
| `db` | MySQL 8.0 | No |

Everyone signs in with their own email and password. Each author's books, brand kits, offers and exported files are private to them. The first person to open the site creates the **admin** account. Admins add other authors from **Manage users**.

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
openssl rand -hex 32        # copy this for JWT_SECRET
nano .env
```

In `.env`, set:

- `DOMAIN` and `PUBLIC_URL`: your domain, e.g. `studio.yourbrokerage.ng` and `https://studio.yourbrokerage.ng`
- `JWT_SECRET`: the random value printed above. It signs login sessions; changing it signs everyone out.
- `ALLOW_REGISTRATION`: leave `false` so only admins can add users, or `true` to let anyone sign up from the login page.
- `SMTP_*` and `MAIL_FROM` (recommended): lets users reset forgotten passwords by email. See [Email setup](#email-setup). Without it, "Forgot password?" is hidden and admins reset passwords instead.
- `MYSQL_ROOT_PASSWORD` and `DB_PASSWORD`: two different long random passwords (`openssl rand -hex 24` makes one)
- `ANTHROPIC_API_KEY`: optional

## 6. Start it

```bash
docker compose up -d --build                    # first build takes ~5 minutes
docker compose ps                               # app and db should say "healthy"
```

**Straight away**, open `https://studio.yourbrokerage.ng` and create the admin account. Until you do, the site shows the setup form to anyone who visits.

Optional: load the "Sleep Soundly" sample book into the admin's library:

```bash
docker compose exec app node server/db/seed.js
```

## Users and passwords

- **Add an author:** avatar menu → **Manage users** → **Add user**. Give them the temporary password privately; they change it under **Account & password**.
- **Forgotten password:** with email set up, users click **Forgot password?** on the sign-in page and get a link that works once and expires after an hour. An admin can always reset it from **Manage users** (key icon). Either way the user is signed out on every device and gets a "your password was changed" email.
- **Lost device:** the user picks **Sign out on all devices** under **Account & password**, or an admin resets their password.
- **Locked out of the only admin account:** reset the password from the server:
  ```bash
  docker compose exec app node server/db/reset-password.js admin@yourbrokerage.ng 'New-admin-pass-2026'
  ```
- After 8 wrong passwords for the same email from the same address, sign-in pauses for 15 minutes.

## Email setup

Password reset links and "your password was changed" notices are sent over SMTP. Put these in `.env`, then run `docker compose up -d`:

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` / `SMTP_PASS` |
|---|---|---|---|
| Google Workspace / Gmail | `smtp.gmail.com` | `587` | your address / an [app password](https://myaccount.google.com/apppasswords) (needs 2-step verification) |
| Zoho Mail | `smtp.zoho.com` (or `smtppro.zoho.com` for paid plans) | `587` | your address / your password or app password |
| Brevo | `smtp-relay.brevo.com` | `587` | your Brevo login / an SMTP key |
| Mailgun | `smtp.mailgun.org` | `587` | the domain's SMTP login / password |

- Set `MAIL_FROM` to an address your provider allows you to send from, e.g. `InsurePress Studio <no-reply@yourbrokerage.ng>`.
- `PUBLIC_URL` must be your real `https://` address: it's the start of every emailed link.
- Check it worked with `docker compose logs app | grep Email`. You should see `Email: SMTP ready`. If the check failed, the log says why (usually a wrong password or port).
- For best delivery, add your provider's SPF/DKIM records to your domain's DNS. Your provider's dashboard shows the exact values.

## Day-to-day

| Task | Command (run inside `insurepress-studio/`) |
|---|---|
| View logs | `docker compose logs -f app` |
| Update to the latest code | `git pull && docker compose up -d --build` |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` (your data is kept) |
| Back up the database | `docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" insurepress_studio' > backup-$(date +%F).sql` |
| Restore a backup | `docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" insurepress_studio' < backup-YYYY-MM-DD.sql` |

Books live in the `dbdata` volume and exported files in the `exports` volume. Both survive restarts and rebuilds. **Do not run `docker compose down -v`**: the `-v` deletes them.

## Troubleshooting

- **The browser shows a certificate error, or Caddy logs mention "challenge failed":** the domain doesn't point at this server yet, or port 80/443 is blocked. Check DNS (step 2) and the firewall (step 3), then run `docker compose restart caddy`.
- **"set DOMAIN in .env" or a similar error:** a required value is missing from `.env`.
- **PDF export fails or the app restarts during exports:** the server is short of memory. Add swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) or use a 4 GB server.
- **PDFs use plain fonts:** the server couldn't reach Google Fonts, so it fell back to the bundled DejaVu fonts. Everything still works.
