import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bot } from "grammy";
import { z } from "zod";
import { createServiceRoleClient } from "@house-of-stars/database/runtime";
import { TelegramInitDataHmacVerifier } from "@house-of-stars/telegram/runtime";
import { botEnvSchema } from "@house-of-stars/shared/server-env-runtime";
import { createTelegramStarsInvoice } from "./payments/create-invoice.js";
import {
  createSupabasePaymentChargeStore,
  registerInvoiceHandlers,
} from "./payments/handlers.js";
import { startNotificationWorker } from "./notification-worker.js";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
try {
  process.loadEnvFile(path.join(workspaceRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const env = botEnvSchema.parse(process.env);
const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const miniAppUrl = new URL(env.MINIAPP_URL);
const telegramCanOpenMiniApp = miniAppUrl.protocol === "https:";
const paymentChargeStore = createSupabasePaymentChargeStore({
  supabaseUrl: env.SUPABASE_URL,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
});

registerInvoiceHandlers(bot, paymentChargeStore);

bot.command("start", async (context) => {
  if (!telegramCanOpenMiniApp) {
    await context.reply(
      "The Mini App needs a public HTTPS URL. Set MINIAPP_URL to your HTTPS development tunnel or deployed URL, then restart the bot.",
    );
    return;
  }
  await context.reply("Open the House of Stars Mini App.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Open app", web_app: { url: env.MINIAPP_URL } }],
      ],
    },
  });
});

const invoiceRequestSchema = z
  .object({
    initData: z.string().min(1),
    purpose: z.enum(["stars_purchase", "quick_sell"]).default("stars_purchase"),
    packId: z.string().trim().min(1).optional(),
    stars: z.coerce.number().int().positive().optional(),
    orderId: z.string().trim().max(128).optional(),
    nonce: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

async function handleInvoiceRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") {
    response.writeHead(405, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ ok: false, error: "Only POST is supported" }),
    );
    return;
  }

  const rawBody = await new Promise<string>((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += String(chunk);
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });

  if (!rawBody) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ ok: false, error: "Request body is required" }),
    );
    return;
  }

  let payload: z.infer<typeof invoiceRequestSchema>;
  try {
    payload = invoiceRequestSchema.parse(JSON.parse(rawBody));
  } catch {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: false,
        error: "Missing or invalid invoice request",
      }),
    );
    return;
  }

  const serviceRoleClient = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const verifier = new TelegramInitDataHmacVerifier({
    botToken: env.TELEGRAM_BOT_TOKEN,
    maxAgeSeconds: 300,
  });

  try {
    const telegramUser = await verifier.verify(payload.initData);
    const { data: account, error: accountError } = await serviceRoleClient
      .from("users")
      .select("id")
      .eq("telegram_user_id", Number(telegramUser.id))
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: false,
          error: "Telegram user not found in the House of Stars database",
        }),
      );
      return;
    }

    const invoiceLink = await createTelegramStarsInvoice({
      bot,
      userId: account.id,
      packId: payload.packId,
      stars: payload.stars,
      purpose: payload.purpose,
      orderId: payload.orderId,
      nonce: payload.nonce,
    });

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, invoiceLink }));
  } catch (error) {
    const description =
      error instanceof Error ? error.message : "Failed to create invoice";
    const statusCode =
      /^Telegram.*failed|invalid|missing|expired|signature/i.test(description)
        ? 401
        : 502;
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: description }));
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    response.end();
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (url.pathname === "/health" && request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: "ok",
        service: "bot",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  if (url.pathname === "/invoices") {
    void handleInvoiceRequest(request, response);
    return;
  }

  response.writeHead(404).end();
});

server.listen(env.BOT_PORT, () =>
  console.info(`Bot health server listening on ${env.BOT_PORT}`),
);
bot.start({
  onStart: async () => {
    if (telegramCanOpenMiniApp) {
      await bot.api.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Open app",
          web_app: { url: env.MINIAPP_URL },
        },
      });
      console.info("Telegram bot started; Mini App menu button configured");
      return;
    }
    console.warn(
      "Telegram bot started without a Mini App menu button: MINIAPP_URL must use public HTTPS",
    );
  },
});
const stopNotificationWorker = startNotificationWorker({
  bot,
  supabaseUrl: env.SUPABASE_URL,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  miniAppUrl: env.MINIAPP_URL,
});

function shutdown(): void {
  stopNotificationWorker();
  bot.stop();
  server.close(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
