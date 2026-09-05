import { DefaultWalletAddressValidator } from "@house-of-stars/wallet-validation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickSellConfig } from "../../../../../config/server";
import { getServerSessionContext } from "../../../../../lib/server-session";
const schema = z
  .object({
    asset: z.string().min(1),
    network: z.string().min(1),
    address: z.string().min(1),
  })
  .strict();
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { status: "invalid", reason: "Enter a wallet address." },
      { status: 400 },
    );
  }
  const configured = getQuickSellConfig().payoutAssets.some(
    (item) => item.asset === body.asset && item.network === body.network,
  );
  if (!configured)
    return NextResponse.json(
      {
        status: "unsupported_network",
        reason: "This asset and network combination is not supported.",
      },
      { status: 400 },
    );
  return NextResponse.json(
    new DefaultWalletAddressValidator(
      getQuickSellConfig().payoutAssets,
    ).validateAddress(body),
  );
}
