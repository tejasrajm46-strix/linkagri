import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { LabTestingClient } from "@/components/lab/LabTestingClient";
import { isDemoMode } from "@/lib/env";
import { Role } from "@prisma/client";

export const metadata = { title: "Lab Testing & Crop Health" };
export const dynamic = "force-dynamic";

const labSelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  address: true,
  distanceKm: true,
  services: true,
  supportedCrops: true,
  testTypes: true,
  phone: true,
  email: true,
  website: true,
  operatingHours: true,
  accreditation: true,
  isVerified: true,
  rating: true,
  approxPrice: true,
  turnaroundDays: true,
} as const;

export default async function LabTestingPage() {
  const user = await requireSession();
  const isAdmin = user.role === Role.ADMIN;
  const farmerView = user.role === Role.FARMER || user.role === Role.FPO;

  // Server-side scoping — never rely on the client for authorization.
  const [labs, requests, reports, cases, myLots] = await Promise.all([
    prisma.lab.findMany({ select: labSelect, orderBy: [{ isVerified: "desc" }, { distanceKm: "asc" }] }),
    farmerView || isAdmin
      ? prisma.labTestRequest.findMany({
          where: isAdmin ? {} : { farmerId: user.id },
          include: {
            preferredLab: { select: { id: true, name: true, location: true, phone: true, email: true } },
            lot: { select: { id: true, lotNo: true } },
            reports: { select: { id: true, reportNo: true, testType: true, status: true } },
            cases: { select: { id: true, caseNo: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    farmerView || isAdmin
      ? prisma.labReport.findMany({
          where: isAdmin ? {} : { farmerId: user.id },
          include: {
            lab: { select: { id: true, name: true, location: true, phone: true, email: true, isVerified: true } },
            testRequest: { select: { id: true, requestNo: true, problemDescription: true, symptoms: true } },
            lot: { select: { id: true, lotNo: true } },
            analysis: true,
            cases: { select: { id: true, caseNo: true, status: true } },
          },
          orderBy: { uploadedAt: "desc" },
        })
      : [],
    farmerView || isAdmin
      ? prisma.cropHealthCase.findMany({
          where: isAdmin ? {} : { farmerId: user.id },
          include: {
            request: { select: { id: true, requestNo: true, status: true } },
            report: { select: { id: true, reportNo: true, testType: true, status: true } },
            aiAnalysis: true,
            consultations: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : [],
    farmerView
      ? prisma.lot.findMany({
          where: { farmerId: user.id },
          select: { id: true, lotNo: true, crop: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
  ]);

  return (
    <>
      <PageHeader
        title="🧪 Lab Testing & Crop Health"
        subtitle="Report a crop problem, find a lab, upload the lab report, and let AI explain it — safely, with expert verification."
      />
      <LabTestingClient
        role={user.role}
        userId={user.id}
        isAdmin={isAdmin}
        isDemo={isDemoMode()}
        requests={requests}
        reports={reports}
        cases={cases}
        labs={labs}
        myLots={myLots}
      />
    </>
  );
}