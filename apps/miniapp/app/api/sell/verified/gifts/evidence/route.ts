import { createHash, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  acceptedEvidenceMimeTypes,
  evidenceTypeSchema,
  MAX_EVIDENCE_FILE_SIZE,
} from "../../../../../../lib/fragment-sell";
import { getServerSessionContext } from "../../../../../../lib/server-session";
import { hasExpectedImageSignature } from "../../../../../../lib/evidence-file";
const giftTypes = new Set([
  "gift_history",
  "gift_details",
  "telegram_confirmation",
  "other",
]);
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const form = await request.formData();
  const file = form.get("file");
  const type = evidenceTypeSchema.safeParse(form.get("evidenceType"));
  if (
    !(file instanceof File) ||
    !type.success ||
    !giftTypes.has(type.data) ||
    !(acceptedEvidenceMimeTypes as readonly string[]).includes(file.type) ||
    file.size <= 0 ||
    file.size > MAX_EVIDENCE_FILE_SIZE
  )
    return NextResponse.json(
      { error: "Use a JPEG, PNG, or WebP image up to 8 MB." },
      { status: 400 },
    );
  const { data: state } = await supabase
    .from("sell_sessions")
    .select("order_id")
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .maybeSingle();
  if (!state?.order_id)
    return NextResponse.json({ error: "Draft unavailable." }, { status: 404 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedImageSignature(bytes, file.type))
    return NextResponse.json(
      { error: "File content does not match its declared image format." },
      { status: 400 },
    );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${session.sub}/${state.order_id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("user-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError)
    return NextResponse.json(
      { error: "Evidence upload failed." },
      { status: 500 },
    );
  const { data, error } = await supabase
    .from("order_evidence")
    .insert({
      order_id: state.order_id,
      user_id: session.sub,
      storage_path: path,
      evidence_type: type.data,
      sha256,
      mime_type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    })
    .select("id, evidence_type, mime_type, size, uploaded_at")
    .single();
  if (error) {
    await supabase.storage.from("user-assets").remove([path]);
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "This file was already uploaded."
            : "Unable to record evidence.",
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ evidence: data }, { status: 201 });
}
