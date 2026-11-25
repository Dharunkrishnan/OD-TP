// src/data/handlerDashboard.js
// Every figure on the Claims Handler dashboard, calculated live from the claims – nothing typed in.
// The same matching rule (matchOpen / matchClosed) filters My Work Queue when a figure is clicked,
// so a number on the dashboard and the list it opens always agree.
//
// Requirement coverage
//   180  Role-based dashboard – pending, TAT, ageing, outstanding
//   166  TAT tracking, ageing and breach alerts
//   168  IRDAI regulatory TAT monitoring (survey report, claim decision)
//   184  Intimated / registered / closed (paid, withdrawn, repudiated, closed without payment, NBNR closed)
//
// Filters (Performance tab)
//   reg  : registered in – "mtd" (this month) | "7" | "30" | "90" days; empty = all claims
//   loss : loss type; empty = all
// A filter selects the claims (registered in the period, of that loss type); every card then
// counts within that set, so All = Open + Closed holds for any filter.

import { openQueue, closedList, CLOSURE_TYPES } from "./claimLists";
import { IRDAI_STEPS } from "./odHandlerMock";

/* ------------------------------------------------------------------ */
/* Filter definitions                                                  */
/* ------------------------------------------------------------------ */
export const PERIODS = [
  { key: "", label: "All" },
  { key: "mtd", label: "This month" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];
export const PERIOD_TEXT = { mtd: "registered this month", 7: "registered in the last 7 days", 30: "registered in the last 30 days", 90: "registered in the last 90 days" };

export const AGE_BANDS = [
  { key: "0-7", label: "0–7 d", min: 0, max: 7 },
  { key: "8-15", label: "8–15 d", min: 8, max: 15 },
  { key: "16-30", label: "16–30 d", min: 16, max: 30 },
  { key: "31-60", label: "31–60 d", min: 31, max: 60 },
  { key: "60+", label: "60+ d", min: 61, max: Infinity },
];

// Pipeline stages with their TAT target (days). Labels follow the merged persona:
// the handler is also the surveyor, so the first steps are the handler's own inspection.
export const TAT_PIPE = [
  { stage: "Registered", label: "Registration → Inspection", target: 1 },
  { stage: "Survey pending", label: "Inspection → Survey done", target: 2 },
  { stage: "Assessment", label: "Survey → Assessment", target: 5 },
  { stage: "Documents pending", label: "Document collection", target: 7 },
  { stage: "Approval", label: "Approval", target: 2 },
  { stage: "Repair / DO", label: "Final invoice → Delivery order", target: 3 },
  { stage: "Payment", label: "Delivery order → Payment", target: 2 },
];
export const STAGE_ORDER = ["NBNR", ...TAT_PIPE.map((t) => t.stage)];

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, "0");
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysBetween = (a, b) => Math.round((new Date(b.slice(0, 10) + "T00:00:00") - new Date(a.slice(0, 10) + "T00:00:00")) / 86400000);

function inPeriod(regDate, reg) {
  if (!reg) return true;
  const today = todayIso();
  if (reg === "mtd") return regDate >= today.slice(0, 8) + "01";
  return daysBetween(regDate, today) <= Number(reg) - 1;
}

/* ------------------------------------------------------------------ */
/* Stage durations                                                     */
/* Demo: each claim's time in every completed stage is derived from    */
/* its registration date, age and the stage target (a fixed spread per */
/* claim, so figures are stable). Real system: stage-change timestamps */
/* from the claim audit trail.                                         */
/* ------------------------------------------------------------------ */
const spread = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000; // 0 – 0.999
};
function stageDurations(claimNo, upto, totalDays) {
  const done = TAT_PIPE.slice(0, upto).map((t) => ({ stage: t.stage, days: t.target * STAGE_BIAS[t.stage] * (0.6 + spread(claimNo + t.stage) * 0.8) }));
  const sum = done.reduce((a, d) => a + d.days, 0);
  const room = Math.max(0, totalDays * 0.9);
  const k = sum > room && sum > 0 ? room / sum : 1;
  return done.map((d) => ({ ...d, days: Math.round(d.days * k * 10) / 10 }));
}
// typical pace per stage against its target (document collection usually runs over)
const STAGE_BIAS = { Registered: 0.9, "Survey pending": 1.12, Assessment: 0.82, "Documents pending": 1.22, Approval: 0.85, "Repair / DO": 0.95, Payment: 0.9 };
const pipeIndex = (stage) => TAT_PIPE.findIndex((t) => t.stage === stage);

/* ------------------------------------------------------------------ */
/* Matching – shared with My Work Queue                                */
/* ------------------------------------------------------------------ */
export const IRDAI_STAGES = Object.fromEntries(IRDAI_STEPS.map((s) => [s.key, s.stages]));

export function matchOpen(r, f) {
  if (!inPeriod(r.regDate, f.reg)) return false;
  if (f.loss && r.lossType !== f.loss) return false;
  if (f.stage && r.stage !== f.stage) return false;
  if (f.with && r.pendingWith !== f.with) return false;
  if (f.sla && r.sla.status !== f.sla) return false;
  if (f.age) {
    const b = AGE_BANDS.find((x) => x.key === f.age);
    if (b && (r.ageDays < b.min || r.ageDays > b.max)) return false;
  }
  if (f.irdai && !(IRDAI_STAGES[f.irdai] || []).includes(r.stage)) return false;
  if (f.due === "all" && !(r.sla.status !== "ok" || r.dueToday)) return false;
  if (f.due === "due" && !(r.sla.status !== "breach" && (r.sla.status === "risk" || r.dueToday))) return false;
  return true;
}
export function matchClosed(r, f) {
  if (!inPeriod(r.regDate, f.reg)) return false;
  if (f.loss && r.lossType !== f.loss) return false;
  if (f.closure && r.closureType !== f.closure) return false;
  return true;
}

// URL keys a dashboard link may carry, with how each reads in the queue's filter chips
export const DRILL_KEYS = ["reg", "loss", "stage", "with", "sla", "age", "irdai", "due", "closure"];
const SLA_TEXT = { breach: "SLA breached", risk: "At risk (≤ 24 h)", ok: "On track" };
const IRDAI_TEXT = Object.fromEntries(IRDAI_STEPS.map((s) => [s.key, `IRDAI: ${s.label.toLowerCase()}`]));
export function drillLabel(key, value) {
  switch (key) {
    case "reg":
      return value === "mtd" ? "Registered this month" : `Registered last ${value} days`;
    case "loss":
      return `Loss: ${value}`;
    case "stage":
      return `Stage: ${value}`;
    case "with":
      return `Pending with: ${value}`;
    case "sla":
      return SLA_TEXT[value] || value;
    case "age":
      return `Age ${AGE_BANDS.find((b) => b.key === value)?.label || value}`;
    case "irdai":
      return IRDAI_TEXT[value] || value;
    case "due":
      return value === "all" ? "Due today and overdue" : "Due today (not overdue)";
    case "closure":
      return `Closed: ${value}`;
    default:
      return value;
  }
}
export const readDrill = (params) => Object.fromEntries(DRILL_KEYS.map((k) => [k, params.get(k) || ""]).filter(([, v]) => v));

// Link into My Work Queue for a figure: the active dashboard filters plus the figure's own rule
export function queueLink(filters, extra = {}, closed = false) {
  const p = new URLSearchParams();
  if (closed) p.set("view", "closed");
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => v && p.set(k, v));
  return `/od/worklist?${p.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */
export function dashboardSummary(filters = {}) {
  const f = { reg: filters.reg || "", loss: filters.loss || "" };
  const open = openQueue().filter((r) => matchOpen(r, f));
  const closed = closedList().filter((r) => matchClosed(r, f));
  const count = (fn) => open.filter(fn).length;

  // completed stage durations: open claims (stages before the current one) + closed claims
  const samples = Object.fromEntries(TAT_PIPE.map((t) => [t.stage, []]));
  open.forEach((r) => {
    const k = pipeIndex(r.stage);
    if (k > 0) stageDurations(r.claimNo, k, r.ageDays).forEach((d) => samples[d.stage].push(d.days));
  });
  closed.forEach((r) => {
    const k = pipeIndex(r.stage);
    if (k < 0) return; // NBNR closed – never entered the pipeline
    const upto = r.closureType === "Paid" ? TAT_PIPE.length : k; // a paid claim completed every stage
    const total = Math.max(1, daysBetween(r.regDate, r.closedOn));
    stageDurations(r.claimNo, upto, total).forEach((d) => samples[d.stage].push(d.days));
  });

  return {
    filters: f,
    kpis: {
      all: open.length + closed.length,
      open: open.length,
      closed: closed.length,
      outstanding: open.reduce((t, r) => t + (r.reserve || 0), 0),
      paid: closed.reduce((t, r) => t + (r.paid || 0), 0),
      breached: count((r) => r.sla.status === "breach"),
      atRisk: count((r) => r.sla.status === "risk"),
    },
    closedByType: CLOSURE_TYPES.map((type) => ({
      type,
      count: closed.filter((r) => r.closureType === type).length,
      paid: closed.filter((r) => r.closureType === type).reduce((t, r) => t + (r.paid || 0), 0),
    })),
    ageing: AGE_BANDS.map((b) => ({
      ...b,
      count: count((r) => r.ageDays >= b.min && r.ageDays <= b.max),
      breached: count((r) => r.ageDays >= b.min && r.ageDays <= b.max && r.sla.status === "breach"),
    })),
    pendingWith: Object.entries(
      open.reduce((m, r) => {
        m[r.pendingWith] = (m[r.pendingWith] || 0) + 1;
        return m;
      }, {})
    )
      .map(([party, n]) => ({ party, count: n }))
      .sort((a, b) => b.count - a.count || a.party.localeCompare(b.party)),
    irdai: IRDAI_STEPS.map((st) => {
      const rows = open.filter((r) => st.stages.includes(r.stage));
      return { ...st, total: rows.length, due: rows.filter((r) => r.sla.status === "risk").length, late: rows.filter((r) => r.sla.status === "breach").length };
    }),
    nbnr: count((r) => r.stage === "NBNR"),
    nbnrBreached: count((r) => r.stage === "NBNR" && r.sla.status === "breach"),
    stageTat: TAT_PIPE.map((t) => {
      const s = samples[t.stage];
      const avg = s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
      return {
        ...t,
        avg,
        samples: s.length,
        open: count((r) => r.stage === t.stage),
        breached: count((r) => r.stage === t.stage && r.sla.status === "breach"),
      };
    }),
  };
}

// Loss types present in the data, for the filter
export function lossTypes() {
  return [...new Set([...openQueue(), ...closedList()].map((r) => r.lossType))].sort();
}