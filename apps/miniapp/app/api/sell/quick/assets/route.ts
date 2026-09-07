import { type NextRequest, NextResponse } from "next/server";
import { getQuickSellConfig } from "../../../../../config/server";
import { getServerSessionContext } from "../../../../../lib/server-session";
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const config = getQuickSellConfig();
  return NextResponse.json({
    assets: config.payoutAssets.map(({ asset, network, category }) => ({
      asset,
      network,
      category,
    })),
  });
}
