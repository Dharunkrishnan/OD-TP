// src/components/ClaimTimeline.jsx
// Single-lane claim timeline (Claim 360): date and time on the left, a line with a node per step,
// and a card per step on the right – stage, team, what was done, SLA with met / breached / due
// status, and the regulatory basis (IRDAI badge or "no regulatory mandate").
// steps come from claimJourney(); highlight = lifecycle stage index to highlight (stage view).

import { useState } from "react";
import { AlertTriangle, Calculator, Camera, Check, Clock, FilePlus2, Flag, Gavel, IdCard, Lock, Pause, Send, ShieldCheck, UserCheck } from "lucide-react";

const ICONS = { file: FilePlus2, pause: Pause, id: IdCard, user: UserCheck, camera: Camera, calc: Calculator, shield: ShieldCheck, gavel: Gavel, send: Send, lock: Lock, flag: Flag };
const STAGE_NAMES = ["Intake", "Survey", "Assessment", "Decision", "Settlement"];
const dt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function Chip({ chip }) {
  if (!chip || chip.kind === "none") return null;
  const map = {
    met: ["bg-emerald-50 text-emerald-800", Check],
    breach: ["bg-red-50 text-red-800", AlertTriangle],
    overdue: ["bg-red-50 text-red-800", AlertTriangle],
    due: ["bg-amber-50 text-amber-900", Clock],
  };
  const [cls, Icon] = map[chip.kind];
  return (
    <span className={`ml-1 inline-flex h-[18px] items-center gap-1 rounded px-1.5 align-middle text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {chip.text}
    </span>
  );
}

export default function ClaimTimeline({ steps, highlight = null, compact = false }) {
  const [show, setShow] = useState("all");
  const done = steps.filter((s) => s.state === "done").length;
  const breached = steps.filter((s) => s.chip?.kind === "breach" || s.chip?.kind === "overdue").length;
  const shown = steps.filter((s) => show === "all" || (show === "irdai" && s.irdai) || (show === "stage" && s.lifecycle === highlight));
  const filters = [
    ["all", "All steps"],
    ...(highlight != null ? [["stage", `This stage (${STAGE_NAMES[highlight]})`]] : []),
    ["irdai", "IRDAI steps"],
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div role="radiogroup" aria-label="Show steps" className="inline-flex overflow-hidden rounded-md border border-slate-300">
          {filters.map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={show === k}
              onClick={() => setShow(k)}
              className={`h-7 px-2.5 text-[12px] font-medium ${show === k ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-slate-600">
          {steps.length} steps · {done} done
          {breached > 0 && <span className="font-semibold text-red-700"> · {breached} SLA breached</span>}
        </p>
      </div>

      <ol className={`px-3 pb-3 ${compact ? "" : "pt-1"}`}>
        {shown.map((s, i) => {
          const Icon = ICONS[s.icon] || FilePlus2;
          const first = i === 0;
          const last = i === shown.length - 1;
          const bad = s.chip?.kind === "breach" || s.chip?.kind === "overdue";
          const node =
            s.state === "todo"
              ? "bg-slate-300"
              : s.state === "current"
                ? "bg-[#0B1F3A]"
                : s.flag
                  ? "bg-amber-500"
                  : bad
                    ? "bg-red-600"
                    : "bg-teal-700";
          const hl = highlight != null && s.lifecycle === highlight;
          return (
            <li key={s.key} className={`grid ${compact ? "grid-cols-[76px_30px_minmax(0,1fr)]" : "grid-cols-[92px_34px_minmax(0,1fr)]"} items-start`}>
              <div className="pr-1 pt-1 text-right text-[12px] leading-tight">
                {s.when ? (
                  <>
                    <div className="font-semibold text-slate-800">{dt(s.when.date)}</div>
                    <div className="text-slate-500">{s.when.time}</div>
                  </>
                ) : (
                  <div className="text-slate-500">{s.state === "current" ? "Now" : "Pending"}</div>
                )}
              </div>
              <div className="relative flex justify-center self-stretch">
                <span className={`absolute w-0.5 bg-slate-300 ${first ? "top-3.5" : "top-0"} ${last ? "h-3.5" : "bottom-0"}`} aria-hidden="true" />
                <span className={`relative mt-0.5 grid h-[26px] w-[26px] place-items-center rounded-full text-white ring-[3px] ring-white ${node}`} aria-hidden="true">
                  {s.state === "done" && !bad && !s.flag ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
              </div>
              <div
                className={`mb-2 rounded-lg border px-3 py-2 ${
                  s.state === "current" ? "border-[#0B1F3A] ring-1 ring-[#0B1F3A]" : hl ? "border-teal-300 bg-teal-50/40" : "border-slate-200"
                } ${s.state === "todo" ? "bg-slate-50" : hl ? "" : "bg-white"}`}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`text-[12.5px] font-semibold ${s.state === "todo" ? "text-slate-500" : "text-[#0B1F3A]"}`}>{s.stage}</span>
                  <span className="inline-flex h-[18px] items-center rounded bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700">{s.team}</span>
                  {s.irdai && <span className="inline-flex h-[18px] items-center rounded bg-blue-50 px-1.5 text-[11px] font-semibold text-blue-800">IRDAI</span>}
                  {s.state === "current" && <span className="inline-flex h-[18px] items-center rounded bg-[#0B1F3A] px-1.5 text-[11px] font-semibold text-white">current step</span>}
                </div>
                <p className={`mt-0.5 text-[12px] ${s.state === "todo" ? "text-slate-500" : "text-slate-700"}`}>{s.act}</p>
                <p className="mt-0.5 text-[12px] text-slate-800">
                  <span className="text-slate-500">SLA:</span> {s.sla}
                  <Chip chip={s.chip} />
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{s.reg}</p>
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-1 py-6 text-center text-[12.5px] text-slate-500">No steps for this filter.</li>}
      </ol>
    </div>
  );
}