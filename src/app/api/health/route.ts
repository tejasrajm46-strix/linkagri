import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}