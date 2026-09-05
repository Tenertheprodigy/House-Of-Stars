import { z } from "zod";
export {
  TelegramInitDataError,
  TelegramInitDataHmacVerifier,
} from "./init-data";

export const telegramIdentitySchema = z.object({
  id: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  photoUrl: z.url().optional(),
});
export type TelegramIdentity = z.infer<typeof telegramIdentitySchema>;

export interface TelegramInitDataVerifier {
  verify(initData: string): Promise<TelegramIdentity>;
}

export interface TelegramNotifier {
  sendMessage(chatId: string, text: string): Promise<void>;
}

export type StarsBalanceResult =
  | { readonly status: "available"; readonly balance: number }
  | { readonly status: "unavailable" };

export interface StarsBalanceProvider {
  getBalance(userId: string): Promise<StarsBalanceResult>;
}
