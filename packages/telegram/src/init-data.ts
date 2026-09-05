import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { TelegramIdentity, TelegramInitDataVerifier } from "./index.js";

const telegramUserSchema = z.object({
  id: z.number().int().positive().safe(),
  username: z.string().min(1).optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1).optional(),
  photo_url: z.url().optional(),
});

export class TelegramInitDataError extends Error {
  constructor(
    message: string,
    readonly code: "missing" | "malformed" | "invalid_signature" | "expired",
  ) {
    super(message);
    this.name = "TelegramInitDataError";
  }
}

export interface TelegramInitDataVerifierOptions {
  botToken: string;
  maxAgeSeconds?: number;
  futureSkewSeconds?: number;
  now?: () => Date;
}

export class TelegramInitDataHmacVerifier implements TelegramInitDataVerifier {
  private readonly maxAgeSeconds: number;
  private readonly futureSkewSeconds: number;
  private readonly now: () => Date;

  constructor(private readonly options: TelegramInitDataVerifierOptions) {
    if (!options.botToken) throw new Error("Telegram bot token is required");
    this.maxAgeSeconds = options.maxAgeSeconds ?? 300;
    this.futureSkewSeconds = options.futureSkewSeconds ?? 30;
    this.now = options.now ?? (() => new Date());
  }

  async verify(initData: string): Promise<TelegramIdentity> {
    if (!initData)
      throw new TelegramInitDataError(
        "Telegram init data is missing",
        "missing",
      );

    const parameters = new URLSearchParams(initData);
    const seen = new Set<string>();
    for (const [key] of parameters) {
      if (seen.has(key))
        throw new TelegramInitDataError(
          "Duplicate init data field",
          "malformed",
        );
      seen.add(key);
    }

    const receivedHash = parameters.get("hash");
    const authDateValue = parameters.get("auth_date");
    const userValue = parameters.get("user");
    if (
      !receivedHash ||
      !authDateValue ||
      !userValue ||
      !/^[a-f\d]{64}$/i.test(receivedHash)
    ) {
      throw new TelegramInitDataError(
        "Telegram init data is malformed",
        "malformed",
      );
    }

    const dataCheckString = [...parameters.entries()]
      .filter(([key]) => key !== "hash")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData")
      .update(this.options.botToken)
      .digest();
    const expectedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest();
    const suppliedHash = Buffer.from(receivedHash, "hex");
    if (
      suppliedHash.length !== expectedHash.length ||
      !timingSafeEqual(suppliedHash, expectedHash)
    ) {
      throw new TelegramInitDataError(
        "Telegram init data signature is invalid",
        "invalid_signature",
      );
    }

    const authDate = Number(authDateValue);
    if (!Number.isSafeInteger(authDate) || authDate <= 0) {
      throw new TelegramInitDataError(
        "Telegram auth date is malformed",
        "malformed",
      );
    }
    const ageSeconds = Math.floor(this.now().getTime() / 1000) - authDate;
    if (
      ageSeconds > this.maxAgeSeconds ||
      ageSeconds < -this.futureSkewSeconds
    ) {
      throw new TelegramInitDataError(
        "Telegram init data has expired",
        "expired",
      );
    }

    let user: z.infer<typeof telegramUserSchema>;
    try {
      user = telegramUserSchema.parse(JSON.parse(userValue));
    } catch {
      throw new TelegramInitDataError(
        "Telegram user data is malformed",
        "malformed",
      );
    }

    return {
      id: String(user.id),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      photoUrl: user.photo_url,
    };
  }
}
