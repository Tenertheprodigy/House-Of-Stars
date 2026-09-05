import { z } from "zod";

export const quickSellOrderRequestSchema = z
  .object({
    quoteId: z.uuid(),
    walletAddress: z.string().min(1),
    networkConfirmed: z.literal(true),
  })
  .strict();
