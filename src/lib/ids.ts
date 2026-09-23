import { prisma } from "./db";

/** Next lot number like AG12510 — unique human-readable identifier. */
export async function nextLotNo(): Promise<string> {
  const latest = await prisma.lot.findFirst({
    orderBy: { lotNo: "desc" },
    select: { lotNo: true },
  });
  const start = 12452;
  const n = latest ? Math.max(start, parseInt(latest.lotNo.replace(/\D/g, ""), 10) + 1) : start + 1;
  return `AG${n}`;
}

export async function nextOfferNo(): Promise<string> {
  const latest = await prisma.offer.findFirst({ orderBy: { offerNo: "desc" } });
  const n = latest ? parseInt(latest.offerNo.replace(/\D/g, ""), 10) + 1 : 9021;
  return `OFF-${n}`;
}

export async function nextOrderNo(): Promise<string> {
  const latest = await prisma.order.findFirst({ orderBy: { orderNo: "desc" } });
  const n = latest ? parseInt(latest.orderNo.replace(/\D/g, ""), 10) + 1 : 1005;
  return `AG-${n}`;
}

export async function nextDisputeNo(): Promise<string> {
  const latest = await prisma.dispute.findFirst({ orderBy: { disputeNo: "desc" } });
  const n = latest ? parseInt(latest.disputeNo.replace(/\D/g, ""), 10) + 1 : 5003;
  return `DSP-${n}`;
}

export async function nextLabRequestNo(): Promise<string> {
  const latest = await prisma.labTestRequest.findFirst({ orderBy: { requestNo: "desc" } });
  const n = latest ? parseInt(latest.requestNo.replace(/\D/g, ""), 10) + 1 : 1001;
  return `LT-${n}`;
}

export async function nextReportNo(): Promise<string> {
  const latest = await prisma.labReport.findFirst({ orderBy: { reportNo: "desc" } });
  const n = latest ? parseInt(latest.reportNo.replace(/\D/g, ""), 10) + 1 : 1001;
  return `LR-${n}`;
}

export async function nextCaseNo(): Promise<string> {
  const latest = await prisma.cropHealthCase.findFirst({ orderBy: { caseNo: "desc" } });
  const n = latest ? parseInt(latest.caseNo.replace(/\D/g, ""), 10) + 1 : 1001;
  return `CH-${n}`;
}