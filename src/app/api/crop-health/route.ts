import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { nextCaseNo } from "@/lib/ids";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { z } from "zod";
import { idString } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

const createCaseSchema = z
  .object({
    requestId: idString,
    actionTaken: z.string().trim().max(1000).nullish(),
  })
  .strict();

const include = {
  request: { select: { id: true, requestNo: true, crop: true, problemDescription: true, symptoms: true, status: true } },
  report: { select: { id: true, reportNo: true, testType: true, reportDate: true, status: true } },
  aiAnalysis: true,
  consultations: { orderBy: { createdAt: "desc" as const } },
} as const;

export async function GET() {
  try {
    const user = await requireSession();
    const cases =
      user.role === Role.ADMIN
        ? await prisma.cropHealthCase.findMany({ include, orderBy: { updatedAt: "desc" } })
        : await prisma.cropHealthCase.findMany({
            where: { farmerId: user.id },
            include,
            orderBy: { updatedAt: "desc" },
          });
    return ok({ cases });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    rateLimit({ scope: "crop-health:create", key: user.id, ...Rate.action });

    const body = createCaseSchema.parse(await readBody(req));
    const request = await prisma.labTestRequest.findUnique({
      where: { id: body.requestId },
      select: { id: true, farmerId: true, crop: true, problemDescription: true },
    });
    if (!request) throw { status: 404, message: "Lab test request not found" };
    if (request.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You can only track your own lab requests" };
    }

    const existing = await prisma.cropHealthCase.findFirst({
      where: { farmerId: user.id, requestId: request.id },
    });
    if (existing) return ok({ case: existing });

    const c = await prisma.cropHealthCase.create({
      data: {
        caseNo: await nextCaseNo(),
        farmerId: user.id,
        requestId: request.id,
        crop: request.crop,
        problem: request.problemDescription.slice(0, 300),
        actionTaken: body.actionTaken ?? null,
        status: "OPEN",
      },
      include,
    });
    await logAudit(user.id, "CROP_HEALTH_CASE_OPENED", "CropHealthCase", c.id, { caseNo: c.caseNo });
    return ok({ case: c }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}