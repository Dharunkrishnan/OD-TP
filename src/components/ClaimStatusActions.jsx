// src/components/ClaimStatusActions.jsx
// Claim status actions for the OD Claims Handler in Claim 360 (Phase 2A).
// Motor OD Claims Requirement Catalogue V2.0:
//   16  NBNR handling              – resolve: convert to a registered claim, or close with reason
//   21  Claim withdrawal           – customer withdraws, only before assessment, reason mandatory
//   131 Closure without payment    – no claim / documents not submitted / duplicate; repudiation goes for approval (62/63)
//   134 Claim reopening            – reason + authority: sent to the Claims Manager for approval
//   162 Claim hold / pend          – reason + review date; release any time
//   35  Change surveyor (menu item) – opens AppointSurveyorDialog from Claim 360
//
// Demo: the new status and its history are kept for this browser session (sessionStorage).
// Replace with: POST /od/claims/:claimNo/{nbnr-resolve|withdraw|close|reopen|hold|release}

import { useEffect, useRef, useState } from "react";
import { BEFORE_ASSESSMENT, effectiveState } from "../data/claimStatus";
import { UserCog, ChevronDown, CirclePause, CirclePlay, FileX2, LogOut, RotateCcw, ShieldX, X, XCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

const HANDLER = "Karthik Subramanian";
const MANAGER = "Priya Raghavan";


const REASONS = {
  nbnrConvert: ["Premium realised – policy now in force", "Policy found after correcting the policy / vehicle number", "OD cover confirmed on the policy", "Loss date corrected – within the policy period"],
  nbnrClose: ["Policy not in force on the loss date", "Loss outside the policy period", "TP-only policy – no OD cover", "Duplicate intimation", "No response from the insured after reminders"],
  withdraw: ["Vehicle repaired privately by the insured", "Settled with the third party's insurer", "Loss below the deductible", "Insured does not wish to claim (NCB)", "Other"],
  close: ["Repudiated – policy exclusion / condition breach", "No claim – no damage or loss below the deductible", "Documents not submitted after reminders", "Duplicate claim"],
  reopen: ["Additional / addendum payment", "Grievance from the insured", "Ombudsman award", "Court direction", "Closed in error"],
  hold: ["Awaiting police / court report", "Awaiting insured's decision on settlement", "Investigation in progress", "Awaiting financier NOC", "Other"],
};

const today = () => new Date().toISOString().slice(0, 10);
const nowStamp = () => {
  const d = new Date();
  return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
};
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

/* ---------------- banner under the claim header ---------------- */
const BANNER = {
  HOLD: { tone: "bg-amber-50 text-amber-900 border-amber-200", Icon: CirclePause, title: (r) => `On hold until ${fmt(r.reviewDate)}` },
  WITHDRAWN: { tone: "bg-slate-100 text-slate-800 border-slate-300", Icon: LogOut, title: () => "Withdrawn by the insured" },
  CLOSED: { tone: "bg-slate-100 text-slate-800 border-slate-300", Icon: FileX2, title: () => "Closed without payment" },
  NBNR_CLOSED: { tone: "bg-slate-100 text-slate-800 border-slate-300", Icon: XCircle, title: () => "NBNR closed – not registered" },
  REPUDIATION_PENDING: { tone: "bg-red-50 text-red-800 border-red-200", Icon: ShieldX, title: () => `Repudiation sent to ${MANAGER} for approval` },
  REOPEN_PENDING: { tone: "bg-indigo-50 text-indigo-800 border-indigo-200", Icon: RotateCcw, title: () => `Reopen sent to ${MANAGER} for approval` },
  NBNR_CONVERTED: { tone: "bg-emerald-50 text-emerald-800 border-emerald-200", Icon: CheckCircle2, title: () => "NBNR converted – claim registered" },
  SETTLED: { tone: "bg-emerald-50 text-emerald-800 border-emerald-200", Icon: CheckCircle2, title: () => "Settled & closed" },
  REPUDIATED: { tone: "bg-red-50 text-red-800 border-red-200", Icon: ShieldX, title: (r) => `Repudiated – approved by ${r.decidedBy || MANAGER}` },
};

export function ClaimStatusBanner({ rec }) {
  // Claims Manager's answer to a repudiation / reopen request (rejected → claim back to where it was)
  if (rec?.notice && !BANNER[rec.state]) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-sky-200 bg-sky-50 px-4 py-2 text-[12.5px] text-sky-900" role="status">
        <RotateCcw className="h-4 w-4 flex-none" aria-hidden="true" />
        <span className="font-semibold">{rec.notice.title}</span>
        <span className="min-w-0 flex-1 truncate" title={rec.notice.text}>
          · {rec.notice.text} · {fmt(rec.at)}
        </span>
      </div>
    );
  }
  if (!rec || !BANNER[rec.state]) return null;
  const b = BANNER[rec.state];
  return (
    <div className={`flex flex-wrap items-center gap-2 border-t px-4 py-2 text-[12.5px] ${b.tone}`} role="status">
      <b.Icon className="h-4 w-4 flex-none" aria-hidden="true" />
      <span className="font-semibold">{b.title(rec)}</span>
      <span className="min-w-0 flex-1 truncate" title={[rec.reason, rec.remarks].filter(Boolean).join(" – ")}>
        · {rec.reason}
        {rec.remarks ? ` – “${rec.remarks}”` : ""} · {fmt(rec.at)}
      </span>
    </div>
  );
}

/* ---------------- "Claim actions" menu ---------------- */
export function ClaimActionsMenu({ stage, rec, onPick, canChangeSurveyor = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const st = effectiveState(stage, rec);
  const canWithdraw = BEFORE_ASSESSMENT.includes(st.stage);
  const items = st.closed
    ? [{ key: "reopen", label: "Reopen claim", Icon: RotateCcw, note: "Needs Claims Manager approval" }]
    : st.waiting
      ? []
      : [
          ...(canChangeSurveyor ? [{ key: "surveyor", label: "Change surveyor", Icon: UserCog, note: "Before the survey is done, with reason" }] : []),
          st.hold ? { key: "release", label: "Release hold", Icon: CirclePlay } : { key: "hold", label: "Put on hold", Icon: CirclePause, note: "Reason and review date" },
          { key: "withdraw", label: "Withdraw claim", Icon: LogOut, disabled: !canWithdraw, note: canWithdraw ? "Customer request, before assessment" : "Only before assessment" },
          { key: "close", label: "Close without payment", Icon: FileX2, note: "Repudiation goes for approval" },
        ];
  if (!items.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Claim actions <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 top-full z-30 mt-1 w-[250px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  onPick(it.key);
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <it.Icon className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
                <span className="leading-tight">
                  <span className="block text-[12.5px] font-medium text-slate-800">{it.label}</span>
                  {it.note && <span className="block text-[11px] text-slate-500">{it.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- dialog for every action ---------------- */
const TITLES = {
  nbnr: "Resolve NBNR",
  withdraw: "Withdraw claim",
  close: "Close without payment",
  reopen: "Reopen claim",
  hold: "Put claim on hold",
  release: "Release hold",
};

export function ClaimStatusDialog({ action, claim, rec, onCancel, onDone }) {
  const [nbnrMode, setNbnrMode] = useState("convert");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [via, setVia] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reviewDate, setReviewDate] = useState("");
  const [tried, setTried] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const reasonList = action === "nbnr" ? REASONS[nbnrMode === "convert" ? "nbnrConvert" : "nbnrClose"] : REASONS[action] || [];
  const repudiate = action === "close" && reason.startsWith("Repudiated");
  const docsNotSubmitted = action === "close" && reason.startsWith("Documents not submitted");
  const [maxHold] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

  const errors = {};
  if (action !== "release" && !reason) errors.reason = "Select a reason.";
  const minRemarks = repudiate || action === "reopen" ? 20 : reason === "Other" ? 10 : action === "release" ? 0 : 0;
  if (remarks.trim().length < minRemarks) errors.remarks = `Write at least ${minRemarks} characters.`;
  if (action === "withdraw" && !via) errors.via = "Select how the request came in.";
  if (action === "withdraw" && !confirm) errors.confirm = "Confirm the insured's written request is on file.";
  if (docsNotSubmitted && !confirm) errors.confirm = "Confirm the reminders were sent.";
  if (action === "hold") {
    if (!reviewDate) errors.reviewDate = "Choose a review date.";
    else if (reviewDate < today() || reviewDate > maxHold) errors.reviewDate = "Within the next 30 days.";
  }
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    const base = { reason: reason || rec?.reason, remarks: remarks.trim(), at: today() };
    const ev = (event, detail, by = HANDLER) => ({ ...nowStamp(), event, by, detail });
    const prevEvents = rec?.events || [];
    let next;
    let msg;
    switch (action) {
      case "nbnr":
        if (nbnrMode === "convert") {
          next = { ...base, state: "NBNR_CONVERTED", events: [ev("NBNR converted to claim", `${reason}. Claim registered and reserve created.`), ...prevEvents] };
          msg = "NBNR converted – claim registered and reserve created.";
        } else {
          next = { ...base, state: "NBNR_CLOSED", events: [ev("NBNR closed", `${reason}${remarks ? ` – ${remarks}` : ""}. Letter sent to the insured.`), ...prevEvents] };
          msg = "NBNR closed. Letter sent to the insured.";
        }
        break;
      case "withdraw":
        next = { ...base, state: "WITHDRAWN", events: [ev("Claim withdrawn", `${reason} · request by ${via}. Reserve released to ₹0.`), ...prevEvents] };
        msg = "Claim withdrawn. Reserve released to ₹0.";
        break;
      case "close":
        if (repudiate) {
          next = { ...base, state: "REPUDIATION_PENDING", prevState: rec?.state || "OPEN", events: [ev("Repudiation sent for approval", `${reason} – ${remarks}. To ${MANAGER}.`), ...prevEvents] };
          msg = `Repudiation sent to ${MANAGER} for approval.`;
        } else {
          next = { ...base, state: "CLOSED", events: [ev("Closed without payment", `${reason}${remarks ? ` – ${remarks}` : ""}. Reserve released to ₹0; closure letter sent.`), ...prevEvents] };
          msg = "Claim closed without payment. Closure letter sent.";
        }
        break;
      case "reopen":
        next = { ...base, state: "REOPEN_PENDING", prevState: rec?.state, prevReason: rec?.reason, events: [ev("Reopen sent for approval", `${reason} – ${remarks}. To ${MANAGER}.`), ...prevEvents] };
        msg = `Reopen sent to ${MANAGER} for approval.`;
        break;
      case "hold":
        next = { ...base, state: "HOLD", reviewDate, events: [ev("Claim put on hold", `${reason}${remarks ? ` – ${remarks}` : ""}. Review on ${fmt(reviewDate)}.`), ...prevEvents] };
        msg = `On hold until ${fmt(reviewDate)}. A diary reminder is set for that day.`;
        break;
      case "release":
        next = { state: "OPEN", reason: "", remarks: "", at: today(), events: [ev("Hold released", remarks || "Work resumed on the claim."), ...prevEvents] };
        msg = "Hold released.";
        break;
      default:
        return;
    }
    onDone(next, msg);
  }

  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";
  const danger = action === "close" || action === "withdraw" || (action === "nbnr" && nbnrMode === "close");
  const buttonLabel =
    action === "nbnr" ? (nbnrMode === "convert" ? "Convert to claim" : "Close NBNR") : action === "close" ? (repudiate ? "Send for approval" : "Close claim") : action === "reopen" ? "Send for approval" : TITLES[action];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cs-title" className="flex max-h-[calc(100vh-32px)] w-full max-w-[470px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="cs-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              {TITLES[action]}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              <span className="font-mono">{claim.claimNo}</span> · {claim.insured} · reserve ₹{Number(claim.reserve).toLocaleString("en-IN")}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">
          {action === "nbnr" && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-[12.5px]" role="radiogroup" aria-label="Resolution">
              {[
                ["convert", "Convert to claim"],
                ["close", "Close NBNR"],
              ].map(([k, l], i) => (
                <button
                  key={k}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={nbnrMode === k}
                  onClick={() => {
                    setNbnrMode(k);
                    setReason("");
                  }}
                  className={`h-8 rounded-md font-semibold ${nbnrMode === k ? "bg-white text-[#0B1F3A] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {action === "nbnr" && (
            <p className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-600" aria-hidden="true" />
              NBNR reason on this claim: <b className="font-semibold">{claim.nbnrReason || claim.nextAction}</b>
            </p>
          )}
          {action === "withdraw" && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">Allowed before assessment only. The reserve is released and the claim is closed as withdrawn.</p>}
          {action === "reopen" && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[12px] text-indigo-900">Reopening needs authority: it goes to {MANAGER} (Claims Manager) for approval.</p>}
          {action === "release" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              On hold since {fmt(rec?.at)} · {rec?.reason}. Releasing puts the claim back in your active work.
            </p>
          )}

          {action !== "release" && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-700">
                Reason <span className="text-red-600">*</span>
              </span>
              <select ref={action === "nbnr" ? undefined : firstRef} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} aria-invalid={!!err("reason")}>
                <option value="">Select</option>
                {reasonList.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              {err("reason") && <span className="mt-1 block text-[11.5px] text-red-700">{err("reason")}</span>}
            </label>
          )}

          {repudiate && (
            <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-900">
              <ShieldX className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              Repudiation is not closed by the handler. It goes to {MANAGER} for approval; the letter with the reason and policy clause goes to the insured after approval.
            </p>
          )}

          {action === "withdraw" && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-700">
                Request received by <span className="text-red-600">*</span>
              </span>
              <select value={via} onChange={(e) => setVia(e.target.value)} className={inputCls} aria-invalid={!!err("via")}>
                <option value="">Select</option>
                {["Email from insured", "Letter from insured", "Call (recorded)", "Branch visit"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              {err("via") && <span className="mt-1 block text-[11.5px] text-red-700">{err("via")}</span>}
            </label>
          )}

          {action === "hold" && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-700">
                Review date <span className="text-red-600">*</span>
              </span>
              <input type="date" value={reviewDate} min={today()} max={maxHold} onChange={(e) => setReviewDate(e.target.value)} className={inputCls} aria-invalid={!!err("reviewDate")} />
              {err("reviewDate") ? (
                <span className="mt-1 block text-[11.5px] text-red-700">{err("reviewDate")}</span>
              ) : (
                <span className="mt-1 block text-[11.5px] text-slate-500">Within 30 days. A diary reminder is set for that day.</span>
              )}
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-slate-700">
              Remarks {minRemarks > 0 && <span className="text-red-600">*</span>}
            </span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, 400))}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              aria-invalid={!!err("remarks")}
            />
            {err("remarks") ? (
              <span className="mt-1 block text-[11.5px] text-red-700">{err("remarks")}</span>
            ) : (
              <span className="mt-1 block text-[11.5px] text-slate-500">{minRemarks ? `Minimum ${minRemarks} characters · ` : "Optional · "}saved in the claim timeline</span>
            )}
          </label>

          {(action === "withdraw" || docsNotSubmitted) && (
            <div>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
                <span>{action === "withdraw" ? "The insured's written withdrawal request is uploaded to the claim." : "Reminders were sent to the insured as per the follow-up rule and there was no response."}</span>
              </label>
              {err("confirm") && <span className="mt-1 block text-[11.5px] text-red-700">{err("confirm")}</span>}
            </div>
          )}

          {action === "hold" && (
            <p className="flex gap-2 text-[11.5px] text-slate-500">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              The claim's SLA clock pauses while on hold. Regulatory TAT reports still count the full days from intimation.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            ref={action === "release" ? firstRef : undefined}
            type="submit"
            className={`h-9 rounded-lg px-3 text-[13px] font-semibold text-white ${danger && !repudiate ? "bg-red-700 hover:bg-red-800" : "bg-[#0B1F3A] hover:bg-[#13305a]"}`}
          >
            {buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}