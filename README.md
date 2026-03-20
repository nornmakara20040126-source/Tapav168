# T-Shirt Production System

React + Vite frontend for the T-shirt production workflow. Data is stored in Firebase. Telegram notifications are optional and require a backend proxy so the bot token is never exposed in the browser.

## GitHub Pages

This repo now includes a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.

What it does:

- builds the app from the repository root
- detects the repository name automatically and sets the correct Vite base path
- deploys the `dist` output to GitHub Pages on every push to `main`
- disables Telegram by default for the Pages build because GitHub Pages cannot run backend functions

### Enable Pages

1. Push this repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `main` or run the `Deploy to GitHub Pages` workflow manually.

For the current remote repository, the expected site URL is:

`https://nornmakara20040126-source.github.io/Tapav168/`

### Important limitation

GitHub Pages only hosts static files. These files will not run on Pages:

- `server/telegram-proxy.mjs`
- `netlify/functions/telegram-send.mjs`

If you want Telegram notifications while hosting the frontend on GitHub Pages, point `VITE_TELEGRAM_PROXY_URL` at an external HTTPS backend you control.

Examples:

- Netlify function
- Render service
- Cloudflare Worker
- your own Node server

If you do not provide `VITE_TELEGRAM_PROXY_URL`, the GitHub Pages workflow builds with Telegram disabled.

To enable Telegram on GitHub Pages:

1. Deploy `server/telegram-proxy.mjs` or `netlify/functions/telegram-send.mjs` to a public HTTPS host.
2. In GitHub, open `Settings -> Secrets and variables -> Actions -> Variables`.
3. Add `VITE_TELEGRAM_PROXY_URL` with your public proxy URL, for example `https://your-proxy.example.com/telegram/send`.
4. Optional: add `VITE_TELEGRAM_ROLE_CHAT_IDS` if you want different Telegram chat IDs per role.
5. Push to `main` again so the Pages workflow rebuilds with Telegram enabled.

## Local development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

## Telegram backend options

### Option A: local Node proxy

Run:

```bash
npm run telegram:server
```

Then set:

```env
VITE_TELEGRAM_PROXY_URL=http://localhost:8787/telegram/send
```

Required backend environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (optional default target chat)
- `VITE_TELEGRAM_ROLE_CHAT_IDS` (optional JSON map from role ID to chat ID)

Example:

```env
VITE_TELEGRAM_ROLE_CHAT_IDS={"admin":"111111111","operation":"222222222","stock":"333333333","cutting":"444444444","qc":"555555555"}
```

### Option B: Netlify

This project already contains Netlify configuration in `netlify.toml`.

Netlify production uses:

- `netlify/functions/telegram-send.mjs`
- redirect `/telegram/send -> /.netlify/functions/telegram-send`

### Option C: Render

This repo now includes `render.yaml` for the Telegram proxy backend.

Render service settings:

- start command: `node server/telegram-proxy.mjs`
- health check: `/health`
- required environment variables:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`

After Render gives you a public URL such as `https://your-app.onrender.com`, set:

```env
VITE_TELEGRAM_PROXY_URL=https://your-app.onrender.com/telegram/send
```

## Production notes

Telegram notifications, when enabled, are sent for:

- order saved
- order approved to production
- step received
- step completed
