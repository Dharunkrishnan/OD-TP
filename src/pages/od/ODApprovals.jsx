// src/pages/od/ODApprovals.jsx
// OD Claims Manager – Approvals (route /od/approvals, ?claim=OD-CHN-26-004498 opens one claim).
//
// Claims come here when the handler's recommended amount is above the handler's authority (₹1 L).
// The manager can decide up to their own authority (₹5 L); above that the claim is referred
// to the Zonal Claims Head.
//
// Decisions:
//   Approve                – at the recommended amount → claim moves to Settlement
//   Approve with change    – lower amount, reason + remarks mandatory
//   Query                  – back to the handler as a task; approval SLA paused
//   Repudiate              – reason + remarks mandatory; handler issues the repudiation letter
//   Refer to Zonal Head    – only when above my authority (Approve / Repudiate are then not allowed)
//
// Demo: decisions are kept for this browser session only (sessionStorage).
// Replace with POST /od/approvals/:claimNo/decision.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Info,
  MessageSquareReply,
  PenLine,
  Search,
  ShieldX,
  X,
  XCircle,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { auditLog, useAuth, getRole } from "../../auth";
import { claimSlug, claimFromSlug } from "../../data/odClaimDetail";
import {
  APPROVAL_LIST,
  MANAGER_AUTHORITY,
  APPROVAL_SLA_HOURS,
  ZONAL_HEAD,
  CAT_LABEL,
  CHANGE_REASONS,
  QUERY_TYPES,
  REPUDIATION_REASONS,
  REFER_RECOMMENDATIONS,
} from "../../data/odApprovalsMock";
import { KEYS, readStore, saveStore } from "../../data/odManagerData";


/* ---------------- helpers ---------------- */
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const lakh = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : inr(n));
const waitLabel = (h) => (h >= 24 ? `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ""}` : `${h} h`);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const firstName = (n) => n.split(" ")[0];

const readDecisions = () => readStore(KEYS.decisions);
const saveDecisions = (d) => saveStore(KEYS.decisions, d);

const OUTCOME = {
  approved: { label: "Approved", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  changed: { label: "Approved with change", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  query: { label: "Query sent", tone: "bg-amber-50 text-amber-900 ring-amber-200", Icon: MessageSquareReply },
  repudiated: { label: "Repudiated", tone: "bg-red-50 text-red-800 ring-red-200", Icon: XCircle },
  referred: { label: "Referred to Zonal Head", tone: "bg-indigo-50 text-indigo-800 ring-indigo-200", Icon: ArrowUpRight },
};

function nextStep(outcome, c) {
  switch (outcome) {
    case "approved":
    case "changed":
      return `Moves to Settlement – ${firstName(c.handler)} issues the delivery order / payment.`;
    case "query":
      return `Back with ${firstName(c.handler)} as a task. Approval SLA is paused until they reply.`;
    case "repudiated":
      return `${firstName(c.handler)} issues the repudiation letter with this reason to the insured.`;
    case "referred":
      return `Sent to ${ZONAL_HEAD.name}, ${ZONAL_HEAD.role}.`;
    default:
      return "";
  }
}

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "sla", label: "Over SLA", test: (c) => c.overSla },
  { key: "above", label: "Above my limit", test: (c) => c.aboveLimit },
  { key: "ctl", label: "Total loss", test: (c) => c.basis === "ctl" },
];

/* ---------------- small UI pieces ---------------- */
function Chip({ tone = "bg-slate-100 text-slate-700 ring-slate-200", children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}

function WaitChip({ c }) {
  const near = !c.overSla && c.waitingHours > APPROVAL_SLA_HOURS - 12;
  const tone = c.overSla ? "bg-red-50 text-red-700 ring-red-200" : near ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <Chip tone={tone} title={`Approval SLA ${APPROVAL_SLA_HOURS / 24} days`}>
      {c.overSla ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <Clock className="h-3 w-3" aria-hidden="true" />}
      {waitLabel(c.waitingHours)}
      {c.overSla ? " · over SLA" : " waiting"}
    </Chip>
  );
}

function Section({ title, right, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex h-8 items-center justify-between gap-2 border-b border-slate-100 px-3">
        <h3 className="text-[12.5px] font-semibold text-[#0B1F3A]">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone = "text-slate-900", subTone = "text-slate-500" }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`truncate text-[17px] font-semibold leading-tight tabular-nums ${tone}`}>{value}</p>
      <p className={`truncate text-[11px] ${subTone}`}>{sub}</p>
    </div>
  );
}

function CheckRow({ state, children, sub }) {
  const map = {
    ok: [CheckCircle2, "text-emerald-600"],
    warn: [AlertTriangle, "text-amber-600"],
    bad: [XCircle, "text-red-600"],
    info: [Info, "text-slate-400"],
  };
  const [Icon, tone] = map[state];
  return (
    <li className="flex items-start gap-2 px-3 py-1">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${tone}`} aria-hidden="true" />
      <span className="min-w-0 text-[12px] leading-snug text-slate-700">
        {children}
        {sub && <span className="block text-[11px] text-slate-500">{sub}</span>}
      </span>
    </li>
  );
}

/* ---------------- Assessment ---------------- */
function PartialAssessment({ c }) {
  const a = c.assessment;
  const less = [
    ["Less depreciation", a.dep, c.zeroDep ? "Zero Depreciation cover" : `Metal ${Math.round(c.metalRate * 100)}% (vehicle ${c.vehicleAge}) · plastic 50% · paint 12.5%`],
    ["Less compulsory deductible", c.compulsoryDed, c.cc > 1500 ? "Above 1500 cc" : "Up to 1500 cc"],
    ...(c.voluntaryDed ? [["Less voluntary deductible", c.voluntaryDed, "As per policy"]] : []),
    ...(c.salvage ? [["Less salvage (replaced parts)", c.salvage, "Retained by insured"]] : []),
  ];
  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead>
        <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-500">
          <th className="py-1 pl-3 font-semibold">Item</th>
          <th className="hidden py-1 font-semibold sm:table-cell">Type</th>
          <th className="py-1 text-right font-semibold">Estimate</th>
          <th className="py-1 pl-2 text-right font-semibold">Assessed</th>
          <th className="py-1 pl-3 pr-3 text-right font-semibold">Dep.</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {a.rows.map((r) => (
          <tr key={r.item}>
            <td className="py-[3px] pl-3 text-slate-800">{r.item}</td>
            <td className="hidden py-[3px] text-slate-500 sm:table-cell">{CAT_LABEL[r.cat]}</td>
            <td className="py-[3px] text-right text-slate-500">{inr(r.estimate)}</td>
            <td className="py-[3px] text-right text-slate-800">{inr(r.assessed)}</td>
            <td className="py-[3px] pl-3 pr-3 text-right text-slate-500">{r.dep ? `${inr(r.dep)}` : "–"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-slate-200">
        <tr className="font-semibold">
          <td className="py-1 pl-3 text-slate-800">Total</td>
          <td className="hidden sm:table-cell" />
          <td className="py-1 text-right text-slate-500">{inr(a.estimate)}</td>
          <td className="py-1 text-right text-slate-800">{inr(a.assessed)}</td>
          <td className="py-1 pl-3 pr-3 text-right text-slate-500">{a.dep ? inr(a.dep) : "–"}</td>
        </tr>
        {less.map(([label, amt, note]) => (
          <tr key={label} className="text-slate-600">
            <td className="py-[2px] pl-3" colSpan={2}>
              {label} <span className="text-[11px] text-slate-400">· {note}</span>
            </td>
            <td className="hidden sm:table-cell" />
            <td className="py-[2px] text-right">− {inr(amt)}</td>
            <td />
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-teal-50/60 text-[13px] font-semibold text-[#0B1F3A]">
          <td className="py-1.5 pl-3" colSpan={2}>
            Net payable – recommended
          </td>
          <td className="hidden sm:table-cell" />
          <td className="py-1.5 text-right">{inr(a.net)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

function CtlAssessment({ c }) {
  const a = c.assessment;
  const rows = [
    ["Insured Declared Value (IDV)", inr(c.idv), ""],
    ["Repair estimate", inr(c.repairEstimate), `${a.repairPct}% of IDV – above 75%, so total loss`],
    [
      "Settlement basis",
      c.ctlBasis === "insured" ? "Net of salvage" : "Insurer takes salvage",
      c.ctlBasis === "insured" ? "Insured keeps the wreck" : `Wreck sold by insurer · best bid ${inr(c.salvageValue)}`,
    ],
    ...(a.salvage ? [["Less salvage value", `− ${inr(a.salvage)}`, "Best salvage bid"]] : []),
    ["Less compulsory deductible", `− ${inr(c.compulsoryDed)}`, c.cc > 1500 ? "Above 1500 cc" : "Up to 1500 cc"],
  ];
  return (
    <table className="w-full text-[12px] tabular-nums">
      <tbody className="divide-y divide-slate-100">
        {rows.map(([label, value, note]) => (
          <tr key={label}>
            <td className="py-1 pl-3 text-slate-700">
              {label}
              {note && <span className="block text-[11px] text-slate-400">{note}</span>}
            </td>
            <td className="py-1 pr-3 text-right font-medium text-slate-800">{value}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-teal-50/60 text-[13px] font-semibold text-[#0B1F3A]">
          <td className="py-1.5 pl-3">Net payable – recommended</td>
          <td className="py-1.5 pr-3 text-right">{inr(a.net)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/* ---------------- Decision dialog ---------------- */
const DIALOG = {
  approved: { title: "Approve claim", button: "Approve", btnTone: "bg-emerald-700 hover:bg-emerald-800" },
  changed: { title: "Approve with change", button: "Approve revised amount", btnTone: "bg-emerald-700 hover:bg-emerald-800" },
  query: { title: "Send a query to the handler", button: "Send query", btnTone: "bg-[#0B1F3A] hover:bg-[#13305a]" },
  repudiated: { title: "Repudiate claim", button: "Repudiate", btnTone: "bg-red-700 hover:bg-red-800" },
  referred: { title: `Refer to ${ZONAL_HEAD.role}`, button: "Refer", btnTone: "bg-indigo-700 hover:bg-indigo-800" },
};

function Field({ label, required, error, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11.5px] text-red-700">{error}</span> : hint ? <span className="mt-1 block text-[11.5px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function DecisionDialog({ mode, c, onCancel, onConfirm }) {
  const cfg = DIALOG[mode];
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [subjectToDocs, setSubjectToDocs] = useState(false);
  const [tried, setTried] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const amt = Number(String(amount).replace(/[^\d]/g, ""));
  const minRemarks = mode === "repudiated" ? 20 : 10;
  const errors = {};
  if (mode === "changed") {
    if (!amt) errors.amount = "Enter the approved amount.";
    else if (amt >= c.amount) errors.amount = `Must be less than the recommended ${inr(c.amount)}. To approve more, send a query for re-inspection.`;
    if (!reason) errors.reason = "Select a reason.";
  }
  if ((mode === "query" || mode === "repudiated" || mode === "referred") && !reason) errors.reason = "Select an option.";
  const needRemarks = mode !== "approved";
  if (needRemarks && remarks.trim().length < minRemarks) errors.remarks = `Write at least ${minRemarks} characters.`;
  if (mode === "approved" && c.docsPending.length && !subjectToDocs) errors.docs = "Tick to approve subject to the pending documents, or send a query instead.";
  const valid = Object.keys(errors).length === 0;

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    onConfirm({
      outcome: mode,
      amount: mode === "changed" ? amt : mode === "approved" ? c.amount : null,
      reason: reason || null,
      remarks: remarks.trim(),
      subjectToDocs: mode === "approved" && c.docsPending.length ? c.docsPending : null,
    });
  }
  const err = (k) => (tried ? errors[k] : null);

  const reasonOptions = { changed: CHANGE_REASONS, query: QUERY_TYPES, repudiated: REPUDIATION_REASONS, referred: REFER_RECOMMENDATIONS }[mode];
  const reasonLabel = { changed: "Reason for change", query: "Query type", repudiated: "Repudiation reason", referred: "My recommendation" }[mode];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="w-full max-w-[460px] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="decision-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              {cfg.title}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              <span className="font-mono">{c.claimNo}</span> · {c.insured} · recommended {inr(c.amount)}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {mode === "approved" && (
            <>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900">
                Approve <b>{inr(c.amount)}</b> as recommended by {c.handler}.
              </div>
              {c.reserveShort && (
                <p className="flex gap-2 text-[12px] text-slate-700">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                  Reserve will be revised from {inr(c.reserve)} to {inr(c.amount)} on approval.
                </p>
              )}
              {c.docsPending.length > 0 && (
                <div>
                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                    <input
                      ref={firstRef}
                      type="checkbox"
                      checked={subjectToDocs}
                      onChange={(e) => setSubjectToDocs(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-emerald-700"
                    />
                    <span>
                      Approve subject to <b>{c.docsPending.join(", ")}</b>. Payment is held until it is received.
                    </span>
                  </label>
                  {err("docs") && <span className="mt-1 block text-[11.5px] text-red-700">{err("docs")}</span>}
                </div>
              )}
            </>
          )}

          {mode === "repudiated" && (
            <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-900">
              <ShieldX className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              The insured receives a repudiation letter with this reason. Only the {ZONAL_HEAD.role} can reopen a repudiated claim.
            </p>
          )}

          {mode === "referred" && (
            <p className="flex gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-[12px] text-indigo-900">
              <ArrowUpRight className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {inr(c.amount)} is above your authority of {inr(MANAGER_AUTHORITY)}. Goes to {ZONAL_HEAD.name}, {ZONAL_HEAD.office}.
            </p>
          )}

          {mode === "changed" && (
            <Field label="Approved amount" required error={err("amount")} hint={`Recommended ${inr(c.amount)}`}>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">₹</span>
                <input
                  ref={firstRef}
                  inputMode="numeric"
                  value={amount ? Number(amt).toLocaleString("en-IN") : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                  className={`${inputCls} pl-6 tabular-nums`}
                  aria-invalid={!!err("amount")}
                />
              </div>
            </Field>
          )}

          {reasonOptions && (
            <Field label={reasonLabel} required error={err("reason")} hint={mode === "query" ? `Goes to ${c.handler} as a task` : null}>
              <select
                ref={mode === "changed" ? undefined : firstRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputCls}
                aria-invalid={!!err("reason")}
              >
                <option value="">Select</option>
                {reasonOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={mode === "query" ? "Message to handler" : mode === "referred" ? "Note for the Zonal Head" : "Remarks"}
            required={needRemarks}
            error={err("remarks")}
            hint={needRemarks ? `Minimum ${minRemarks} characters · saved in the claim's audit trail` : "Optional · saved in the claim's audit trail"}
          >
            <textarea
              ref={mode === "approved" && !c.docsPending.length ? firstRef : undefined}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              aria-invalid={!!err("remarks")}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className={`h-9 rounded-lg px-3 text-[13px] font-semibold text-white ${cfg.btnTone}`}>
            {cfg.button}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function ODApprovals() {
  const { user } = useAuth();
  // Approvals belong to the Claims Manager role (switch role from the profile menu)
  if (getRole(user, "OD")?.role !== "CLAIMS_MANAGER") return <NotForRole />;
  return <ApprovalsPage />;
}

function NotForRole() {
  const navigate = useNavigate();
  return (
    <ODShell active="approvals" title="Approvals">
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="mt-2 text-[15px] font-semibold text-[#0B1F3A]">Approvals is for the Claims Manager</h2>
        <p className="mt-1 text-[13px] text-slate-500">Your current role cannot approve claims. Change role from your name at the top right → Select role.</p>
        <button type="button" onClick={() => navigate("/od/dashboard")} className="mt-4 h-9 rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white">
          Go to my dashboard
        </button>
      </div>
    </ODShell>
  );
}

function ApprovalsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [decisions, setDecisions] = useState(readDecisions);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("oldest");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  const pending = APPROVAL_LIST.filter((c) => !decisions[c.claimNo]);
  const decided = APPROVAL_LIST.filter((c) => decisions[c.claimNo]).sort((a, b) => (decisions[b.claimNo].at > decisions[a.claimNo].at ? 1 : -1));

  const list = useMemo(() => {
    if (filter === "decided") return decided;
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const q = query.trim().toLowerCase();
    return pending
      .filter(f.test)
      .filter((c) => !q || [c.claimNo, c.insured, c.handler, c.regNo, c.vehicle].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "amount" ? b.amount - a.amount : b.waitingHours - a.waitingHours));
  }, [filter, sort, query, pending, decided]);

  const selectedNo = claimFromSlug(params.get("claim") || "");
  // The open claim follows the list: if the chosen claim is not in the current filter, open the first one shown
  const selected = list.find((c) => c.claimNo === selectedNo) || list[0] || APPROVAL_LIST.find((c) => c.claimNo === selectedNo) || null;
  const decision = selected ? decisions[selected.claimNo] : null;

  function select(c) {
    setParams(c ? { claim: claimSlug(c.claimNo) } : {}, { replace: true });
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function confirmDecision(d) {
    const c = selected;
    const rec = { ...d, at: new Date().toISOString() };
    const next = { ...decisions, [c.claimNo]: rec };
    setDecisions(next);
    saveDecisions(next);
    auditLog("APPROVAL_DECISION", { claimNo: c.claimNo, ...rec });
    setDialog(null);
    setToast({ text: `${c.claimNo} · ${OUTCOME[d.outcome].label}`, sub: nextStep(d.outcome, c) });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
    // move on to the next claim still waiting in the current view
    const rest = list.filter((x) => x.claimNo !== c.claimNo && !next[x.claimNo]);
    const after = rest.find((x) => list.indexOf(x) > list.indexOf(c)) || rest[0] || pending.find((x) => x.claimNo !== c.claimNo);
    select(after || c);
  }

  function undoDecision(claimNo) {
    const next = { ...decisions };
    delete next[claimNo];
    setDecisions(next);
    saveDecisions(next);
    auditLog("APPROVAL_DECISION_UNDONE", { claimNo });
  }

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, pending.filter(f.test).length]));
  const totalValue = pending.reduce((t, c) => t + c.amount, 0);

  return (
    <ODShell
      active="approvals"
      title="Approvals"
      subtitle={`Claims above the handler's ₹1 L authority · my limit ${lakh(MANAGER_AUTHORITY)} · approval SLA ${APPROVAL_SLA_HOURS / 24} days`}
      onNavigateMissing={(label) => {
        setToast({ text: `${label} comes in a later build step.` });
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2600);
      }}
    >
      <div className="flex flex-col gap-2 lg:h-[calc(100vh-68px)] lg:flex-row">
        {/* ---------------- List ---------------- */}
        <aside data-approvals-list className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white lg:w-[340px] lg:flex-none">
          <div className="border-b border-slate-100 px-3 pb-2 pt-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-[#0B1F3A]">Waiting for my approval</h2>
              <span className="text-[11.5px] tabular-nums text-slate-500">
                {pending.length} · {lakh(totalValue)}
              </span>
            </div>
            <label className="mt-1.5 flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
              <Search className="h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Claim no, insured, vehicle or handler"
                aria-label="Search approvals"
                className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-slate-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1" role="tablist" aria-label="Filter approvals">
              {[...FILTERS.map((f) => ({ ...f, n: counts[f.key] })), { key: "decided", label: "Decided", n: decided.length }].map((f) => {
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(f.key)}
                    className={`h-6 rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset ${
                      on ? "bg-[#0B1F3A] text-white ring-[#0B1F3A]" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label} <span className={`tabular-nums ${on ? "text-teal-300" : "text-slate-400"}`}>{f.n}</span>
                  </button>
                );
              })}
            </div>
            {filter !== "decided" && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                Sort
                {[
                  ["oldest", "Oldest first"],
                  ["amount", "Highest amount"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSort(k)}
                    aria-pressed={sort === k}
                    className={`rounded px-1.5 py-px ${sort === k ? "bg-teal-50 font-semibold text-teal-800" : "hover:bg-slate-100"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {list.map((c) => {
              const on = selected?.claimNo === c.claimNo;
              const d = decisions[c.claimNo];
              return (
                <li key={c.claimNo}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    aria-current={on ? "true" : undefined}
                    className={`block w-full border-l-[3px] px-3 py-1.5 text-left ${on ? "border-teal-600 bg-teal-50/60" : "border-transparent hover:bg-slate-50"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-teal-800">{c.claimNo}</span>
                      <span className="text-[12.5px] font-semibold tabular-nums text-slate-900">{inr(d?.amount ?? c.amount)}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-600">
                      {c.insured} · {c.vehicle} · {firstName(c.handler)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {d ? (
                        <Chip tone={OUTCOME[d.outcome].tone}>{OUTCOME[d.outcome].label}</Chip>
                      ) : (
                        <>
                          <WaitChip c={c} />
                          {c.aboveLimit && <Chip tone="bg-indigo-50 text-indigo-800 ring-indigo-200">Above my limit</Chip>}
                          {c.basis === "ctl" && <Chip>Total loss</Chip>}
                          {c.docsPending.length > 0 && <Chip tone="bg-amber-50 text-amber-800 ring-amber-200">Docs pending</Chip>}
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && (
              <li className="px-3 py-8 text-center text-[12.5px] text-slate-500">
                {filter === "decided" ? "No decisions yet in this session." : pending.length ? "No claim matches this filter." : "All caught up – nothing waiting for your approval."}
              </li>
            )}
          </ul>
        </aside>

        {/* ---------------- Detail ---------------- */}
        {selected ? (
          <Detail
            key={selected.claimNo}
            c={selected}
            decision={decision}
            onOpenClaim={() => navigate(`/od/claims/${claimSlug(selected.claimNo)}`)}
            onDecide={setDialog}
            onUndo={() => undoDecision(selected.claimNo)}
          />
        ) : (
          <div className="grid flex-1 place-items-center rounded-lg border border-slate-200 bg-white p-8 text-[13px] text-slate-500">Select a claim.</div>
        )}
      </div>

      {dialog && selected && <DecisionDialog mode={dialog} c={selected} onCancel={() => setDialog(null)} onConfirm={confirmDecision} />}

      {toast && (
        <div role="status" className="fixed right-4 top-14 z-50 max-w-[calc(100vw-32px)] rounded-xl bg-[#0B1F3A] px-3 py-2 text-[12.5px] text-white shadow-[0_12px_32px_rgba(11,31,58,0.35)]">
          <p className="flex items-center gap-2 font-semibold">
            <BadgeCheck className="h-4 w-4 flex-none text-teal-300" aria-hidden="true" />
            {toast.text}
          </p>
          {toast.sub && <p className="pl-6 text-[11.5px] text-slate-300">{toast.sub}</p>}
        </div>
      )}
    </ODShell>
  );
}

function Detail({ c, decision, onOpenClaim, onDecide, onUndo }) {
  const inForce = c.lossDate >= c.policyFrom && c.lossDate <= c.policyTo;
  const docsOk = c.docs.filter((d) => d.ok).length;
  const variance = c.basis === "partial" ? Math.round(((c.assessment.assessed - c.assessment.estimate) / c.assessment.estimate) * 100) : null;
  const headroom = MANAGER_AUTHORITY - c.amount;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="rounded-t-lg border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="font-mono text-[14px] font-semibold text-[#0B1F3A]">{c.claimNo}</h2>
          <Chip>{c.lossType}</Chip>
          {!decision && <WaitChip c={c} />}
          {c.aboveLimit && !decision && <Chip tone="bg-indigo-50 text-indigo-800 ring-indigo-200">Above my limit</Chip>}
          <button
            type="button"
            onClick={onOpenClaim}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-teal-800 hover:bg-teal-50"
            title="Open the full claim (Claim 360)"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Open claim
          </button>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-slate-600">
          {c.insured} · {c.vehicle} · <span className="font-mono">{c.regNo}</span> · Handler <b className="font-semibold text-slate-700">{c.handler}</b> · sent {waitLabel(c.waitingHours)} ago
        </p>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Tile label="Recommended – net payable" value={inr(c.amount)} sub={c.basis === "ctl" ? "Total loss settlement" : `Assessed ${inr(c.assessment.assessed)}`} tone="text-[#0B1F3A]" />
          <Tile
            label="My authority"
            value={inr(MANAGER_AUTHORITY)}
            sub={c.aboveLimit ? `Above by ${inr(-headroom)} – refer up` : `Within limit · ${lakh(headroom)} to spare`}
            subTone={c.aboveLimit ? "font-semibold text-indigo-700" : "text-emerald-700"}
          />
          <Tile
            label="Reserve"
            value={inr(c.reserve)}
            sub={c.reserveShort ? `Short by ${inr(c.amount - c.reserve)}` : "Adequate"}
            subTone={c.reserveShort ? "font-semibold text-amber-700" : "text-emerald-700"}
          />
          <Tile
            label="Policy · IDV"
            value={inr(c.idv)}
            sub={`NCB ${c.ncb}% · ${c.addons.length ? c.addons.join(", ") : "No add-ons"}`}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-2">
            <Section
              title={c.basis === "ctl" ? "Total loss settlement" : "Assessment"}
              right={
                <span className="text-[11px] text-slate-500">
                  Surveyor {c.surveyor} · {fmtDate(c.surveyDate)}
                </span>
              }
            >
              {c.basis === "ctl" ? <CtlAssessment c={c} /> : <PartialAssessment c={c} />}
            </Section>

            <Section title={`Handler's note · ${c.handler}`}>
              <p className="px-3 py-2 text-[12.5px] leading-relaxed text-slate-700">{c.handlerNote}</p>
            </Section>
          </div>

          <div className="min-w-0 space-y-2">
            <Section title="Approval checks">
              <ul className="py-1">
                <CheckRow state={inForce ? "ok" : "bad"} sub={`${fmtDate(c.policyFrom)} – ${fmtDate(c.policyTo)} · loss ${fmtDate(c.lossDate)}`}>
                  Policy in force on the loss date
                </CheckRow>
                <CheckRow state={c.aboveLimit ? "bad" : "ok"}>{c.aboveLimit ? `Above my authority of ${inr(MANAGER_AUTHORITY)}` : "Within my authority"}</CheckRow>
                <CheckRow state={c.docsPending.length ? "warn" : "ok"} sub={c.docsPending.length ? `Pending: ${c.docsPending.join(", ")}` : null}>
                  Documents {docsOk} of {c.docs.length} received
                </CheckRow>
                <CheckRow state="ok">Surveyor report received · {fmtDate(c.surveyDate)}</CheckRow>
                <CheckRow state={c.reserveShort ? "warn" : "ok"}>{c.reserveShort ? `Reserve ${inr(c.reserve)} is below the recommended amount` : "Reserve covers the recommended amount"}</CheckRow>
                {variance !== null && (
                  <CheckRow state="info">
                    Assessed {variance === 0 ? "equal to" : `${Math.abs(variance)}% ${variance < 0 ? "below" : "above"}`} the garage estimate
                  </CheckRow>
                )}
                {c.basis === "ctl" && <CheckRow state="ok">Repair estimate {c.assessment.repairPct}% of IDV – total loss criteria met</CheckRow>}
                {c.covered && <CheckRow state="ok">{c.covered}</CheckRow>}
                {c.flags.map((f) => (
                  <CheckRow key={f.text} state={f.tone === "red" ? "bad" : f.tone === "amber" ? "warn" : "info"}>
                    {f.text}
                  </CheckRow>
                ))}
              </ul>
            </Section>

            <Section title="Loss">
              <dl className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-0.5 px-3 py-2 text-[12px]">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-slate-800">{fmtDate(c.lossDate)}</dd>
                <dt className="text-slate-500">Place</dt>
                <dd className="text-slate-800">{c.lossPlace}</dd>
                <dt className="text-slate-500">Cause</dt>
                <dd className="text-slate-800">{c.cause}</dd>
                <dt className="text-slate-500">Garage</dt>
                <dd className="text-slate-800">{c.garage}</dd>
                <dt className="text-slate-500">Policy</dt>
                <dd className="font-mono text-[11.5px] text-slate-800">{c.policyNo}</dd>
              </dl>
            </Section>

            <Section title="Documents" right={<span className="text-[11px] tabular-nums text-slate-500">{docsOk} / {c.docs.length}</span>}>
              <ul className="flex flex-wrap gap-1 px-3 py-2">
                {c.docs.map((d) => (
                  <li key={d.name}>
                    <Chip tone={d.ok ? "bg-white text-slate-700 ring-slate-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
                      {d.ok ? <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : <FileText className="h-3 w-3" aria-hidden="true" />}
                      {d.name}
                      {!d.ok && " · pending"}
                    </Chip>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-t border-slate-200 bg-white px-3 py-2">
        {decision ? (
          <>
            <Chip tone={OUTCOME[decision.outcome].tone}>
              {(() => {
                const I = OUTCOME[decision.outcome].Icon;
                return <I className="h-3.5 w-3.5" aria-hidden="true" />;
              })()}
              {OUTCOME[decision.outcome].label}
              {decision.amount ? ` · ${inr(decision.amount)}` : ""}
            </Chip>
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600" title={[decision.reason, decision.remarks].filter(Boolean).join(" – ")}>
              {fmtTime(decision.at)}
              {decision.reason ? ` · ${decision.reason}` : ""}
              {decision.remarks ? ` · “${decision.remarks}”` : ""}
            </span>
            <button type="button" onClick={onUndo} className="h-8 rounded-lg border border-slate-300 px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50" title="Demo only – undo this decision">
              Undo (demo)
            </button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-[11.5px] text-slate-500">
              {c.aboveLimit ? `Above ${lakh(MANAGER_AUTHORITY)} – approve or repudiate is for the ${ZONAL_HEAD.role}.` : "Every decision is saved in the claim's audit trail."}
            </p>
            <button
              type="button"
              onClick={() => onDecide("query")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MessageSquareReply className="h-4 w-4" aria-hidden="true" /> Query
            </button>
            {c.aboveLimit ? (
              <button
                type="button"
                onClick={() => onDecide("referred")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-700 px-3 text-[12.5px] font-semibold text-white hover:bg-indigo-800"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> Refer to Zonal Head
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onDecide("repudiated")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
                >
                  <ShieldX className="h-4 w-4" aria-hidden="true" /> Repudiate
                </button>
                <button
                  type="button"
                  onClick={() => onDecide("changed")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12.5px] font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" /> Approve with change
                </button>
                <button
                  type="button"
                  onClick={() => onDecide("approved")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12.5px] font-semibold text-white hover:bg-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve {inr(c.amount)}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}