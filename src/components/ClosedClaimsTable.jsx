// src/components/ClosedClaimsTable.jsx
// My Work Queue → Closed: claims the handler has closed (catalogue 130, 131, 16), most recent first.
// Filters: closure type and period; search by claim no, vehicle no or insured.
// Open a claim to read it (eye) or work on it (pen) – Claim actions → Reopen needs the manager's approval (134).

import { useMemo, useState } from "react";
import { Eye, FilePen, Search, RotateCcw } from "lucide-react";
import { CLOSURE_TYPES } from "../data/claimLists";

const inr = (n) => (n ? "₹" + Number(n).toLocaleString("en-IN") : "–");
const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const TYPE_TONE = {
  Paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Withdrawn: "bg-slate-100 text-slate-700 ring-slate-200",
  Repudiated: "bg-red-50 text-red-800 ring-red-200",
  "Closed without payment": "bg-amber-50 text-amber-900 ring-amber-200",
  "NBNR closed": "bg-indigo-50 text-indigo-800 ring-indigo-200",
};
const PERIODS = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "This year", days: 365 },
];

export default function ClosedClaimsTable({ rows, onOpen }) {
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState("90");
  const [q, setQ] = useState("");
  const [cutoff] = useState(() => {
    const p = {};
    PERIODS.forEach((x) => (p[x.key] = new Date(Date.now() - x.days * 86400000).toISOString().slice(0, 10)));
    return p;
  });

  const inPeriod = useMemo(() => rows.filter((r) => r.closedOn >= cutoff[period]), [rows, period, cutoff]);
  const counts = useMemo(() => Object.fromEntries(CLOSURE_TYPES.map((t) => [t, inPeriod.filter((r) => r.closureType === t).length])), [inPeriod]);
  const shown = inPeriod.filter((r) => (type === "all" || r.closureType === type) && (!q.trim() || `${r.claimNo} ${r.regNo} ${r.insured}`.toLowerCase().includes(q.trim().toLowerCase())));
  const paidTotal = shown.reduce((t, r) => t + (r.paid || 0), 0);

  return (
    <div className="flex flex-col">
      {/* closure-type chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        {[["all", "All closed", inPeriod.length], ...CLOSURE_TYPES.map((t) => [t, t, counts[t]])].map(([k, l, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            aria-pressed={type === k}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold ${type === k ? "border-[#0B1F3A] bg-[#0B1F3A] text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {l}
            <span className={`rounded-full px-1.5 text-[11px] ${type === k ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{n}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Claim, vehicle or insured"
              aria-label="Search closed claims"
              className="h-7 w-[210px] rounded-md border border-slate-300 pl-7 pr-2 text-[12px] outline-none focus:border-teal-600"
            />
          </label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Closed in" className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[12px]">
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-3 py-2 font-semibold">Claim no</th>
              <th scope="col" className="px-2 py-2 font-semibold">Vehicle no</th>
              <th scope="col" className="px-2 py-2 font-semibold">Insured</th>
              <th scope="col" className="px-2 py-2 font-semibold">Loss type</th>
              <th scope="col" className="px-2 py-2 font-semibold">Closure</th>
              <th scope="col" className="px-2 py-2 font-semibold">Closed on</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Paid</th>
              <th scope="col" className="px-2 py-2 font-semibold">Reason</th>
              <th scope="col" className="w-[76px] px-3 py-2 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.claimNo}
                // a click anywhere on the row opens the claim (view); buttons keep their own action
                onClick={(e) => !e.target.closest("button, a, input, select") && !window.getSelection()?.toString() && onOpen(r.claimNo, false)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" onClick={() => onOpen(r.claimNo, false)} className="font-mono text-[12px] font-semibold text-teal-800 hover:underline">
                    {r.claimNo}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-700">{r.regNo}</td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-800">{r.insured}</td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-600">{r.lossType}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className={`inline-flex rounded px-1.5 text-[12px] font-semibold leading-5 ring-1 ring-inset ${TYPE_TONE[r.closureType]}`}>{r.closureType}</span>
                  {r.reopenPending && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 text-[12px] font-semibold leading-5 text-violet-800">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reopen requested
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-700">{fmt(r.closedOn)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-slate-900">{inr(r.paid)}</td>
                <td className="max-w-[300px] truncate px-2 py-2 text-slate-600" title={r.closeReason}>
                  {r.closeReason}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => onOpen(r.claimNo, false)} aria-label={`View ${r.claimNo}`} title="View" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onOpen(r.claimNo, true)} aria-label={`Open ${r.claimNo} to reopen`} title="Open – Reopen is under Claim actions" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                      <FilePen className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-[12.5px] text-slate-500">
                  No closed claims for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500">
        {shown.length} closed claim(s) · paid {inr(paidTotal)} · closed claims are outside SLA and are not counted in the open queue.
      </p>
    </div>
  );
}