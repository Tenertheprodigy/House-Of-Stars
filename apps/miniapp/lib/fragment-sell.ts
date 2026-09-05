import { z } from "zod";

export const fragmentDetailsSchema = z
  .object({
    starsAmount: z.number().int().positive(),
    payoutAsset: z.string().min(1),
    walletAddress: z.string().min(1),
    networkConfirmed: z.literal(true),
  })
  .strict();

export const evidenceTypeSchema = z.enum([
  "stars_transaction_history",
  "purchase_receipt",
  "gift_history",
  "gift_details",
  "telegram_confirmation",
  "other",
]);
export const acceptedEvidenceMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_EVIDENCE_FILE_SIZE = 8 * 1024 * 1024;
