import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ENV_PATH = path.resolve(process.cwd(), '.env');

const loadDotEnv = () => {
  if (!fs.existsSync(ENV_PATH)) return;
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadDotEnv();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = Number(process.env.PORT || process.env.TELEGRAM_PORT || 8787);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders,
  });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: 'Missing URL' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'telegram-proxy' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/telegram/send') {
    if (!TELEGRAM_BOT_TOKEN) {
      sendJson(res, 500, {
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN in environment',
      });
      return;
    }

    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const text = String(body.text || '').trim();
      const chatId = String(body.chat_id || DEFAULT_CHAT_ID || '').trim();
      const parseMode = body.parse_mode || undefined;

      if (!text) {
        sendJson(res, 400, { ok: false, error: 'text is required' });
        return;
      }
      if (!chatId) {
        sendJson(res, 400, {
          ok: false,
          error: 'chat_id is required (or set TELEGRAM_CHAT_ID)',
        });
        return;
      }

      const apiRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: parseMode,
          }),
        }
      );

      const apiData = await apiRes.json();
      if (!apiRes.ok || !apiData.ok) {
        sendJson(res, 502, { ok: false, error: apiData.description || 'Telegram API error' });
        return;
      }

      sendJson(res, 200, { ok: true, result: apiData.result?.message_id || null });
      return;
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || 'Server error' });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[telegram-proxy] running on http://localhost:${PORT}`);
});
