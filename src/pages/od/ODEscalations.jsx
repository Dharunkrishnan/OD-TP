// src/pages/od/ODEscalations.jsx
// OD Claims Manager – Escalations (route /od/escalations, ?esc=ESC-26-0412 opens one)
// Persona: Priya Raghavan · OD0150 · Claims Manager, Chennai
//
// Only what a manager acts on: every escalation on a team claim, the response due date,
// and three actions – Acknowledge · Assign follow-up to the handler · Respond & close.
//
// Sources and response timelines (RESPONSE_RULES – confirm with Compliance before go-live):
//   IGMS / Bima Bharosa  – IRDAI grievance portal: acknowledge immediately, resolve with a final letter in 14 days
//   Customer complaint   – call centre / email / branch: every complaint is a grievance → same 14 days
//   Ombudsman award      – comply with the award within 30 days of receipt
//   Legal notice         – internal: reply through the Legal team within 15 days
//   SLA escalation       – internal: claim breached by more than 3 days → manager action within 2 days
// Reference: IRDAI Master Circular on Protection of Policyholders' Interests, 2024.
//
// Demo: escalations are sample data; actions are kept for this browser session (sessionStorage).
// Replace with: GET /od/manager/escalations · POST /od/escalations/:id/{acknowledge|follow-up|close}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Gavel,
  Landmark,
  ListTodo,
  Mail,
  MessageSquareWarning,
  Scale,
  Search,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { auditLog, useAuth, getRole } from "../../auth";
import { claimSlug } from "../../data/odClaimDetail";
import { WORK_QUEUE } from "../../data/odHandlerMock";
import { TEAM } from "../../data/odTeamMock";

/* ================================================================== */
/* Rules                                                               */
/* ================================================================== */
const RESPONSE_RULES = {
  IGMS: { label: "IGMS / Bima Bharosa", days: 14, basis: "IRDAI: resolve with a final letter within 14 days", Icon: Landmark, tone: "bg-indigo-50 text-indigo-800 ring-indigo-200", external: true },
  CUSTOMER: { label: "Customer complaint", days: 14, basis: "IRDAI: every complaint is a grievance – 14 days", Icon: MessageSquareWarning, tone: "bg-sky-50 text-sky-800 ring-sky-200", external: true },
  OMBUDSMAN: { label: "Ombudsman award", days: 30, basis: "Comply with the award within 30 days of receipt", Icon: Scale, tone: "bg-purple-50 text-purple-800 ring-purple-200", external: true },
  LEGAL: { label: "Legal notice", days: 15, basis: "Internal: reply through the Legal team within 15 days", Icon: Gavel, tone: "bg-slate-100 text-slate-800 ring-slate-300", external: true },
  SLA: { label: "SLA escalation", days: 2, basis: "Internal: claim breached > 3 days – manager action within 2 days", Icon: Timer, tone: "bg-red-50 text-red-700 ring-red-200", external: false },
};

const CLOSE_OUTCOMES = {
  external: ["Accepted – claim settled / will be settled", "Partly accepted – reasons given", "Not accepted – reasons given in final letter", "Withdrawn by complainant", "Duplicate of another complaint"],
  internal: ["Action taken – claim moved forward", "Claim reallocated", "Waiting on external party – documented", "Claim closed"],
};

const STATUS = {
  NEW: { label: "New", tone: "bg-red-50 text-red-700 ring-red-200" },
  ACK: { label: "Acknowledged", tone: "bg-amber-50 text-amber-900 ring-amber-200" },
  FOLLOWUP: { label: "With handler", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  CLOSED: { label: "Closed", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
};

/* ================================================================== */
/* Demo escalations (raisedDaysAgo is relative to today)               */
/* ================================================================== */
const Q = Object.fromEntries(WORK_QUEUE.map((r) => [r.claimNo, r]));
const fromQueue = (no) => {
  const r = Q[no];
  return r ? { insured: r.insured, vehicle: r.vehicle, regNo: r.regNo, stage: r.stage, pendingWith: r.pendingWith === "Me (handler)" ? "Handler" : r.pendingWith, sla: r.sla, reserve: r.reserve, ageDays: r.ageDays, real: true } : {};
};

const SAMPLE = [
  {
    id: "ESC-26-0412", source: "IGMS", raisedDaysAgo: 13, status: "ACK", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004529", ...fromQueue("OD/CHN/26/004529"),
    ref: "IGMS token 2026-TN-118734", raisedBy: "T. Bhuvana (insured) via Bima Bharosa", channel: "Bima Bharosa portal",
    complaint: "Claim pending for over 50 days. Garage has finished the repair but says the insurer has not cleared it. I have already given all documents.",
    history: [{ d: 13, text: "Grievance received from IGMS / Bima Bharosa" }, { d: 13, text: "Acknowledged to complainant" }],
  },
  {
    id: "ESC-26-0398", source: "IGMS", raisedDaysAgo: 15, status: "FOLLOWUP", handler: "Arvind Kumar",
    claimNo: "OD/CHN/26/003290", insured: "S. Karthika", vehicle: "Maruti Brezza ZXi", regNo: "TN 09 BK 4410", stage: "Survey pending", pendingWith: "Surveyor", sla: { status: "breach", label: "Breached 6 d" }, reserve: 48500, ageDays: 66,
    ref: "IGMS token 2026-TN-117902", raisedBy: "S. Karthika (insured) via IGMS", channel: "IGMS portal",
    complaint: "Surveyor has not inspected my car for 3 weeks. Car is lying at the garage and I am paying for a taxi daily.",
    history: [{ d: 15, text: "Grievance received from IGMS" }, { d: 15, text: "Acknowledged to complainant" }, { d: 12, text: "Follow-up assigned to Arvind: get survey done, update customer" }],
  },
  {
    id: "ESC-26-0421", source: "CUSTOMER", raisedDaysAgo: 0, status: "NEW", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004498", ...fromQueue("OD/CHN/26/004498"),
    ref: "Email · CRM case 55821", raisedBy: "M. Ashok Kumar (insured)", channel: "Email to claims@",
    complaint: "Why is my claim stuck in approval? The garage says they cannot start work without approval. Please escalate.",
    history: [{ d: 0, text: "Complaint received by email – CRM case created" }],
  },
  {
    id: "ESC-26-0417", source: "CUSTOMER", raisedDaysAgo: 4, status: "ACK", handler: "Meena Sundaram",
    claimNo: "OD/CHN/26/003490", insured: "P. Lavanya", vehicle: "Hyundai Venue SX", regNo: "TN 14 DR 7720", stage: "Payment", pendingWith: "Finance", sla: { status: "ok", label: "2 d left" }, reserve: 76400, ageDays: 29,
    ref: "Call centre ticket CC-889120", raisedBy: "P. Lavanya (insured)", channel: "Call centre",
    complaint: "Depreciation deducted on plastic parts is too high. I want a breakup of the settlement before I accept.",
    history: [{ d: 4, text: "Complaint logged by call centre" }, { d: 4, text: "Acknowledged to complainant (SMS + email)" }],
  },
  {
    id: "ESC-26-0377", source: "OMBUDSMAN", raisedDaysAgo: 21, status: "FOLLOWUP", handler: "Rahul Menon",
    claimNo: "OD/CHN/26/003955", insured: "J. Kavitha", vehicle: "Tata Punch Creative", regNo: "TN 05 CP 3381", stage: "Documents pending", pendingWith: "Insured", sla: { status: "risk", label: "10 h left" }, reserve: 221000, ageDays: 58,
    ref: "Ombudsman Chennai · Award CHN-G-044-2627-0193", raisedBy: "Insurance Ombudsman, Chennai", channel: "Award letter",
    complaint: "Award in favour of the insured: pay ₹1,86,000 towards repair cost with interest as per Rule 17 of the Insurance Ombudsman Rules, 2017.",
    history: [{ d: 21, text: "Award received from the Ombudsman" }, { d: 20, text: "Legal reviewed – no appeal" }, { d: 18, text: "Follow-up assigned to Rahul: process payment as per award" }],
  },
  {
    id: "ESC-26-0405", source: "LEGAL", raisedDaysAgo: 6, status: "ACK", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004445", ...fromQueue("OD/CHN/26/004445"),
    ref: "Advocate notice · Regd. post RN 7741 2290", raisedBy: "Adv. R. Selvam for B. Karthikeyan", channel: "Registered post",
    complaint: "Legal notice demanding settlement of the theft claim for the full IDV within 15 days, failing which a consumer complaint will be filed.",
    history: [{ d: 6, text: "Legal notice received" }, { d: 6, text: "Forwarded to Legal team" }],
  },
  {
    id: "ESC-26-0419", source: "SLA", raisedDaysAgo: 1, status: "NEW", handler: "Arvind Kumar",
    claimNo: "OD/CHN/26/003291", insured: "N. Revathi", vehicle: "Kia Seltos HTX", regNo: "TN 12 KM 5512", stage: "Documents pending", pendingWith: "Insured", sla: { status: "breach", label: "Breached 4 d" }, reserve: 314300, ageDays: 65,
    ref: "Auto-escalated by system", raisedBy: "SLA rule – breached > 3 days", channel: "System",
    complaint: "Claim breached the settlement SLA by 4 days. Documents pending with the insured for 19 days; 2 reminders sent.",
    history: [{ d: 1, text: "Auto-escalated: SLA breached by more than 3 days" }],
  },
  {
    id: "ESC-26-0420", source: "SLA", raisedDaysAgo: 0, status: "NEW", handler: "Fathima Begum",
    claimNo: "OD/CHN/26/003890", insured: "V. Ashwin", vehicle: "Toyota Glanza G", regNo: "TN 19 AF 2205", stage: "Survey pending", pendingWith: "Surveyor", sla: { status: "breach", label: "Breached 4 d" }, reserve: 64200, ageDays: 41,
    ref: "Auto-escalated by system", raisedBy: "SLA rule – breached > 3 days", channel: "System",
    complaint: "Claim breached the survey SLA by 4 days. Handler is on leave.",
    history: [{ d: 0, text: "Auto-escalated: SLA breached by more than 3 days" }],
  },
  {
    id: "ESC-26-0363", source: "CUSTOMER", raisedDaysAgo: 9, status: "CLOSED", handler: "Divya Ramesh",
    claimNo: "OD/CHN/26/003090", insured: "G. Sathish", vehicle: "Maruti Swift VXi", regNo: "TN 07 CJ 1180", stage: "Repair / DO", pendingWith: "Garage / dealer", sla: { status: "ok", label: "3 d left" }, reserve: 41800, ageDays: 22,
    ref: "Branch letter BR-CHN-2210", raisedBy: "G. Sathish (insured)", channel: "Branch",
    complaint: "Delivery order not issued even after the final invoice was submitted.",
    history: [{ d: 9, text: "Complaint received at branch" }, { d: 9, text: "Acknowledged to complainant" }, { d: 7, text: "Follow-up assigned to Divya: issue DO today" }, { d: 6, text: "Closed – Accepted – claim settled / will be settled: DO issued, customer informed" }],
    outcome: "Accepted – claim settled / will be settled",
  },
];

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
const STORE_KEY = "smartclaims-escalation-updates";
const DAY = 86400000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const fmtDate = (t) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (t) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const first = (n) => n.split(" ")[0];

function readUpdates() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveUpdates(u) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

// due position: days left (negative = overdue)
function dueInfo(e, today) {
  const raised = today - e.raisedDaysAgo * DAY;
  const due = raised + RESPONSE_RULES[e.source].days * DAY;
  const left = Math.round((due - today) / DAY);
  return { raised, due, left };
}

function Chip({ tone, children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function SourceChip({ source }) {
  const r = RESPONSE_RULES[source];
  return (
    <Chip tone={r.tone}>
      <r.Icon className="h-3 w-3" aria-hidden="true" />
      {r.label}
    </Chip>
  );
}

function DueChip({ e, today }) {
  if (e.status === "CLOSED") return <Chip tone={STATUS.CLOSED.tone}>Closed</Chip>;
  const { left } = dueInfo(e, today);
  const tone = left < 0 ? "bg-red-600 text-white ring-red-600" : left <= 2 ? "bg-amber-50 text-amber-900 ring-amber-300" : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <Chip tone={tone} title={RESPONSE_RULES[e.source].basis}>
      {left < 0 ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CalendarClock className="h-3 w-3" aria-hidden="true" />}
      {left < 0 ? `Overdue ${-left} d` : left === 0 ? "Due today" : `Due in ${left} d`}
    </Chip>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex h-8 items-center justify-between gap-2 border-b border-slate-100 px-3">
        <h3 className="text-[12.5px] font-semibold text-[#0B1F3A]">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/* ================================================================== */
/* Action dialog                                                       */
/* ================================================================== */
function ActionDialog({ mode, e, today, onCancel, onConfirm }) {
  const rule = RESPONSE_RULES[e.source];
  const { due } = dueInfo(e, today);
  const maxDate = new Date(Math.max(due, today)).toISOString().slice(0, 10);
  const [task, setTask] = useState("");
  const [by, setBy] = useState(new Date(Math.min(today + DAY, Math.max(due, today))).toISOString().slice(0, 10));
  const [outcome, setOutcome] = useState("");
  const [response, setResponse] = useState("");
  const [letter, setLetter] = useState(false);
  const [tried, setTried] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const esc = (ev) => ev.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const errors = {};
  if (mode === "followup") {
    if (task.trim().length < 10) errors.task = "Write at least 10 characters.";
    if (!by) errors.by = "Choose a date.";
  }
  if (mode === "close") {
    if (!outcome) errors.outcome = "Select an outcome.";
    if (response.trim().length < 20) errors.response = "Write at least 20 characters.";
    if (rule.external && !letter) errors.letter = "Confirm the final reply has been sent.";
  }
  const err = (k) => (tried ? errors[k] : null);
  const valid = Object.keys(errors).length === 0;

  function submit(ev) {
    ev.preventDefault();
    setTried(true);
    if (!valid) return;
    if (mode === "ack") onConfirm({ kind: "ack" });
    if (mode === "followup") onConfirm({ kind: "followup", task: task.trim(), by });
    if (mode === "close") onConfirm({ kind: "close", outcome, response: response.trim() });
  }

  const title = { ack: "Acknowledge escalation", followup: `Assign follow-up to ${first(e.handler)}`, close: "Respond & close" }[mode];
  const button = { ack: "Acknowledge", followup: "Assign follow-up", close: "Close escalation" }[mode];
  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(ev) => ev.target === ev.currentTarget && onCancel()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="esc-dialog-title" className="w-full max-w-[460px] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="esc-dialog-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              {title}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              {e.id} · <span className="font-mono">{e.claimNo}</span> · {e.insured}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {mode === "ack" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              {rule.external
                ? `An acknowledgement with the escalation number goes to ${e.raisedBy.split(" (")[0].split(" via")[0]} by SMS and email. ${rule.basis}.`
                : `Marks that you have seen this SLA escalation. ${rule.basis}.`}
            </p>
          )}

          {mode === "followup" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">
                  What {first(e.handler)} must do <span className="text-red-600">*</span>
                </span>
                <textarea
                  ref={firstRef}
                  value={task}
                  onChange={(ev) => setTask(ev.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="e.g. Get the survey done today and call the customer with an update"
                  className="w-full resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  aria-invalid={!!err("task")}
                />
                {err("task") && <span className="mt-1 block text-[11.5px] text-red-700">{err("task")}</span>}
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">
                  Complete by <span className="text-red-600">*</span>
                </span>
                <input type="date" value={by} min={new Date(today).toISOString().slice(0, 10)} max={maxDate} onChange={(ev) => setBy(ev.target.value)} className={inputCls} aria-invalid={!!err("by")} />
                <span className="mt-1 block text-[11.5px] text-slate-500">On or before the response due date ({fmtDate(due)}). Goes to {first(e.handler)}'s diary as a task.</span>
              </label>
            </>
          )}

          {mode === "close" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">
                  Outcome <span className="text-red-600">*</span>
                </span>
                <select ref={firstRef} value={outcome} onChange={(ev) => setOutcome(ev.target.value)} className={inputCls} aria-invalid={!!err("outcome")}>
                  <option value="">Select</option>
                  {CLOSE_OUTCOMES[rule.external ? "external" : "internal"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                {err("outcome") && <span className="mt-1 block text-[11.5px] text-red-700">{err("outcome")}</span>}
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">
                  {rule.external ? "Final response to the complainant" : "Action taken"} <span className="text-red-600">*</span>
                </span>
                <textarea
                  value={response}
                  onChange={(ev) => setResponse(ev.target.value.slice(0, 600))}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  aria-invalid={!!err("response")}
                />
                {err("response") ? (
                  <span className="mt-1 block text-[11.5px] text-red-700">{err("response")}</span>
                ) : (
                  <span className="mt-1 block text-[11.5px] text-slate-500">Minimum 20 characters · saved in the claim's audit trail{rule.external ? " and on the final letter" : ""}</span>
                )}
              </label>
              {rule.external && (
                <div>
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
                    <input type="checkbox" checked={letter} onChange={(ev) => setLetter(ev.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
                    <span>
                      Final reply sent to the complainant{e.source === "IGMS" ? " and updated on IGMS / Bima Bharosa" : e.source === "OMBUDSMAN" ? " and compliance reported to the Ombudsman" : ""}
                      {e.source === "LEGAL" ? " through the Legal team" : ""}
                    </span>
                  </label>
                  {err("letter") && <span className="mt-1 block text-[11.5px] text-red-700">{err("letter")}</span>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button ref={mode === "ack" ? firstRef : undefined} type="submit" className={`h-9 rounded-lg px-3 text-[13px] font-semibold text-white ${mode === "close" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-[#0B1F3A] hover:bg-[#13305a]"}`}>
            {button}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
export default function ODEscalations() {
  const { user } = useAuth();
  if (getRole(user, "OD")?.role !== "CLAIMS_MANAGER") return <NotForRole />;
  return <EscalationsPage />;
}

function NotForRole() {
  const navigate = useNavigate();
  return (
    <ODShell active="escalations" title="Escalations">
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <XCircle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="mt-2 text-[15px] font-semibold text-[#0B1F3A]">Escalations is for the Claims Manager</h2>
        <p className="mt-1 text-[13px] text-slate-500">Change role from your name at the top right → Select role.</p>
        <button type="button" onClick={() => navigate("/od/dashboard")} className="mt-4 h-9 rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white">
          Go to my dashboard
        </button>
      </div>
    </ODShell>
  );
}

const FILTERS = [
  { key: "open", label: "Open", test: (e) => e.status !== "CLOSED" },
  { key: "overdue", label: "Overdue", test: (e, t) => e.status !== "CLOSED" && dueInfo(e, t).left < 0 },
  { key: "grievance", label: "Grievances", test: (e) => e.status !== "CLOSED" && RESPONSE_RULES[e.source].external },
  { key: "sla", label: "SLA", test: (e) => e.status !== "CLOSED" && e.source === "SLA" },
  { key: "closed", label: "Closed", test: (e) => e.status === "CLOSED" },
];

function EscalationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [updates, setUpdates] = useState(readUpdates);
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);
  const [today] = useState(startOfToday);

  // sample + this session's actions
  const all = useMemo(
    () =>
      SAMPLE.map((e) => {
        const u = updates[e.id];
        return u ? { ...e, status: u.status, outcome: u.outcome || e.outcome, history: [...e.history, ...u.history] } : e;
      }),
    [updates]
  );

  const f = FILTERS.find((x) => x.key === filter);
  const q = query.trim().toLowerCase();
  const list = all
    .filter((e) => f.test(e, today))
    .filter((e) => !q || [e.id, e.claimNo, e.insured, e.handler, e.ref].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (filter === "closed" ? a.raisedDaysAgo - b.raisedDaysAgo : dueInfo(a, today).left - dueInfo(b, today).left));

  const wanted = params.get("esc");
  const selected = list.find((e) => e.id === wanted) || list[0] || all.find((e) => e.id === wanted) || null;
  const select = (e) => setParams(e ? { esc: e.id } : {}, { replace: true });

  const open = all.filter((e) => e.status !== "CLOSED");
  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, all.filter((e) => x.test(e, today)).length]));

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function act(a) {
    const e = selected;
    const prev = updates[e.id] || { status: e.status, history: [] };
    let status = prev.status;
    let text = "";
    if (a.kind === "ack") {
      status = "ACK";
      text = RESPONSE_RULES[e.source].external ? "Acknowledged to complainant (SMS + email)" : "Acknowledged by manager";
    }
    if (a.kind === "followup") {
      status = "FOLLOWUP";
      text = `Follow-up assigned to ${first(e.handler)} by ${fmtShort(new Date(a.by).getTime())}: ${a.task}`;
    }
    if (a.kind === "close") {
      status = "CLOSED";
      text = `Closed – ${a.outcome}: ${a.response}`;
    }
    const next = { ...updates, [e.id]: { status, outcome: a.outcome || prev.outcome, history: [...prev.history, { d: 0, text, now: true }] } };
    setUpdates(next);
    saveUpdates(next);
    auditLog("ESCALATION_" + a.kind.toUpperCase(), { id: e.id, claimNo: e.claimNo, ...a });
    setDialog(null);
    setToast(`${e.id} · ${a.kind === "ack" ? "Acknowledged" : a.kind === "followup" ? `Follow-up sent to ${first(e.handler)}` : "Closed"}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    if (a.kind === "close") {
      const rest = list.filter((x) => x.id !== e.id);
      select(rest[0] || e);
    }
  }

  function undo(id) {
    const next = { ...updates };
    delete next[id];
    setUpdates(next);
    saveUpdates(next);
  }

  const overdue = counts.overdue;

  return (
    <ODShell
      active="escalations"
      title="Escalations"
      subtitle={`${open.length} open${overdue ? ` · ${overdue} overdue` : ""} · grievances must be resolved within ${RESPONSE_RULES.IGMS.days} days`}
      onNavigateMissing={(l) => {
        setToast(`${l} comes in a later build step.`);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2600);
      }}
    >
      <div className="flex flex-col gap-2 lg:h-[calc(100vh-68px)] lg:flex-row">
        {/* ---------------- List ---------------- */}
        <aside data-esc-list className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white lg:w-[350px] lg:flex-none">
          <div className="border-b border-slate-100 px-3 pb-2 pt-2">
            <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
              <Search className="h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Escalation no, claim no, insured, handler" aria-label="Search escalations" className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-slate-400" />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1" role="tablist" aria-label="Filter escalations">
              {FILTERS.map((x) => {
                const on = filter === x.key;
                const alert = x.key === "overdue" && counts.overdue > 0;
                return (
                  <button
                    key={x.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(x.key)}
                    className={`h-6 rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset ${on ? "bg-[#0B1F3A] text-white ring-[#0B1F3A]" : alert ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                  >
                    {x.label} <span className={`tabular-nums ${on ? "text-teal-300" : alert ? "text-red-600" : "text-slate-400"}`}>{counts[x.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {list.map((e) => {
              const on = selected?.id === e.id;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => select(e)} aria-current={on ? "true" : undefined} className={`block w-full border-l-[3px] px-3 py-1.5 text-left ${on ? "border-teal-600 bg-teal-50/60" : "border-transparent hover:bg-slate-50"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-800">{e.id}</span>
                      <DueChip e={e} today={today} />
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-600">
                      <span className="font-mono text-[11px] text-teal-800">{e.claimNo}</span> · {e.insured} · {first(e.handler)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      <SourceChip source={e.source} />
                      <Chip tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Chip>
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="px-3 py-8 text-center text-[12.5px] text-slate-500">{filter === "overdue" ? "Nothing overdue." : "No escalations here."}</li>}
          </ul>
        </aside>

        {/* ---------------- Detail ---------------- */}
        {selected ? (
          <Detail key={selected.id} e={selected} today={today} canUndo={!!updates[selected.id]} onAct={setDialog} onUndo={() => undo(selected.id)} onOpenClaim={() => navigate(`/od/claims/${claimSlug(selected.claimNo)}`)} onTeamQueue={() => navigate(`/od/team-queue?handler=${TEAM.find((h) => h.name === selected.handler)?.userId || ""}`)} />
        ) : (
          <div className="grid flex-1 place-items-center rounded-lg border border-slate-200 bg-white p-8 text-[13px] text-slate-500">No escalation selected.</div>
        )}
      </div>

      {dialog && selected && <ActionDialog mode={dialog} e={selected} today={today} onCancel={() => setDialog(null)} onConfirm={act} />}

      {toast && (
        <div role="status" className="fixed right-4 top-14 z-50 flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-3 py-2 text-[12.5px] font-semibold text-white shadow-[0_12px_32px_rgba(11,31,58,0.35)]">
          <BadgeCheck className="h-4 w-4 text-teal-300" aria-hidden="true" />
          {toast}
        </div>
      )}
    </ODShell>
  );
}

function Detail({ e, today, canUndo, onAct, onUndo, onOpenClaim, onTeamQueue }) {
  const rule = RESPONSE_RULES[e.source];
  const { raised, due, left } = dueInfo(e, today);
  const closed = e.status === "CLOSED";
  const slaTone = { breach: "text-red-700", risk: "text-amber-800", ok: "text-emerald-700" }[e.sla.status];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50">
      <div className="rounded-t-lg border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-[15px] font-semibold text-[#0B1F3A]">{e.id}</h2>
          <SourceChip source={e.source} />
          <Chip tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Chip>
          <DueChip e={e} today={today} />
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={onTeamQueue} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-teal-800 hover:bg-teal-50" title="Open this handler's claims in the Team Work Queue (to reallocate)">
              <ListTodo className="h-3.5 w-3.5" aria-hidden="true" /> Team queue
            </button>
            {e.real && (
              <button type="button" onClick={onOpenClaim} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-teal-800 hover:bg-teal-50">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Open claim
              </button>
            )}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-slate-600">
          <span className="font-mono">{e.claimNo}</span> · {e.insured} · {e.vehicle} · <span className="font-mono">{e.regNo}</span> · Handler <b className="font-semibold text-slate-700">{e.handler}</b>
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {/* tiles */}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {[
            ["Raised on", fmtDate(raised), e.channel],
            ["Response due", fmtDate(due), rule.basis, !closed && left < 0 ? "text-red-700" : !closed && left <= 2 ? "text-amber-800" : "text-slate-900"],
            ["Claim stage", e.stage, `Pending with ${e.pendingWith}`],
            ["Claim SLA", e.sla.label, `Reserve ${inr(e.reserve)} · ${e.ageDays} d old`, slaTone],
          ].map(([l, v, s, tone]) => (
            <div key={l} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <p className="truncate text-[11px] font-medium text-slate-500">{l}</p>
              <p className={`truncate text-[15px] font-semibold leading-tight ${tone || "text-slate-900"}`}>{v}</p>
              <p className="truncate text-[11px] text-slate-500" title={s}>
                {s}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Section title={e.source === "SLA" ? "Why it was escalated" : e.source === "OMBUDSMAN" ? "Award" : "Complaint"} right={<span className="truncate text-[11px] text-slate-500">{e.ref}</span>}>
            <div className="px-3 py-2">
              <p className="text-[11.5px] text-slate-500">
                {e.source === "SLA" ? <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" /> : e.source === "LEGAL" ? <FileText className="mr-1 inline h-3 w-3" aria-hidden="true" /> : <Mail className="mr-1 inline h-3 w-3" aria-hidden="true" />}
                {e.raisedBy}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-800">“{e.complaint}”</p>
              {closed && e.outcome && (
                <p className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-[12px] text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                  Outcome: {e.outcome}
                </p>
              )}
            </div>
          </Section>

          <Section title="Timeline" right={<span className="text-[11px] tabular-nums text-slate-500">{e.history.length} entries</span>}>
            <ol className="relative px-3 py-2">
              {e.history.map((h, i) => {
                const last = i === e.history.length - 1;
                return (
                  <li key={i} className="relative flex gap-2 pb-2 last:pb-0">
                    {!last && <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" aria-hidden="true" />}
                    <span className={`relative mt-1 h-[11px] w-[11px] flex-none rounded-full ring-2 ring-white ${h.now ? "bg-teal-600" : last ? "bg-slate-500" : "bg-slate-300"}`} aria-hidden="true" />
                    <span className="min-w-0 text-[12px] leading-snug">
                      <span className="block text-[10.5px] font-semibold text-slate-400">{h.now ? "Today · you" : fmtShort(today - h.d * DAY)}</span>
                      <span className="text-slate-700">{h.text}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-t border-slate-200 bg-white px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[11.5px] text-slate-500">
          {closed ? "Closed – kept for audit and IRDAI returns." : e.status === "NEW" ? (rule.external ? "Acknowledge first – IRDAI expects an immediate acknowledgement." : "New SLA escalation – act within 2 days.") : `Respond by ${fmtDate(due)}.`}
        </p>
        {canUndo && (
          <button type="button" onClick={onUndo} className="h-8 rounded-lg border border-slate-300 px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50" title="Demo only – undo this session's actions">
            Undo (demo)
          </button>
        )}
        {!closed && (
          <>
            {e.status === "NEW" && (
              <button type="button" onClick={() => onAct("ack")} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 text-[12.5px] font-semibold text-white hover:bg-[#13305a]">
                <Check className="h-4 w-4" aria-hidden="true" /> Acknowledge
              </button>
            )}
            <button
              type="button"
              onClick={() => onAct("followup")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${e.status === "NEW" ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "bg-[#0B1F3A] text-white hover:bg-[#13305a]"}`}
            >
              <ListTodo className="h-4 w-4" aria-hidden="true" /> Assign follow-up
            </button>
            <button type="button" onClick={() => onAct("close")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12.5px] font-semibold text-emerald-800 hover:bg-emerald-50">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Respond & close
            </button>
          </>
        )}
      </div>
    </section>
  );
}