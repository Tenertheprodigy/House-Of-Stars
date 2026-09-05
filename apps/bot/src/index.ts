import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bot } from "grammy";
import { botEnvSchema } from "@house-of-stars/shared/server-env";
import { startNotificationWorker } from "./notification-worker";

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

const server = createServer((request, response) => {
  if (request.url === "/health" && request.method === "GET") {
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
