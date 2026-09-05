import { z } from "zod";

export const verifiedSellSourceSchema = z.enum([
  "apple_google",
  "fragment_other",
  "gifts",
]);
export type VerifiedSellSource = z.infer<typeof verifiedSellSourceSchema>;
export const verifiedSellSourceDestinations: Record<
  VerifiedSellSource,
  string
> = {
  apple_google: "/sell/verified/apple-google",
  fragment_other: "/sell/verified/fragment",
  gifts: "/sell/verified/gifts",
};
export const verifiedSellSourceRequestSchema = z
  .object({ source: verifiedSellSourceSchema })
  .strict();
