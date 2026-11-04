// src/pages/od/ODManagerDashboard.jsx
// OD Claims Manager – Team Dashboard (persona: Priya Raghavan · OD0150 · Chennai)
// Route: /od/dashboard → ODHome picks this page for role CLAIMS_MANAGER.
//
// What the manager sees on one screen:
//   1. Team KPIs – open, SLA breached, at risk, waiting for my approval, SLA met, avg TAT
//   2. Team workload – each handler: open vs capacity, breached, at risk, due today, closed, SLA met, TAT
//   3. Waiting for my approval – oldest first, approval SLA, authority check (above ₹5 L → Zonal head)
//   4. Team stage-wise TAT vs target, with breached claims per stage
//   5. Watch list – high-value and red-flag claims
// Data: src/data/odTeamMock.js (Karthik's figures come from his real queue).

import { useState } from "react";
import {
  FolderOpen,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  Gauge,
  Timer,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  IndianRupee,
  CalendarClock,
  Plane,
  Shuffle,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { useAuth } from "../../auth";
import {
  TEAM,
  TEAM_KPIS,
  APPROVALS,
  WATCHLIST,
  TEAM_TAT,
  MANAGER_AUTHORITY,
  APPROVAL_SLA_HOURS,
  HANDLER_CAPACITY,
} from "../../data/odTeamMock";

/* ---------------- helpers ---------------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}
const lakh = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : "₹" + Number(n).toLocaleString("en-IN"));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
const waitLabel = (h) => (h >= 24 ? `${Math.floor(h / 24)} d ${h % 24 ? `${h % 24} h` : ""}`.trim() : `${h} h`);
const STAGE_SHORT = {
  "Registration → Surveyor appointed": "Surveyor appointed",
  "Surveyor appointed → Survey done": "Survey done",
  "Survey → Assessment report": "Assessment report",
  "Document collection": "Document collection",
  Approval: "Approval",
  "Final invoice → Delivery order": "Delivery order",
  "Delivery order → Payment": "Payment",
};

/* ---------------- building blocks ---------------- */
function Card({ title, note, children, className = "" }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex min-h-9 flex-none flex-wrap items-center justify-between gap-x-2 border-b border-slate-100 px-3 py-0.5">
        <h2 className="truncate text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
        {note && <span className="flex-none truncate text-[11.5px] text-slate-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}

// numbers in the workload table: only colour when there is something to act on
function Num({ v, tone }) {
  if (!v) return <span className="text-slate-300">–</span>;
  const cls = tone === "red" ? "font-semibold text-red-700" : tone === "amber" ? "font-semibold text-amber-800" : "text-slate-800";
  return <span className={cls}>{v}</span>;
}

export default function ODManagerDashboard() {
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0];
  const [toast, setToast] = useState("");

  function notBuilt(what) {
    setToast(`${what} – this page comes in a later build step.`);
    window.clearTimeout(notBuilt.t);
    notBuilt.t = window.setTimeout(() => setToast(""), 2600);
  }

  const K = TEAM_KPIS;
  const slaOk = K.slaMet >= K.slaTarget;
  const tatOk = K.avgTat <= K.tatTarget;
  const KPIS = [
    { label: "Team open claims", value: K.open, sub: `${TEAM.length} handlers`, icon: FolderOpen, tone: "bg-slate-100 text-slate-700", go: "Team Work Queue" },
    { label: "SLA breached", value: K.breached, sub: "Open claims", icon: AlertTriangle, tone: "bg-red-50 text-red-700", go: "Team Work Queue" },
    { label: "At risk", value: K.atRisk, sub: "Due ≤ 24 h", icon: Clock, tone: "bg-amber-50 text-amber-800", go: "Team Work Queue" },
    { label: "Waiting for my approval", value: K.approvals, sub: `${lakh(K.approvalsValue)} · ${K.approvalsOverSla} over SLA`, icon: ClipboardCheck, tone: "bg-teal-50 text-teal-800", go: "Approvals" },
    { label: "SLA met (30 days)", value: `${K.slaMet}%`, sub: `Target ${K.slaTarget}%`, icon: Gauge, tone: slaOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700", ok: slaOk },
    { label: "Avg TAT (30 days)", value: `${K.avgTat} d`, sub: `Target ${K.tatTarget} d`, icon: Timer, tone: tatOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700", ok: tatOk },
  ];
  const maxTat = Math.max(...TEAM_TAT.map((s) => Math.max(s.actual, s.target))) * 1.1;
  const onLeave = TEAM.filter((h) => h.status === "leave");

  return (
    <ODShell active="dashboard" title={`${greeting()}, ${firstName}`} subtitle={`${todayLabel()} · Team SLA, workload and approvals`} onNavigateMissing={notBuilt}>
      <div className="flex flex-col gap-2">
        {/* ---------------- KPI row ---------------- */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {KPIS.map((k) => {
            const Tag = k.go ? "button" : "div";
            return (
              <Tag
                key={k.label}
                {...(k.go ? { type: "button", onClick: () => notBuilt(k.go), title: `Open ${k.go}` } : {})}
                className={`flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-left ${k.go ? "transition hover:border-teal-600" : ""}`}
              >
                <span className={`grid h-7 w-7 flex-none place-items-center rounded ${k.tone}`}>
                  <k.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium leading-tight text-slate-500" title={k.label}>{k.label}</span>
                  <span className="block text-base font-semibold leading-tight tabular-nums text-slate-900">{k.value}</span>
                  <span className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-slate-500">
                    {k.sub}
                    {k.ok !== undefined &&
                      (k.ok ? (
                        <CheckCircle2 className="h-3 w-3 flex-none text-emerald-700" aria-label="Within target" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 flex-none text-red-700" aria-label="Off target" />
                      ))}
                  </span>
                </span>
              </Tag>
            );
          })}
        </div>

        {/* ---------------- Row 2: Workload · Approvals ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card
            title="Team workload"
            note={onLeave.length ? `${onLeave.map((h) => h.name.split(" ")[0]).join(", ")} on leave · ${onLeave.reduce((t, h) => t + h.dueToday, 0)} claims due today need cover` : `Capacity ${HANDLER_CAPACITY} open claims per handler`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] whitespace-nowrap text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-1.5 pl-3 pr-2 font-semibold">Handler</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold" title={`Open claims against a capacity of ${HANDLER_CAPACITY}`}>Open / cap.</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right font-semibold" title="SLA breached">Breached</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right font-semibold">At risk</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right font-semibold">Due today</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right font-semibold" title="Closed in the last 30 days">Closed</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right font-semibold" title="SLA met, last 30 days">SLA</th>
                    <th scope="col" className="py-1.5 pl-1.5 pr-3 text-right font-semibold" title="Average TAT, last 30 days">TAT</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {TEAM.map((h) => {
                    const load = h.open / HANDLER_CAPACITY;
                    const over = load > 1;
                    return (
                      <tr key={h.userId} className="border-t border-slate-100 hover:bg-teal-50/40">
                        <td className="py-1 pl-3 pr-2">
                          <button
                            type="button"
                            onClick={() => notBuilt(`Team Work Queue (${h.name})`)}
                            title={`${h.name} · ${h.userId}${h.leaveNote ? " · " + h.leaveNote : ""}`}
                            className="group flex min-w-0 items-center gap-2 text-left"
                          >
                            <span className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[9px] font-bold ${h.status === "leave" ? "bg-slate-200 text-slate-500" : "bg-[#0B1F3A] text-teal-200"}`}>
                              {initials(h.name)}
                            </span>
                            <span className="font-semibold text-slate-800 group-hover:text-teal-800 group-hover:underline">{h.name}</span>
                            {h.status === "leave" && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                                <Plane className="h-2.5 w-2.5" aria-hidden="true" />
                                On leave
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-1">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-12 flex-none overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                              <span
                                className={`block h-full rounded-full ${over ? "bg-red-600" : load > 0.85 ? "bg-amber-500" : "bg-teal-600"}`}
                                style={{ width: `${Math.min(100, load * 100)}%` }}
                              />
                            </span>
                            <span className={over ? "font-semibold text-red-700" : "text-slate-800"} title={over ? "Over capacity" : undefined}>
                              {h.open}
                              <span className="font-normal text-slate-400">/{HANDLER_CAPACITY}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-1.5 py-1 text-right"><Num v={h.breached} tone="red" /></td>
                        <td className="px-1.5 py-1 text-right"><Num v={h.atRisk} tone="amber" /></td>
                        <td className="px-1.5 py-1 text-right">
                          {h.status === "leave" && h.dueToday ? (
                            <button type="button" onClick={() => notBuilt("Reallocation")} title="Reallocate to cover leave" className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 font-semibold text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100">
                              {h.dueToday}
                              <Shuffle className="h-3 w-3" aria-hidden="true" />
                            </button>
                          ) : (
                            <Num v={h.dueToday} />
                          )}
                        </td>
                        <td className="px-1.5 py-1 text-right text-slate-800">{h.closed30}</td>
                        <td className={`px-1.5 py-1 text-right ${h.slaMet < K.slaTarget ? "font-semibold text-red-700" : "text-slate-800"}`}>{h.slaMet}%</td>
                        <td className={`py-1 pl-1.5 pr-3 text-right ${h.avgTat > K.tatTarget ? "font-semibold text-red-700" : "text-slate-800"}`}>{h.avgTat} d</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="tabular-nums">
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <td className="py-1 pl-3 pr-2">Team total</td>
                    <td className="px-2 py-1">{K.open}</td>
                    <td className="px-1.5 py-1 text-right text-red-700">{K.breached}</td>
                    <td className="px-1.5 py-1 text-right text-amber-800">{K.atRisk}</td>
                    <td className="px-1.5 py-1 text-right">{K.dueToday}</td>
                    <td className="px-1.5 py-1 text-right">{K.closed30}</td>
                    <td className="px-1.5 py-1 text-right">{K.slaMet}%</td>
                    <td className="py-1 pl-1.5 pr-3 text-right">{K.avgTat} d</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="Waiting for my approval" note={`${K.approvals} claims · ${lakh(K.approvalsValue)} · oldest first`}>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto lg:max-h-[212px]">
              {APPROVALS.map((a) => {
                const overSla = a.waitingHours > APPROVAL_SLA_HOURS;
                const nearSla = !overSla && a.waitingHours > APPROVAL_SLA_HOURS - 12;
                const above = a.amount > MANAGER_AUTHORITY;
                return (
                  <li key={a.claimNo}>
                    <button type="button" onClick={() => notBuilt("Approvals")} className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-teal-50/40">
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[11.5px] font-semibold text-teal-800">{a.claimNo}</span>
                          {above && (
                            <span className="rounded bg-violet-50 px-1 text-[10px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200" title={`Above your authority of ${inr(MANAGER_AUTHORITY)} – refer to the Zonal Claims Head`}>
                              Above my limit
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {a.handler.split(" ")[0]} · {a.insured} · {a.lossType}
                        </span>
                      </span>
                      <span className="flex-none text-right leading-tight">
                        <span className="block text-[12.5px] font-semibold tabular-nums text-slate-900">{inr(a.amount)}</span>
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold ${overSla ? "text-red-700" : nearSla ? "text-amber-800" : "text-slate-500"}`}
                          title={`Approval SLA ${APPROVAL_SLA_HOURS / 24} days`}
                        >
                          {overSla ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CalendarClock className="h-3 w-3" aria-hidden="true" />}
                          {waitLabel(a.waitingHours)}
                          {overSla ? " · over SLA" : " waiting"}
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 flex-none text-slate-300" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* ---------------- Row 3: Team TAT · Watch list ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Team stage-wise TAT vs target" note="Average days · last 90 days · breached = open claims now over SLA">
            <ul className="flex flex-col gap-[3px] px-3 py-1">
              {TEAM_TAT.map((s) => {
                const over = s.actual > s.target;
                return (
                  <li key={s.stage} className="grid grid-cols-[130px_minmax(0,1fr)_96px_64px] items-center gap-2 text-[12px] max-sm:grid-cols-[100px_minmax(0,1fr)_80px]">
                    <span className="truncate text-slate-700" title={s.stage}>{STAGE_SHORT[s.stage] || s.stage}</span>
                    <span className="relative h-2.5 rounded bg-slate-100" aria-hidden="true">
                      <span className={`absolute inset-y-0 left-0 rounded ${over ? "bg-red-600" : "bg-teal-600"}`} style={{ width: `${(s.actual / maxTat) * 100}%` }} />
                      <span className="absolute -inset-y-0.5 w-0.5 bg-[#0B1F3A]" style={{ left: `${(s.target / maxTat) * 100}%` }} title={`Target ${s.target} d`} />
                    </span>
                    <span className="text-right tabular-nums">
                      <span className={`font-semibold ${over ? "text-red-700" : "text-slate-900"}`}>{s.actual.toFixed(1)} d</span>
                      <span className="text-slate-400"> / {s.target} d</span>
                    </span>
                    <span className="text-right max-sm:hidden">
                      {s.breached ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 text-[11px] font-semibold leading-4 text-red-700">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          {s.breached}
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-0.5 text-[10.5px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-teal-600" aria-hidden="true" />Within target</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-600" aria-hidden="true" />Over target</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-[#0B1F3A]" aria-hidden="true" />Target</span>
            </p>
          </Card>

          <Card title="Watch list" note="High value and red flags">
            <ul className="divide-y divide-slate-100">
              {WATCHLIST.map((w) => (
                <li key={w.claimNo}>
                  <button type="button" onClick={() => notBuilt("Escalations")} className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-teal-50/40">
                    <span
                      className={`grid h-5 w-5 flex-none place-items-center rounded ${
                        w.kind === "fraud" ? "bg-red-50 text-red-700" : w.kind === "late" ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800"
                      }`}
                    >
                      {w.kind === "fraud" ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> : w.kind === "late" ? <Clock className="h-3.5 w-3.5" aria-hidden="true" /> : <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate leading-tight" title={`${w.claimNo} · ${w.reason} · ${w.handler}`}>
                      <span className="font-mono text-[11.5px] font-semibold text-teal-800">{w.claimNo}</span>
                      <span className="text-[11px] text-slate-500"> · {w.reason}</span>
                    </span>
                    <span className="flex-none text-[12px] font-semibold tabular-nums text-slate-900">{lakh(w.reserve)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}