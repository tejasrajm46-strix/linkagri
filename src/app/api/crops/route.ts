import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";

export async function GET() {
  try {
    await requireSession();
    const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
    return ok({ crops });
  } catch (e) {
    return fail(e);
  }
}