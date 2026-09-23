"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, Badge, EmptyState, Modal, KpiCard, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fullDate } from "@/lib/format";
import { statusLabel, statusColor } from "@/lib/nav";
import { LAB_REQUEST_FLOW } from "@/lib/state";
import { Role } from "@prisma/client";

type Lab = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  distanceKm: number;
  services: string[];
  supportedCrops: string[];
  testTypes: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  operatingHours: string | null;
  accreditation: string | null;
  isVerified: boolean;
  rating: number;
  approxPrice: number | null;
  turnaroundDays: number | null;
};

type TestRequest = {
  id: string;
  requestNo: string;
  crop: string;
  variety: string | null;
  location: string | null;
  problemCategory: string;
  problemDescription: string;
  symptoms: string | null;
  dateNoticed: string | Date | null;
  affectedAreaPct: number | null;
  severity: string | null;
  status: string;
  createdAt: string | Date;
  preferredLab: Pick<Lab, "id" | "name" | "location" | "phone" | "email"> | null;
  lot: { id: string; lotNo: string } | null;
  reports: { id: string; reportNo: string; testType: string; status: string }[];
  cases: { id: string; caseNo: string }[];
};

type Analysis = {
  id: string;
  summary: string;
  abnormalFindings: string[];
  possibleCauses: string[];
  cropImpact: string;
  recommendedActions: string[];
  prevention: string;
  treatmentCategories: string[];
  confidence: string;
  confidenceReason: string;
  expertReviewRecommended: boolean;
  expertNote: string | null;
  model: string;
  analysisTimestamp: string | Date;
  extractedFrom: string;
  extractedChars: number;
  extractedTextSnippet: string | null;
};

type Report = {
  id: string;
  reportNo: string;
  crop: string;
  testType: string;
  reportDate: string | Date | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  notes: string | null;
  uploadedAt: string | Date;
  lab: Pick<Lab, "id" | "name" | "location" | "phone" | "email" | "isVerified"> | null;
  testRequest: { id: string; requestNo: string; problemDescription: string | null; symptoms: string | null } | null;
  analysis: Analysis | null;
  cases: { id: string; caseNo: string; status: string }[];
};

type CaseItem = {
  id: string;
  caseNo: string;
  crop: string;
  problem: string;
  labName: string | null;
  testType: string | null;
  actionTaken: string | null;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  request: { id: string; requestNo: string; status: string } | null;
  report: { id: string; reportNo: string; testType: string; status: string } | null;
  aiAnalysis: Analysis | null;
  consultations: { id: string; question: string; status: string; response: string | null; respondedAt: string | Date | null }[];
};

type Lot = { id: string; lotNo: string; crop: { name: string } };

type Props = {
  role: Role;
  userId: string;
  isAdmin: boolean;
  isDemo: boolean;
  requests: TestRequest[];
  reports: Report[];
  cases: CaseItem[];
  labs: Lab[];
  myLots: Lot[];
};

const PROBLEM_CATEGORIES = [
  "PEST",
  "DISEASE",
  "SOIL",
  "WATER",
  "NUTRIENT_DEFICIENCY",
  "CROP_QUALITY",
  "UNKNOWN",
  "OTHER",
];

const TERMINAL = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);
const OPEN_STATUSES = new Set(["REQUESTED", "LAB_ACCEPTED", "SAMPLE_SUBMITTED", "TESTING", "REPORT_READY"]);

export function LabTestingClient(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "requests" | "reports" | "history">("overview");
  const [showRequest, setShowRequest] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showLabs, setShowLabs] = useState(false);
  const [askCaseId, setAskCaseId] = useState<string | null>(null);
  const [prefillLabId, setPrefillLabId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 5000);
  };

  const refresh = () => router.refresh();

  const farmerView = props.role === Role.FARMER || props.role === Role.FPO;

  const active = props.requests.filter((r) => OPEN_STATUSES.has(r.status)).length;
  const completed = props.reports.filter((r) => r.status === "ANALYZED" || r.status === "SHARED").length;

  const doAction = useCallback(async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init);
    let j: { ok?: boolean; message?: string } = {};
    try {
      j = (await r.json()) as typeof j;
    } catch {
      // ignore
    }
    if (!r.ok) throw new Error(j.message ?? "Request failed");
    return j;
  }, []);

  // ── Modals ──────────────────────────────────────────────────────────────

  return (
    <>
      {props.isDemo ? (
        <p className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <b>DEMO MODE</b> — Labs, reports and analyses shown here are synthetic demo data for the SIH
          presentation. They are not real laboratory results.
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{notice}</p>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard icon="lab" label="My Test Requests" value={props.requests.length} sub="total requests" accent />
        <KpiCard icon="flask" label="Active Lab Tests" value={active} sub="awaiting report" />
        <KpiCard icon="doc" label="Completed Reports" value={completed} sub="analyzed" />
        <KpiCard icon="microscope" label="AI Analyses" value={props.reports.filter((r) => r.analysis).length} sub="ready to review" />
      </div>

      {farmerView ? (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setShowRequest(true)} className="btn-primary">
            + Request Lab Test
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary !bg-card !text-brand-700 border border-brand-200">
            Upload Lab Report
          </button>
          <button onClick={() => setShowLabs(true)} className="btn-ghost">Find a Lab</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setShowLabs(true)} className="btn-primary">Browse Labs Directory</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {(
          [
            ["overview", "Overview"],
            ...(farmerView ? [["requests", "My Requests"] as const] : []),
            ...(farmerView ? [["reports", "My Reports"] as const] : []),
            ...(farmerView ? [["history", "Crop Health"] as const] : []),
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === k ? "bg-brand-600 text-white" : "bg-line/[0.06] text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewTab
          {...props}
          farmerView={farmerView}
          active={active}
          completed={completed}
          onShowRequest={() => setShowRequest(true)}
          onShowUpload={() => setShowUpload(true)}
          onShowLabs={() => setShowLabs(true)}
          onAskExpert={(caseId) => setAskCaseId(caseId)}
          expandedAnalysis={expandedAnalysis}
          onToggleAnalysis={(id) => setExpandedAnalysis(expandedAnalysis === id ? null : id)}
          busy={busy}
          onBusy={setBusy}
          onRefresh={refresh}
          onFlash={flash}
          doAction={doAction}
        />
      ) : null}
      {tab === "requests" ? (
        <RequestsTab
          requests={props.requests}
          isAdmin={props.isAdmin}
          isDemo={props.isDemo}
          busy={busy}
          onBusy={setBusy}
          onRefresh={refresh}
          onFlash={flash}
          doAction={doAction}
        />
      ) : null}
      {tab === "reports" ? (
        <ReportsTab
          reports={props.reports}
          isAdmin={props.isAdmin}
          onAskExpert={(caseId) => setAskCaseId(caseId)}
          onUpload={() => setShowUpload(true)}
          expandedAnalysis={expandedAnalysis}
          onToggleAnalysis={(id) => setExpandedAnalysis(expandedAnalysis === id ? null : id)}
          busy={busy}
          onBusy={setBusy}
          onRefresh={refresh}
          onFlash={flash}
          doAction={doAction}
        />
      ) : null}
      {tab === "history" ? (
        <HistoryTab
          cases={props.cases}
          isAdmin={props.isAdmin}
          onAskExpert={(caseId) => setAskCaseId(caseId)}
          expandedAnalysis={expandedAnalysis}
          onToggleAnalysis={(id) => setExpandedAnalysis(expandedAnalysis === id ? null : id)}
          busy={busy}
          onBusy={setBusy}
          onRefresh={refresh}
          onFlash={flash}
          doAction={doAction}
        />
      ) : null}

      {/* Modals */}
      {farmerView && showRequest ? (
        <RequestModal
          labs={props.labs}
          myLots={props.myLots}
          prefillLabId={prefillLabId ?? undefined}
          busy={busy}
          onBusy={setBusy}
          onClose={() => {
            setShowRequest(false);
            setPrefillLabId(null);
          }}
          onDone={async (reqNo) => {
            setShowRequest(false);
            setPrefillLabId(null);
            await refresh();
            flash(`Lab request ${reqNo} submitted — the lab will review it.`);
          }}
          doAction={doAction}
        />
      ) : null}
      {farmerView && showUpload ? (
        <UploadModal
          labs={props.labs}
          requests={props.requests}
          myLots={props.myLots}
          busy={busy}
          onBusy={setBusy}
          onClose={() => setShowUpload(false)}
          onDone={async (reportNo) => {
            setShowUpload(false);
            await refresh();
            flash(`Report ${reportNo} uploaded — stored privately on your account.`);
          }}
          doAction={doAction}
        />
      ) : null}
      {showLabs ? (
        <LabsModal
          labs={props.labs}
          farmerView={farmerView}
          onClose={() => setShowLabs(false)}
          onRequestTest={(labId) => {
            setShowLabs(false);
            setPrefillLabId(labId);
            setShowRequest(true);
          }}
        />
      ) : null}
      {farmerView && askCaseId ? (
        <AskExpertModal
          caseId={askCaseId}
          cases={props.cases}
          busy={busy}
          onBusy={setBusy}
          onClose={() => setAskCaseId(null)}
          onDone={async () => {
            setAskCaseId(null);
            await refresh();
            flash("Question sent to the AgriLink expert team.");
          }}
          doAction={doAction}
        />
      ) : null}
    </>
  );
}

function StepTimeline({ status }: { status: string }) {
  const idx = LAB_REQUEST_FLOW.indexOf(status);
  const isTerminal = TERMINAL.has(status);
  return (
    <ol className="flex items-center gap-1 flex-wrap">
      {LAB_REQUEST_FLOW.filter((s) => s !== "DRAFT").map((s, i) => {
        const done = idx >= i;
        const current = idx === i;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 ? <span className="text-ink-faint text-xs mx-0.5">→</span> : null}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                current
                  ? "bg-brand-600 text-white"
                  : done
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-line/[0.06] text-ink-faint"
              }`}
            >
              {done && !current ? "✓" : current ? "●" : "○"} {statusLabel(s)}
            </span>
          </li>
        );
      })}
      {isTerminal ? (
        <li className="flex items-center gap-1">
          <span className="text-ink-faint text-xs mx-0.5">→</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {statusLabel(status)}
          </span>
        </li>
      ) : null}
    </ol>
  );
}

function OverviewTab(props: Props & {
  farmerView: boolean;
  active: number;
  completed: number;
  onShowRequest: () => void;
  onShowUpload: () => void;
  onShowLabs: () => void;
  onAskExpert: (caseId: string) => void;
  expandedAnalysis: string | null;
  onToggleAnalysis: (id: string) => void;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onRefresh: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const latestRequest = props.requests[0];
  const latestReport = props.reports.find((r) => r.analysis) ?? props.reports[0];
  const latestCase = props.cases[0];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Icon name="lab" className="w-4 h-4 text-brand-700" /> Latest Lab Request
            </h3>
            <Badge status={latestRequest?.status ?? "DRAFT"}>{latestRequest?.status ?? "None"}</Badge>
          </div>
          {latestRequest ? (
            <div>
              <p className="font-semibold">{latestRequest.crop} — {latestRequest.problemCategory.replaceAll("_", " ").toLowerCase()}</p>
              <p className="text-sm text-ink-muted mt-1 line-clamp-2">{latestRequest.problemDescription}</p>
              <p className="text-xs text-ink-faint mt-2">
                {latestRequest.requestNo} · {latestRequest.preferredLab ? latestRequest.preferredLab.name : "no lab chosen"} · {fullDate(latestRequest.createdAt)}
              </p>
              <div className="mt-3">
                <StepTimeline status={latestRequest.status} />
              </div>
            </div>
          ) : (
            <EmptyState icon="lab" title="No lab requests yet" body="Report a crop problem and a testing lab can help you find the cause." />
          )}
        </Card>

        <Card className="card-pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Icon name="microscope" className="w-4 h-4 text-brand-700" /> Latest AI Analysis
            </h3>
            {latestReport?.analysis ? <Badge status={latestReport.analysis.confidence}>{latestReport.analysis.confidence} confidence</Badge> : null}
          </div>
          {latestReport?.analysis ? (
            <div>
              <p className="text-sm text-ink">{latestReport.analysis.summary.slice(0, 220)}…</p>
              <p className="text-xs text-ink-faint mt-2">
                {latestReport.crop} · {latestReport.testType} · {fullDate(latestReport.analysis.analysisTimestamp)}
              </p>
              <button
                className="mt-3 text-sm font-semibold text-brand-700"
                onClick={() => props.onToggleAnalysis(latestReport.id)}
              >
                {props.expandedAnalysis === latestReport.id ? "Hide details" : "View full analysis →"}
              </button>
              {props.expandedAnalysis === latestReport.id ? (
                <div className="mt-3">
                  <AnalysisView analysis={latestReport.analysis} isDemo />
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState icon="microscope" title="No AI analysis yet" body="Upload a lab report and click 'Analyze with AI' to get a structured, safety-checked interpretation." />
          )}
        </Card>
      </div>

      {props.farmerView ? (
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Icon name="leaf" className="w-4 h-4 text-brand-700" /> Recent Crop Health Cases
            </h3>
            <span className="badge bg-line/[0.06] text-ink-muted">{props.cases.length} case{props.cases.length === 1 ? "" : "s"}</span>
          </div>
          {props.cases.length === 0 ? (
            <EmptyState icon="leaf" title="No crop health history" body="Once you request lab tests or upload reports, your crop health history builds up here." />
          ) : (
            <div className="space-y-3">
              {props.cases.slice(0, 3).map((c) => (
                <CaseCard
                  key={c.id}
                  c={c}
                  isAdmin={props.isAdmin}
                  onAskExpert={props.onAskExpert}
                  expandedAnalysis={props.expandedAnalysis}
                  onToggleAnalysis={props.onToggleAnalysis}
                  busy={props.busy}
                  onBusy={props.onBusy}
                  onRefresh={props.onRefresh}
                  onFlash={props.onFlash}
                  doAction={props.doAction}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {!props.farmerView ? (
        <Card className="card-pad">
          <h3 className="font-bold text-ink mb-2">Laboratory Directory</h3>
          <p className="text-sm text-ink-muted mb-3">
            Browse verified labs for soil, water, plant disease, nutrient, residue and crop-quality testing.
          </p>
          <button onClick={props.onShowLabs} className="btn-primary">Browse Labs Directory</button>
        </Card>
      ) : null}
    </div>
  );
}

function RequestsTab(props: {
  requests: TestRequest[];
  isAdmin: boolean;
  isDemo: boolean;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onRefresh: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const advance = async (r: TestRequest, to: string) => {
    props.onBusy(r.id);
    try {
      await props.doAction(`/api/lab-tests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      props.onRefresh();
    } catch (e) {
      props.onFlash((e as Error).message);
    } finally {
      props.onBusy(null);
    }
  };

  if (props.requests.length === 0) {
    return <EmptyState icon="lab" title="No lab test requests" body="Describe a crop problem and request a lab test — the request stays visible here with its status timeline." />;
  }

  return (
    <div className="space-y-3">
      {props.requests.map((r) => {
        const idx = LAB_REQUEST_FLOW.indexOf(r.status);
        const nextForward = idx >= 0 && idx < LAB_REQUEST_FLOW.length - 1 ? LAB_REQUEST_FLOW[idx + 1] : null;
        return (
          <Card key={r.id} className="card-pad">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold">{r.requestNo}</p>
                  <Badge status={r.status}>{r.status}</Badge>
                  <span className="badge bg-line/[0.06] text-ink-muted">{r.problemCategory.replaceAll("_", " ").toLowerCase()}</span>
                  {r.severity ? <span className="badge bg-amber-50 text-amber-700">Severity: {r.severity}</span> : null}
                </div>
                <p className="font-semibold mt-2">{r.crop}{r.variety ? ` · ${r.variety}` : ""}{r.location ? ` · ${r.location}` : ""}</p>
                <p className="text-sm text-ink mt-1">{r.problemDescription}</p>
                {r.symptoms ? <p className="text-xs text-ink-muted mt-1"><b>Symptoms:</b> {r.symptoms}</p> : null}
                <p className="text-xs text-ink-faint mt-2">
                  {r.preferredLab ? `Lab: ${r.preferredLab.name} (${r.preferredLab.location})` : "No lab chosen yet"}
                  {r.affectedAreaPct != null ? ` · Affected area: ${r.affectedAreaPct}%` : ""}
                  {r.dateNoticed ? ` · Noticed: ${fullDate(r.dateNoticed)}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <StepTimeline status={r.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextForward && !TERMINAL.has(r.status) && (props.isDemo || props.isAdmin) ? (
                <button
                  className="btn-ghost"
                  disabled={props.busy === r.id}
                  onClick={() => advance(r, nextForward)}
                >
                  {props.busy === r.id ? "Updating…" : `Simulate: ${statusLabel(nextForward)} →`}
                </button>
              ) : null}
              {!TERMINAL.has(r.status) ? (
                <button
                  className="btn-soft-danger"
                  disabled={props.busy === r.id}
                  onClick={() => advance(r, "CANCELLED")}
                >
                  Cancel request
                </button>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ReportsTab(props: {
  reports: Report[];
  isAdmin: boolean;
  onAskExpert: (caseId: string) => void;
  onUpload: () => void;
  expandedAnalysis: string | null;
  onToggleAnalysis: (id: string) => void;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onRefresh: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  if (props.reports.length === 0) {
    return (
      <>
        <EmptyState icon="doc" title="No lab reports yet" body="Upload a lab report (PDF, JPG or PNG, max 5 MB) — it is stored privately and only you (and admins) can view it." />
        <div className="text-center mt-4">
          <button onClick={props.onUpload} className="btn-primary">Upload Lab Report</button>
        </div>
      </>
    );
  }
  return (
    <div className="space-y-3">
      {props.reports.map((r) => (
        <Card key={r.id} className="card-pad">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">{r.reportNo}</p>
                <Badge status={r.status}>{r.status}</Badge>
                <span className="badge bg-line/[0.06] text-ink-muted">{r.testType}</span>
                {r.lab?.isVerified ? <span className="badge bg-emerald-50 text-emerald-700">✓ Verified lab</span> : null}
              </div>
              <p className="font-semibold mt-2">{r.crop} · {r.fileName}</p>
              <p className="text-xs text-ink-faint mt-1">
                {r.lab ? `${r.lab.name} (${r.lab.location})` : "No lab linked"}
                {r.reportDate ? ` · Report date: ${fullDate(r.reportDate)}` : ""}
                {r.fileSize > 0 ? ` · ${Math.round(r.fileSize / 1024)} KB` : ""}
              </p>
              {r.notes ? <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2 inline-block">📌 {r.notes}</p> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-ghost" href={`/api/lab-reports/${r.id}/file`} target="_blank" rel="noreferrer">
              View
            </a>
            <a className="btn-ghost" href={`/api/lab-reports/${r.id}/file?download=1`} target="_blank" rel="noreferrer">
              Download
            </a>
            <AnalyzeButton
              reportId={r.id}
              hasAnalysis={!!r.analysis}
              busy={props.busy}
              onBusy={props.onBusy}
              onDone={props.onRefresh}
              onFlash={props.onFlash}
              doAction={props.doAction}
            />
            {r.cases[0] ? (
              <button className="btn-ghost" onClick={() => props.onAskExpert(r.cases[0].id)}>
                Ask an Expert
              </button>
            ) : null}
            <DeleteReportButton reportId={r.id} reportNo={r.reportNo} busy={props.busy} onBusy={props.onBusy} onDone={props.onRefresh} onFlash={props.onFlash} doAction={props.doAction} />
          </div>
          {r.analysis ? (
            <div className="mt-3">
              <button
                className="text-sm font-semibold text-brand-700 flex items-center gap-1"
                onClick={() => props.onToggleAnalysis(r.id)}
              >
                <Icon name="microscope" className="w-4 h-4" />
                {props.expandedAnalysis === r.id ? "Hide AI analysis" : "View AI analysis"}
              </button>
              {props.expandedAnalysis === r.id ? <div className="mt-3"><AnalysisView analysis={r.analysis} isDemo /></div> : null}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function AnalyzeButton(props: {
  reportId: string;
  hasAnalysis: boolean;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onDone: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const run = async () => {
    props.onBusy(`analyze-${props.reportId}`);
    try {
      await props.doAction(`/api/lab-reports/${props.reportId}/analyze`, { method: "POST" });
      props.onDone();
      props.onFlash("AI analysis complete — review it below, then verify with the lab before acting.");
    } catch (e) {
      props.onFlash((e as Error).message);
    } finally {
      props.onBusy(null);
    }
  };
  return (
    <button className="btn-primary" disabled={props.busy !== null} onClick={run}>
      {props.busy === `analyze-${props.reportId}`
        ? "Analyzing…"
        : props.hasAnalysis
          ? "Re-analyze with AI"
          : "Analyze Report with AI"}
    </button>
  );
}

function DeleteReportButton(props: {
  reportId: string;
  reportNo: string;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onDone: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const run = async () => {
    if (!window.confirm(`Delete report ${props.reportNo} and its analysis? This cannot be undone.`)) return;
    props.onBusy(`del-${props.reportId}`);
    try {
      await props.doAction(`/api/lab-reports/${props.reportId}`, { method: "DELETE" });
      props.onDone();
      props.onFlash(`${props.reportNo} deleted.`);
    } catch (e) {
      props.onFlash((e as Error).message);
    } finally {
      props.onBusy(null);
    }
  };
  return (
    <button className="btn-soft-danger" disabled={props.busy !== null} onClick={run}>
      Delete
    </button>
  );
}

function HistoryTab(props: {
  cases: CaseItem[];
  isAdmin: boolean;
  onAskExpert: (caseId: string) => void;
  expandedAnalysis: string | null;
  onToggleAnalysis: (id: string) => void;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onRefresh: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  if (props.cases.length === 0) {
    return <EmptyState icon="leaf" title="No crop health history" body="Cases appear here when you request lab tests or upload reports." />;
  }
  return (
    <div className="space-y-3">
      {props.cases.map((c) => (
        <CaseCard
          key={c.id}
          c={c}
          isAdmin={props.isAdmin}
          onAskExpert={props.onAskExpert}
          expandedAnalysis={props.expandedAnalysis}
          onToggleAnalysis={props.onToggleAnalysis}
          busy={props.busy}
          onBusy={props.onBusy}
          onRefresh={props.onRefresh}
          onFlash={props.onFlash}
          doAction={props.doAction}
        />
      ))}
    </div>
  );
}

function CaseCard(props: {
  c: CaseItem;
  isAdmin: boolean;
  onAskExpert: (caseId: string) => void;
  expandedAnalysis: string | null;
  onToggleAnalysis: (id: string) => void;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onRefresh: () => void;
  onFlash: (m: string) => void;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const c = props.c;
  const analysis = c.aiAnalysis;
  return (
    <Card className="card-pad">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-bold">{c.caseNo}</p>
        <Badge status={c.status}>{c.status}</Badge>
        <span className="badge bg-line/[0.06] text-ink-muted">{c.crop}</span>
        {c.labName ? <span className="badge bg-brand-50 text-brand-700">🧪 {c.labName}</span> : null}
      </div>
      <p className="text-sm mt-2 text-ink">{c.problem}</p>
      <p className="text-xs text-ink-faint mt-1">
        Opened {fullDate(c.createdAt)}
        {c.request ? ` · Request ${c.request.requestNo} (${statusLabel(c.request.status)})` : ""}
        {c.report ? ` · Report ${c.report.reportNo} (${statusLabel(c.report.status)})` : ""}
      </p>
      {c.actionTaken ? (
        <p className="text-xs mt-2 text-ink-muted"><b>Action taken:</b> {c.actionTaken}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!props.isAdmin ? (
          <button className="btn-ghost" onClick={() => props.onAskExpert(c.id)}>
            Ask an Expert
          </button>
        ) : null}
        {analysis ? (
          <button
            className="text-sm font-semibold text-brand-700 flex items-center gap-1"
            onClick={() => props.onToggleAnalysis(c.id)}
          >
            <Icon name="microscope" className="w-4 h-4" />
            {props.expandedAnalysis === c.id ? "Hide AI analysis" : "View AI analysis"}
          </button>
        ) : null}
      </div>
      {analysis && props.expandedAnalysis === c.id ? (
        <div className="mt-3"><AnalysisView analysis={analysis} isDemo /></div>
      ) : null}
      {c.consultations.length > 0 ? (
        <div className="mt-3 space-y-2">
          {c.consultations.map((q) => (
            <div key={q.id} className="rounded-lg bg-line/[0.06] px-3 py-2">
              <p className="text-xs font-semibold text-ink">Q: {q.question}</p>
              {q.response ? (
                <p className="text-xs mt-1 text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">
                  <b>A (expert):</b> {q.response}
                </p>
              ) : (
                <p className="text-xs mt-1 text-ink-faint">Awaiting expert response…</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function AnalysisView({ analysis, isDemo }: { analysis: Analysis; isDemo?: boolean }) {
  const confColor =
    analysis.confidence === "High" ? "bg-emerald-50 text-emerald-700" : analysis.confidence === "Low" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700";
  return (
    <div className="rounded-xl border border-line/10 overflow-hidden">
      <div className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <p className="font-bold text-sm flex items-center gap-2">
          <Icon name="microscope" className="w-4 h-4" /> AI CROP HEALTH ANALYSIS
        </p>
        <span className={`badge ${confColor}`}>{analysis.confidence} confidence</span>
      </div>
      <div className="p-4 space-y-4 bg-card">
        {isDemo ? (
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
            DEMO DATA — generated from the report metadata + farmer description. Not a diagnosis; verify with the lab or an agronomist.
          </p>
        ) : null}
        <ExtractedTextView analysis={analysis} />
        <Section label="A. Summary" icon="doc">
          <p className="text-sm text-ink">{analysis.summary}</p>
        </Section>
        {analysis.abnormalFindings.length > 0 ? (
          <Section label="B. Abnormal Findings" icon="alert">
            <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
              {analysis.abnormalFindings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        {analysis.possibleCauses.length > 0 ? (
          <Section label="C. Possible Causes" icon="search">
            <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
              {analysis.possibleCauses.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section label="D. Crop Impact" icon="leaf">
          <p className="text-sm text-ink">{analysis.cropImpact}</p>
        </Section>
        {analysis.recommendedActions.length > 0 ? (
          <Section label="E. Recommended Next Steps" icon="check">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-ink">
              {analysis.recommendedActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </Section>
        ) : null}
        <Section label="F. Prevention" icon="shield">
          <p className="text-sm text-ink">{analysis.prevention}</p>
        </Section>
        {analysis.treatmentCategories.length > 0 ? (
          <Section label="Integrated Pest Management & Treatment (category-level only)" icon="flask">
            <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
              {analysis.treatmentCategories.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section label="G. Expert Verification" icon="user">
          <p className="text-sm text-ink">
            {analysis.expertReviewRecommended
              ? "Recommended — confirm the diagnosis with a Krishi Vigyan Kendra agronomist, plant pathologist or agricultural officer before applying any chemical."
              : "Not strictly required, but consult an expert if symptoms persist."}
          </p>
          {analysis.expertNote ? <p className="text-xs text-amber-700 mt-2">{analysis.expertNote}</p> : null}
          <p className="text-[11px] text-ink-faint mt-2">
            Confidence reason: {analysis.confidenceReason} · Analyzed at {fullDate(analysis.analysisTimestamp)} · Model {analysis.model}
          </p>
        </Section>
      </div>
    </div>
  );
}

const EXTRACTED_LABEL: Record<string, string> = {
  "pdf-text": "Text read from the PDF report",
  "pdf-no-text": "No text could be extracted — the document may be scanned or image-only",
  image: "The file is an image — its text cannot be read in this build",
  missing: "The report file was not available to read",
};

function ExtractedTextView({ analysis }: { analysis: Analysis }) {
  const kind = analysis.extractedFrom;
  if (!kind || kind === "none") return null;
  const label = EXTRACTED_LABEL[kind];
  if (!label) return null;
  const ok = kind === "pdf-text";
  return (
    <div className={`rounded-lg border px-3 py-2 ${ok ? "border-brand-200 bg-brand-50/60" : "border-amber-200 bg-amber-50"}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${ok ? "text-brand-700" : "text-amber-700"}`}>
        {ok ? "📄 What the AI read" : "⚠️ Report not readable by AI"}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {label}
        {ok ? ` — ${analysis.extractedChars.toLocaleString()} characters` : ""}.
      </p>
      {ok && analysis.extractedTextSnippet ? (
        <details className="mt-1.5">
          <summary className="text-xs font-semibold text-brand-700 cursor-pointer">Show extracted text</summary>
          <pre className="mt-1.5 text-[11px] leading-relaxed whitespace-pre-wrap bg-card/70 border border-line/10 rounded-lg p-2 max-h-40 overflow-auto text-ink-muted">
            {analysis.extractedTextSnippet}
          </pre>
        </details>
      ) : null}
      {!ok ? (
        <p className="text-[11px] text-amber-700 mt-1">
          Upload a clearer PDF copy of the report, then click Analyze again to re-run with the file's actual values.
        </p>
      ) : null}
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-800 flex items-center gap-1.5 mb-1.5">
        {icon ? <Icon name={icon as never} className="w-3.5 h-3.5" /> : null}
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────

function RequestModal(props: {
  labs: Lab[];
  myLots: Lot[];
  prefillLabId?: string;
  busy: string | null;
  onBusy: (b: string | null) => void;
  onClose: () => void;
  onDone: (requestNo: string) => Promise<void>;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const [form, setForm] = useState({
    crop: "Tomato",
    variety: "",
    lotId: "",
    location: "Ramanagara",
    problemCategory: "DISEASE",
    problemDescription: "",
    symptoms: "",
    dateNoticed: "",
    affectedAreaPct: "",
    severity: "Medium",
    preferredLabId: props.prefillLabId ?? "",
    preferredDate: "",
    additionalNotes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.problemDescription.trim().length < 10) {
      setError("Please describe the problem in at least a few words (10+ characters).");
      return;
    }
    props.onBusy("request");
    try {
      const j = (await props.doAction("/api/lab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: form.crop,
          variety: form.variety || null,
          lotId: form.lotId || null,
          location: form.location || null,
          problemCategory: form.problemCategory,
          problemDescription: form.problemDescription,
          symptoms: form.symptoms || null,
          dateNoticed: form.dateNoticed || null,
          affectedAreaPct: form.affectedAreaPct ? Number(form.affectedAreaPct) : null,
          severity: form.severity || null,
          preferredLabId: form.preferredLabId || null,
          preferredDate: form.preferredDate || null,
          additionalNotes: form.additionalNotes || null,
        }),
      })) as { request?: { requestNo: string } };
      await props.onDone(j.request?.requestNo ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      props.onBusy(null);
    }
  };

  return (
    <Modal open onClose={props.onClose} title="Request Lab Test" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Crop">
            <input className="input" value={form.crop} onChange={(e) => set("crop", e.target.value)} required />
          </Field>
          <Field label="Crop variety">
            <input className="input" value={form.variety} onChange={(e) => set("variety", e.target.value)} placeholder="e.g. Arka Vikas" />
          </Field>
          <Field label="Problem category">
            <select className="input" value={form.problemCategory} onChange={(e) => set("problemCategory", e.target.value)}>
              {PROBLEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select className="input" value={form.severity} onChange={(e) => set("severity", e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </Field>
          <Field label="Linked lot (optional)">
            <select className="input" value={form.lotId} onChange={(e) => set("lotId", e.target.value)}>
              <option value="">— None —</option>
              {props.myLots.map((l) => (
                <option key={l.id} value={l.id}>{l.lotNo} · {l.crop.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Preferred lab">
            <select className="input" value={form.preferredLabId} onChange={(e) => set("preferredLabId", e.target.value)}>
              <option value="">— Let AgriLink suggest —</option>
              {props.labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.location})</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Affected area (%)">
            <input className="input" type="number" min={0} max={100} value={form.affectedAreaPct} onChange={(e) => set("affectedAreaPct", e.target.value)} />
          </Field>
          <Field label="Date problem noticed">
            <input className="input" type="date" value={form.dateNoticed} onChange={(e) => set("dateNoticed", e.target.value)} />
          </Field>
          <Field label="Preferred testing date">
            <input className="input" type="date" value={form.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} />
          </Field>
        </div>
        <Field label="Describe the problem *">
          <textarea
            className="input min-h-24"
            value={form.problemDescription}
            onChange={(e) => set("problemDescription", e.target.value)}
            placeholder="e.g. Leaves are turning yellow and small insects are visible on the underside…"
            required
          />
        </Field>
        <Field label="Symptoms">
          <textarea className="input min-h-20" value={form.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="Yellowing, spots, wilting, curling…" />
        </Field>
        <Field label="Additional notes">
          <textarea className="input min-h-16" value={form.additionalNotes} onChange={(e) => set("additionalNotes", e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={props.onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={props.busy !== null}>
            {props.busy === "request" ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UploadModal(props: {
  labs: Lab[];
  requests: TestRequest[];
  myLots: Lot[];
  busy: string | null;
  onBusy: (b: string | null) => void;
  onClose: () => void;
  onDone: (reportNo: string) => Promise<void>;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const [form, setForm] = useState({
    crop: "Tomato",
    testType: "Plant Disease Test",
    labId: "",
    testRequestId: "",
    lotId: "",
    reportDate: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a report file (PDF, JPG or PNG, max 5 MB).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large — maximum size is 5 MB.");
      return;
    }
    props.onBusy("upload");
    try {
      const fd = new FormData();
      fd.append(
        "meta",
        JSON.stringify({
          crop: form.crop,
          testType: form.testType,
          labId: form.labId || null,
          testRequestId: form.testRequestId || null,
          lotId: form.lotId || null,
          reportDate: form.reportDate || null,
          notes: form.notes || null,
        })
      );
      fd.append("file", file);
      const r = await fetch("/api/lab-reports", { method: "POST", body: fd });
      const j = (await r.json()) as { ok?: boolean; message?: string; report?: { reportNo: string } };
      if (!r.ok) throw new Error(j.message ?? "Upload failed");
      await props.onDone(j.report?.reportNo ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      props.onBusy(null);
    }
  };

  return (
    <Modal open onClose={props.onClose} title="Upload Lab Report" size="lg">
      <p className="text-xs text-ink-muted mb-4">
        PDF, JPG or PNG only · max 5 MB. Files are stored privately and are never shown publicly.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Crop">
            <input className="input" value={form.crop} onChange={(e) => set("crop", e.target.value)} required />
          </Field>
          <Field label="Test type">
            <input className="input" value={form.testType} onChange={(e) => set("testType", e.target.value)} placeholder="e.g. Plant Disease Test" required />
          </Field>
          <Field label="Lab">
            <select className="input" value={form.labId} onChange={(e) => set("labId", e.target.value)}>
              <option value="">— None —</option>
              {props.labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Link to lab request (optional)">
            <select className="input" value={form.testRequestId} onChange={(e) => set("testRequestId", e.target.value)}>
              <option value="">— None —</option>
              {props.requests.map((r) => (
                <option key={r.id} value={r.id}>{r.requestNo} · {r.crop}</option>
              ))}
            </select>
          </Field>
          <Field label="Linked lot (optional)">
            <select className="input" value={form.lotId} onChange={(e) => set("lotId", e.target.value)}>
              <option value="">— None —</option>
              {props.myLots.map((l) => (
                <option key={l.id} value={l.id}>{l.lotNo} · {l.crop.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Report date">
            <input className="input" type="date" value={form.reportDate} onChange={(e) => set("reportDate", e.target.value)} />
          </Field>
        </div>
        <Field label="Report file *">
          <input
            className="input"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Notes">
          <textarea className="input min-h-16" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any details about the report…" />
        </Field>
        {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={props.onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={props.busy !== null}>
            {props.busy === "upload" ? "Uploading…" : "Upload Report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LabsModal(props: {
  labs: Lab[];
  farmerView: boolean;
  onClose: () => void;
  onRequestTest: (labId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [testType, setTestType] = useState("");
  const [crop, setCrop] = useState("");
  const [maxDist, setMaxDist] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const types = Array.from(new Set(props.labs.flatMap((l) => l.testTypes)));
  const crops = Array.from(new Set(props.labs.flatMap((l) => l.supportedCrops)));

  const filtered = props.labs.filter((l) => {
    if (q && !l.name.toLowerCase().includes(q.toLowerCase()) && !l.location.toLowerCase().includes(q.toLowerCase())) return false;
    if (testType && !l.testTypes.some((t) => t.toLowerCase().includes(testType.toLowerCase()))) return false;
    if (crop && !l.supportedCrops.some((c) => c.toLowerCase().includes(crop.toLowerCase()) || c.toLowerCase() === "all crops")) return false;
    if (maxDist && l.distanceKm > Number(maxDist)) return false;
    if (maxPrice && (l.approxPrice ?? 0) > Number(maxPrice)) return false;
    return true;
  });

  return (
    <Modal open onClose={props.onClose} title="Lab Testing Directory" size="xl">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="Search name/location…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={testType} onChange={(e) => setTestType(e.target.value)}>
          <option value="">All test types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">All crops</option>
          {crops.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input className="input" type="number" placeholder="Max distance (km)" value={maxDist} onChange={(e) => setMaxDist(e.target.value)} />
        <input className="input" type="number" placeholder="Max price (₹)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="lab" title="No labs match" body="Try clearing some filters." />
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map((l) => (
            <Card key={l.id} className="card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{l.name}</p>
                    {l.isVerified ? <span className="badge bg-emerald-50 text-emerald-700">✓ Verified</span> : <span className="badge bg-gray-100 text-gray-500">Not verified</span>}
                    {l.rating ? <span className="badge bg-amber-50 text-amber-700">★ {l.rating.toFixed(1)}</span> : null}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">{l.location} · {l.distanceKm} km</p>
                  {l.accreditation ? <p className="text-xs text-ink-faint mt-1">Accreditation: {l.accreditation}</p> : null}
                  {l.description ? <p className="text-sm text-ink mt-2">{l.description}</p> : null}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {l.testTypes.map((t) => (
                      <span key={t} className="badge bg-brand-50 text-brand-700">{t}</span>
                    ))}
                  </div>
                  <p className="text-xs text-ink-faint mt-2">
                    {l.turnaroundDays ? `~${l.turnaroundDays} day turnaround` : ""}
                    {l.approxPrice ? ` · from ₹${l.approxPrice}` : ""}
                    {l.operatingHours ? ` · ${l.operatingHours}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  {l.phone ? (
                    <a className="btn-ghost" href={`tel:${l.phone.replace(/\s/g, "")}`}>📞 Contact Lab</a>
                  ) : null}
                  {l.email ? (
                    <a className="btn-ghost" href={`mailto:${l.email}`}>✉ {l.email}</a>
                  ) : null}
                  {props.farmerView ? (
                    <button className="btn-primary" onClick={() => props.onRequestTest(l.id)}>
                      Request Test
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AskExpertModal(props: {
  caseId: string;
  cases: CaseItem[];
  busy: string | null;
  onBusy: (b: string | null) => void;
  onClose: () => void;
  onDone: () => Promise<void>;
  doAction: (url: string, init?: RequestInit) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activeCase = props.cases.find((c) => c.id === props.caseId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (question.trim().length < 10) {
      setError("Please describe your question in a few words (10+ characters).");
      return;
    }
    props.onBusy("expert");
    try {
      await props.doAction("/api/expert-consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: props.caseId, question }),
      });
      await props.onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      props.onBusy(null);
    }
  };

  return (
    <Modal open onClose={props.onClose} title="Ask an Agricultural Expert">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-ink-muted">
          Case {activeCase?.caseNo} · {activeCase?.crop}: your question, symptoms, lab report and AI analysis are sent to the AgriLink expert team.
        </p>
        <Field label="Your question *">
          <textarea
            className="input min-h-28"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Should I treat the spots now or wait for the lab confirmation?"
            required
          />
        </Field>
        {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={props.onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={props.busy !== null}>
            {props.busy === "expert" ? "Sending…" : "Send to Expert"}
          </button>
        </div>
      </form>
    </Modal>
  );
}