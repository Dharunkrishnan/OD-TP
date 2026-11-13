// src/pages/od/ODClaim360.jsx
// P06 · Claim 360 – one place to see and work an OD claim.
// Route: /od/claims/:id   (id = claim no with "/" replaced by "-", e.g. OD-CHN-26-004512)
// Catalogue refs: Claim Summary 182–183, Policy & Coverage 22–32, Survey 37–51,
// Damage Assessment 52–59, Document Mgmt 152–157, Reserve 18–19, Audit Trail 171–175,
// Communication 144–151, Investigation & Fraud 66–69.
// Phase 2B (src/data/claimWork.js): reserve revision 19 · variance alert 94 · queries 145 ·
// document upload 153 · document verification 154 · note visibility 173.
// Settlement panel (src/data/claimSettlement.js): DO + working sheet 91 · final invoice 79–83 · payee & bank 120, 122 ·
// consent 121 · delivery & satisfaction before payment 77 · payment 125–126 · auto-close after payment 130.

import { useMemo, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  FilePlus2,
  Upload,
  ShieldAlert,
  Send,
  StickyNote,
  Phone,
  Mail,
  Wrench,
  UserCheck,
  Car,
  X,
  CircleDot,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { TAT_STAGES } from "../../data/odHandlerMock";
import { getClaimDetail, claimFromSlug, LIFECYCLE, STAGE_TO_STEP } from "../../data/odClaimDetail";
import { ClaimStatusBanner, ClaimActionsMenu, ClaimStatusDialog } from "../../components/ClaimStatusActions";
import { useClaimStatus, effectiveState } from "../../data/claimStatus";
import { useClaimWork, reserveVariance, newId, isoToday, nowStamp, HANDLER, MANAGER, NOTE_VISIBILITY } from "../../data/claimWork";
import SettlementPanel, { InvoiceDialog, PayeeDialog, ConsentDialog, DeliveryDialog, WorkingSheetDialog } from "../../components/SettlementPanel";
import { settlementState, INVOICE_TOLERANCE_PCT } from "../../data/claimSettlement";
import { ReserveDialog, VarianceBanner, QueryDialog, ReplyDialog, QueriesPanel, UploadDialog, RejectDocDialog } from "../../components/ClaimWorkDialogs";
import AppointSurveyorDialog from "../../components/AppointSurveyorDialog";
import { useClaimSurvey, daysLeft } from "../../data/claimSurvey";

const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));
const dt = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";

const STAGE_TAT = {
  NBNR: "Intimation → Registration",
  Registered: "Registration → Surveyor appointed",
  "Survey pending": "Surveyor appointed → Survey done",
  Assessment: "Survey → Assessment report",
  "Documents pending": "Document collection",
  Approval: "Approval",
  "Repair / DO": "Final invoice → Delivery order",
  Payment: "Delivery order → Payment",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "policy", label: "Policy & vehicle" },
  { key: "loss", label: "Loss & survey" },
  { key: "docs", label: "Documents" },
  { key: "queries", label: "Queries" },
  { key: "reserve", label: "Reserve & payments" },
  { key: "timeline", label: "Timeline" },
];

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */
function Card({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 px-3 py-0.5">
          <h2 className="text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label / value grid used across tabs */
function Facts({ items, cols = "sm:grid-cols-2 xl:grid-cols-3" }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-2 px-3 py-2.5 ${cols}`}>
      {items
        .filter(Boolean)
        .map(([k, v, opts = {}]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className={`text-[12.5px] text-slate-800 ${opts.mono ? "font-mono" : ""} ${opts.strong ? "font-semibold" : ""}`}>
              {v ?? "–"}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** All header chips share one height and baseline. */
const CHIP = "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold leading-none";

function SlaChip({ sla }) {
  const map = {
    breach: { cls: "bg-red-50 text-red-800 ring-red-200", Icon: AlertTriangle },
    risk: { cls: "bg-amber-50 text-amber-900 ring-amber-200", Icon: Clock },
    ok: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  };
  const { cls, Icon } = map[sla.status];
  return (
    <span className={`${CHIP} ring-1 ring-inset ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      SLA · {sla.label}
    </span>
  );
}

function DocStatus({ status }) {
  const map = {
    Received: { cls: "bg-sky-50 text-sky-800", Icon: Clock, label: "Received – to verify" },
    Verified: { cls: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
    Rejected: { cls: "bg-red-50 text-red-700", Icon: XCircle },
    Pending: { cls: "bg-amber-50 text-amber-900", Icon: Clock },
    "Not yet due": { cls: "bg-slate-100 text-slate-600", Icon: MinusCircle },
  };
  const { cls, Icon, label } = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-semibold leading-5 ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label || status}
    </span>
  );
}

// compact: icon only on screens below 1536 px (name shows on hover), full label on wide screens
function ActionButton({ icon: Icon, children, onClick, primary, danger, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={compact ? children : undefined}
      className={`flex h-7 items-center gap-1.5 rounded-md text-[12px] font-semibold transition ${compact ? "px-2 2xl:px-2.5" : "px-2.5"} ${
        primary
          ? "bg-teal-700 text-white hover:bg-teal-800"
          : danger
          ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={compact ? "max-2xl:sr-only" : ""}>{children}</span>
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Completed stage view (click a done step in the lifecycle sidebar)   */
/* Read only: what happened in that stage, who did it and when.        */
/* ------------------------------------------------------------------ */
const STAGE_EVENTS = [
  ["Claim intimated", "Parked as NBNR", "Policy & coverage validated", "Claim registered", "Assigned to handler"],
  ["Surveyor appointed", "Survey completed", "Flag raised"],
  ["Reserve revised", "Document requested", "Document received"],
  ["Sent for approval", "Approved", "Repudiated"],
  ["Repair authorised", "Payment requested", "Payment made"],
];
const inrAmt = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));

function StageView({ c, index, label, documents, timeline, onBack }) {
  const events = timeline.filter((e) => STAGE_EVENTS[index].some((k) => e.event.startsWith(k)));
  const ev = (name) => timeline.find((e) => e.event.startsWith(name));
  const registered = ev("Claim registered");
  const approvalSent = ev("Sent for approval");
  const authorised = ev("Repair authorised");
  const completedOn = [registered, ev("Survey completed"), ev("Reserve revised"), authorised, ev("Payment requested")][index];

  let sections = [];
  if (index === 0) {
    sections = [
      {
        title: "Intimation",
        items: [
          ["Intimated on", dt(c.loss.intimatedOn)],
          ["Channel", c.loss.intimationChannel],
          ["Intimation delay", `${c.loss.intimationDelayDays} day(s) after loss`],
          ["Loss date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
          ["Place of loss", c.loss.place],
          ["Cause", c.loss.cause],
          ["Police", c.loss.policeReport],
          ["Contact (masked)", `${c.contact.mobile} · ${c.contact.email}`],
        ],
      },
      {
        title: "Policy & coverage validation",
        items: c.checks.slice(0, 4).map((k) => [k.label, `${k.ok === true ? "✓ " : k.ok === false ? "✕ " : ""}${k.note}`]),
      },
      {
        title: "Registration",
        items: [
          ["Claim no", c.claimNo, { mono: true }],
          ["Registered on", registered ? `${dt(registered.date)} · ${registered.time}` : "–"],
          ["Initial reserve", inrAmt(c.reserveHistory[0]?.amount), { strong: true }],
          ["Reserve basis", c.reserveHistory[0]?.reason],
          ["Assigned to", "Karthik Subramanian · Chennai"],
          ["Policy no", c.policy.policyNo, { mono: true }],
        ],
      },
    ];
  } else if (index === 1) {
    const sv = c.survey;
    sections = [
      {
        title: c.survey.surveyType === "Investigation (SIU)" ? "Investigation" : "Surveyor appointment",
        items: [
          ["Survey type", sv.surveyType],
          ["Surveyor", sv.surveyor ? sv.surveyor.name : "–"],
          ["Licence no", sv.surveyor ? sv.surveyor.licence : "–", { mono: true }],
          ["Surveyor type", sv.surveyor ? sv.surveyor.type : "–"],
          ["Appointed on", dt(sv.appointedOn)],
          ["Survey done on", dt(sv.surveyDoneOn)],
        ],
      },
      {
        title: "Inspection",
        items: [
          ["Vehicle location", c.loss.vehicleLocation],
          ["Garage", c.garage ? `${c.garage.name} (${c.garage.type})` : "–"],
          ["Garage estimate", inrAmt(sv.estimate), { strong: true }],
          ["Odometer", c.vehicle.odometer ? `${c.vehicle.odometer.toLocaleString("en-IN")} km` : "–"],
          ["Photos", documents.find((d) => d.name === "Vehicle photos")?.status === "Received" ? "Uploaded" : "–"],
          ["Survey report", documents.find((d) => d.name === "Survey report")?.status ?? "–"],
          ["Red flags", c.flags.length ? c.flags.join(", ") : "None"],
        ],
      },
    ];
  } else if (index === 2) {
    const sv = c.survey;
    sections = [
      {
        title: "Assessment",
        items: [
          ["Garage estimate", inrAmt(sv.estimate)],
          ["Assessed loss", inrAmt(sv.assessed), { strong: true }],
          [sv.zeroDep ? "Depreciation (zero dep)" : "Depreciation", inrAmt(sv.depreciation)],
          ["Salvage", inrAmt(sv.salvage)],
          ["Deductible", inrAmt(sv.deductible)],
          ["Net liability", inrAmt(sv.netLiability), { strong: true }],
        ],
      },
      {
        title: "Reserve & documents",
        items: [
          ...c.reserveHistory.map((h) => [`${h.type} · ${dt(h.date)}`, `${inrAmt(h.amount)} – ${h.reason}`]),
          ["Documents received", `${documents.filter((d) => d.status === "Received").length} of ${documents.length}`],
        ],
      },
    ];
  } else if (index === 3) {
    sections = [
      {
        title: "Decision",
        items: [
          ["Sent for approval", approvalSent ? `${dt(approvalSent.date)} · ${approvalSent.time}` : "–"],
          ["Amount sent", inrAmt(c.survey.netLiability ?? c.reserve), { strong: true }],
          ["Decision", authorised ? "Approved" : "–", { strong: true }],
          ["Decided by", authorised ? authorised.by : "–"],
          ["Decided on", authorised ? `${dt(authorised.date)} · ${authorised.time}` : "–"],
          ["Liability", "Admissible under Own Damage section"],
        ],
      },
    ];
  } else {
    sections = [
      {
        title: "Settlement",
        items: [
          ["Delivery order", authorised ? `Issued ${dt(authorised.date)}` : "–"],
          ["Garage", c.garage ? c.garage.name : "–"],
          ...c.payments.map((x) => [`Payment · ${dt(x.date)}`, `${inrAmt(x.amount)} to ${x.payee} · ${x.mode} · ${x.status}`]),
        ],
      },
    ];
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-teal-50/60 px-3 py-2">
        <p className="flex items-center gap-2 text-[13px] text-slate-700">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-600 text-white">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>
            <span className="font-semibold text-[#0B1F3A]">
              Stage {index + 1} · {label}
            </span>{" "}
            · Completed{completedOn ? ` on ${dt(completedOn.date)}` : ""} · <span className="text-slate-500">read only</span>
          </span>
        </p>
        <button type="button" onClick={onBack} className="flex h-7 items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white hover:bg-teal-800">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to current stage
        </button>
      </div>

      <div className="grid gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="grid content-start gap-2">
          {sections.map((sec) => (
            <section key={sec.title} className="rounded-lg border border-slate-200">
              <h3 className="border-b border-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B1F3A]">{sec.title}</h3>
              <Facts items={sec.items} />
            </section>
          ))}
        </div>
        <section className="rounded-lg border border-slate-200">
          <h3 className="border-b border-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B1F3A]">Activity in this stage</h3>
          {events.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-slate-500">No recorded activity.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {events.map((e, k) => (
                <li key={k} className="px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold text-slate-800">
                    {e.event}
                    <span className="flex-none text-[11px] font-normal text-slate-500">
                      {dt(e.date)} {e.time}
                    </span>
                  </p>
                  <p className="text-[11.5px] text-slate-600">{e.detail}</p>
                  <p className="text-[11px] text-slate-400">by {e.by}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
// Header chip for a closed claim (replaces the stage name)
const CLOSED_CHIP = { SETTLED: "Closed – paid", WITHDRAWN: "Withdrawn", CLOSED: "Closed – no payment", NBNR_CLOSED: "NBNR closed" };

export default function ODClaim360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const claimNo = claimFromSlug(id);
  const base = useMemo(() => getClaimDetail(claimNo), [claimNo]);
  // View (eye icon / row click) = read only. Edit (paper-and-pen icon, ?mode=edit) = work on the claim.
  const [params] = useSearchParams();
  const editMode = params.get("mode") === "edit";

  const [tab, setTab] = useState("overview");
  const [viewStage, setViewStage] = useState(null); // index of a completed lifecycle stage being viewed, or null
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null); // "note" | "docs"
  const [note, setNote] = useState("");
  const [docPick, setDocPick] = useState([]);
  // Phase 2A – claim status (NBNR resolve, withdraw, close without payment, reopen, hold): catalogue 16, 21, 131, 134, 162
  const [statusRec, setStatusRec] = useClaimStatus(claimNo);
  const [statusAction, setStatusAction] = useState(null);
  // Surveyor appointment / change (catalogue 35, timelines 168)
  const [surveyRec, setSurveyRec] = useClaimSurvey(claimNo);
  const [surveyDialog, setSurveyDialog] = useState(false);
  // Phase 2B – reserve, queries, documents, notes (catalogue 19, 94, 145, 153, 154, 173)
  const [work, updateWork] = useClaimWork(claimNo);
  const [workDialog, setWorkDialog] = useState(null); // "reserve" | "query" | "upload" | { reply } | { reject }
  const [noteVis, setNoteVis] = useState("team");

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(""), 2600);
  }
  const notBuilt = (what) => flash(`${what} – this screen comes in a later build step.`);

  if (!base) {
    return (
      <ODShell active="queue" title="Claim not found" onNavigateMissing={notBuilt}>
        <Card className="mx-auto max-w-md p-6 text-center">
          <p className="text-sm text-slate-700">
            No claim <span className="font-mono">{claimNo}</span> in your queue.
          </p>
          <Link to="/od/worklist" className="mt-3 inline-block text-[13px] font-medium text-teal-700 hover:underline">
            Back to My Work Queue
          </Link>
        </Card>
      </ODShell>
    );
  }

  const st = effectiveState(base.stage, statusRec);
  // the claim as it stands now (an NBNR converted in this session shows as Registered)
  // NBNR converted → premium realised, so the policy is now confirmed in force
  const converted = base.stage === "NBNR" && st.stage === "Registered";
  // Left step rail follows the claim status: converted → Survey step; hold / closed / waiting → shown on the current step
  const STATUS_NOTE = {
    HOLD: "On hold",
    WITHDRAWN: "Closed · withdrawn",
    CLOSED: "Closed without payment",
    NBNR_CLOSED: "Closed · NBNR",
    REPUDIATION_PENDING: "Awaiting manager approval",
    REOPEN_PENDING: "Awaiting manager approval",
  };
  // Surveyor appointed in this session → Registered claim moves to Survey pending
  const surveyed = !!surveyRec && (st.stage === "Registered" || st.stage === "Survey pending");
  // Settlement (Repair / DO, Payment): payment requested → Payment; paid & closed → Closed
  const settled = st.state === "SETTLED";
  const settle = ["Repair / DO", "Payment"].includes(base.stage) ? settlementState(base, work.settlement || {}) : null;
  const stage = surveyed ? "Survey pending" : settled ? "Closed" : settle?.payment && base.stage === "Repair / DO" ? "Payment" : st.stage;
  const baseLife = settled
    ? STAGE_TO_STEP.Closed
    : stage === "Payment" && base.stage !== "Payment"
      ? STAGE_TO_STEP.Payment
      : surveyed
    ? { ...STAGE_TO_STEP["Survey pending"], note: `${surveyRec.mode === "video" ? "Video survey" : "Survey"} on ${dt(surveyRec.visitDate)}` }
    : converted
      ? STAGE_TO_STEP.Registered
      : base.lifecycle;
  const lifecycle = STATUS_NOTE[st.state] ? { ...baseLife, hold: true, note: STATUS_NOTE[st.state] } : baseLife;
  // Closed (withdrawn / without payment / NBNR closed) → reserve released to ₹0
  const released = st.closed && base.reserve > 0;
  // Reserve revised in this session (catalogue 19) – latest revision is the current reserve
  const revised = work.revisions.length > 0;
  const c =
    stage === base.stage && lifecycle === base.lifecycle && !released && !surveyed && !revised
      ? base
      : {
          ...base,
          stage,
          lifecycle,
          ...(revised && {
            reserve: work.revisions[work.revisions.length - 1].amount,
            reserveHistory: [...base.reserveHistory, ...work.revisions],
          }),
          ...(converted && {
            nextAction: "Appoint surveyor",
            policy: { ...base.policy, status: "In force" },
            checks: base.checks.map((k) =>
              k.label === "Policy in force on loss date" ? { ...k, ok: true, note: "Yes · confirmed with PAS" } : k
            ),
          }),
          ...(surveyed && {
            pendingWith: "Surveyor",
            nextAction: `${surveyRec.mode === "video" ? "Video survey" : "Survey visit"} on ${dt(surveyRec.visitDate)} · report due ${dt(surveyRec.reportDue)}`,
            sla: { status: daysLeft(surveyRec.reportDue) <= 2 ? "risk" : "ok", label: `report in ${daysLeft(surveyRec.reportDue)} d` },
            survey: {
              ...base.survey,
              surveyor: surveyRec.surveyor,
              appointedOn: surveyRec.at,
              surveyType: surveyRec.mode === "video" ? "Video survey" : base.survey.surveyType,
              visitDate: surveyRec.visitDate,
              location: surveyRec.location,
              reportDue: surveyRec.reportDue,
            },
          }),
          ...(released && {
            reserve: 0,
            reserveHistory: [
              ...base.reserveHistory,
              ...work.revisions,
              { date: statusRec.at, type: settled ? "Paid & closed" : "Released", amount: 0, by: "Claims handler", reason: statusRec.reason || "Claim closed" },
            ],
          }),
        };
  const active = !st.closed && !st.waiting; // closed / waiting for approval → only notes allowed
  // Documents: claim data + this session's requests, uploads and verification (catalogue 153, 154)
  // Past the Assessment step (Approval, Repair / DO, Payment, Closed) the documents received earlier were already verified
  const verifiedEarlier = (STAGE_TO_STEP[c.stage]?.step ?? 0) >= 3;
  const documents = [
    ...c.documents.map((d) => ({ ...d, ...(verifiedEarlier && d.status === "Received" ? { status: "Verified" } : {}), ...(work.docs[d.name] || {}) })),
    ...Object.entries(work.docs)
      .filter(([, d]) => d.extra)
      .map(([name, d]) => ({ name, ...d })),
  ];
  const pendingDocs = documents.filter((d) => d.status === "Pending" || d.status === "Rejected");
  const toVerify = documents.filter((d) => d.status === "Received");
  const requestable = documents.filter((d) => d.status === "Not yet due");
  const openQueries = work.queries.filter((q) => q.status === "OPEN");
  // Payments: the handler's payment request replaces the demo row once raised in this session
  const payments = settle?.payment
    ? [
        {
          date: settle.payment.requestedOn,
          payee: settle.payee?.name || c.payments[0]?.payee || c.insured,
          mode: settle.payment.mode || "NEFT",
          amount: settle.payment.amount,
          status: settle.payment.status === "PAID" ? `Paid · UTR ${settle.payment.utr}` : "Sent to Finance",
        },
      ]
    : c.payments;
  const reservePending = work.reserveRequest?.status === "PENDING";
  // Variance alert (catalogue 94) – reserve vs assessed loss, or garage estimate before assessment
  const variance = active ? reserveVariance(c.reserve, c.survey) : null;
  const checks = variance
    ? [...c.checks, { label: "Reserve vs estimate", ok: !variance.alert, note: variance.pct === 0 ? `Matches the ${variance.basisLabel}` : `${variance.pct}% ${variance.over ? "above" : "below"} the ${variance.basisLabel}${variance.alert ? " – revise" : ""}` }]
    : c.checks;
  const timeline = [...(statusRec?.events || []), ...(surveyRec?.events || []), ...work.events, ...c.timeline].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  );
  const tat = TAT_STAGES.find((s) => s.stage === STAGE_TAT[c.stage]);

  // 5-stage lifecycle shown in the left sidebar while this claim is open
  const lifecycleSteps = LIFECYCLE.map((st, i) => {
    const cur = c.lifecycle.step;
    const state = i < cur ? "done" : i === cur ? (c.lifecycle.hold ? "hold" : "active") : "todo";
    return {
      label: st.label,
      state,
      status: state === "done" ? "Completed" : state === "todo" ? "Not started" : c.lifecycle.note,
      // Completed stages open a read-only view; the current stage returns to the normal page; later stages are locked
      selected: viewStage === i || (viewStage === null && i === cur),
      onClick: state === "done" ? () => setViewStage(i) : state === "todo" ? undefined : () => setViewStage(null),
      disabled: state === "todo",
    };
  });

  // every Phase 2B action = a change to the claim's work record + a timeline event
  const logWork = (event, detail, change = (w) => w, extra = {}) =>
    updateWork((w) => ({ ...change(w), events: [{ ...nowStamp(), event, by: HANDLER, detail, ...extra }, ...w.events] }));
  const setDoc = (name, patch) => (w) => ({ ...w, docs: { ...w.docs, [name]: { ...(w.docs[name] || {}), ...patch } } });

  function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    const vis = NOTE_VISIBILITY.find((v) => v.key === noteVis);
    logWork("Note added", note.trim(), undefined, { visibility: vis.label });
    setNote("");
    setNoteVis("team");
    setModal(null);
    flash(`Note added · visible to ${vis.label.toLowerCase()}.`);
  }

  function requestDocs(e) {
    e.preventDefault();
    if (docPick.length === 0) return;
    logWork("Document requested", `${docPick.join(", ")} · SMS + email sent to insured`, (w) =>
      docPick.reduce((acc, n) => setDoc(n, { status: "Pending", requestedOn: isoToday(), reminders: 0 })(acc), w)
    );
    setDocPick([]);
    setModal(null);
    flash(`${docPick.length} document(s) requested from the insured.`);
  }

  function markReceived(name) {
    logWork("Document received", `${name} · to verify`, setDoc(name, { status: "Received", receivedOn: isoToday() }));
  }

  function reviseReserve(r) {
    setWorkDialog(null);
    const amt = (n) => "₹" + n.toLocaleString("en-IN");
    if (r.needsApproval) {
      logWork("Reserve increase sent for approval", `${amt(r.from)} → ${amt(r.to)} · ${r.reason}${r.remarks ? ` – ${r.remarks}` : ""} · to ${MANAGER}`, (w) => ({
        ...w,
        reserveRequest: { id: newId("RSV"), from: r.from, to: r.to, reason: r.reason, remarks: r.remarks, at: isoToday(), status: "PENDING" },
      }));
      flash(`Reserve increase to ${amt(r.to)} sent to ${MANAGER} for approval.`);
    } else {
      logWork("Reserve revised", `${amt(r.from)} → ${amt(r.to)} · ${r.reason}${r.remarks ? ` – ${r.remarks}` : ""}`, (w) => ({
        ...w,
        revisions: [...w.revisions, { date: isoToday(), type: r.to > r.from ? "Revised (increase)" : "Revised (decrease)", amount: r.to, by: HANDLER, reason: r.remarks ? `${r.reason} – ${r.remarks}` : r.reason }],
      }));
      flash(`Reserve revised to ${amt(r.to)}.`);
    }
  }

  function raiseQuery(q) {
    setWorkDialog(null);
    logWork("Query raised", `To ${q.to} (${q.toName}) · ${q.subject} – ${q.details} · reply by ${dt(q.due)}`, (w) => ({
      ...w,
      queries: [{ id: newId("Q"), ...q, raisedOn: isoToday(), status: "OPEN", reminders: 0 }, ...w.queries],
    }));
    setTab("queries");
    flash(`Query sent to the ${q.to.toLowerCase()}.`);
  }
  function remindQuery(q) {
    logWork("Query reminder sent", `To ${q.to} · ${q.subject}`, (w) => ({ ...w, queries: w.queries.map((x) => (x.id === q.id ? { ...x, reminders: x.reminders + 1 } : x)) }));
    flash(`Reminder sent to the ${q.to.toLowerCase()}.`);
  }
  function closeQuery(q, reply) {
    setWorkDialog(null);
    logWork("Query closed", `${q.to} · ${q.subject} – reply: ${reply}`, (w) => ({
      ...w,
      queries: w.queries.map((x) => (x.id === q.id ? { ...x, status: "CLOSED", reply, closedOn: isoToday() } : x)),
    }));
    flash("Query closed.");
  }

  // ----- Settlement (DO → invoice → payee → discharge → payment → close) -----
  const amtF = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const saveSettle = (patch, event, detail) => logWork(event, detail, (w) => ({ ...w, settlement: { ...(w.settlement || {}), ...patch } }));
  function recordInvoice(inv) {
    setWorkDialog(null);
    const over = Math.round(((inv.amount - settle.approved) / settle.approved) * 100);
    const flag = inv.amount > settle.approved * (1 + INVOICE_TOLERANCE_PCT / 100);
    saveSettle({ invoice: inv }, "Final invoice received", `${inv.no} · ${inv.type} · GSTIN ${inv.gstin} · in favour of ${inv.favour} · ${amtF(inv.amount)} · ${over > 0 ? `${over}% above` : "within"} approved ${amtF(settle.approved)}${flag ? " – sent to the surveyor for re-check" : ""}`);
    flash(flag ? `Invoice is ${over}% above approved – sent to the surveyor for re-check.` : "Final invoice recorded.");
  }
  function surveyorConfirmed() {
    saveSettle(
      { invoice: { ...settle.invoice, surveyorOk: true } },
      "Surveyor confirmed final bill",
      `Payable limited to the approved ${amtF(settle.approved)}; excess ${amtF(settle.invoice.amount - settle.approved)} to be collected by the garage from the insured`
    );
    flash("Surveyor confirmation recorded.");
  }
  function savePayee(p) {
    setWorkDialog(null);
    saveSettle({ payee: p }, "Payee set", `${p.type} · ${p.name} · A/c ${p.acct} · IFSC ${p.ifsc} · account verified`);
    flash(`Payee set – ${p.name}.`);
  }
  function recordConsent(x) {
    setWorkDialog(null);
    saveSettle({ consent: x }, "Settlement consent received", `${c.insured} agreed to ${amtF(settle.payable)} · ${x.mode} · ${x.ref}`);
    flash("Settlement consent recorded.");
  }
  function confirmDelivery(x) {
    setWorkDialog(null);
    saveSettle({ delivery: x }, "Vehicle delivered", `Delivered ${dt(x.on)} by ${c.garage?.name} · satisfaction note signed by ${c.insured}`);
    flash("Delivery & satisfaction confirmed – payment can be raised.");
  }
  function requestPayment() {
    saveSettle(
      { payment: { status: "REQUESTED", amount: settle.payable, requestedOn: isoToday(), mode: "NEFT" } },
      "Payment request sent to Finance",
      `${amtF(settle.payable)} by NEFT to ${settle.payee.name} (A/c ${settle.payee.acct})`
    );
    flash(`Payment of ${amtF(settle.payable)} sent to Finance.`);
  }
  // Payment success → claim closes automatically, reserve released to nil (catalogue 130)
  function markPaid() {
    const utr = `N${String(Date.now()).slice(-11)}`;
    const payee = settle.payee?.name || payments[0]?.payee;
    const stamp = nowStamp();
    saveSettle({ payment: { ...settle.payment, status: "PAID", utr, paidOn: isoToday() } }, "Payment made", `${amtF(settle.payment.amount)} to ${payee} · UTR ${utr} (Finance)`);
    const reason = `Paid ${amtF(settle.payment.amount)} to ${payee}`;
    setStatusRec({
      state: "SETTLED",
      reason,
      remarks: `UTR ${utr}`,
      at: isoToday(),
      events: [{ ...stamp, event: "Claim closed – settled", by: "System (auto)", detail: `${reason} · UTR ${utr} · reserve released to ₹0` }, ...(statusRec?.events || [])],
    });
    flash(`Payment made · UTR ${utr}. Claim closed automatically.`);
  }

  function uploadDoc(u) {
    setWorkDialog(null);
    const extra = !c.documents.some((d) => d.name === u.docType);
    logWork("Document uploaded", `${u.docType} · ${u.fileName} (${u.sizeKb} KB) · from ${u.source}`, setDoc(u.docType, { status: "Received", receivedOn: isoToday(), source: u.source, file: u.fileName, extra }));
    setTab("docs");
    flash(`${u.docType} uploaded – verify it in Documents.`);
  }
  function verifyDoc(name) {
    logWork("Document verified", name, setDoc(name, { status: "Verified", verifiedOn: isoToday(), rejectReason: "" }));
    flash(`${name} verified.`);
  }
  function rejectDoc(name, reason, rerequest) {
    setWorkDialog(null);
    logWork("Document rejected", `${name} – ${reason}${rerequest ? " · asked the insured again" : ""}`, setDoc(name, { status: "Rejected", rejectReason: reason, rerequested: rerequest, requestedOn: isoToday(), reminders: 0 }));
    flash(`${name} rejected${rerequest ? " and requested again" : ""}.`);
  }

  return (
    <ODShell
      active="queue"
      // Claim no, insured and vehicle are shown once – in the claim card below – so the page header
      // carries only the screen name and the mode (edit / view only)
      title="Claim 360"
      subtitle={editMode ? "Edit mode · actions are saved to the claim" : "View only · use the pen icon in My Work Queue to work on this claim"}
      onNavigateMissing={notBuilt}
      claimNav={{ backTo: "/od/worklist", backLabel: "Back to My Work Queue", steps: lifecycleSteps }}
    >
      <div className="flex flex-col gap-2">
        {/* ---------------- Back (small screens only) ---------------- */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            onClick={() => navigate("/od/worklist")}
            className="flex h-8 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to queue
          </button>
        </div>

        {/* ---------------- Claim header ---------------- */}
        <Card>
          {/* Row 1: claim no + status chips (left) · actions (edit mode only) + policy status (right) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold leading-6 tracking-wide text-[#0B1F3A] tabular-nums">{c.claimNo}</span>
              {/* Closed claims show the closure type instead of the stage; SLA stops once closed or on hold */}
              <span className={`${CHIP} ${st.closed ? "bg-slate-200 text-slate-800" : "bg-[#0B1F3A] text-white"}`}>
                {CLOSED_CHIP[st.state] || c.stage}
              </span>
              {st.hold && <span className={`${CHIP} bg-amber-100 text-amber-900`}>On hold</span>}
              {!st.closed && !st.hold && <SlaChip sla={c.sla} />}
              {!st.closed && !st.hold && c.dueToday && <span className={`${CHIP} bg-teal-50 text-teal-800`}>Due today</span>}
              {c.flags.map((f) => (
                <span key={f} className={`${CHIP} ${f === "Fraud flag" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {f}
                </span>
              ))}
              {c.loss.catEvent && <span className={`${CHIP} bg-sky-50 text-sky-800`}>CAT event</span>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {/* Actions show only in edit mode (paper-and-pen icon in My Work Queue) */}
              {editMode && (
                <>
                <ActionButton icon={StickyNote} onClick={() => setModal("note")} compact>
                  Add note
                </ActionButton>
                {active && (
                  <>
                <ActionButton icon={FilePlus2} onClick={() => setModal("docs")} compact>
                  Request documents
                </ActionButton>
                <ActionButton icon={Upload} onClick={() => setWorkDialog("upload")} compact>
                  Upload
                </ActionButton>
                {c.stage === "Registered" && (
                  <ActionButton icon={UserCheck} onClick={() => setSurveyDialog(true)} primary>
                    Appoint surveyor
                  </ActionButton>
                )}
                {c.stage === "NBNR" && (
                  <ActionButton icon={CheckCircle2} onClick={() => setStatusAction("nbnr")} primary>
                    Resolve NBNR
                  </ActionButton>
                )}
                {(c.stage === "Assessment" || c.stage === "Documents pending") && (
                  <ActionButton icon={Send} onClick={() => notBuilt("Send for approval")} primary>
                    Send for approval
                  </ActionButton>
                )}
                <ActionButton icon={ShieldAlert} onClick={() => notBuilt("Refer to SIU")} danger>
                  Refer to SIU
                </ActionButton>
                  </>
                )}
                <ClaimActionsMenu
                  stage={c.stage}
                  rec={statusRec}
                  canChangeSurveyor={c.stage === "Survey pending" && !!c.survey.surveyor}
                  onPick={(k) => (k === "surveyor" ? setSurveyDialog(true) : setStatusAction(k))}
                />
                  <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
                </>
              )}
              <span
                className={`${CHIP} ${c.policy.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                title={c.policy.policyNo}
              >
                {c.policy.status === "In force" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                Policy · {c.policy.status}
              </span>
            </div>
          </div>

          {/* Row 2: key facts – one line each, same font, same baseline */}
          <dl className="flex flex-wrap justify-between gap-x-5 gap-y-3 px-4 py-2.5">
            {[
              ["Insured", c.insured],
              ["Vehicle no", c.regNo],
              ["Make / model", c.vehicle.makeModel],
              ["Loss type", c.lossType],
              ["Loss date", dt(c.lossDate)],
              ["Claim raised", dt(c.regDate)],
              ["Reserve", inr(c.reserve), true],
              ["Pending with", c.pendingWith],
              ["Age", `${c.ageDays} days`],
            ].map(([k, v, strong]) => (
              <div key={k} className="flex-none">
                <dt className="whitespace-nowrap text-[10.5px] font-medium uppercase leading-4 tracking-wide text-slate-500">{k}</dt>
                <dd
                  className={`mt-0.5 whitespace-nowrap text-[13px] leading-5 tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-800"}`}
                  title={String(v)}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          {/* Status after a claim action (hold, withdrawn, closed, waiting for approval, NBNR resolved) */}
          <ClaimStatusBanner rec={surveyed && statusRec?.state === "NBNR_CONVERTED" ? null : statusRec} />

          {/* Row 3: next action */}
          {active && (
          <div className="flex items-center gap-2 border-t border-slate-100 bg-amber-50/60 px-4 py-2 text-[12.5px] leading-5">
            <CircleDot className="h-4 w-4 flex-none text-amber-700" aria-hidden="true" />
            <span className="font-semibold text-slate-800">Next action:</span>
            <span className="truncate text-slate-700" title={c.nextAction}>
              {st.hold ? `Review on ${dt(statusRec.reviewDate)} – then release the hold` : c.nextAction}
            </span>
          </div>
          )}
        </Card>

        {/* ---------------- Completed stage (read only) – or the normal tabs ---------------- */}
        {viewStage !== null ? (
          <StageView
            c={c}
            index={viewStage}
            label={LIFECYCLE[viewStage].label}
            documents={documents}
            timeline={timeline}
            onBack={() => setViewStage(null)}
          />
        ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_290px]">
          <Card>
            <div role="tablist" aria-label="Claim sections" className="flex flex-wrap gap-1 border-b border-slate-100 px-2 py-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-medium ${
                    tab === t.key ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                  {t.key === "docs" && pendingDocs.length + toVerify.length > 0 && (
                    <span className={`rounded px-1.5 text-[10.5px] font-semibold ${tab === t.key ? "bg-white/15" : "bg-amber-100 text-amber-900"}`}>
                      {pendingDocs.length + toVerify.length}
                    </span>
                  )}
                  {t.key === "queries" && openQueries.length > 0 && (
                    <span className={`rounded px-1.5 text-[10.5px] font-semibold ${tab === t.key ? "bg-white/15" : "bg-amber-100 text-amber-900"}`}>
                      {openQueries.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ===== Overview ===== */}
            {tab === "overview" && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 p-2 xl:grid-cols-2">
                {variance?.alert && (
                  <div className="xl:col-span-2">
                    <VarianceBanner v={variance} reserve={c.reserve} pending={reservePending} canRevise={editMode} onRevise={() => setWorkDialog("reserve")} />
                  </div>
                )}
                {settle && (
                  <div className="xl:col-span-2">
                    <SettlementPanel
                      s={settle}
                      canAct={editMode && active}
                      closed={settled}
                      onInvoice={() => setWorkDialog("invoice")}
                      onSurveyorOk={surveyorConfirmed}
                      onPayee={() => setWorkDialog("payee")}
                      onConsent={() => setWorkDialog("consent")}
                      onDelivery={() => setWorkDialog("delivery")}
                      onViewSheet={() => setWorkDialog("sheet")}
                      onRequestPayment={requestPayment}
                      onMarkPaid={markPaid}
                    />
                  </div>
                )}
                <Card title="Loss summary">
                  <Facts
                    cols="grid-cols-2"
                    items={[
                      ["Date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
                      ["Place", c.loss.place],
                      ["Cause", c.loss.cause],
                      ["Police", c.loss.policeReport],
                      ["Intimated via", c.loss.intimationChannel],
                      ["Intimation delay", `${c.loss.intimationDelayDays} day(s)`],
                    ]}
                  />
                </Card>
                <Card title="Assessment summary">
                  {c.survey.assessed == null ? (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">
                      {c.survey.estimate ? `Garage estimate ${inr(c.survey.estimate)} received. ` : ""}Assessment not done yet.
                    </p>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <tbody>
                        {[
                          ["Garage estimate", c.survey.estimate],
                          ["Assessed loss", c.survey.assessed],
                          [`Less depreciation${c.survey.zeroDep ? " (zero dep)" : ""}`, -c.survey.depreciation],
                          ["Less salvage", -c.survey.salvage],
                          ["Less deductible (compulsory + voluntary)", -c.survey.deductible],
                        ].map(([k, v]) => (
                          <tr key={k} className="border-b border-slate-50">
                            <td className="px-3 py-1 text-slate-600">{k}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-slate-800">{v == null ? "–" : v === 0 ? "Nil" : v < 0 ? `– ${inr(-v)}` : inr(v)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-1.5 text-slate-800">Net liability (approx.)</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-900">{inr(c.survey.netLiability)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </Card>
                <Card
                  title="Pending documents"
                  action={
                    <button type="button" onClick={() => setTab("docs")} className="text-[12px] font-medium text-teal-700 hover:underline">
                      All documents
                    </button>
                  }
                >
                  {toVerify.length > 0 && (
                    <p className="border-b border-slate-50 px-3 py-1.5 text-[12px] text-sky-800">
                      {toVerify.length} received – to verify:{" "}
                      {toVerify.map((d) => d.name).join(", ")}
                    </p>
                  )}
                  {pendingDocs.length === 0 ? (
                    <p className="flex items-center gap-1.5 px-3 py-3 text-[12.5px] text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Nothing pending right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {pendingDocs.map((d) => (
                        <li key={d.name} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]">
                          <span className="text-slate-800">{d.name}</span>
                          <span className="text-[11px] text-slate-500">
                            {d.status === "Rejected" ? `Rejected – ${d.rejectReason}` : `Requested ${dt(d.requestedOn)} · ${d.reminders || 0} reminder(s)`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card
                  title="Recent activity"
                  action={
                    <button type="button" onClick={() => setTab("timeline")} className="text-[12px] font-medium text-teal-700 hover:underline">
                      Full timeline
                    </button>
                  }
                >
                  <ul className="divide-y divide-slate-50">
                    {timeline.slice(0, 4).map((e, i) => (
                      <li key={i} className="px-3 py-1.5 text-[12px]">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-slate-800">{e.event}</span>
                          <span className="flex-none text-[11px] text-slate-500">
                            {dt(e.date)} {e.time}
                          </span>
                        </div>
                        <div className="truncate text-[11.5px] text-slate-600" title={e.detail}>
                          {e.detail}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            {/* ===== Policy & vehicle ===== */}
            {tab === "policy" && (
              <div className="flex flex-col gap-2 p-2">
                <Card title="Policy">
                  <Facts
                    items={[
                      ["Policy no", c.policy.policyNo, { mono: true }],
                      ["Product", c.policy.product],
                      ["Status", c.policy.status],
                      ["Period", `${dt(c.policy.periodFrom)} – ${dt(c.policy.periodTo)}`],
                      ["Premium realised", c.policy.premiumRealised],
                      ["Channel", c.policy.channel],
                      ["IDV", inr(c.policy.idv), { strong: true }],
                      ["NCB", c.policy.ncb],
                      ["Deductibles", `Compulsory ${inr(c.policy.compulsoryDeductible)} · Voluntary ${inr(c.policy.voluntaryDeductible)}`],
                      ["Add-on covers", c.policy.addOns.join(", ")],
                      ["Financier (hypothecation)", c.policy.financier ?? "None"],
                      ["Previous claims on vehicle", c.policy.previousClaims],
                    ]}
                  />
                </Card>
                <Card title="Vehicle">
                  <Facts
                    items={[
                      ["Registration no", c.vehicle.regNo, { mono: true }],
                      ["Make / model", c.vehicle.makeModel],
                      ["Year of manufacture", c.vehicle.yearOfMfg],
                      ["Fuel · cc", `${c.vehicle.fuel} · ${c.vehicle.cc} cc`],
                      ["Chassis no", c.vehicle.chassis, { mono: true }],
                      ["Engine no", c.vehicle.engine, { mono: true }],
                      ["Usage", c.vehicle.usage],
                      ["Odometer", `${c.vehicle.odometer.toLocaleString("en-IN")} km`],
                    ]}
                  />
                </Card>
                <Card title="Driver at time of loss">
                  {c.driver ? (
                    <Facts
                      items={[
                        ["Name", c.driver.name],
                        ["DL no", c.driver.dlNo, { mono: true }],
                        ["DL class", c.driver.dlClass],
                        ["Valid till", dt(c.driver.dlValidTill)],
                      ]}
                    />
                  ) : (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">Not applicable – vehicle was parked / not being driven.</p>
                  )}
                </Card>
              </div>
            )}

            {/* ===== Loss & survey ===== */}
            {tab === "loss" && (
              <div className="flex flex-col gap-2 p-2">
                <Card title="Loss details">
                  <Facts
                    items={[
                      ["Loss date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
                      ["Place of loss", c.loss.place],
                      ["Loss type", c.lossType],
                      ["Cause / description", c.loss.cause],
                      ["Third party involved", c.loss.tpInvolved ? "Yes – TP claim intimation passed to TP system" : "No"],
                      ["Police", c.loss.policeReport],
                      ["Vehicle location", c.loss.vehicleLocation],
                      ["Intimated on / via", `${dt(c.loss.intimatedOn)} · ${c.loss.intimationChannel}`],
                      c.loss.catEvent && ["Catastrophe event", c.loss.catEvent],
                    ]}
                  />
                </Card>
                <Card title="Survey">
                  {c.survey.surveyor ? (
                    <Facts
                      items={[
                        ["Surveyor", `${c.survey.surveyor.name} · ${c.survey.surveyor.type}`],
                        ["Licence no", c.survey.surveyor.licence, { mono: true }],
                        ["Survey type", c.survey.surveyType],
                        ["Appointed on", dt(c.survey.appointedOn)],
                        c.survey.visitDate && ["Visit date / place", `${dt(c.survey.visitDate)} · ${c.survey.location}`],
                        c.survey.reportDue && ["Report due", `${dt(c.survey.reportDue)} (15 days from appointment)`],
                        ["Survey done on", c.survey.surveyDoneOn ? dt(c.survey.surveyDoneOn) : "Pending"],
                        ["Garage", c.garage ? `${c.garage.name} (${c.garage.type})` : "–"],
                      ]}
                    />
                  ) : (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">
                      {c.stage === "NBNR" ? "Survey starts after the claim is registered." : "Surveyor not appointed yet."}
                    </p>
                  )}
                </Card>
                {c.survey.assessed != null && (
                  <Card title="Assessment">
                    <Facts
                      items={[
                        ["Garage estimate", inr(c.survey.estimate)],
                        ["Assessed loss", inr(c.survey.assessed), { strong: true }],
                        ["Depreciation", c.survey.zeroDep ? "Nil – zero depreciation add-on" : inr(c.survey.depreciation)],
                        ["Salvage value", inr(c.survey.salvage)],
                        ["Deductible", inr(c.survey.deductible)],
                        ["Net liability (approx.)", inr(c.survey.netLiability), { strong: true }],
                      ]}
                    />
                  </Card>
                )}
              </div>
            )}

            {/* ===== Documents ===== */}
            {tab === "docs" && (
              <div className="overflow-x-auto">
                {editMode && active && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <p className="text-[12px] text-slate-600">
                      {documents.filter((d) => d.status === "Verified").length} verified · {toVerify.length} to verify · {pendingDocs.length} pending
                    </p>
                    <button type="button" onClick={() => setWorkDialog("upload")} className="flex h-7 items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white hover:bg-teal-800">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Upload document
                    </button>
                  </div>
                )}
                <table className="w-full min-w-[620px] text-left text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-1.5 font-semibold">Document</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Status</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Received / requested</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Source</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.name} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-1.5 text-slate-800">
                            <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {d.name}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <DocStatus status={d.status} />
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">
                          {d.status === "Received" && `${dt(d.receivedOn)}${d.file ? ` · ${d.file}` : ""}`}
                          {d.status === "Verified" && `Received ${dt(d.receivedOn)} · verified ${dt(d.verifiedOn || d.receivedOn)}`}
                          {d.status === "Rejected" && `${d.rejectReason}${d.rerequested ? ` · requested again ${dt(d.requestedOn)}` : ""}`}
                          {d.status === "Pending" && `Requested ${dt(d.requestedOn) !== "–" ? dt(d.requestedOn) : "today"} · ${d.reminders || 0} reminder(s)`}
                          {d.status === "Not yet due" && "–"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">{d.source ?? "–"}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          <span className="inline-flex gap-2.5">
                            {(d.status === "Received" || d.status === "Verified") && (
                              <button type="button" onClick={() => notBuilt(`View ${d.name}`)} className="text-[12px] font-medium text-teal-700 hover:underline">
                                View
                              </button>
                            )}
                            {d.status === "Received" && editMode && active && (
                              <>
                                <button type="button" onClick={() => verifyDoc(d.name)} className="text-[12px] font-semibold text-emerald-700 hover:underline">
                                  Verify
                                </button>
                                <button type="button" onClick={() => setWorkDialog({ reject: d.name })} className="text-[12px] font-medium text-red-700 hover:underline">
                                  Reject
                                </button>
                              </>
                            )}
                            {(d.status === "Pending" || d.status === "Rejected") && editMode && active && (
                              <button type="button" onClick={() => markReceived(d.name)} className="text-[12px] font-medium text-teal-700 hover:underline">
                                Mark received
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== Queries (catalogue 145) ===== */}
            {tab === "queries" && (
              <QueriesPanel
                queries={work.queries}
                canAct={editMode && active}
                onRaise={() => setWorkDialog("query")}
                onRemind={remindQuery}
                onClose={(q) => setWorkDialog({ reply: q })}
              />
            )}

            {/* ===== Reserve & payments ===== */}
            {tab === "reserve" && (
              <div className="flex flex-col gap-2 p-2">
                {variance?.alert && <VarianceBanner v={variance} reserve={c.reserve} pending={reservePending} canRevise={editMode} onRevise={() => setWorkDialog("reserve")} />}
                {reservePending && (
                  <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12.5px] text-violet-900" role="status">
                    <b className="font-semibold">Reserve increase waiting for {MANAGER}</b> · {inr(work.reserveRequest.from)} → {inr(work.reserveRequest.to)} · {work.reserveRequest.reason} · sent {dt(work.reserveRequest.at)}
                  </p>
                )}
                {work.reserveRequest && work.reserveRequest.status !== "PENDING" && work.reserveRequest.decidedAt && (
                  <p className={`rounded-lg border px-3 py-2 text-[12.5px] ${work.reserveRequest.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
                    <b className="font-semibold">
                      Reserve increase to {inr(work.reserveRequest.to)} {work.reserveRequest.status === "APPROVED" ? "approved" : "not approved"} by {MANAGER}
                    </b>
                    {work.reserveRequest.decisionRemarks ? ` · “${work.reserveRequest.decisionRemarks}”` : ""} · {dt(work.reserveRequest.decidedAt)}
                  </p>
                )}
                <Card
                  title="Reserve history"
                  action={
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-slate-800">Current {inr(c.reserve)}</span>
                      {editMode && active && !reservePending && (
                        <button type="button" onClick={() => setWorkDialog("reserve")} className="h-7 rounded-md border border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                          Revise reserve
                        </button>
                      )}
                    </span>
                  }
                >
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-wide text-slate-500">
                        <th scope="col" className="px-3 py-1.5 font-semibold">Date</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">Type</th>
                        <th scope="col" className="px-2 py-1.5 text-right font-semibold">Amount</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">By</th>
                        <th scope="col" className="px-3 py-1.5 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.reserveHistory.map((h, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-600">{dt(h.date)}</td>
                          <td className="px-2 py-1.5 text-slate-800">{h.type}</td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{inr(h.amount)}</td>
                          <td className="px-2 py-1.5 text-slate-600">{h.by}</td>
                          <td className="px-3 py-1.5 text-slate-600">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Card title="Payments">
                  {payments.length === 0 ? (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">No payments yet. Payment is raised after the delivery order is issued.</p>
                  ) : (
                    <table className="w-full text-left text-[12.5px]">
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 text-slate-600">{dt(p.date)}</td>
                            <td className="px-2 py-1.5 text-slate-800">{p.payee}</td>
                            <td className="px-2 py-1.5">{p.mode}</td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                            <td className="px-3 py-1.5">
                              <span className={`rounded px-1.5 text-[11px] font-semibold leading-5 ${p.status.startsWith("Paid") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}

            {/* ===== Timeline ===== */}
            {tab === "timeline" && (
              <ol className="relative px-4 py-3">
                {timeline.map((e, i) => (
                  <li key={i} className="relative border-l-2 border-slate-200 pb-3 pl-4 last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-700" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[12.5px] font-semibold text-slate-800">{e.event}</span>
                      <span className="text-[11px] tabular-nums text-slate-500">
                        {dt(e.date)} · {e.time}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-600">{e.detail}</div>
                    <div className="text-[11px] text-slate-500">
                      by {e.by}
                      {e.visibility && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">Visible to: {e.visibility}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* ---------------- Side panel ---------------- */}
          <div className="flex flex-col gap-2">
            {tat && st.closed && (
              <Card title="Current stage TAT">
                <p className="px-3 py-2 text-[12.5px] text-slate-600">Claim closed – SLA clock stopped.</p>
              </Card>
            )}
            {tat && st.hold && (
              <Card title="Current stage TAT">
                <p className="px-3 py-2 text-[12.5px] text-slate-600">
                  SLA clock paused while the claim is on hold (review on {dt(statusRec.reviewDate)}).
                </p>
              </Card>
            )}
            {tat && !st.closed && !st.hold && (
              <Card title="Current stage TAT">
                <div className="px-3 py-2 text-[12.5px]">
                  <div className="text-slate-600">{tat.stage}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <SlaChip sla={c.sla} />
                    <span className="text-[11px] text-slate-500">Target {tat.target} d · avg {tat.actual} d</span>
                  </div>
                  {c.pendingWith === "Insured" && (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Settlement SLA clock is paused while documents are with the insured. This stage&apos;s follow-up SLA still applies.
                    </p>
                  )}
                </div>
              </Card>
            )}

            <Card title="Checks">
              <ul className="flex flex-col px-3 py-1.5">
                {checks.map((k) => (
                  <li key={k.label} className="flex items-start gap-2 py-1 text-[12px]">
                    {k.ok === true && <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-none text-emerald-600" aria-label="Passed" />}
                    {k.ok === false && <XCircle className="mt-px h-3.5 w-3.5 flex-none text-red-600" aria-label="Failed" />}
                    {k.ok === null && <MinusCircle className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-label="Not applicable" />}
                    {k.ok === "pending" && <Clock className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-label="Pending" />}
                    <span className="min-w-0">
                      <span className="block text-slate-800">{k.label}</span>
                      <span
                        className={`block text-[11px] ${k.ok === false ? "text-red-700" : k.ok === "pending" ? "text-amber-800" : "text-slate-500"}`}
                      >
                        {k.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Contacts">
              <ul className="flex flex-col divide-y divide-slate-50 text-[12px]">
                <li className="flex items-start gap-2 px-3 py-1.5">
                  <Car className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800">{c.insured}</span>
                    <span className="block text-[11px] text-slate-500">Insured</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{c.contact.mobile}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" aria-hidden="true" />{c.contact.email}</span>
                    </span>
                  </span>
                </li>
                {c.survey.surveyor && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.survey.surveyor.name}</span>
                      <span className="block text-[11px] text-slate-500">Surveyor · {c.survey.surveyor.licence}</span>
                    </span>
                  </li>
                )}
                {c.garage && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.garage.name}</span>
                      <span className="block text-[11px] text-slate-500">{c.garage.type}</span>
                    </span>
                  </li>
                )}
              </ul>
              <p className="border-t border-slate-100 px-3 py-1.5 text-[10.5px] text-slate-500">Mobile and email are masked for privacy.</p>
            </Card>
          </div>
        </div>
        )}
      </div>

      {/* ---------------- Modals ---------------- */}
      {statusAction && (
        <ClaimStatusDialog
          action={statusAction}
          claim={base}
          rec={statusRec}
          onCancel={() => setStatusAction(null)}
          onDone={(next, msg) => {
            setStatusRec(next);
            setStatusAction(null);
            flash(msg);
          }}
        />
      )}

      {surveyDialog && (
        <AppointSurveyorDialog
          claim={c}
          current={c.stage === "Survey pending" && c.survey.surveyor ? (surveyRec || { surveyor: c.survey.surveyor, mode: "physical", at: c.survey.appointedOn, visitDate: c.survey.appointedOn, location: c.loss.vehicleLocation, events: [] }) : null}
          wasNbnr={base.stage === "NBNR"}
          onCancel={() => setSurveyDialog(false)}
          onDone={(next, msg) => {
            setSurveyRec(next);
            setSurveyDialog(false);
            flash(msg);
          }}
        />
      )}

      {workDialog === "invoice" && <InvoiceDialog c={c} s={settle} onCancel={() => setWorkDialog(null)} onDone={recordInvoice} />}
      {workDialog === "payee" && <PayeeDialog c={c} s={settle} onCancel={() => setWorkDialog(null)} onDone={savePayee} />}
      {workDialog === "consent" && <ConsentDialog c={c} s={settle} onCancel={() => setWorkDialog(null)} onDone={recordConsent} />}
      {workDialog === "delivery" && <DeliveryDialog c={c} onCancel={() => setWorkDialog(null)} onDone={confirmDelivery} />}
      {workDialog === "sheet" && <WorkingSheetDialog c={c} s={settle} onCancel={() => setWorkDialog(null)} />}
      {workDialog === "reserve" && <ReserveDialog claim={c} onCancel={() => setWorkDialog(null)} onDone={reviseReserve} />}
      {workDialog === "query" && <QueryDialog claim={c} surveyorName={c.survey.surveyor?.name} onCancel={() => setWorkDialog(null)} onDone={raiseQuery} />}
      {workDialog?.reply && <ReplyDialog query={workDialog.reply} onCancel={() => setWorkDialog(null)} onDone={(r) => closeQuery(workDialog.reply, r)} />}
      {workDialog === "upload" && <UploadDialog claim={c} documents={documents} onCancel={() => setWorkDialog(null)} onDone={uploadDoc} />}
      {workDialog?.reject && <RejectDocDialog docName={workDialog.reject} onCancel={() => setWorkDialog(null)} onDone={(r, again) => rejectDoc(workDialog.reject, r, again)} />}

      {modal === "note" && (
        <Modal title="Add note" onClose={() => setModal(null)}>
          <form onSubmit={addNote} className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1 text-[12.5px]">
              <span className="font-medium text-slate-700">Note (saved to the claim timeline)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15"
                placeholder="e.g. Spoke to insured, DL copy will be emailed by tomorrow"
                autoFocus
              />
            </label>
            <fieldset>
              <legend className="mb-1 text-[12.5px] font-medium text-slate-700">Who can see this note</legend>
              <div className="flex flex-col gap-1">
                {NOTE_VISIBILITY.map((v) => (
                  <label key={v.key} className="flex items-center gap-2 text-[12.5px] text-slate-800">
                    <input type="radio" name="note-vis" checked={noteVis === v.key} onChange={() => setNoteVis(v.key)} className="h-4 w-4 accent-teal-700" />
                    <b className="font-semibold">{v.label}</b>
                    <span className="text-[11.5px] text-slate-500">{v.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-8 rounded-md border border-slate-300 px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={!note.trim()} className="h-8 rounded-md bg-teal-700 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
                Save note
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "docs" && (
        <Modal title="Request documents from insured" onClose={() => setModal(null)}>
          <form onSubmit={requestDocs} className="flex flex-col gap-3 p-4">
            {requestable.length === 0 ? (
              <p className="text-[12.5px] text-slate-600">All required documents are already received or requested.</p>
            ) : (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-[12.5px] font-medium text-slate-700">Select documents to request</legend>
                {requestable.map((d) => (
                  <label key={d.name} className="flex items-center gap-2 text-[12.5px] text-slate-800">
                    <input
                      type="checkbox"
                      checked={docPick.includes(d.name)}
                      onChange={(e) =>
                        setDocPick((p) => (e.target.checked ? [...p, d.name] : p.filter((x) => x !== d.name)))
                      }
                      className="h-4 w-4 accent-teal-700"
                    />
                    {d.name}
                  </label>
                ))}
              </fieldset>
            )}
            <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11.5px] text-slate-600">
              The insured gets an SMS and email with the list. The request is logged on the claim timeline.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-8 rounded-md border border-slate-300 px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={docPick.length === 0} className="h-8 rounded-md bg-teal-700 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
                Send request
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}