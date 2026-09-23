import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { nextLabRequestNo } from "@/lib/ids";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { labRequestCreateSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { notify } from "@/lib/notifications";
import { Role } from "@prisma/client";

const include = {
  preferredLab: { select: { id: true, name: true, location: true, phone: true, email: true } },
  lot: { select: { id: true, lotNo: true } },
  reports: { select: { id: true, reportNo: true, testType: true, status: true } },
  cases: { select: { id: true, caseNo: true } },
} as const;

export async function GET() {
  try {
    const user = await requireSession();
    const requests =
      user.role === Role.ADMIN
        ? await prisma.labTestRequest.findMany({ include, orderBy: { createdAt: "desc" } })
        : await prisma.labTestRequest.findMany({
            where: { farmerId: user.id },
            include,
            orderBy: { createdAt: "desc" },
          });
    return ok({ requests });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    rateLimit({ scope: "lab-tests:create", key: user.id, ...Rate.action });

    const body = labRequestCreateSchema.parse(await readBody(req));

    // Ownership checks for optional linked resources — never trust a client ID.
    if (body.lotId) {
      const lot = await prisma.lot.findUnique({ where: { id: body.lotId }, select: { farmerId: true } });
      if (!lot) throw { status: 404, message: "Lot not found" };
      if (lot.farmerId !== user.id && user.role !== Role.ADMIN) {
        throw { status: 403, message: "You can only attach your own lots" };
      }
    }
    if (body.preferredLabId) {
      const lab = await prisma.lab.findUnique({ where: { id: body.preferredLabId }, select: { id: true } });
      if (!lab) throw { status: 400, message: "Selected laboratory does not exist" };
    }

    const requestNo = await nextLabRequestNo();
    const request = await prisma.labTestRequest.create({
      data: {
        requestNo,
        farmerId: user.id,
        crop: body.crop,
        variety: body.variety ?? null,
        lotId: body.lotId ?? null,
        location: body.location ?? null,
        problemCategory: body.problemCategory,
        problemDescription: body.problemDescription,
        symptoms: body.symptoms ?? null,
        dateNoticed: body.dateNoticed ? new Date(body.dateNoticed) : null,
        affectedAreaPct: body.affectedAreaPct ?? null,
        severity: body.severity ?? null,
        preferredLabId: body.preferredLabId ?? null,
        preferredDate: body.preferredDate ? new Date(body.preferredDate) : null,
        additionalNotes: body.additionalNotes ?? null,
        status: "REQUESTED",
      },
      include,
    });

    await logAudit(user.id, "LAB_REQUEST_SUBMITTED", "LabTestRequest", request.id, { requestNo, crop: body.crop });
    await notify({
      userId: user.id,
      type: "LAB",
      title: "Lab request submitted",
      body: `Lab test ${requestNo} (${body.crop} — ${body.problemCategory.replaceAll("_", " ").toLowerCase()}) sent${body.preferredLabId ? " to your chosen lab" : ""}.`,
      link: "/lab-testing",
    });
    return ok({ request }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}