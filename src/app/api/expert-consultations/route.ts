import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { expertAskSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { notify } from "@/lib/notifications";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    rateLimit({ scope: "expert:ask", key: user.id, ...Rate.action });

    const body = expertAskSchema.parse(await readBody(req));
    const c = await prisma.cropHealthCase.findUnique({
      where: { id: body.caseId },
      select: { id: true, farmerId: true, crop: true, caseNo: true, problem: true },
    });
    if (!c) throw { status: 404, message: "Crop health case not found" };
    if (c.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You can only ask about your own cases" };
    }

    const consultation = await prisma.expertConsultation.create({
      data: {
        caseId: c.id,
        farmerId: user.id,
        question: body.question,
        context: `Case ${c.caseNo} — ${c.crop}: ${c.problem.slice(0, 400)}`,
        status: "SENT",
      },
    });

    await logAudit(user.id, "EXPERT_CONSULTATION_SENT", "ExpertConsultation", consultation.id, {
      caseNo: c.caseNo,
    });
    // Demo: no live expert backend — the request is stored and visible to the
    // admin who can answer from the admin panel.
    await notify({
      userId: user.id,
      type: "INFO",
      title: "Expert question sent",
      body: `Your question about ${c.crop} (case ${c.caseNo}) was sent to the AgriLink expert team. You'll be notified when they respond.`,
      link: "/lab-testing",
    });
    return ok({ consultation }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}