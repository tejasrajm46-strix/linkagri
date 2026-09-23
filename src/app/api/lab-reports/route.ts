import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { nextReportNo, nextCaseNo } from "@/lib/ids";
import { ok, fail } from "@/lib/apiHelpers";
import { labReportMetaSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { validateUpload } from "@/lib/uploads";
import { saveBuffer, newStoredName } from "@/lib/storage";
import { notify } from "@/lib/notifications";
import { Role } from "@prisma/client";

const include = {
  lab: { select: { id: true, name: true, location: true, phone: true, email: true, isVerified: true } },
  testRequest: { select: { id: true, requestNo: true, crop: true, problemDescription: true, symptoms: true } },
  lot: { select: { id: true, lotNo: true } },
  analysis: true,
  cases: { select: { id: true, caseNo: true, status: true } },
} as const;

export async function GET() {
  try {
    const user = await requireSession();
    const reports =
      user.role === Role.ADMIN
        ? await prisma.labReport.findMany({ include, orderBy: { uploadedAt: "desc" } })
        : await prisma.labReport.findMany({
            where: { farmerId: user.id },
            include,
            orderBy: { uploadedAt: "desc" },
          });
    return ok({ reports });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    rateLimit({ scope: "lab-reports:upload", key: user.id, ...Rate.action });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw { status: 400, message: "Invalid upload — send a multipart form with a file." };
    }

    const metaRaw = form.get("meta");
    if (typeof metaRaw !== "string" || !metaRaw.trim()) {
      throw { status: 400, message: "Missing report details (meta field)." };
    }
    let metaJson: unknown;
    try {
      metaJson = JSON.parse(metaRaw);
    } catch {
      throw { status: 400, message: "Report details are not valid JSON." };
    }
    const meta = labReportMetaSchema.parse(metaJson);

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw { status: 400, message: "Missing file — please attach the report (PDF, JPG or PNG)." };
    }

    // Ownership of linked resources — never trust client-supplied IDs.
    if (meta.testRequestId) {
      const tr = await prisma.labTestRequest.findUnique({
        where: { id: meta.testRequestId },
        select: { farmerId: true },
      });
      if (!tr) throw { status: 404, message: "Lab test request not found" };
      if (tr.farmerId !== user.id) throw { status: 403, message: "You can only attach your own lab requests" };
    }
    if (meta.lotId) {
      const lot = await prisma.lot.findUnique({ where: { id: meta.lotId }, select: { farmerId: true } });
      if (!lot) throw { status: 404, message: "Lot not found" };
      if (lot.farmerId !== user.id) throw { status: 403, message: "You can only attach your own lots" };
    }
    if (meta.labId) {
      const lab = await prisma.lab.findUnique({ where: { id: meta.labId }, select: { id: true } });
      if (!lab) throw { status: 400, message: "Laboratory does not exist" };
    }

    // Server-side file validation (magic bytes + size) — client checks unused.
    const data = Buffer.from(await file.arrayBuffer());
    const validated = validateUpload({ name: file.name, type: file.type, size: file.size, data });

    const storedName = newStoredName("lab-reports", validated.ext);
    saveBuffer("lab-reports", storedName, validated.data);

    const reportNo = await nextReportNo();
    const report = await prisma.labReport.create({
      data: {
        reportNo,
        farmerId: user.id,
        testRequestId: meta.testRequestId ?? null,
        labId: meta.labId ?? null,
        lotId: meta.lotId ?? null,
        crop: meta.crop,
        testType: meta.testType,
        reportDate: meta.reportDate ? new Date(meta.reportDate) : null,
        fileName: file.name.slice(0, 200),
        storedName,
        mimeType: validated.mime,
        fileSize: validated.size,
        status: "UPLOADED",
        notes: meta.notes ?? null,
      },
      include,
    });

    // Auto-create a crop-health case so the farmer's history starts here.
    const existingCase = await prisma.cropHealthCase.findFirst({
      where: { farmerId: user.id, reportId: report.id },
    });
    if (!existingCase) {
      const tr = report.testRequest;
      await prisma.cropHealthCase.create({
        data: {
          caseNo: await nextCaseNo(),
          farmerId: user.id,
          requestId: tr ? tr.id : null,
          reportId: report.id,
          crop: report.crop,
          problem:
            tr?.problemDescription?.slice(0, 300) ??
            `Lab report ${report.testType.toLowerCase()} for ${report.crop}`,
          labName: report.lab?.name ?? null,
          testType: report.testType,
          status: "OPEN",
        },
      });
    }

    await logAudit(user.id, "LAB_REPORT_UPLOADED", "LabReport", report.id, {
      reportNo,
      testType: meta.testType,
      size: validated.size,
    });
    await notify({
      userId: user.id,
      type: "LAB",
      title: "Lab report uploaded",
      body: `${report.testType} report ${reportNo} for ${report.crop} is saved and private to your account. You can analyze it with AI.`,
      link: "/lab-testing",
    });
    return ok({ report }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}