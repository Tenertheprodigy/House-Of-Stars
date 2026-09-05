import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "../../../../lib/admin-session";
const schema = z.object({
  page: z.coerce.number().int().positive().default(1),
  status: z.string().optional(),
  type: z.enum(["quick", "verified"]).optional(),
  source: z
    .enum(["apple_google", "fragment_other", "gifts", "unknown"])
    .optional(),
  asset: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  search: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9_:@.-]+$/)
    .optional(),
});
const PAGE_SIZE = 20;
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { admin, supabase } = await getAuthorizedAdmin(request);
  if (!admin)
    return NextResponse.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const parsed = schema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid filters." }, { status: 400 });
  const filters = parsed.data;
  let userIds: string[] = [];
  if (filters.search) {
    let users = supabase.from("users").select("id");
    if (/^\d+$/.test(filters.search))
      users = users.eq("telegram_user_id", filters.search);
    else
      users = users.ilike("username", `%${filters.search.replace(/^@/, "")}%`);
    const { data } = await users.limit(100);
    userIds = (data ?? []).map((user) => user.id);
  }
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, user_id, type, source, stars_amount, payout_asset, expected_payout_amount, status, created_at, users!orders_user_id_fkey(telegram_user_id, username, first_name, last_name)",
      { count: "exact" },
    );
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.asset) query = query.eq("payout_asset", filters.asset);
  if (filters.from)
    query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lt("created_at", `${filters.to}T00:00:00.000Z`);
  if (filters.search) {
    const clauses: string[] = [`wallet_address.ilike.%${filters.search}%`];
    if (/^\d+$/.test(filters.search))
      clauses.push(`order_number.eq.${filters.search}`);
    if (userIds.length) clauses.push(`user_id.in.(${userIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("Admin orders query failed", error.code);
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    orders: data ?? [],
    pagination: {
      page: filters.page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    },
  });
}
