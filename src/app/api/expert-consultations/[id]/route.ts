import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { expertAnswerSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    const c = await prisma.expertConsultation.findUnique({
      where: { id },
      include: { case: { select: { caseNo: true, crop: true } } },
    });
    if (!c) throw { status: 404, message: "Consultation not found" };
    if (c.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You can only access your own consultations" };
    }
    return ok({ consultation: c });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.ADMIN]);
    rateLimit({ scope: "expert:answer", key: user.id, ...Rate.admin });

    const body = expertAnswerSchema.parse(await readBody(req));
    const existing = await prisma.expertConsultation.findUnique({
      where: { id },
      select: { id: true, farmerId: true, status: true, caseId: true },
    });
    if (!existing) throw { status: 404, message: "Consultation not found" };
    if (existing.status === "ANSWERED") {
      throw { status: 409, message: "This consultation already has a response." };
    }

    const updated = await prisma.expertConsultation.update({
      where: { id: existing.id },
      data: { response: body.response, status: "ANSWERED", respondedAt: new Date() },
    });
    await logAudit(user.id, "EXPERT_CONSULTATION_ANSWERED", "ExpertConsultation", existing.id, {
      caseId: existing.caseId,
    });
    await notify({
      userId: existing.farmerId,
      type: "LAB",
      title: "Expert response received",
      body: "An agricultural expert has answered your question. View it in your crop health history.",
      link: "/lab-testing",
    });
    return ok({ consultation: updated });
  } catch (e) {
    return fail(e);
  }
}