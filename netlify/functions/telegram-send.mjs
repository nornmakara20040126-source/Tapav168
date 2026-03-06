const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders,
  },
  body: JSON.stringify(payload),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod === "GET") {
    return jsonResponse(200, { ok: true, service: "telegram-send" });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    return jsonResponse(500, {
      ok: false,
      error: "Missing TELEGRAM_BOT_TOKEN in environment",
    });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const text = String(body.text || "").trim();
    const chatId = String(body.chat_id || defaultChatId || "").trim();
    const parseMode = body.parse_mode ? String(body.parse_mode) : undefined;

    if (!text) {
      return jsonResponse(400, { ok: false, error: "text is required" });
    }

    if (!chatId) {
      return jsonResponse(400, {
        ok: false,
        error: "chat_id is required (or set TELEGRAM_CHAT_ID)",
      });
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        }),
      }
    );

    const telegramData = await telegramResponse
      .json()
      .catch(() => ({ ok: false, description: "Invalid Telegram response" }));

    if (!telegramResponse.ok || !telegramData.ok) {
      return jsonResponse(502, {
        ok: false,
        error: telegramData.description || "Telegram API error",
      });
    }

    return jsonResponse(200, {
      ok: true,
      result: telegramData.result?.message_id || null,
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error.message || "Server error",
    });
  }
};
