import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { labRequestPatchSchema } from "@/lib/schemas";
import { canTransition, LAB_REQUEST_FLOW, LAB_REQUEST_TRANSITIONS } from "@/lib/state";
import { Role } from "@prisma/client";

const include = {
  farmer: { select: { id: true, name: true } },
  preferredLab: { select: { id: true, name: true, location: true, phone: true, email: true } },
  lot: { select: { id: true, lotNo: true } },
  reports: { select: { id: true, reportNo: true, testType: true, status: true } },
  cases: { select: { id: true, caseNo: true } },
} as const;

async function getScoped(id: string, userId: string, role: Role) {
  const request = await prisma.labTestRequest.findUnique({ where: { id }, include });
  if (!request) throw { status: 404, message: "Lab test request not found" };
  if (request.farmerId !== userId && role !== Role.ADMIN) {
    throw { status: 403, message: "You can only access your own lab test requests" };
  }
  return request;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    rateLimit({ scope: "lab-tests:get", key: user.id, ...Rate.general });
    const request = await getScoped(id, user.id, user.role);
    return ok({ request });
  } catch (e) {
    return fail(e);
  }
}

const MILESTONE_LABEL: Record<string, string> = {
  REQUESTED: "submitted",
  LAB_ACCEPTED: "accepted by the lab",
  SAMPLE_SUBMITTED: "sample submitted",
  TESTING: "testing started",
  REPORT_READY: "report ready",
  COMPLETED: "completed",
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO, Role.ADMIN]);
    rateLimit({ scope: "lab-tests:update", key: user.id, ...Rate.action });

    const body = labRequestPatchSchema.parse(await readBody(req));
    const request = await getScoped(id, user.id, user.role);
    const from = request.status;
    const to = body.status;

    if (!canTransition(LAB_REQUEST_TRANSITIONS, from, to)) {
      throw { status: 409, message: `Cannot move a ${from} request to ${to}.` };
    }

    const isOwner = request.farmerId === user.id;
    if (user.role !== Role.ADMIN && isOwner) {
      // Owner: submit (DRAFT→REQUESTED) and cancel from open states.
      const ownerAllowed =
        (from === "DRAFT" && to === "REQUESTED") ||
        (to === "CANCELLED" && ["DRAFT", "REQUESTED", "LAB_ACCEPTED", "SAMPLE_SUBMITTED"].includes(from));
      // Demo mode: allow the farmer to simulate the lab's forward progression
      // (the demo has no lab user accounts). Production requires admin.
      const demoForward = isDemoMode() && LAB_REQUEST_FLOW.indexOf(to) > LAB_REQUEST_FLOW.indexOf(from) && from !== "DRAFT";
      if (!ownerAllowed && !demoForward) {
        throw { status: 403, message: "Only the lab (admin) can move the request past submission" };
      }
    }

    // Conditional update so two concurrent requests cannot double-advance.
    const updated = await prisma.labTestRequest.updateMany({
      where: { id: request.id, status: from },
      data: { status: to },
    });
    if (updated.count === 0) {
      throw { status: 409, message: "Request status changed since you loaded it — please refresh." };
    }

    await logAudit(user.id, "LAB_REQUEST_STATUS", "LabTestRequest", request.id, { from, to });
    if (MILESTONE_LABEL[to]) {
      await notify({
        userId: request.farmerId,
        type: "LAB",
        title: "Lab request update",
        body: `Your lab request ${request.requestNo} (${request.crop}) is now ${MILESTONE_LABEL[to]}.`,
        link: "/lab-testing",
      });
    }

    const refreshed = await prisma.labTestRequest.findUnique({ where: { id: request.id }, include });
    return ok({ request: refreshed });
  } catch (e) {
    return fail(e);
  }
}