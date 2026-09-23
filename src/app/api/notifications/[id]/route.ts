import { fail, ok } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    // updateMany scoped by userId — cross-user notification ids are a no-op.
    const res = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    if (res.count === 0) throw { status: 404, message: "Notification not found" };
    return ok({ read: true });
  } catch (e) {
    return fail(e);
  }
}