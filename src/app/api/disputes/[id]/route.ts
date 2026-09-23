import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { disputePatchSchema } from "@/lib/schemas";
import { DISPUTE_TRANSITIONS } from "@/lib/state";
import { Role } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.ADMIN]);
    rateLimit({ scope: "disputes:admin", key: user.id, ...Rate.admin });

    const body = disputePatchSchema.parse(await readBody(req));
    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw { status: 404, message: "Dispute not found" };

    const data: Record<string, unknown> = {};
    if (body.status && body.status !== dispute.status) {
      if (!DISPUTE_TRANSITIONS[dispute.status]?.includes(body.status)) {
        throw {
          status: 400,
          message: `Cannot move dispute from ${dispute.status} to ${body.status}`,
        };
      }
      data.status = body.status;
    }
    if (body.resolution !== undefined && body.resolution !== null) {
      data.resolution = body.resolution;
    }
    if (body.evidence) data.evidence = body.evidence;
    if (Object.keys(data).length === 0) {
      throw { status: 400, message: "Nothing to update" };
    }

    // Conditional: only the state we validated may be transitioned.
    const updatedRes = await prisma.dispute.updateMany({
      where: { id: dispute.id, ...(data.status ? { status: dispute.status } : {}) },
      data,
    });
    if (updatedRes.count === 0) {
      throw { status: 409, message: "This dispute changed state — refresh and retry" };
    }
    const updated = { ...dispute, ...data };

    await notify({
      userId: dispute.raisedById,
      type: "DISPUTE",
      title: `Dispute ${String(data.status ?? dispute.status).replaceAll("_", " ")}`,
      body: `Your grievance ${dispute.disputeNo} is now ${String(data.status ?? dispute.status).replaceAll("_", " ").toLowerCase()}${data.resolution ? `: ${data.resolution}` : ""}.`,
      link: "/disputes",
    });
    await logAudit(user.id, "DISPUTE_UPDATED", "Dispute", dispute.id, {
      disputeNo: dispute.disputeNo,
      ...data,
    });
    return ok({ dispute: updated });
  } catch (e) {
    return fail(e);
  }
}
