import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/server";
import { createShopeeAuthorizationUrl } from "@/lib/shopee/oauth";
import { toSafeApiError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole("admin");
    const authorizationUrl = await createShopeeAuthorizationUrl(
      auth,
      request.nextUrl.searchParams.get("returnTo") ?? "/connections",
    );
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: safe.code }, { status: safe.status });
  }
}
