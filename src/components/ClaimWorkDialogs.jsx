// src/components/ClaimWorkDialogs.jsx
// Phase 2B dialogs and panels for Claim 360 (Claims Handler):
//   ReserveDialog     – catalogue 19 (increase above ₹1 L → Claims Manager)
//   VarianceBanner    – catalogue 94 (reserve vs assessed / estimate > 20 %)
//   QueryDialog, ReplyDialog, QueriesPanel – catalogue 145
//   UploadDialog      – catalogue 153
//   RejectDocDialog   – catalogue 154
// Data rules live in src/data/claimWork.js.

import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, MessageSquarePlus, BellRing, CheckCircle2, Upload, Paperclip } from "lucide-react";
import {
  HANDLER_RESERVE_LIMIT,
  VARIANCE_PCT,
  RESERVE_REASONS,
  QUERY_SUBJECTS,
  DOC_REJECT_REASONS,
  UPLOAD_MAX_MB,
  MANAGER,
  isoToday,
  addDays,
  daysFromToday,
} from "../data/claimWork";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–");
const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function Label({ children, req, hint }) {
  return (
    <span className="mb-1 block text-[12px] font-medium text-slate-700">
      {children} {req && <span className="text-red-600">*</span>}
      {hint && <span className="font-normal text-slate-500"> · {hint}</span>}
    </span>
  );
}
function Err({ msg }) {
  return msg ? <span className="mt-1 block text-[11.5px] text-red-700">{msg}</span> : null;
}

/** shared dialog frame – Esc closes, first field focused */
function Frame({ id, title, sub, onCancel, onSubmit, submitLabel, danger, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("input, select, textarea")?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        ref={ref}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`flex max-h-[calc(100vh-32px)] w-full ${wide ? "max-w-[540px]" : "max-w-[470px]"} flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id={id} className="text-[15px] font-semibold text-[#0B1F3A]">
              {title}
            </h2>
            {sub && <p className="truncate text-[12px] text-slate-500">{sub}</p>}
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className={`h-9 rounded-lg px-3 text-[13px] font-semibold text-white ${danger ? "bg-red-700 hover:bg-red-800" : "bg-teal-700 hover:bg-teal-800"}`}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= 19 · Revise reserve ================= */
export function ReserveDialog({ claim, onCancel, onDone }) {
  const current = claim.reserve;
  const basis = claim.survey?.assessed ?? claim.survey?.estimate ?? null;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tried, setTried] = useState(false);
  const n = Number(String(amount).replace(/[^\d]/g, ""));
  const needsApproval = n > current && n > HANDLER_RESERVE_LIMIT;

  const errors = {};
  if (!n) errors.amount = "Enter the new reserve amount.";
  else if (n === current) errors.amount = "The new reserve is the same as the current reserve.";
  else if (n > 5000000) errors.amount = "Check the amount – above ₹50 L needs a total-loss review.";
  if (!reason) errors.reason = "Select the reason for the revision.";
  if ((reason === "Other" || needsApproval) && remarks.trim().length < 10) errors.remarks = needsApproval ? `Explain the increase for ${MANAGER} (at least 10 characters).` : "Describe the reason (at least 10 characters).";
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    onDone({ from: current, to: n, reason, remarks: remarks.trim(), needsApproval });
  }

  const diff = n ? n - current : 0;
  return (
    <Frame id="rv-title" title="Revise reserve" sub={`${claim.claimNo} · current reserve ${inr(current)}`} onCancel={onCancel} onSubmit={submit} submitLabel={needsApproval ? "Send for approval" : "Revise reserve"}>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
        <span className="text-slate-500">
          Current reserve <b className="block text-[14px] tabular-nums text-slate-900">{inr(current)}</b>
        </span>
        <span className="text-slate-500">
          {basis != null ? (claim.survey.assessed != null ? "Assessed loss" : "Garage estimate") : "Estimate"}
          <b className="block text-[14px] tabular-nums text-slate-900">{basis != null ? inr(basis) : "Not received"}</b>
        </span>
      </div>
      <label className="block">
        <Label req>New reserve (₹)</Label>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={basis ? String(basis) : ""} className={inputCls} aria-invalid={!!err("amount")} />
        {n > 0 && n !== current && (
          <span className={`mt-1 block text-[11.5px] ${diff > 0 ? "text-amber-800" : "text-emerald-700"}`}>
            {diff > 0 ? "Increase" : "Decrease"} of {inr(Math.abs(diff))} ({Math.round((Math.abs(diff) / current) * 100)}%)
          </span>
        )}
        <Err msg={err("amount")} />
      </label>
      <label className="block">
        <Label req>Reason</Label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} aria-invalid={!!err("reason")}>
          <option value="">Select</option>
          {RESERVE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Err msg={err("reason")} />
      </label>
      <label className="block">
        <Label req={reason === "Other" || needsApproval}>Remarks</Label>
        <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} h-auto py-2`} aria-invalid={!!err("remarks")} />
        <Err msg={err("remarks")} />
      </label>
      {needsApproval ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Above your ₹1 L authority – the increase goes to {MANAGER} for approval. The current reserve stays until she approves.
        </p>
      ) : (
        <p className="text-[11.5px] text-slate-500">Within your authority – the reserve changes now and is recorded in the reserve history.</p>
      )}
    </Frame>
  );
}

/* ================= 94 · Variance alert ================= */
export function VarianceBanner({ v, reserve, canRevise, onRevise, pending }) {
  if (!v?.alert) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900" role="alert">
      <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">Reserve {v.over ? "above" : "below"} the {v.basisLabel} by {v.pct}%</b> – reserve {inr(reserve)} vs {inr(v.basis)} (alert above {VARIANCE_PCT}%).
      </span>
      {pending ? (
        <span className="text-[12px] font-medium">Revision waiting for {MANAGER}</span>
      ) : (
        canRevise && (
          <button type="button" onClick={onRevise} className="h-7 rounded-md bg-amber-600 px-2.5 text-[12px] font-semibold text-white hover:bg-amber-700">
            Revise reserve
          </button>
        )
      )}
    </div>
  );
}

/* ================= 145 · Queries ================= */
export function QueryDialog({ claim, surveyorName, onCancel, onDone }) {
  const targets = [
    ["Insured", claim.insured],
    claim.garage && ["Garage", claim.garage.name],
    surveyorName && ["Surveyor", surveyorName],
  ].filter(Boolean);
  const [to, setTo] = useState(targets[0][0]);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [[today, maxDue]] = useState(() => [isoToday(), addDays(isoToday(), 15)]);
  const [due, setDue] = useState(() => addDays(isoToday(), 3));
  const [tried, setTried] = useState(false);
  const errors = {};
  if (!subject) errors.subject = "Select what the query is about.";
  if (details.trim().length < 10) errors.details = "Write the question (at least 10 characters).";
  if (!due || due < today || due > maxDue) errors.due = "Choose a reply date within 15 days.";
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    const t = targets.find((x) => x[0] === to);
    onDone({ to, toName: t[1], subject, details: details.trim(), due });
  }
  return (
    <Frame id="q-title" title="Raise query" sub={`${claim.claimNo} · ${claim.insured}`} onCancel={onCancel} onSubmit={submit} submitLabel="Send query" wide>
      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-slate-700">
          Send to <span className="text-red-600">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {targets.map(([k, name]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${to === k ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700"}`}>
              <input type="radio" name="q-to" checked={to === k} onChange={() => setTo(k)} className="h-3.5 w-3.5 accent-teal-700" />
              <b className="font-semibold">{k}</b> <span className="max-w-[170px] truncate text-slate-500">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <Label req>About</Label>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} aria-invalid={!!err("subject")}>
          <option value="">Select</option>
          {QUERY_SUBJECTS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Err msg={err("subject")} />
      </label>
      <label className="block">
        <Label req>Question</Label>
        <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputCls} h-auto py-2`} aria-invalid={!!err("details")} />
        <Err msg={err("details")} />
      </label>
      <label className="block max-w-[200px]">
        <Label req>Reply by</Label>
        <input type="date" value={due} min={today} max={maxDue} onChange={(e) => setDue(e.target.value)} className={inputCls} aria-invalid={!!err("due")} />
        <Err msg={err("due")} />
      </label>
      <p className="text-[11.5px] text-slate-500">Sent by SMS and email. A reminder goes automatically one day before the reply date.</p>
    </Frame>
  );
}

export function ReplyDialog({ query, onCancel, onDone }) {
  const [reply, setReply] = useState("");
  const [tried, setTried] = useState(false);
  const bad = reply.trim().length < 5;
  return (
    <Frame
      id="qr-title"
      title="Close query"
      sub={`${query.to} · ${query.subject}`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!bad) onDone(reply.trim());
      }}
      submitLabel="Close query"
    >
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">“{query.details}”</p>
      <label className="block">
        <Label req>Reply received</Label>
        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} className={`${inputCls} h-auto py-2`} aria-invalid={tried && bad} />
        <Err msg={tried && bad ? "Record the reply (at least 5 characters)." : null} />
      </label>
    </Frame>
  );
}

export function QueriesPanel({ queries, canAct, onRaise, onRemind, onClose }) {
  const open = queries.filter((q) => q.status === "OPEN");
  const closed = queries.filter((q) => q.status !== "OPEN");
  return (
    <div className="p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <p className="text-[12.5px] text-slate-600">
          {open.length ? `${open.length} open · ${open.filter((q) => daysFromToday(q.due) < 0).length} overdue` : "No open queries."}
        </p>
        {canAct && (
          <button type="button" onClick={onRaise} className="flex h-7 items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white hover:bg-teal-800">
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> Raise query
          </button>
        )}
      </div>
      {queries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-1.5 font-semibold">To</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Query</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Raised · reply by</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...open, ...closed].map((q) => {
                const left = daysFromToday(q.due);
                const overdue = q.status === "OPEN" && left < 0;
                return (
                  <tr key={q.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-1.5">
                      <span className="block font-semibold text-slate-800">{q.to}</span>
                      <span className="block max-w-[150px] truncate text-[11.5px] text-slate-500">{q.toName}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="block text-slate-800">{q.subject}</span>
                      <span className="block text-[11.5px] text-slate-500">{q.details}</span>
                      {q.reply && <span className="mt-0.5 block text-[11.5px] text-emerald-800">Reply: {q.reply}</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                      {fmt(q.raisedOn)}
                      <span className="block text-[11.5px]">by {fmt(q.due)}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      {q.status === "OPEN" ? (
                        <span className={`inline-flex whitespace-nowrap rounded px-1.5 text-[11px] font-semibold leading-5 ${overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900"}`}>
                          {overdue ? `Overdue ${-left} d` : left === 0 ? "Due today" : `Open · ${left} d left`}
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-emerald-50 px-1.5 text-[11px] font-semibold leading-5 text-emerald-800">Closed {fmt(q.closedOn)}</span>
                      )}
                      {q.reminders > 0 && <span className="block text-[11px] text-slate-500">{q.reminders} reminder(s)</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      {canAct && q.status === "OPEN" && (
                        <span className="inline-flex gap-2">
                          <button type="button" onClick={() => onRemind(q)} className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-700 hover:underline">
                            <BellRing className="h-3 w-3" aria-hidden="true" /> Remind
                          </button>
                          <button type="button" onClick={() => onClose(q)} className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-700 hover:underline">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Close
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= 153 · Upload document ================= */
export function UploadDialog({ claim, documents, onCancel, onDone }) {
  const types = [...documents.map((d) => d.name), "Other document"];
  const [docType, setDocType] = useState(() => documents.find((d) => d.status === "Pending" || d.status === "Rejected")?.name || "");
  const [otherName, setOtherName] = useState("");
  const [source, setSource] = useState("Insured");
  const [file, setFile] = useState(null);
  const [tried, setTried] = useState(false);
  const errors = {};
  if (!docType) errors.type = "Select the document type.";
  if (docType === "Other document" && otherName.trim().length < 3) errors.other = "Name the document.";
  if (!file) errors.file = "Choose a file.";
  else if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) errors.file = "Only PDF, JPG or PNG files.";
  else if (file.size > UPLOAD_MAX_MB * 1024 * 1024) errors.file = `File is larger than ${UPLOAD_MAX_MB} MB.`;
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    onDone({ docType: docType === "Other document" ? otherName.trim() : docType, fileName: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), source });
  }
  return (
    <Frame id="up-title" title="Upload document" sub={`${claim.claimNo} · ${claim.insured}`} onCancel={onCancel} onSubmit={submit} submitLabel="Upload">
      <label className="block">
        <Label req>Document type</Label>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls} aria-invalid={!!err("type")}>
          <option value="">Select</option>
          {types.map((t) => {
            const d = documents.find((x) => x.name === t);
            return (
              <option key={t} value={t}>
                {t}
                {d ? ` – ${d.status === "Rejected" ? "rejected, upload again" : d.status.toLowerCase()}` : ""}
              </option>
            );
          })}
        </select>
        <Err msg={err("type")} />
      </label>
      {docType === "Other document" && (
        <label className="block">
          <Label req>Document name</Label>
          <input value={otherName} onChange={(e) => setOtherName(e.target.value)} className={inputCls} aria-invalid={!!err("other")} />
          <Err msg={err("other")} />
        </label>
      )}
      <label className="block">
        <Label req hint={`PDF, JPG or PNG · max ${UPLOAD_MAX_MB} MB`}>
          File
        </Label>
        <span className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] ${err("file") ? "border-red-400" : "border-slate-300"}`}>
          {file ? <Paperclip className="h-4 w-4 text-teal-700" aria-hidden="true" /> : <Upload className="h-4 w-4 text-slate-400" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate text-slate-700">{file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "Choose a file"}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-[96px] text-[11px] file:mr-0 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[11.5px]" aria-label="Choose file" />
        </span>
        <Err msg={err("file")} />
      </label>
      <label className="block max-w-[220px]">
        <Label>Received from</Label>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
          {["Insured", "Garage", "Surveyor", "Police / RTO", "Handler (scanned)"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <p className="text-[11.5px] text-slate-500">The document is marked Received – to verify. Verify or reject it from the Documents tab.</p>
    </Frame>
  );
}

/* ================= 154 · Reject document ================= */
export function RejectDocDialog({ docName, onCancel, onDone }) {
  const [reason, setReason] = useState("");
  const [rerequest, setRerequest] = useState(true);
  const [tried, setTried] = useState(false);
  return (
    <Frame
      id="rj-title"
      title="Reject document"
      sub={docName}
      danger
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (reason) onDone(reason, rerequest);
      }}
      submitLabel="Reject"
    >
      <label className="block">
        <Label req>Reason</Label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} aria-invalid={tried && !reason}>
          <option value="">Select</option>
          {DOC_REJECT_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Err msg={tried && !reason ? "Select why the document is rejected." : null} />
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
        <input type="checkbox" checked={rerequest} onChange={(e) => setRerequest(e.target.checked)} className="h-4 w-4 accent-teal-700" />
        Ask the insured for it again (SMS & email with the reason)
      </label>
    </Frame>
  );
}