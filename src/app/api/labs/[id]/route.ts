import { fail, ok } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    rateLimit({ scope: "labs:get", key: user.id, ...Rate.general });
    const lab = await prisma.lab.findUnique({
      where: { id },
      include: { requests: { take: 0 }, reports: { take: 0 } },
    });
    if (!lab) throw { status: 404, message: "Lab not found" };
    return ok({ lab });
  } catch (e) {
    return fail(e);
  }
}