// src/components/HandlerRequestDetail.jsx
// Claims Manager – one request from a Claims Handler (Approvals → "From handlers"):
// repudiation (131), reopen (134) or reserve increase above ₹1 L (19). Approve or Reject; rejecting needs remarks.

import { useState } from "react";
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { REQUEST_KIND } from "../data/handlerRequests";

const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–");

const WHAT_HAPPENS = {
  REPUDIATION: ["Claim is repudiated and closed; reserve released. The handler issues the repudiation letter quoting the policy clause.", "Claim goes back to the handler to continue processing."],
  REOPEN: ["Claim is reopened in the handler's queue and the reserve is re-created.", "Claim stays closed as it was."],
  RESERVE: ["New reserve applies from today and is recorded in the reserve history.", "Reserve stays at the current amount."],
};

export function RequestListItem({ r, on, onClick }) {
  const k = REQUEST_KIND[r.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "true" : undefined}
      className={`block w-full border-l-[3px] px-3 py-1.5 text-left ${on ? "border-teal-600 bg-teal-50/60" : "border-transparent hover:bg-slate-50"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-teal-800">{r.claimNo}</span>
        <span className="text-[12.5px] font-semibold tabular-nums text-slate-900">{r.kind === "RESERVE" ? inr(r.to) : inr(r.reserve)}</span>
      </span>
      <span className="block truncate text-[11.5px] text-slate-600">
        {r.insured} · {r.vehicle} · {r.handler.split(" ")[0]}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className={`inline-flex items-center rounded px-1.5 text-[10.5px] font-semibold leading-[18px] ring-1 ring-inset ${k.tone}`}>{k.label}</span>
        <span className="text-[11px] text-slate-500">sent {fmt(r.raisedOn)}</span>
      </span>
    </button>
  );
}

export default function HandlerRequestDetail({ r, onDecide, onOpenClaim }) {
  const [remarks, setRemarks] = useState("");
  const [tried, setTried] = useState(false);
  const k = REQUEST_KIND[r.kind];
  const rejectBad = remarks.trim().length < 10;

  const facts = [
    ["Request", k.label],
    ["Handler", r.handler],
    ["Sent on", fmt(r.raisedOn)],
    ["Loss type", r.lossType],
    r.kind === "RESERVE" ? ["Reserve", `${inr(r.reserve)} → ${inr(r.to)} (+${inr(r.to - r.reserve)})`] : ["Current reserve", inr(r.reserve)],
    ["Garage estimate", inr(r.estimate)],
    ["Assessed loss", r.assessed == null ? "Not assessed yet" : inr(r.assessed)],
    r.kind === "REOPEN" && ["Closed as", r.closedAs],
  ].filter(Boolean);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-[#0B1F3A]">{r.claimNo}</span>
            <span className={`inline-flex items-center rounded px-1.5 text-[11px] font-semibold leading-5 ring-1 ring-inset ${k.tone}`}>{k.label}</span>
          </p>
          <p className="text-[12px] text-slate-500">
            {r.insured} · {r.regNo} · {r.vehicle}
          </p>
        </div>
        <button type="button" onClick={onOpenClaim} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open claim
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-4">
          {facts.map(([t, v]) => (
            <div key={t}>
              <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{t}</dt>
              <dd className="text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Handler's reason</p>
          <p className="text-[13px] font-semibold text-slate-800">{r.reason}</p>
          {r.remarks && <p className="text-[12.5px] text-slate-700">“{r.remarks}”</p>}
        </div>
        <div className="grid gap-2 text-[12px] sm:grid-cols-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-900">
            <b className="font-semibold">If you approve:</b> {WHAT_HAPPENS[r.kind][0]}
          </p>
          <p className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700">
            <b className="font-semibold">If you reject:</b> {WHAT_HAPPENS[r.kind][1]}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-slate-700">
            Remarks to the handler <span className="font-normal text-slate-500">· required to reject</span>
          </span>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            aria-invalid={tried && rejectBad}
          />
          {tried && rejectBad && <span className="mt-1 block text-[11.5px] text-red-700">Tell the handler why (at least 10 characters).</span>}
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (!rejectBad) onDecide(false, remarks.trim());
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
        </button>
        <button type="button" onClick={() => onDecide(true, remarks.trim())} className="flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve {k.label.toLowerCase()}
        </button>
      </div>
    </section>
  );
}