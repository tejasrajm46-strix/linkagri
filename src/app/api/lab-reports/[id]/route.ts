import { fail, ok } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { deleteFile } from "@/lib/storage";
import { Role } from "@prisma/client";

const include = {
  lab: { select: { id: true, name: true, location: true, phone: true, email: true, isVerified: true } },
  testRequest: { select: { id: true, requestNo: true, crop: true, problemDescription: true, symptoms: true } },
  lot: { select: { id: true, lotNo: true } },
  analysis: true,
  cases: { select: { id: true, caseNo: true, status: true } },
} as const;

async function getScoped(id: string, userId: string, role: Role) {
  const report = await prisma.labReport.findUnique({ where: { id }, include });
  if (!report) throw { status: 404, message: "Report not found" };
  if (report.farmerId !== userId && role !== Role.ADMIN) {
    throw { status: 403, message: "You can only access your own lab reports" };
  }
  return report;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    rateLimit({ scope: "lab-reports:get", key: user.id, ...Rate.general });
    const report = await getScoped(id, user.id, user.role);
    return ok({ report });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "lab-reports:delete", key: user.id, ...Rate.action });

    const report = await getScoped(id, user.id, user.role);

    // Cascade: analysis + case links reference the report — remove them first.
    await prisma.$transaction([
      prisma.aIReportAnalysis.deleteMany({ where: { reportId: report.id } }),
      prisma.cropHealthCase.deleteMany({ where: { reportId: report.id } }),
      prisma.labReport.delete({ where: { id: report.id } }),
    ]);
    deleteFile("lab-reports", report.storedName);

    await logAudit(user.id, "LAB_REPORT_DELETED", "LabReport", report.id, { reportNo: report.reportNo });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}