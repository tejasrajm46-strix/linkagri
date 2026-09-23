import { fail } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { fileExists, readBuffer } from "@/lib/storage";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Private report delivery. The file lives in `.uploads/` (outside public/)
 * and is ONLY served here after an ownership check — never by static
 * middleware. Admin may view any report; farmers only their own.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    rateLimit({ scope: "lab-reports:file", key: user.id, ...Rate.general });

    const report = await prisma.labReport.findUnique({
      where: { id },
      select: { id: true, farmerId: true, storedName: true, fileName: true, mimeType: true },
    });
    if (!report) throw { status: 404, message: "Report not found" };
    if (report.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You can only download your own lab reports" };
    }
    if (!fileExists("lab-reports", report.storedName)) {
      throw { status: 404, message: "Report file is not available (demo data has no physical file)." };
    }

    const data = readBuffer("lab-reports", report.storedName);
    const url = new URL(req.url);
    const asAttachment = url.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": report.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${encodeURIComponent(report.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}