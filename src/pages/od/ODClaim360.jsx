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

import { useEffect, useMemo, useState } from "react";
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
  History,
  Milestone,
  Pencil,
  ClipboardCheck,
  Calculator,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { TAT_STAGES, needsIps } from "../../data/odHandlerMock";
import { getClaimDetail, claimFromSlug, LIFECYCLE, STAGE_TO_STEP } from "../../data/odClaimDetail";
import { impactOf, damagedParts, DEP_TEXT, CTL_THRESHOLD, partialAssessment } from "../../data/odAssessment";
import { ClaimStatusBanner, ClaimActionsMenu, ClaimStatusDialog } from "../../components/ClaimStatusActions";
import ClaimDetailSections from "../../components/ClaimDetailSections";
import ClaimTimeline from "../../components/ClaimTimeline";
import { claimJourney } from "../../data/claimJourney";
import { useClaimStatus, effectiveState } from "../../data/claimStatus";
import { useClaimWork, reserveVariance, newId, isoToday, nowStamp, HANDLER, MANAGER, NOTE_VISIBILITY } from "../../data/claimWork";
import SettlementPanel, { InvoiceDialog, PayeeDialog, ConsentDialog, DeliveryDialog, WorkingSheetDialog } from "../../components/SettlementPanel";
import { settlementState, INVOICE_TOLERANCE_PCT } from "../../data/claimSettlement";
import { ReserveDialog, VarianceBanner, QueryDialog, ReplyDialog, QueriesPanel, UploadDialog, RejectDocDialog } from "../../components/ClaimWorkDialogs";
import AppointSurveyorDialog from "../../components/AppointSurveyorDialog";
import { ScheduleInspectionDialog, SurveyReportDialog, AssessmentDialog, ReferSiuDialog } from "../../components/HandlerStageDialogs";
import { HANDLER_AS_SURVEYOR } from "../../data/odHandlerMock";
import { HANDLER_AUTHORITY, MANAGER_AUTHORITY } from "../../data/odTeamMock";
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
  { key: "details", label: "Claim details" },
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
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className={`text-[12.5px] text-slate-800 ${opts.mono ? "font-mono" : ""} ${opts.strong ? "font-semibold" : ""}`}>
              {v ?? "–"}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** All header chips share one height and baseline. */
const CHIP = "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-semibold leading-none";

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
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[12px] font-semibold leading-5 ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label || status}
    </span>
  );
}

// compact: icon only on screens below 1536 px (name shows on hover), full label on wide screens
// soon = action planned for a later build step: shown greyed with a hover note, click does nothing
function ActionButton({ icon: Icon, children, onClick, primary, danger, compact, soon }) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      aria-disabled={soon || undefined}
      title={soon ? `${children} – available in a later build step` : compact ? children : undefined}
      className={`flex h-7 items-center gap-1.5 rounded-md text-[12px] font-semibold transition ${compact ? "px-2 2xl:px-2.5" : "px-2.5"} ${
        soon
          ? "cursor-not-allowed border border-dashed border-slate-300 bg-slate-50 text-slate-500"
          : primary
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
  ["Surveyor appointed", "Inspection scheduled", "Survey completed", "Flag raised"],
  ["Reserve revised", "Assessment saved", "Document requested", "Document received"],
  ["Sent for approval", "Repair authorised", "Approved", "Repudiated", "Referred to SIU"],
  ["Repair authorised", "Final invoice received", "Surveyor confirmed final bill", "Re-inspection done", "Salvage collected", "Delivery order issued", "Payee set", "Settlement consent received", "Vehicle delivered", "Payment requested", "Payment made", "Claim closed"],
];
// work that belongs to whatever stage the claim is in when it is done (documents, queries, notes)
const ANY_STAGE_EVENTS = ["Document", "Query", "Note added", "Reserve increase sent for approval", "Referred to SIU"];
const eventsOfStage = (timeline, index, current) =>
  timeline.filter((e) => STAGE_EVENTS[index].some((k) => e.event.startsWith(k)) || (current && ANY_STAGE_EVENTS.some((k) => e.event.startsWith(k))));
const inrAmt = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));

// Stage bar – the same on every stage: "Stage n · name · status" with Timeline, Activity (this stage) and
// Upload; a completed stage also has "Back to current stage". Timeline / Activity open as floating cards.
function StageBarHeader({ index, label, status, done, panel, toggle, count, onUpload, onBack }) {
  const btn = (on) =>
    `flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold ${on ? "border-[#0B1F3A] bg-[#0B1F3A] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 ${done ? "bg-teal-50/60" : "bg-sky-50/60"}`}>
      <p className="flex items-center gap-2 text-[13px] text-slate-700">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-white ${done ? "bg-teal-600" : "bg-[#0B1F3A]"}`}>
          {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="text-[11px] font-bold">{index + 1}</span>}
        </span>
        <span>
          <span className="font-semibold text-[#0B1F3A]">
            Stage {index + 1} · {label}
          </span>{" "}
          · {status}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => toggle("timeline")} aria-expanded={panel === "timeline"} aria-controls={panel === "timeline" ? "stage-timeline" : undefined} className={btn(panel === "timeline")}>
          <Milestone className="h-3.5 w-3.5" aria-hidden="true" />
          Timeline
        </button>
        <button type="button" onClick={() => toggle("activity")} aria-expanded={panel === "activity"} aria-controls={panel === "activity" ? "stage-activity" : undefined} className={btn(panel === "activity")}>
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          Activity
          <span className={`rounded px-1 text-[11px] font-bold leading-4 ${panel === "activity" ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>
        </button>
        {/* Upload a document for this claim (edit mode, open claim) – same dialog as the header Upload */}
        {onUpload && (
          <button type="button" onClick={onUpload} title={`Upload a document – ${label} stage`} className={btn(false)}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </button>
        )}
        {onBack && (
          <button type="button" onClick={onBack} className="flex h-7 items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white hover:bg-teal-800">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to current stage
          </button>
        )}
      </div>
    </div>
  );
}

function StagePanels({ panel, setPanel, events, journey, index, className = "lg:right-3 lg:top-2" }) {
  const floating = `z-30 mt-2 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.28),0_2px_6px_rgba(15,23,42,0.08)] lg:absolute lg:mt-0 lg:max-h-[calc(100vh-14rem)] ${className}`;
  const head = (title, close) => (
    <div className="flex min-h-9 flex-none items-center justify-between gap-2 border-b border-slate-100 px-3 py-1">
      <h3 className="text-[12.5px] font-semibold text-[#0B1F3A]">{title}</h3>
      <button type="button" onClick={() => setPanel(null)} aria-label={close} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
  const scroll = "min-h-0 flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700/40";
  if (panel === "activity")
    return (
      <section id="stage-activity" aria-label="Activity in this stage" className={`${floating} lg:w-[340px]`}>
        {head("Activity in this stage", "Close activity")}
        <div tabIndex={0} className={scroll}>
          {events.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-slate-500">No recorded activity yet.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {events.map((e, k) => (
                <li key={k} className="px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold text-slate-800">
                    {e.event}
                    <span className="flex-none text-[12px] font-normal text-slate-500">
                      {dt(e.date)} {e.time}
                    </span>
                  </p>
                  <p className="text-[12px] text-slate-600">{e.detail}</p>
                  <p className="text-[12px] text-slate-500">by {e.by}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    );
  if (panel === "timeline")
    return (
      <section id="stage-timeline" aria-label="Claim timeline" className={`${floating} lg:w-[520px]`}>
        {head("Claim timeline", "Close timeline")}
        <div tabIndex={0} className={scroll}>
          <ClaimTimeline steps={journey} highlight={index} compact />
        </div>
      </section>
    );
  return null;
}

// Current stage: the same bar above the work tabs (no "Back" – this is the current stage)
function CurrentStageBar({ c, index, label, timeline, journey, onUpload }) {
  const [panel, setPanel] = useState(null);
  const toggle = (k) => setPanel((p) => (p === k ? null : k));
  useEffect(() => {
    if (!panel) return undefined;
    const onKey = (e) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);
  const events = eventsOfStage(timeline, index, true);
  const status = c.lifecycle?.closed
    ? "Closed"
    : `In progress${c.pendingWith ? ` · pending with ${c.pendingWith}` : ""}${c.sla?.label ? ` · ${c.sla.label}` : ""}`;
  return (
    <div className="relative z-20">
      <Card>
        <StageBarHeader index={index} label={label} status={status} panel={panel} toggle={toggle} count={events.length} onUpload={onUpload} />
      </Card>
      <StagePanels panel={panel} setPanel={setPanel} events={events} journey={journey} index={index} className="lg:right-3 lg:top-full lg:mt-1" />
    </div>
  );
}

// Line-item table inside a stage card (Assessment: part-wise assessment)
function StageTable({ t }) {
  const right = (k) => t.num?.includes(k);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
            {t.cols.map((h, k) => (
              <th key={h} scope="col" className={`whitespace-nowrap px-3 py-1.5 font-semibold ${right(k) ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {t.rows.map((r, i) => (
            <tr key={i} className={t.dim?.[i] ? "bg-rose-50/40" : ""}>
              {r.map((v, k) => (
                <td key={k} className={`px-3 py-1 ${right(k) ? "whitespace-nowrap text-right" : ""} ${k === 0 ? "font-medium text-slate-800" : k === r.length - 1 ? (t.dim?.[i] ? "text-rose-700" : "text-slate-500") : "text-slate-700"}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {t.foot && (
          <tfoot className="border-t border-slate-200">
            <tr className="font-semibold text-[#0B1F3A]">
              {t.foot.map((v, k) => (
                <td key={k} className={`px-3 py-1.5 ${right(k) ? "whitespace-nowrap text-right" : ""} ${k === t.foot.length - 1 ? "font-normal text-rose-700" : ""}`}>
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function StageView({ c, index, label, documents, timeline, journey, onBack, onUpload }) {
  const events = eventsOfStage(timeline, index, false);
  // "Activity in this stage" stays hidden until asked for – opens as a floating card over the right side
  // panel open over the right side: "activity" (this stage) or "timeline" (whole claim journey), one at a time
  const [panel, setPanel] = useState(null);
  const toggle = (k) => setPanel((p) => (p === k ? null : k));
  useEffect(() => {
    if (!panel) return undefined;
    const onKey = (e) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);
  const ev = (name) => timeline.find((e) => e.event.startsWith(name));
  const registered = ev("Claim registered");
  const approvalSent = ev("Sent for approval");
  const authorised = ev("Repair authorised");
  const completedOn = [registered, ev("Survey completed"), ev("Reserve revised"), authorised || ev("Approved"), ev("Payment requested")][index];

  let sections = [];
  if (index === 0) {
    const intimated = ev("Claim intimated");
    const assigned = ev("Assigned to handler");
    const allocated = ev("Allocated for survey");
    const ipsClaim = needsIps(c);
    const plusDays = (iso, n) => {
      const d = new Date(iso + "T00:00:00");
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const tick = (ok) => (ok === true ? "✓ " : ok === false ? "✕ " : "");
    const LATER_DOCS = ["Survey report", "Final invoice", "Satisfaction note / delivery", "Non-traceable report (police)", "Original keys & Form 28/29/30"];
    const askedDocs = documents.filter((d) => !LATER_DOCS.includes(d.name));
    sections = [
      {
        title: "Intimation",
        items: [
          ["Intimated on", intimated ? `${dt(intimated.date)} · ${intimated.time}` : dt(c.loss.intimatedOn)],
          ["Channel", c.loss.intimationChannel],
          ["Intimation delay", `${c.loss.intimationDelayDays} day(s) after loss${c.loss.intimationDelayDays > 7 ? " – late, reason recorded" : ""}`],
          ["Insured contact (masked)", `${c.contact.mobile} · ${c.contact.email}`],
          [
            "Acknowledgement",
            registered ? `SMS & email with claim no sent · ${dt(registered.date)} ${registered.time}` : "Sent on registration",
          ],
          ["Customer KYC", c.profile.insured.kyc],
          ["E-claim form", `✓ Generated at intimation · ECF/${c.claimNo.replace(/\//g, "").slice(-8)} · emailed to the insured`],
        ],
      },
      {
        title: "Loss details",
        items: [
          ["Loss date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
          ["Loss type", c.lossType],
          ["Cause", c.loss.cause],
          ["Place of loss", c.loss.place],
          ["Vehicle now at", c.loss.vehicleLocation],
          ["Third party", c.loss.tpInvolved ? "Involved – passed to TP claims desk" : "Not involved"],
          ["Police / FIR", c.loss.policeReport],
          c.loss.catEvent && ["Catastrophe (CAT) event", c.loss.catEvent],
        ],
      },
      {
        title: "Driver at the time of loss",
        items: c.driver
          ? [
              ["Driver", c.driver.name === c.insured ? `${c.driver.name} (insured)` : c.driver.name],
              ["Driving licence no", c.driver.dlNo, { mono: true }],
              ["Valid till (non-transport)", `${tick(c.driver.dlValidTill >= c.loss.date)}${dt(c.driver.dlValidTill)}`],
              ["Class of vehicle", c.driver.dlClass],
              c.profile.driver?.dob && ["Date of birth", dt(c.profile.driver.dob)],
            ]
          : [["Driver", "Not applicable – vehicle was parked / not being driven"]],
      },
      {
        title: "Registration & allocation",
        items: [
          ["Claim no", c.claimNo, { mono: true }],
          ["Registered on", registered ? `${dt(registered.date)} · ${registered.time}` : "–"],
          [
            "Claim type",
            `${{ "Accident – partial": "Partial loss · accident", "Total loss / CTL": "Total loss / CTL", Theft: "Theft (whole vehicle)", "Partial theft": "Partial theft", "Flood – CAT": "Partial loss · flood (natural peril, CAT)", Fire: "Partial loss · fire" }[c.lossType] || c.lossType} · ${c.garage && !/non-network/i.test(c.garage.type) ? "cashless (network garage)" : "reimbursement"}`,
          ],
          ["Initial reserve", inrAmt(c.reserveHistory[0]?.amount), { strong: true }],
          ["Major loss alert", (c.reserveHistory[0]?.amount || 0) > 500000 ? "Raised – reserve above ₹5,00,000, manager informed" : "Not triggered (threshold ₹5,00,000)"],
          ["Reserve basis", c.reserveHistory[0]?.reason],
          ["Assigned to", `${assigned?.detail || "Karthik Subramanian · Chennai"} · auto (branch & territory rule)`],
          [
            "Survey arrangement",
            ipsClaim
              ? "External surveyor (IPS) needed – CAT / theft / total loss"
              : `✓ In-house – claims handler is the surveyor${allocated ? ` · allocated ${dt(allocated.date)} ${allocated.time}` : ""} (IRDAI: within 24 h)`,
          ],
          registered && ["IRDAI clock – survey report due", `${dt(plusDays(registered.date, 15))} (15 days from registration)`],
          ["IRDAI clock – claim decision", "Within 7 days of the survey report"],
        ],
      },
      {
        title: "Vehicle & policy on the loss date",
        span: "lg:col-span-2",
        items: [
          ["Vehicle", `${c.vehicle.regNo} · ${c.vehicle.makeModel}`],
          ["Year · fuel", `${c.vehicle.yearOfMfg} · ${c.vehicle.fuel}`],
          ["Chassis / engine no", `${c.vehicle.chassis} / ${c.vehicle.engine}`, { mono: true }],
          ["Policy no", c.policy.policyNo, { mono: true }],
          ["Policy period", `${dt(c.policy.periodFrom)} – ${dt(c.policy.periodTo)}`],
          ["Product", c.policy.product],
          ["IDV · NCB", `${inrAmt(c.policy.idv)} · ${c.policy.ncb}`, { strong: true }],
          ["Add-on covers", c.policy.addOns.length ? c.policy.addOns.join(", ") : "None"],
          ["Deductibles", `Compulsory ${inrAmt(c.policy.compulsoryDeductible)} · voluntary ${inrAmt(c.policy.voluntaryDeductible)}`],
          ["Financier", c.policy.financier ?? "None"],
        ],
      },
      {
        title: "Policy & coverage validation",
        items: [
          ...c.checks.filter((k) => !/reserve/i.test(k.label)).map((k) => [k.label, `${tick(k.ok)}${k.note}`]),
          ["Endorsement & ownership transfer", "✓ No mid-term endorsement · insured is the RC owner on the loss date"],
          ["Claim history (IIB)", c.policy.previousClaims ? `${c.policy.previousClaims} earlier claim(s) on this vehicle · no adverse match` : "✓ No earlier claims on this vehicle"],
        ],
      },
      {
        title: "Documents asked at intimation",
        span: "2xl:col-span-2",
        items: askedDocs.map((d) => [
          d.name,
          /received|verified/i.test(d.status)
            ? `✓ ${d.status}${d.receivedOn ? ` ${dt(d.receivedOn)}` : ""}${d.source ? ` · ${d.source}` : ""}`
            : d.status === "Pending"
              ? `Pending · ${d.reminders || 0} reminder(s)`
              : d.status,
        ]),
      },
    ];
  } else if (index === 1) {
    const sv = c.survey;
    const theft = sv.surveyType === "Investigation (SIU)";
    const ips = !!sv.surveyor && /IPS|panel/i.test(sv.surveyor.type || "");
    const allocStep = journey?.find((x) => x.key === "allocate");
    const surveyStep = journey?.find((x) => x.key === "survey");
    const done = ev("Survey completed");
    const doc = (n) => documents.find((d) => d.name === n);
    const docState = (d) => (!d ? "Not needed" : /received|verified/i.test(d.status) ? `✓ ${d.status}${d.receivedOn ? ` ${dt(d.receivedOn)}` : ""}` : d.status);
    // damage picture from the stated cause – same parts list as the Assessment stage (odAssessment.js)
    const impact = impactOf(c.loss.cause, c.lossType);
    const est = sv.estimate;
    const pctIdv = est ? Math.round((est / c.policy.idv) * 100) : null;
    const before = c.reserveHistory[0]?.amount;
    const after = c.reserveHistory.find((r) => r.type === "Revision")?.amount;
    const chipText = (st) => (st?.chip && st.chip.kind !== "none" ? `${st.chip.kind === "met" ? "✓ " : st.chip.kind === "due" ? "" : "✕ "}${st.chip.text}` : "–");
    sections = [
      {
        title: theft ? "Investigation arrangement" : "Survey arrangement",
        items: [
          ["Survey type", sv.surveyType],
          ["Surveyor", sv.surveyor ? sv.surveyor.name : "–"],
          ["Surveyor type", sv.surveyor ? sv.surveyor.type : "–"],
          ["IRDAI licence no", sv.surveyor?.licence || "–", { mono: true }],
          [
            "Licence check (loss ₹50,000 and above)",
            ips
              ? "✓ External surveyor (IPS) – licensed"
              : est != null && est < 50000
                ? "Not needed – loss under ₹50,000"
                : sv.surveyor?.licence
                  ? `✓ Handler holds a surveyor licence (${sv.surveyor.licence})`
                  : "✕ Licensed surveyor or IPS needed",
          ],
          ["Allocated", allocStep?.when ? `${dt(allocStep.when.date)} · ${allocStep.when.time}` : dt(sv.appointedOn)],
          ["IRDAI – allocation within 24 h", chipText(allocStep)],
          ["Inspection mode", theft ? "Field investigation" : /spot/i.test(sv.surveyType) ? "Physical – at the spot" : "Physical – at the garage"],
          !theft && ["Inspection scheduled", `${dt(allocStep?.when?.date || sv.appointedOn)} · 11:00 · ${c.loss.vehicleLocation}`],
        ],
      },
      {
        title: theft ? "Investigation" : "Inspection",
        items: [
          ["Inspected on", done ? `${dt(done.date)} · ${done.time}` : dt(sv.surveyDoneOn)],
          ["Location", c.loss.vehicleLocation],
          c.garage && ["Garage", `${c.garage.name.split(",")[0]} · ${c.garage.type}`],
          ["Odometer", c.vehicle.odometer ? `${c.vehicle.odometer.toLocaleString("en-IN")} km` : "–"],
          ["Vehicle identity check", theft ? "Not applicable – vehicle not traced" : "✓ Reg no, chassis and engine no match RC and policy"],
          ["Photos & video", docState(doc("Vehicle photos"))],
          !theft && [
            "Surveyor remarks",
            c.flags.includes("Fraud flag")
              ? "Damage pattern doubtful against the stated cause – referred to SIU"
              : /water/.test(impact)
                ? "Water level up to the seats, engine and wiring affected – consistent with the flood"
                : /fire/.test(impact)
                  ? "Fire damage in the engine bay – consistent with the fire brigade report"
                  : impact === "Parts stolen"
                    ? "Parts missing as reported – FIR on file"
                    : `Fresh damage on the ${impact.toLowerCase()}, consistent with the stated cause · no old or rusted damage`,
          ],
          !theft && [
            "Follow-up inspection",
            /water/.test(impact) ? `Done ${dt(sv.surveyDoneOn)} – engine opened at the garage, damage confirmed` : "Not needed – no hidden damage found on dismantling",
          ],
        ],
      },
      !theft && {
        title: "Damage & cause",
        items: [
          ["Point of impact", impact],
          ["Damaged parts", damagedParts(impact)],
          ["Stated cause", c.loss.cause],
          ["Damage consistent with cause", c.flags.includes("Fraud flag") ? "✕ Doubtful – see red flags" : "✓ Yes"],
        ],
      },
      !theft && {
        title: "Estimate",
        items: [
          ["Garage estimate", inrAmt(est), { strong: true }],
          est != null && ["Parts · labour · paint", `${inrAmt(Math.round(est * 0.6))} · ${inrAmt(Math.round(est * 0.25))} · ${inrAmt(est - Math.round(est * 0.6) - Math.round(est * 0.25))}`],
          ["GST", "Included line-wise · CGST + SGST"],
          ["Estimate received", docState(doc("Garage estimate"))],
          pctIdv != null && [
            "Repair or total loss",
            pctIdv > 75 ? `✕ ${pctIdv}% of IDV – constructive total loss (over 75%)` : `✓ Repairable – estimate is ${pctIdv}% of IDV (total loss above 75%)`,
          ],
        ],
      },
      {
        title: "Survey report & IRDAI",
        items: [
          ["Report submitted", done ? `${dt(done.date)} · ${done.time}` : "–"],
          ["Report status", docState(doc("Survey report"))],
          !theft && ["Assessed loss in report", sv.assessed != null ? inrAmt(sv.assessed) : "–", { strong: true }],
          ips && [
            "IPS fee bill",
            (() => {
              const fee = Math.min(15000, Math.max(1500, Math.round(((est || c.reserve) * 0.02) / 100) * 100));
              return `Professional fee ${inrAmt(fee)} + conveyance ${inrAmt(750)} – as per fee schedule · ${done ? "bill raised" : "after the report"}`;
            })(),
          ],
          ["IRDAI – report within 15 days", chipText(surveyStep)],
          ["Recommendation", theft ? "Await police final report (non-traceable) before decision" : pctIdv > 75 ? "Settle as total loss" : "Repair at the garage – claim admissible on survey"],
          ["Reserve after survey", after != null ? `${inrAmt(before)} → ${inrAmt(after)}` : inrAmt(before)],
        ],
      },
      {
        title: "Red flags & investigation",
        items: [
          ["Red flags", c.flags.length ? c.flags.join(", ") : "✓ None"],
          ["SIU referral", c.flags.includes("Fraud flag") || theft ? "Referred to SIU" : "Not referred"],
          ["Fraud rules", c.checks.find((k) => /fraud/i.test(k.label))?.note || "No red flags"],
        ],
      },
      {
        title: "Documents collected in this stage",
        span: "lg:col-span-2 2xl:col-span-3",
        items: ["Garage estimate", "Vehicle photos", "Survey report", "FIR / police report", "Fire brigade report"]
          .map((n) => doc(n) && [n, docState(doc(n))])
          .filter(Boolean),
      },
    ].filter(Boolean);
  } else if (index === 2) {
    // Assessment – catalogue 52–61 (estimate, part-wise assessment, add-ons, depreciation, deductibles,
    // summary, admissibility), 88 GST type, 94–101 variance & total loss, 104–108 theft, 152–154 documents
    const sv = c.survey;
    const a = sv.assessment;
    const doc = (n) => documents.find((d) => d.name === n);
    const docState = (d) => (!d ? "Not needed" : /received|verified/i.test(d.status) ? `✓ ${d.status}${d.receivedOn ? ` ${dt(d.receivedOn)}` : ""}` : d.status);
    const tick = (ok) => (ok ? "✓ " : "✕ ");
    const pct = (x) => `${Math.round(x * 1000) / 10}%`;
    const has = (x) => c.policy.addOns.includes(x);
    const fraud = c.flags.includes("Fraud flag");
    const reserveNow = c.reserveHistory[c.reserveHistory.length - 1]?.amount;
    const payable = sv.netLiability;
    const gap = reserveNow && payable != null ? (reserveNow - payable) / reserveNow : 0;
    const assessedOn = ev("Reserve revised") || ev("Survey completed");
    const dlOk = c.driver ? c.driver.dlValidTill >= c.loss.date : null;
    const coverLine =
      a?.basis === "theft"
        ? "✓ Theft of the vehicle – covered under Section I (Own Damage)"
        : /water/.test(a?.impact || "")
          ? "✓ Flood / inundation – natural peril, covered under Section I"
          : /fire/.test(a?.impact || "")
            ? "✓ Fire – covered under Section I"
            : a?.impact === "Parts stolen"
              ? "✓ Theft of parts – covered (FIR registered)"
              : "✓ Accidental external means – covered under Section I (Own Damage)";
    const admissibility = {
      title: "Admissibility",
      items: [
        ["Cause vs policy cover", coverLine],
        ["Driving licence on loss date", c.driver ? `${tick(dlOk)}${dlOk ? "Valid" : "Expired"} till ${dt(c.driver.dlValidTill)} · ${c.driver.dlClass} matches private car` : "Not applicable – vehicle not being driven"],
        c.driver && ["Driving under influence", "✓ No indication in FIR, photos or survey"],
        ["Use of vehicle", "✓ Private use as per policy – no hire or reward"],
        ["Wear & tear / breakdown", a?.basis === "partial" ? "✓ Not claimed – unrelated items disallowed in the part-wise table" : "Not applicable"],
        ["Rule check (red / amber / green)", fraud ? "Amber – red flag referred to SIU" : "Green – no admissibility risk"],
        ["Result", fraud ? "Pending SIU outcome" : "Admissible under Section I – Own Damage", { strong: true }],
      ],
    };
    const reserve = {
      title: "Reserve",
      items: [
        ...c.reserveHistory.map((h) => [`${h.type} · ${dt(h.date)}`, `${inrAmt(h.amount)} – ${h.reason}`]),
        reserveNow != null &&
          payable != null && [
            "Reserve vs net liability",
            Math.abs(gap) <= 0.2
              ? `✓ Within 20% (${pct(Math.abs(gap))}) – no revision needed`
              : `✕ ${pct(Math.abs(gap))} ${gap < 0 ? "short" : "over"} – revise reserve to ${inrAmt(payable)}`,
          ],
      ],
    };
    const docsSec = (names) => ({
      title: "Documents in this stage",
      items: names.map((n) => doc(n) && [n, docState(doc(n))]).filter(Boolean),
    });

    if (!a) {
      sections = [{ title: "Assessment", items: [["Status", "Assessment not recorded for this claim"]] }, reserve];
    } else if (a.basis === "partial") {
      const sumDep = a.lines.reduce((s2, l) => s2 + l.dep, 0);
      sections = [
        {
          title: "Estimate",
          items: [
            ["Garage estimate", inrAmt(a.estimate), { strong: true }],
            c.garage && ["Estimate from", `${c.garage.name.split(",")[0]} · ${c.garage.type}`],
            ["Captured", "Uploaded by the garage · line items read by OCR, checked by the handler"],
            ["Parts · labour · paint", `${inrAmt(a.split.parts)} · ${inrAmt(a.split.labour)} · ${inrAmt(a.split.paint)}`],
            ["Consumables", inrAmt(a.split.consumables)],
            ["GST", "Included line-wise · CGST + SGST (garage and insurer GSTIN both Tamil Nadu)"],
            ["Estimate document", docState(doc("Garage estimate"))],
          ],
        },
        {
          title: "Assessment summary",
          items: [
            ["Garage estimate", inrAmt(a.estimate)],
            ["Less disallowed items", a.disallowed ? `– ${inrAmt(a.disallowed)}` : "Nil"],
            ["Less rate difference (price list / labour rate)", a.rateCut ? `– ${inrAmt(a.rateCut)}` : "Nil"],
            ["Assessed loss", inrAmt(a.assessed), { strong: true }],
            ["Less depreciation", a.dep ? `– ${inrAmt(a.dep)}` : "Nil (zero depreciation)"],
            ["Less salvage", `– ${inrAmt(sv.salvage)}`],
            ["Less deductibles", `– ${inrAmt(sv.deductible)}`],
            ["Net liability (insurer pays)", inrAmt(sv.netLiability), { strong: true }],
            ["Insured's share", `${inrAmt(a.estimate - sv.netLiability)} (estimate less net liability)`],
            ["Estimate vs assessed", `${pct((a.estimate - a.assessed) / a.estimate)} lower than the estimate`],
            assessedOn && ["Assessed on", `${dt(assessedOn.date)} · ${assessedOn.by}`],
          ],
        },
        {
          title: "Deductibles & salvage",
          span: "lg:col-span-2 2xl:col-span-1",
          items: [
            ["Compulsory deductible", `${inrAmt(c.policy.compulsoryDeductible)} (${c.vehicle.cc > 1500 ? "above" : "up to"} 1500 cc · ${c.vehicle.cc} cc)`],
            ["Voluntary deductible", c.policy.voluntaryDeductible ? inrAmt(c.policy.voluntaryDeductible) : "Nil"],
            ["Imposed deductible", "Nil"],
            ["Salvage of replaced parts", `${inrAmt(sv.salvage)} · retained by the garage`],
            ["Total deduction", inrAmt(a.dep + sv.salvage + sv.deductible), { strong: true }],
          ],
        },
        {
          title: "Part-wise assessment",
          span: "lg:col-span-2 2xl:col-span-3",
          table: {
            cols: ["Item", "Type", "Action", "Estimate", "Assessed", "Dep. %", "Depreciation", "Remarks"],
            num: [3, 4, 5, 6],
            rows: a.lines.map((l) => [
              l.item,
              DEP_TEXT[l.type],
              l.action,
              inrAmt(l.estimate),
              l.assessed ? inrAmt(l.assessed) : "Nil",
              l.depRate ? `${Math.round(l.depRate * 1000) / 10}%` : "–",
              l.dep ? inrAmt(l.dep) : "–",
              l.remark,
            ]),
            foot: ["Total", "", "", inrAmt(a.estimate), inrAmt(a.assessed), "", sumDep ? inrAmt(sumDep) : "–", a.disallowed ? `${inrAmt(a.disallowed)} disallowed` : ""],
            dim: a.lines.map((l) => l.assessed === 0),
          },
        },
        {
          title: "Add-on covers applied",
          items: [
            ["Zero depreciation", has("Zero depreciation") ? "✓ Applied – no depreciation on parts" : "Not opted – depreciation applied"],
            ["Consumables", has("Consumables") ? `✓ Applied – ${inrAmt(a.split.consumables)} allowed` : `Not opted – ${inrAmt(a.split.consumables)} disallowed`],
            ["Engine protect", has("Engine protect") ? (/water/.test(a.impact) ? "✓ Applied – engine repair allowed" : "Opted – not triggered (no engine damage)") : /water/.test(a.impact) ? "Not opted – engine damage reviewed on survey findings" : "Not opted"],
            has("Return to invoice") && ["Return to invoice", "Opted – not applicable (applies to total loss / theft)"],
            has("Roadside assistance") && ["Roadside assistance", "Opted – service add-on, not part of the assessment"],
          ],
        },
        {
          title: "Depreciation",
          items: [
            ["Basis", a.zeroDep ? "Nil – Zero depreciation add-on" : "Policy depreciation schedule (IRDAI / Indian Motor Tariff)"],
            ["Vehicle age", `${a.age.label} (year of manufacture ${c.vehicle.yearOfMfg})`],
            ["Metal & electrical parts", a.zeroDep ? "Nil" : pct(a.metalRate)],
            ["Plastic / rubber / battery", a.zeroDep ? "Nil" : "50%"],
            ["Glass", "Nil"],
            ["Painting", a.zeroDep ? "Nil" : "12.5% (50% on paint material, taken as 25% of the paint bill)"],
            ["Labour", "Nil"],
            ["Total depreciation", inrAmt(a.dep), { strong: true }],
          ],
        },
        admissibility,
        {
          title: "Repair or total loss",
          items: [
            ["Assessed loss vs IDV", `${inrAmt(a.assessed)} of ${inrAmt(c.policy.idv)} · ${pct(a.assessed / c.policy.idv)}`],
            ["Total loss threshold", `${CTL_THRESHOLD * 100}% of IDV`],
            ["Result", a.assessed / c.policy.idv > CTL_THRESHOLD ? "✕ Above threshold – cost benefit analysis needed" : "✓ Repair basis – cost benefit analysis not needed"],
          ],
        },
        reserve,
        docsSec(["Garage estimate", "Survey report", "Vehicle photos", "FIR / police report", "Fire brigade report", "KYC – PAN / Aadhaar", "Cancelled cheque / bank details"]),
      ];
    } else if (a.basis === "ctl") {
      sections = [
        {
          title: "Total loss / CTL determination",
          items: [
            ["IDV", inrAmt(c.policy.idv), { strong: true }],
            ["Repair estimate", inrAmt(a.repairCost)],
            ["Repair cost vs IDV", `${a.pctIdv}% (threshold ${CTL_THRESHOLD * 100}%)`],
            ["Result", "✕ Constructive total loss – cost benefit analysis triggered", { strong: true }],
            ["Estimate document", docState(doc("Garage estimate"))],
          ],
        },
        {
          title: "Wreck quotes – online auction",
          items: [
            ...a.quotes.map((q, k) => [q.bidder, `${inrAmt(q.amount)}${k === 0 ? " · highest" : ""}`, k === 0 ? { strong: true } : undefined]),
            ["Basis", "As-is-where-is, wreck at the garage"],
          ],
        },
        {
          title: "Cost benefit analysis",
          items: [
            ["Repair basis", inrAmt(a.repairCost)],
            ["Total loss – net of salvage", inrAmt(a.netOfSalvage)],
            ["Total loss – insurer takes salvage", `${inrAmt(a.withSalvage)} less wreck sale ${inrAmt(a.best)}`],
            ["Recommended", a.recommended, { strong: true }],
            ["Saving vs repair", inrAmt(a.repairCost - a.netOfSalvage)],
            ["Approval", "Claims Approver decides the settlement type – Decision stage"],
          ],
        },
        {
          title: "Total loss working",
          items: [
            ["IDV", inrAmt(c.policy.idv)],
            ["Less compulsory deductible", `– ${inrAmt(c.policy.compulsoryDeductible)}`],
            ["Less wreck value (insured keeps wreck)", `– ${inrAmt(a.best)}`],
            ["Net payable – net of salvage", inrAmt(a.netOfSalvage), { strong: true }],
            ["Alternative – insurer takes wreck", `${inrAmt(a.withSalvage)} · RC, keys and Form 28/29/30 handed over`],
            ["Depreciation", "Not applicable – settled on IDV"],
            ["Financier", c.policy.financier ? `${c.policy.financier} – paid first up to the loan outstanding (NOC needed)` : "None"],
          ],
        },
        admissibility,
        reserve,
        { span: "lg:col-span-2 2xl:col-span-3", ...docsSec(["Garage estimate", "Survey report", "Vehicle photos", "FIR / police report", "Original keys & Form 28/29/30", "KYC – PAN / Aadhaar", "Cancelled cheque / bank details"]) },
      ];
    } else {
      sections = [
        {
          title: "Investigation outcome",
          items: [
            ["Investigator", sv.surveyor ? sv.surveyor.name : "–"],
            ["Investigation report", fraud ? "Received – red flags, referred to SIU" : "✓ Received – theft genuine, no adverse findings"],
            ["Police final report (non-traceable)", docState(doc("Non-traceable report (police)"))],
            ["Delay in intimation", `${c.loss.intimationDelayDays} day(s)${c.loss.intimationDelayDays > 2 ? " – explained in claim form" : " – within norms"}`],
          ],
        },
        {
          title: "Theft formalities checklist",
          items: [
            ...["FIR / police report", "Non-traceable report (police)", "Original keys & Form 28/29/30", "RC copy", "Claim form (signed)"].map((n) => doc(n) && [n, docState(doc(n))]).filter(Boolean),
            ["Financier NOC & loan statement", c.policy.financier ? `Needed – ${c.policy.financier}` : "Not applicable"],
            ["Subrogation letter & indemnity", "Signed at settlement"],
            ["RTO intimation", "Theft reported to RTO – RC marked"],
          ],
        },
        {
          title: "Theft settlement working",
          items: [
            ["IDV", inrAmt(a.idv), { strong: true }],
            ["Less compulsory deductible", `– ${inrAmt(a.deductible)}`],
            ["Net payable", inrAmt(a.net), { strong: true }],
            ["Payee", a.financier ? `${a.financier} up to the loan outstanding, balance to the insured` : "Insured"],
            ["Return to invoice", has("Return to invoice") ? "Opted – gap between invoice value and IDV payable on invoice copy" : "Not opted"],
            ["Depreciation", "Not applicable – settled on IDV"],
          ],
        },
        admissibility,
        reserve,
        docsSec(["KYC – PAN / Aadhaar", "Cancelled cheque / bank details"]),
      ];
    }
  } else if (index === 3) {
    // Decision – catalogue 114–118 authority & approval, 63 / 64 / 99 decision, 66–69 red flags & SIU,
    // 20 major loss, 168 IRDAI decision timeline, 73–75 repair authorisation, 146 / 144 letters & notifications
    const sv = c.survey;
    const a = sv.assessment;
    const d = c.decision || { amount: sv.netLiability ?? c.reserve, needsApproval: !!approvalSent, level: approvalSent ? "Claims Manager" : "Claims Handler", approver: authorised?.by || "–", kind: "repair" };
    const decided = authorised || ev("Approved");
    const surveyDone = ev("Survey completed");
    const decStep = journey?.find((x) => x.key === "decision");
    const days = (x, y) => Math.round((new Date(y + "T00:00:00") - new Date(x + "T00:00:00")) / 86400000);
    const chipText = (stp) => (stp?.chip && stp.chip.kind !== "none" ? `${stp.chip.kind === "met" ? "✓ " : stp.chip.kind === "due" ? "" : "✕ "}${stp.chip.text}` : "–");
    const fraud = c.flags.includes("Fraud flag");
    const LATER = ["Final invoice", "Satisfaction note / delivery"];
    const needDocs = documents.filter((x) => !LATER.includes(x.name));
    const gotDocs = needDocs.filter((x) => /received|verified/i.test(x.status));
    const network = c.garage && !/non-network/i.test(c.garage.type) && /network|dealer/i.test(c.garage.type);
    const amount = inrAmt(d.amount);
    const comment =
      d.kind === "ctl"
        ? `CBA accepted – total loss net of salvage is ${inrAmt(a ? a.repairCost - a.netOfSalvage : null)} cheaper than repair. Settle on net of salvage.`
        : d.kind === "theft"
          ? "Investigation report and police final report on file. Settle at IDV less compulsory deductible."
          : "Assessment checked against estimate and photos. Depreciation and deductibles as per policy. Approved as assessed.";
    sections = [
      {
        title: "Approval routing",
        items: [
          ["Amount for decision", amount, { strong: true }],
          ["Authority limits", `Handler up to ${inrAmt(100000)} · Manager up to ${inrAmt(500000)} · above: Zonal Claims Head`],
          [
            "Routed to",
            d.needsApproval ? `${d.approver} · ${d.level} – ${d.referred ? "referred by the handler" : "above the handler's limit"}` : "Not routed – within the handler's own authority",
          ],
          ["Maker", "Karthik Subramanian · Claims Handler"],
          ["Checker", d.needsApproval ? `${d.approver} · ${d.level}` : "System checks – rules, documents and red flags"],
          ["Maker-checker", d.needsApproval ? "✓ Maker and checker are different users" : "Not required – not a major loss, repudiation or closure without payment"],
          ["Sent for approval", approvalSent ? `${dt(approvalSent.date)} · ${approvalSent.time}` : "Not needed"],
          ["Delegated authority", "Not used"],
        ],
      },
      {
        title: "Decision",
        items: [
          ["Decision", decided ? "Approved" : "–", { strong: true }],
          ["Decided by", decided ? `${d.approver} · ${d.level}` : "–"],
          ["Decided on", decided ? `${dt(decided.date)} · ${decided.time}` : "–"],
          ["Approved amount", amount, { strong: true }],
          ["Change vs requested", "None – approved as assessed"],
          ["Settlement basis", "Standard – no deviation from policy terms"],
          ["Liability", "Admissible under Section I – Own Damage"],
          ["Comments (mandatory)", comment],
        ],
      },
      {
        title: "IRDAI decision timeline",
        items: [
          ["Survey report on", surveyDone ? `${dt(surveyDone.date)} · ${surveyDone.time}` : "–"],
          ["Decision on", decided ? `${dt(decided.date)} · ${decided.time}` : "–"],
          surveyDone && decided && ["Days taken", `${days(surveyDone.date, decided.date)} day(s)`],
          ["Decision within 7 days of the survey report", chipText(decStep)],
        ],
      },
      {
        title: "Checks before the decision",
        items: [
          ["Red flags", c.flags.length ? c.flags.join(", ") : "✓ None"],
          ["SIU referral", fraud || d.kind === "theft" ? "Referred – investigation report on file" : "Not referred"],
          ["Major loss alert", d.amount > 500000 ? "Raised – above ₹5,00,000, management informed" : "Not triggered"],
          ["Documents at decision", gotDocs.length === needDocs.length ? `✓ All ${needDocs.length} received` : `${gotDocs.length} of ${needDocs.length} received`],
          ["Admissibility", fraud ? "Pending SIU outcome" : "✓ Admissible – Assessment stage"],
        ],
      },
      d.kind === "repair" && {
        title: "Repair authorisation",
        items: [
          ["Type", network ? "Cashless – network garage" : "Reimbursement – insured pays the garage and claims the bills"],
          ["Issued to", c.garage ? c.garage.name.split(",")[0] : "–"],
          ["Issued on", authorised ? `${dt(authorised.date)} · ${authorised.time}` : "–"],
          ["Insurer pays", amount, { strong: true }],
          a?.lines && ["Items", `${a.lines.filter((l) => l.assessed > 0).length} allowed · ${a.lines.filter((l) => l.assessed === 0).length} disallowed`],
          a && ["Insured pays the garage", `${inrAmt(a.dep + sv.deductible + a.disallowed)} – depreciation ${inrAmt(a.dep)}, deductibles ${inrAmt(sv.deductible)}, disallowed ${inrAmt(a.disallowed)}`],
          ["Shared with garage & insured", "Allowed and disallowed items, depreciation and deductibles"],
        ],
      },
      d.kind === "ctl" && {
        title: "Settlement type decision",
        items: [
          ["CBA recommendation", a?.recommended || "–"],
          ["Approved basis", "Total loss – net of salvage (insured keeps the wreck)", { strong: true }],
          ["Net payable", amount, { strong: true }],
          a && ["Wreck value used", `${inrAmt(a.best)} – highest auction quote`],
          c.policy.financier && ["Financier", `${c.policy.financier} – paid first up to the loan outstanding`],
          ["Customer consent", "Settlement consent to be signed before payment"],
        ],
      },
      d.kind === "theft" && {
        title: "Theft claim approval",
        items: [
          ["Net payable", amount, { strong: true }],
          ["Basis", "IDV less compulsory deductible"],
          ["Payee", c.policy.financier ? `${c.policy.financier} up to the loan outstanding, balance to the insured` : "Insured"],
          ["Before payment", "Subrogation letter, indemnity, RC transfer (Form 28/29/30), keys"],
        ],
      },
      {
        title: "Letters & communication",
        items: [
          [d.kind === "repair" ? "Repair authorisation letter" : "Approval letter", decided ? `✓ Generated ${dt(decided.date)}` : "–"],
          ["Insured – SMS & email", decided ? `✓ Sent ${dt(decided.date)} · ${decided.time}` : "–"],
          d.kind === "repair" && ["Garage", decided ? "✓ Authorisation shared on email / garage portal" : "–"],
          d.kind !== "repair" && ["Consent & discharge voucher", "Sent for e-sign"],
          c.loss.intimationChannel && ["Intimation channel", `${c.loss.intimationChannel} – status updated`],
        ],
      },
    ].filter(Boolean);
  } else {
    sections = [
      {
        title: "Settlement",
        items: [
          ["Repair authorisation", authorised ? `Issued ${dt(authorised.date)}` : "–"],
          ["Garage", c.garage ? c.garage.name : "–"],
          ...c.payments.map((x) => [`Payment · ${dt(x.date)}`, `${inrAmt(x.amount)} to ${x.payee} · ${x.mode} · ${x.status}`]),
        ],
      },
    ];
  }

  return (
    <Card>
      <StageBarHeader index={index} label={label} status={<>Completed{completedOn ? ` on ${dt(completedOn.date)}` : ""} · <span className="text-slate-500">read only</span></>} done panel={panel} toggle={toggle} count={events.length} onUpload={onUpload} onBack={onBack} />

      {/* sections use the full width (two side by side on wide screens); activity floats over the right when opened */}
      <div className="relative p-2">
        {/* structured grid: cards in rows, equal height within a row (edges line up); 2 columns from
            1024 px, 3 on wide screens; big cards span 2. Fields follow the card's own width. */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {sections.map((sec) => (
            <section key={sec.title} className={`@container flex flex-col rounded-lg border border-slate-200 bg-white ${sec.span || ""}`}>
              <h3 className="border-b border-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B1F3A]">{sec.title}</h3>
              {sec.table ? <StageTable t={sec.table} /> : <Facts items={sec.items} cols="@md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4" />}
            </section>
          ))}
        </div>
        <StagePanels panel={panel} setPanel={setPanel} events={events} journey={journey} index={index} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
// Closure recorded in the claim data → the same shape as a status record saved in this session
const CLOSURE_STATE = { Paid: "SETTLED", Withdrawn: "WITHDRAWN", Repudiated: "REPUDIATED", "Closed without payment": "CLOSED", "NBNR closed": "NBNR_CLOSED" };
function closureRec(cl) {
  if (!cl) return null;
  const reason = cl.type === "Paid" ? `Paid ₹${cl.paid.toLocaleString("en-IN")} to ${cl.payee}` : cl.reason;
  return { state: CLOSURE_STATE[cl.type], reason, remarks: cl.utr ? `UTR ${cl.utr}` : "", decidedBy: cl.approvedBy, at: cl.closedOn, events: [] };
}

// Header chip for a closed claim (replaces the stage name)
const CLOSED_CHIP = { SETTLED: "Closed – paid", WITHDRAWN: "Withdrawn", CLOSED: "Closed – no payment", NBNR_CLOSED: "NBNR closed" };

// Every claim opens fresh on Claim 360 → Claim details: moving from one claim to another without
// leaving the page (a notification, browser Back) starts the page again, so the previous claim's
// tab, stage view or open panel never carries over.
export default function ODClaim360() {
  const { id } = useParams();
  return <ClaimPage key={id} />;
}

function ClaimPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const claimNo = claimFromSlug(id);
  const base = useMemo(() => getClaimDetail(claimNo), [claimNo]);
  // View (eye icon / row click) = read only. Edit (paper-and-pen icon, ?mode=edit) = work on the claim.
  const [params] = useSearchParams();
  // Opening a claim lands on the Claim 360 summary (all claim details, normal sidebar). "Work on claim"
  // opens the work view (?view=work) with the lifecycle stepper, the current stage's work and the tabs.
  const workView = params.get("view") === "work";
  const editMode = workView && params.get("mode") === "edit";

  const [tab, setTab] = useState("details");
  const [timelineView, setTimelineView] = useState("journey"); // Timeline tab: claim journey | all activity (audit trail)
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
  // Current-stage work by the handler (who is also the surveyor): inspection, report, assessment, decision, SIU
  const [flowDialog, setFlowDialog] = useState(null); // "inspect" | "report" | "assess" | "siu"
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

  // A claim closed earlier (My Work Queue → Closed) carries its closure in the claim data; a change made
  // in this session (e.g. reopen) is saved as the claim's status record and takes over from it
  const statusNow = statusRec || closureRec(base.closure);
  const st = effectiveState(base.stage, statusNow);
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
  // once the survey report is in (work.flow.report) the claim has moved on to Assessment
  const surveyed = !!surveyRec && !work.flow?.report && (st.stage === "Registered" || st.stage === "Survey pending");
  // Settlement (Repair / DO, Payment): payment requested → Payment; paid & closed → Closed
  const settled = st.state === "SETTLED";
  // ---- handler's own stage work saved in this session (work.flow) ----
  // report → Assessment · assessment → new figures + reserve at net liability · decision → Repair / DO or Approval
  const flow = work.flow || {};
  const fa = flow.assessment;
  const flowSurvey = fa
    ? {
        ...base.survey,
        estimate: fa.estimate,
        assessed: fa.assessed,
        depreciation: fa.dep,
        salvage: fa.sal,
        deductible: fa.deductible,
        netLiability: fa.net,
        assessment: {
          ...fa.meta,
          basis: "partial",
          lines: fa.ls,
          estimate: fa.estimate,
          assessed: fa.assessed,
          dep: fa.dep,
          net: fa.net,
          disallowed: fa.ls.filter((l) => l.assessed === 0).reduce((t, l) => t + l.estimate, 0),
          rateCut: fa.ls.filter((l) => l.assessed > 0).reduce((t, l) => t + (l.estimate - l.assessed), 0),
        },
      }
    : null;
  const flowSelfApproved = flow.decision?.type === "self";
  const settleBase = flowSelfApproved
    ? {
        ...base,
        stage: "Repair / DO",
        nextAction: "Track repair progress",
        survey: flowSurvey || base.survey,
        timeline: [{ date: flow.decision.on, time: flow.decision.time, event: "Repair authorised", by: flow.decision.by, detail: "" }, ...base.timeline],
      }
    : base;
  const settle = ["Repair / DO", "Payment"].includes(settleBase.stage) ? settlementState(settleBase, work.settlement || {}) : null;
  const stage0 = surveyed ? "Survey pending" : settled ? "Closed" : settle?.payment && settleBase.stage === "Repair / DO" ? "Payment" : st.stage;
  const EARLY = ["Registered", "Survey pending", "Assessment", "Documents pending", "Approval"];
  const flowStage =
    st.closed || st.waiting || !EARLY.includes(stage0)
      ? null
      : flowSelfApproved
        ? settle?.payment
          ? "Payment"
          : "Repair / DO"
        : flow.decision?.type === "sent"
          ? "Approval"
          : flow.report && ["Registered", "Survey pending"].includes(stage0)
            ? "Assessment"
            : null;
  const stage = flowStage || stage0;
  const baseLife = flowStage
    ? { ...STAGE_TO_STEP[flowStage], note: flowStage === "Approval" ? `Awaiting ${flow.decision.to}` : STAGE_TO_STEP[flowStage].note }
    : settled
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
  const flowChanged = !!(flowStage || fa || flow.siu || flow.report);
  const c =
    stage === base.stage && lifecycle === base.lifecycle && !released && !surveyed && !revised && !flowChanged
      ? base
      : {
          ...base,
          stage,
          lifecycle,
          ...(flow.report && {
            survey: { ...base.survey, surveyor: base.survey.surveyor || surveyRec?.surveyor || HANDLER_AS_SURVEYOR, appointedOn: base.survey.appointedOn || surveyRec?.at, surveyDoneOn: flow.report.on },
          }),
          ...(flowSurvey && { survey: { ...flowSurvey, surveyDoneOn: flow.report?.on || base.survey.surveyDoneOn } }),
          ...(flowStage === "Assessment" && { pendingWith: "Me (handler)", nextAction: fa ? "Approve or send for approval" : "Assess the loss – part-wise assessment", sla: { status: "ok", label: "Decision within 7 days" } }),
          ...(fa && flowStage !== "Repair / DO" && flowStage !== "Payment" && flowStage !== "Approval" && { nextAction: fa.net <= HANDLER_AUTHORITY ? `Approve within my authority – ₹${fa.net.toLocaleString("en-IN")}` : `Send for approval – ₹${fa.net.toLocaleString("en-IN")}` }),
          ...(flowStage === "Approval" && { pendingWith: flow.decision.to, nextAction: `Await decision – ${flow.decision.to}`, sla: { status: "ok", label: "2 working days" } }),
          ...(flowStage === "Repair / DO" && { pendingWith: "Garage / dealer", nextAction: "Track repair progress", sla: { status: "ok", label: "Repair in progress" } }),
          ...(flow.siu && { flags: [...new Set([...base.flags, "Referred to SIU"])], ...(!flowStage || flowStage === "Assessment" ? { nextAction: "Await SIU findings before the decision" } : {}) }),
          ...(revised && {
            reserve: work.revisions[work.revisions.length - 1].amount,
            reserveHistory: [...base.reserveHistory, ...work.revisions],
          }),
          ...(converted && {
            nextAction: needsIps(base) ? "Appoint surveyor (IPS)" : "Schedule inspection with garage",
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
              { date: statusNow.at, type: settled ? "Paid & closed" : "Released", amount: 0, by: "Claims handler", reason: statusNow.reason || "Claim closed" },
            ],
          }),
        };
  const active = !st.closed && !st.waiting; // closed / waiting for approval → only notes allowed
  // Documents: claim data + this session's requests, uploads and verification (catalogue 153, 154)
  // Past the Assessment step (Approval, Repair / DO, Payment, Closed) the documents received earlier were already verified
  const verifiedEarlier = (STAGE_TO_STEP[c.stage]?.step ?? 0) >= 3;
  const documents = [
    ...c.documents.map((d) => ({ ...d, ...(verifiedEarlier && d.status === "Received" ? { status: "Verified" } : {}), ...work.docs[d.name] })),
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
    ? [...c.checks, { label: variance.basisLabel === "net liability" ? "Reserve vs net liability" : "Reserve vs estimate", ok: !variance.alert, note: variance.pct === 0 ? `Matches the ${variance.basisLabel}` : `${variance.pct}% ${variance.over ? "above" : "below"} the ${variance.basisLabel}${variance.alert ? " – revise" : ""}` }]
    : c.checks;
  const timeline = [...(statusRec?.events || []), ...(surveyRec?.events || []), ...work.events, ...c.timeline].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  );
  // claim journey for the timeline (Timeline tab + stage view): steps with team, SLA status and regulatory basis
  const journey = claimJourney(c, timeline, {
    closedEvent: st.closed && statusNow?.at ? { date: statusNow.at, time: "17:00", event: "Claim closed", by: statusNow.decidedBy || "System", detail: [statusNow.reason, statusNow.remarks].filter(Boolean).join(" · ") } : null,
  });
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
  const setDoc = (name, patch) => (w) => ({ ...w, docs: { ...w.docs, [name]: { ...w.docs[name], ...patch } } });

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

  // ----- Handler's stage work: inspection → report → assessment → decision; SIU referral -----
  const PARTIAL_TYPES = ["Accident – partial", "Flood – CAT", "Fire", "Partial theft"];
  const canAssess = active && editMode && (c.stage === "Assessment" || c.stage === "Documents pending") && PARTIAL_TYPES.includes(c.lossType);
  const decisionAmt = c.survey.netLiability ?? c.reserve;
  const assessedReady = fa || (c.survey.assessed != null && (c.stage !== "Survey pending"));
  const canDecide =
    active &&
    editMode &&
    !flow.siu &&
    !flow.decision &&
    assessedReady &&
    ((c.stage === "Assessment" || c.stage === "Documents pending") ? true : c.stage === "Approval" && /me \(handler\)/i.test(c.pendingWith || ""));
  function scheduleInspection(rec) {
    setFlowDialog(null);
    setSurveyRec({ ...rec, events: [{ ...nowStamp(), event: "Inspection scheduled", by: HANDLER, detail: `${dt(rec.visitDate)} ${rec.time} · ${rec.location} · report due ${dt(rec.reportDue)}` }] });
    flash(`Inspection scheduled for ${dt(rec.visitDate)} at ${rec.time}.`);
  }
  function submitReport(r) {
    setFlowDialog(null);
    logWork(
      "Survey completed",
      `${dt(r.on)} · odometer ${r.odometer.toLocaleString("en-IN")} km · ${r.consistent ? "damage consistent with the cause" : "damage doubtful"} · ${r.recommend}${r.followUp ? " · follow-up inspection needed" : ""} · ${r.remarks}`,
      (w) => ({ ...w, flow: { ...(w.flow || {}), report: r } })
    );
    flash(r.consistent ? "Survey report submitted – assess the loss next." : "Survey report submitted – refer the claim to SIU.");
    if (!r.consistent) setFlowDialog("siu");
  }
  // base lines for the assessment dialog: this session's assessment, the claim's, or built from the estimate
  const assessBase = (() => {
    if (!canAssess) return null;
    const a = c.survey.assessment;
    if (a?.basis === "partial" && a.lines) return { lines: a.lines, zeroDep: a.zeroDep ?? c.survey.zeroDep, metalRate: a.metalRate ?? 0, age: a.age, impact: a.impact, split: a.split, salvage: c.survey.salvage };
    const est = c.survey.estimate ?? Math.round(c.reserve * 1.25);
    const t = partialAssessment({
      estimate: est,
      assessed: Math.round(est * 0.85),
      zeroDep: !!c.survey.zeroDep,
      yom: c.vehicle.yearOfMfg,
      lossDate: c.loss.date,
      cause: c.loss.cause,
      lossType: c.lossType,
      addOns: c.policy.addOns,
      salvage: 0,
      deductibles: c.policy.compulsoryDeductible + c.policy.voluntaryDeductible,
    });
    return { lines: t.lines, zeroDep: t.zeroDep, metalRate: t.metalRate, age: t.age, impact: t.impact, split: t.split, salvage: Math.round((est * 0.85 * 0.015) / 10) * 10 };
  })();
  function saveAssessment(x) {
    setFlowDialog(null);
    const meta = { zeroDep: assessBase.zeroDep, metalRate: assessBase.metalRate, age: assessBase.age, impact: assessBase.impact, split: assessBase.split };
    logWork(
      "Assessment saved",
      `Assessed ${amtF(x.assessed)} · depreciation ${amtF(x.dep)} · salvage ${amtF(x.sal)} · deductibles ${amtF(x.deductible)} · net liability ${amtF(x.net)}`,
      (w) => ({
        ...w,
        flow: { ...(w.flow || {}), assessment: { ...x, meta } },
        // reserve follows the expected payout (catalogue 19)
        revisions:
          x.net === c.reserve
            ? w.revisions
            : [...w.revisions, { date: isoToday(), type: x.net > c.reserve ? "Revised (increase)" : "Revised (decrease)", amount: x.net, by: HANDLER, reason: "Revised to net liability after assessment" }],
      })
    );
    flash(`Assessment saved – net liability ${amtF(x.net)}${x.net === c.reserve ? "" : ", reserve revised"}.`);
  }
  function approveSelf() {
    const stamp = nowStamp();
    logWork(
      "Repair authorised",
      `Within own authority (up to ${amtF(HANDLER_AUTHORITY)}) · insurer pays ${amtF(decisionAmt)} · authorisation sent to ${c.garage?.name.split(",")[0] || "the insured"}`,
      (w) => ({ ...w, flow: { ...(w.flow || {}), decision: { type: "self", on: stamp.date, time: stamp.time, by: `${HANDLER} · Claims Handler (within own authority)` } } })
    );
    flash(`Approved ${amtF(decisionAmt)} – repair authorisation sent.`);
  }
  function sendForApproval() {
    const to = decisionAmt > MANAGER_AUTHORITY ? "R. Venkatesh · Zonal Claims Head" : "Priya Raghavan · Claims Manager";
    const stamp = nowStamp();
    logWork("Sent for approval", `Net liability ${amtF(decisionAmt)} · to ${to} (above your authority of ${amtF(HANDLER_AUTHORITY)})`, (w) => ({
      ...w,
      flow: { ...(w.flow || {}), decision: { type: "sent", on: stamp.date, time: stamp.time, to } },
    }));
    flash(`Sent to ${to.split(" · ")[0]} for approval.`);
  }
  function referSiu(x) {
    setFlowDialog(null);
    logWork("Referred to SIU", `${x.reason} · ${x.remarks}`, (w) => ({ ...w, flow: { ...(w.flow || {}), siu: { ...x, on: isoToday() } } }));
    flash("Referred to SIU – the claim cannot be approved until SIU sends its findings.");
  }

  // ----- Settlement (DO → invoice → payee → discharge → payment → close) -----
  const amtF = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const saveSettle = (patch, event, detail) => logWork(event, detail, (w) => ({ ...w, settlement: { ...w.settlement, ...patch } }));
  function recordInvoice(inv) {
    setWorkDialog(null);
    const over = Math.round(((inv.amount - settle.assessed) / settle.assessed) * 1000) / 10;
    const flag = inv.amount > settle.assessed * (1 + INVOICE_TOLERANCE_PCT / 100);
    saveSettle({ invoice: inv }, "Final invoice received", `${inv.no} · ${inv.type} · GSTIN ${inv.gstin} · in favour of ${inv.favour} · ${amtF(inv.amount)} · ${over > 0 ? `${over}% above` : over < 0 ? `${-over}% below` : "matches"} assessed ${amtF(settle.assessed)}${flag ? " – sent to the surveyor for re-check" : ""}`);
    flash(flag ? `Invoice is ${over}% above the assessed loss – sent to the surveyor for re-check.` : "Final invoice recorded.");
  }
  function surveyorConfirmed() {
    saveSettle(
      { invoice: { ...settle.invoice, surveyorOk: true } },
      "Surveyor confirmed final bill",
      `Insurer pays ${amtF(settle.payable)}; bill above the assessed loss (${amtF(settle.invoice.amount - settle.assessed)}) to be collected by the garage from the insured`
    );
    flash("Surveyor confirmation recorded.");
  }
  // Re-inspection after repair (catalogue 47) – second click records the salvage (replaced parts) as collected
  function recordReinspection() {
    if (settle.reinspection) {
      saveSettle({ reinspection: { ...settle.reinspection, salvageCollected: true } }, "Salvage collected", "Replaced parts collected from the garage");
      flash("Salvage collection recorded.");
      return;
    }
    const by = c.survey?.surveyor?.name || "Karthik Subramanian";
    saveSettle({ reinspection: { on: isoToday(), by, partsVerified: true, salvageCollected: true } }, "Re-inspection done", `${by} · repairs done as authorised · replaced parts seen and collected as salvage`);
    flash("Re-inspection recorded.");
  }
  // Delivery order with the liability working sheet (catalogue 91)
  function issueDo() {
    const no = `DO/${c.claimNo.replace(/\//g, "").slice(-8)}`;
    saveSettle({ do: { no, date: isoToday(), sentTo: ["Repairer", "Insured", "Agent"] } }, "Delivery order issued", `${no} · insurer pays ${amtF(settle.payable)} · working sheet sent to repairer, insured and agent`);
    flash(`Delivery order ${no} issued.`);
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
      events: [{ ...stamp, event: "Claim closed – settled", by: "System (auto)", detail: `${reason} · UTR ${utr} · reserve released to ₹0` }, ...(statusNow?.events || [])],
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

  // shared by the summary and the work view
  const claimChips = (
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
  );
  const keyFacts = (
    <>
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
                <dt className="whitespace-nowrap text-[11px] font-medium uppercase leading-4 tracking-wide text-slate-500">{k}</dt>
                <dd
                  className={`mt-0.5 whitespace-nowrap text-[13px] leading-5 tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-800"}`}
                  title={String(v)}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
    </>
  );
  const policyChip = (
              <span
                className={`${CHIP} ${c.policy.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                title={c.policy.policyNo}
              >
                {c.policy.status === "In force" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                Policy · {c.policy.status}
              </span>
  );
  const nextActionRow = (
    <>
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
    </>
  );

  /* ---------------- Claim 360 summary (first screen) ---------------- */
  if (!workView) {
    const goWork = (edit) => navigate(`/od/claims/${id}?view=work${edit ? "&mode=edit" : ""}`);
    return (
      <ODShell active="queue" title="Claim 360" subtitle="Claim summary · all claim details" onNavigateMissing={notBuilt}>
        <div className="flex flex-col gap-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/od/worklist")}
                  aria-label="Back to My Work Queue"
                  title="Back to My Work Queue"
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
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
                {policyChip}
                <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => goWork(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Milestone className="h-4 w-4" aria-hidden="true" />
                  View lifecycle
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={() => goWork(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Work on claim
                  </button>
                )}
              </div>
            </div>
            {keyFacts}
            <ClaimStatusBanner rec={surveyed && statusNow?.state === "NBNR_CONVERTED" ? null : statusNow} />
            {nextActionRow}
          </Card>
          <Card>
            <div className="p-3">
              <ClaimDetailSections c={c} editMode={false} onSoon={notBuilt} />
            </div>
          </Card>
        </div>
        {toast && (
          <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </ODShell>
    );
  }

  return (
    <ODShell
      active="queue"
      // Claim no, insured and vehicle are shown once – in the claim card below – so the page header
      // carries only the screen name and the mode (edit / view only)
      title="Claim 360"
      subtitle={editMode ? "Working on the claim · actions are saved to the claim" : "Lifecycle · view only"}
      onNavigateMissing={notBuilt}
      claimNav={{ backTo: `/od/claims/${id}`, backLabel: "Back to claim summary", steps: lifecycleSteps }}
    >
      <div className="flex flex-col gap-2">
        {/* ---------------- Back (small screens only) ---------------- */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            onClick={() => navigate(`/od/claims/${id}`)}
            className="flex h-8 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to claim summary
          </button>
        </div>

        {/* ---------------- Claim header ---------------- */}
        <Card>
          {/* Row 1: claim no + status chips (left) · actions (edit mode only) + policy status (right) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
            {claimChips}
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
                {/* Handler = surveyor: only CAT / theft / total-loss claims need an external surveyor (IPS) */}
                {c.stage === "Registered" && needsIps(c) && (
                  <ActionButton icon={UserCheck} onClick={() => setSurveyDialog(true)} primary>
                    Appoint surveyor (IPS)
                  </ActionButton>
                )}
                {c.stage === "Registered" && !needsIps(c) && (
                  <ActionButton icon={UserCheck} onClick={() => setFlowDialog("inspect")} primary>
                    Schedule inspection
                  </ActionButton>
                )}
                {c.stage === "Survey pending" && !flow.report && (
                  <ActionButton icon={ClipboardCheck} onClick={() => setFlowDialog("report")} primary>
                    {needsIps(c) ? "Record IPS survey report" : "Submit survey report"}
                  </ActionButton>
                )}
                {c.stage === "NBNR" && (
                  <ActionButton icon={CheckCircle2} onClick={() => setStatusAction("nbnr")} primary>
                    Resolve NBNR
                  </ActionButton>
                )}
                {canAssess && (
                  <ActionButton icon={Calculator} onClick={() => setFlowDialog("assess")} primary={!fa}>
                    {fa ? "Edit assessment" : "Assess the loss"}
                  </ActionButton>
                )}
                {canDecide && decisionAmt <= HANDLER_AUTHORITY && (
                  <ActionButton icon={CheckCircle2} onClick={approveSelf} primary>
                    Approve within my authority
                  </ActionButton>
                )}
                {canDecide && decisionAmt > HANDLER_AUTHORITY && (
                  <ActionButton icon={Send} onClick={sendForApproval} primary>
                    Send for approval
                  </ActionButton>
                )}
                {flow.siu ? (
                  <span className="flex h-7 items-center gap-1.5 rounded-md bg-amber-50 px-2.5 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-200">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Referred to SIU
                  </span>
                ) : (
                  <ActionButton icon={ShieldAlert} onClick={() => setFlowDialog("siu")}>
                    Refer to SIU
                  </ActionButton>
                )}
                  </>
                )}
                <ClaimActionsMenu
                  stage={c.stage}
                  rec={statusNow}
                  canChangeSurveyor={c.stage === "Survey pending" && !!c.survey.surveyor && needsIps(c)}
                  onPick={(k) => (k === "surveyor" ? setSurveyDialog(true) : setStatusAction(k))}
                />
                  <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
                </>
              )}
              {policyChip}
            </div>
          </div>

          {keyFacts}

          {/* Status after a claim action (hold, withdrawn, closed, waiting for approval, NBNR resolved) */}
          <ClaimStatusBanner rec={surveyed && statusNow?.state === "NBNR_CONVERTED" ? null : statusNow} />

          {nextActionRow}
        </Card>

        {/* ---------------- Completed stage (read only) – or the normal tabs ---------------- */}
        {viewStage !== null ? (
          <StageView
            c={c}
            index={viewStage}
            label={LIFECYCLE[viewStage].label}
            documents={documents}
            timeline={timeline}
            journey={journey}
            onBack={() => setViewStage(null)}
            onUpload={editMode && active ? () => setWorkDialog("upload") : undefined}
          />
        ) : (
        <>
        {/* current stage: same stage bar as a completed stage (Timeline · Activity · Upload) */}
        {c.lifecycle.step < LIFECYCLE.length && (
          <CurrentStageBar
            c={c}
            index={c.lifecycle.step}
            label={LIFECYCLE[c.lifecycle.step].label}
            timeline={timeline}
            journey={journey}
            onUpload={editMode && active ? () => setWorkDialog("upload") : undefined}
          />
        )}
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
                  {t.key === "details" && settle ? "Settlement" : t.label}
                  {t.key === "docs" && pendingDocs.length + toVerify.length > 0 && (
                    <span className={`rounded px-1.5 text-[11px] font-semibold ${tab === t.key ? "bg-white/15" : "bg-amber-100 text-amber-900"}`}>
                      {pendingDocs.length + toVerify.length}
                    </span>
                  )}
                  {t.key === "queries" && openQueries.length > 0 && (
                    <span className={`rounded px-1.5 text-[11px] font-semibold ${tab === t.key ? "bg-white/15" : "bg-amber-100 text-amber-900"}`}>
                      {openQueries.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ===== Claim details – the whole claim, section by section ===== */}
            {tab === "details" && (
              <div className="flex flex-col gap-3 p-3">
                {variance?.alert && (
                  <div>
                    <VarianceBanner v={variance} reserve={c.reserve} pending={reservePending} canRevise={editMode} onRevise={() => setWorkDialog("reserve")} />
                  </div>
                )}
                {settle && (
                  <div>
                    <SettlementPanel
                      s={settle}
                      canAct={editMode && active}
                      closed={settled}
                      onInvoice={() => setWorkDialog("invoice")}
                      onSurveyorOk={surveyorConfirmed}
                      onReinspect={recordReinspection}
                      onIssueDo={issueDo}
                      onPayee={() => setWorkDialog("payee")}
                      onConsent={() => setWorkDialog("consent")}
                      onDelivery={() => setWorkDialog("delivery")}
                      onViewSheet={() => setWorkDialog("sheet")}
                      onRequestPayment={requestPayment}
                      onMarkPaid={markPaid}
                    />
                  </div>
                )}
                {/* Settlement stage: only the settlement work here – policy, insured, vehicle and loss details
                    are already on the Claim 360 summary the claim opens on, so they are not repeated */}
                {settle ? (
                  <p className="text-[12px] text-slate-500">
                    Policy, insured, vehicle and loss details are on the{" "}
                    <Link to={`/od/claims/${id}`} className="font-medium text-teal-700 hover:underline">
                      Claim 360 summary
                    </Link>
                    .
                  </p>
                ) : (
                  <ClaimDetailSections c={c} editMode={editMode} onSoon={notBuilt} />
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
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                            <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
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
                              <button type="button" aria-disabled="true" title="Document viewer – available in a later build step" className="cursor-not-allowed text-[12px] font-medium text-slate-500">
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
                      <tr className="text-[11px] uppercase tracking-wide text-slate-500">
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
                              <span className={`rounded px-1.5 text-[12px] font-semibold leading-5 ${p.status.startsWith("Paid") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{p.status}</span>
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
              <div>
              {/* Claim journey (single-lane timeline) by default; the full audit trail one click away */}
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <div role="radiogroup" aria-label="Timeline view" className="inline-flex overflow-hidden rounded-md border border-slate-300">
                  {[
                    ["journey", "Claim journey"],
                    ["activity", `All activity (${timeline.length})`],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={timelineView === k}
                      onClick={() => setTimelineView(k)}
                      className={`h-7 px-2.5 text-[12px] font-medium ${timelineView === k ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-slate-500">{timelineView === "journey" ? "Key steps with SLA and regulatory basis" : "Every action, note, call and document – audit trail"}</span>
              </div>
              {timelineView === "journey" ? (
                <ClaimTimeline steps={journey} />
              ) : (
              <ol className="relative px-4 py-3">
                {timeline.map((e, i) => (
                  <li key={i} className="relative border-l-2 border-slate-200 pb-3 pl-4 last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-700" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[12.5px] font-semibold text-slate-800">{e.event}</span>
                      <span className="text-[12px] tabular-nums text-slate-500">
                        {dt(e.date)} · {e.time}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-600">{e.detail}</div>
                    <div className="text-[12px] text-slate-500">
                      by {e.by}
                      {e.visibility && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">Visible to: {e.visibility}</span>}
                    </div>
                  </li>
                ))}
              </ol>
              )}
              </div>
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
                    <span className="text-[12px] text-slate-500">Target {tat.target} d · avg {tat.actual} d</span>
                  </div>
                  {c.pendingWith === "Insured" && (
                    <p className="mt-1.5 text-[12px] text-slate-500">
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
                    {k.ok === null && <MinusCircle className="mt-px h-3.5 w-3.5 flex-none text-slate-500" aria-label="Not applicable" />}
                    {k.ok === "pending" && <Clock className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-label="Pending" />}
                    <span className="min-w-0">
                      <span className="block text-slate-800">{k.label}</span>
                      <span
                        className={`block text-[12px] ${k.ok === false ? "text-red-700" : k.ok === "pending" ? "text-amber-800" : "text-slate-500"}`}
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
                  <Car className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-500" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800">{c.insured}</span>
                    <span className="block text-[12px] text-slate-500">Insured</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-slate-600">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{c.contact.mobile}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" aria-hidden="true" />{c.contact.email}</span>
                    </span>
                  </span>
                </li>
                {c.survey.surveyor && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-500" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.survey.surveyor.name}</span>
                      <span className="block text-[12px] text-slate-500">Surveyor · {c.survey.surveyor.licence}</span>
                    </span>
                  </li>
                )}
                {c.garage && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-500" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.garage.name}</span>
                      <span className="block text-[12px] text-slate-500">{c.garage.type}</span>
                    </span>
                  </li>
                )}
              </ul>
              <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">Mobile and email are masked for privacy.</p>
            </Card>
          </div>
        </div>
        </>
        )}
      </div>

      {/* ---------------- Modals ---------------- */}
      {statusAction && (
        <ClaimStatusDialog
          action={statusAction}
          claim={base}
          rec={statusNow}
          onCancel={() => setStatusAction(null)}
          onDone={(next, msg) => {
            setStatusRec(next);
            setStatusAction(null);
            flash(msg);
          }}
        />
      )}

      {flowDialog === "inspect" && <ScheduleInspectionDialog claim={c} surveyor={HANDLER_AS_SURVEYOR} onCancel={() => setFlowDialog(null)} onDone={scheduleInspection} />}
      {flowDialog === "report" && <SurveyReportDialog claim={c} onCancel={() => setFlowDialog(null)} onDone={submitReport} />}
      {flowDialog === "assess" && assessBase && <AssessmentDialog claim={c} base={assessBase} handlerLimit={HANDLER_AUTHORITY} onCancel={() => setFlowDialog(null)} onDone={saveAssessment} />}
      {flowDialog === "siu" && <ReferSiuDialog claim={c} onCancel={() => setFlowDialog(null)} onDone={referSiu} />}
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
                    <span className="text-[12px] text-slate-500">{v.hint}</span>
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
            <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[12px] text-slate-600">
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