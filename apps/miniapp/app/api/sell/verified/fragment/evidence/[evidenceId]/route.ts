import { type NextRequest, NextResponse } from "next/server";
import { getServerSessionContext } from "../../../../../../../lib/server-session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ evidenceId: string }> },
): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { evidenceId } = await context.params;
  const { data } = await supabase
    .from("order_evidence")
    .select("storage_bucket, storage_path")
    .eq("id", evidenceId)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (!data)
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  const { data: signed, error } = await supabase.storage
    .from(data.storage_bucket)
    .createSignedUrl(data.storage_path, 60);
  if (error || !signed)
    return NextResponse.json(
      { error: "Unable to create viewing link." },
      { status: 500 },
    );
  return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 });
}
