# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Telegram Bot Integration

This project sends Telegram messages through a backend endpoint so bot credentials are not exposed in the frontend.

In production on Netlify, it uses `netlify/functions/telegram-send.mjs` via `/telegram/send`.

### 1) Netlify (production)

Set these environment variables in Netlify Site Settings -> Environment variables:

- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_CHAT_ID` (optional default target chat)
- `VITE_TELEGRAM_ROLE_CHAT_IDS` (optional JSON map: `roleId -> chat_id`)

Example:

```env
VITE_TELEGRAM_ROLE_CHAT_IDS={"admin":"111111111","operation":"222222222","stock":"333333333","cutting":"444444444","qc":"555555555"}
```

`VITE_TELEGRAM_PROXY_URL` is optional. If not set, the frontend defaults to `/telegram/send`.

### 2) Local development options

Option A: Run with local proxy server:

```bash
npm run telegram:server
```

Then set:

```env
VITE_TELEGRAM_PROXY_URL=http://localhost:8787/telegram/send
```

Option B: Run with Netlify Dev so local function routes work:

```bash
npx netlify dev
```

### 3) App runtime

Run app in normal Vite mode:

```bash
npm run dev
```

When enabled, the app sends Telegram messages for:

- order saved
- order approved to production
- step received
- step completed
