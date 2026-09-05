import { z } from "zod";

export const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const botEnvSchema = serverEnvSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  MINIAPP_URL: z.url(),
  BOT_PORT: z.coerce.number().int().positive().default(3002),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;
