import { fail, ok } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { analyzeCropHealth } from "@/lib/cropHealthAi";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { extractReportText } from "@/lib/reportText";
import { fileExists, readBuffer } from "@/lib/storage";
import { Role } from "@prisma/client";

const SNIPPET_MAX = 1500;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    rateLimit({ scope: "lab-reports:analyze", key: user.id, ...Rate.action });

    const report = await prisma.labReport.findUnique({
      where: { id },
      include: { testRequest: true, analysis: true },
    });
    if (!report) throw { status: 404, message: "Report not found" };
    if (report.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You can only analyze your own lab reports" };
    }

    // Read the actual file — the AI is grounded in real text, never invented.
    const extraction = fileExists("lab-reports", report.storedName)
      ? await extractReportText({
          data: readBuffer("lab-reports", report.storedName),
          mimeType: report.mimeType,
        })
      : { text: "", chars: 0, kind: "missing" as const };

    const description = [
      report.testRequest?.problemDescription,
      report.testRequest?.symptoms,
      report.notes,
      `Crop: ${report.crop}`,
    ]
      .filter(Boolean)
      .join(". ");

    const result = await analyzeCropHealth({
      crop: report.crop,
      testType: report.testType,
      description,
      extractedText: extraction.text || undefined,
      extractedFrom: extraction.kind,
    });

    const data = {
      reportId: report.id,
      summary: result.summary,
      abnormalFindings: result.abnormalFindings,
      possibleCauses: result.possibleCauses,
      cropImpact: result.cropImpact,
      recommendedActions: result.recommendedActions,
      prevention: result.prevention,
      treatmentCategories: result.treatmentCategories,
      confidence: result.confidence,
      confidenceReason: result.confidenceReason,
      expertReviewRecommended: result.expertReviewRecommended,
      expertNote: result.expertNote,
      extractedFrom: extraction.kind,
      extractedChars: extraction.chars,
      extractedTextSnippet: extraction.text ? extraction.text.slice(0, SNIPPET_MAX) : null,
      // Reflect the latest run, not just the first analysis.
      analysisTimestamp: new Date(),
    };

    // Re-analysis is always allowed — a clearer upload should replace the
    // previous (possibly metadata-only) analysis. Same row keeps the id, so
    // the crop-health case link stays valid. Upsert guards double-clicks.
    const analysis = await prisma.aIReportAnalysis.upsert({
      where: { reportId: report.id },
      update: data,
      create: data,
    });

    await prisma.labReport.update({
      where: { id: report.id },
      data: { status: "ANALYZED" },
    });

    // Link the case to the analysis + progress it.
    const cs = await prisma.cropHealthCase.findFirst({
      where: { farmerId: user.id, reportId: report.id },
    });
    if (cs) {
      await prisma.cropHealthCase.update({
        where: { id: cs.id },
        data: { aiAnalysisId: analysis.id, status: "IN_PROGRESS" },
      });
    }

    await logAudit(user.id, "LAB_REPORT_ANALYZED", "LabReport", report.id, {
      reportNo: report.reportNo,
      confidence: result.confidence,
      extractedChars: extraction.chars,
      extractedFrom: extraction.kind,
    });
    await notify({
      userId: user.id,
      type: "AI",
      title: "AI analysis ready",
      body:
        extraction.kind === "pdf-text"
          ? `AI read ${extraction.chars} characters from ${report.reportNo} (${report.testType} for ${report.crop}) — ${result.confidence} confidence. Verify with the lab before acting.`
          : `AI analyzed ${report.reportNo} (${report.testType} for ${report.crop}) — ${result.confidence} confidence. Verify with the lab before acting.`,
      link: "/lab-testing",
    });
    return ok({ analysis, reused: false }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}