import { NextResponse } from "next/server";

import { getAdminPrismaClient } from "@/lib/db/admin-prisma";
import { getCheckoutPrismaClient } from "@/lib/db/checkout-prisma";
import { getPrismaClient } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "no-store",
} as const;

export async function GET() {
  try {
    await Promise.all([
      getPrismaClient().$queryRaw`SELECT 1`,
      getCheckoutPrismaClient().$queryRaw`SELECT 1`,
      getAdminPrismaClient().$queryRaw`SELECT 1`,
    ]);

    return NextResponse.json(
      { status: "ready" },
      { headers: responseHeaders },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: responseHeaders },
    );
  }
}
