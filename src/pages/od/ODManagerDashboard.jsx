// src/pages/od/ODManagerDashboard.jsx
// OD Claims Manager – Team Dashboard (persona: Priya Raghavan · OD0150 · Chennai)
// Route: /od/dashboard → ODHome picks this page for role CLAIMS_MANAGER.
// Same design as the Claims Handler dashboard (single self-contained file): KPI row, three chart cards
// with view + chart-type dropdowns, then stage-wise TAT and the watch list.
//
//   KPI row       – team open, SLA breached, at risk, waiting for my approval, SLA met, avg TAT
//   Team SLA      – SLA status (open) · SLA met by handler · Avg TAT by handler
//   Team workload – Open vs capacity · Breached & at risk · Due today · Closed (30 days)
//   Approvals     – waiting for my approval: oldest first · over SLA · above my limit · highest amount
//   Stage-wise TAT vs target (team) – Column / Bar / Line / Variance + table
//   Watch list    – all · high value · red flags · late intimation
// Data: src/data/odTeamMock.js (Karthik's figures come from his real queue).

import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Users,
  CalendarCheck,
  ArrowDownWideNarrow,
  ArrowUpRight,
  ListFilter,
  Hourglass,
  LayoutList,
  BarChart3,
  BarChartHorizontal,
  PieChart as PieChartIcon,
  Donut,
  LineChart as LineChartIcon,
  ArrowLeftRight,
  Check,
  ChevronDown,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { useAuth } from "../../auth";
import { TEAM, TEAM_KPIS, APPROVALS, WATCHLIST, TEAM_TAT, MANAGER_AUTHORITY, APPROVAL_SLA_HOURS, HANDLER_CAPACITY } from "../../data/odTeamMock";

/* ================================================================== */
/* Chart building blocks (same as the Claims Handler dashboard)        */
/* Card, ViewSelect, BarList, Columns, PieChart, StageTatChart, …      */
/* Kept inside this file so the page is a single drop-in file.         */
/* ================================================================== */

const pct = (n, total) => Math.round((n / total) * 100);
const fmtDays = (d) => `${Number(d).toFixed(1)} d`;

function readView(key, views) {
  try {
    const v = localStorage.getItem(key);
    return views.some((x) => x.key === v) ? v : views[0].key;
  } catch {
    return views[0].key;
  }
}
function saveView(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

// Chart types the user can pick. Only types that suit the data are offered:
// trends (by month) → Bar / Line;  shares of a whole → Bar / Pie / Donut.
const CHART_LABEL = { summary: "Summary", bar: "Bar", hbar: "Horizontal bar", pie: "Pie", donut: "Donut", line: "Line" };
const readChart = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const CHART_ICON = { summary: LayoutList, bar: BarChart3, hbar: BarChartHorizontal, pie: PieChartIcon, donut: Donut, line: LineChartIcon };
const chartOptions = (types) => types.map((t) => ({ key: t, label: CHART_LABEL[t], icon: CHART_ICON[t] }));

// Slice colours. Status = reserved SLA colours; ageing = one-hue ramp (ordered);
// stage / loss type = fixed categorical order (colour follows the category).
const STATUS_HEX = { ok: "#059669", risk: "#f59e0b", breach: "#dc2626" };
const CAT_HEX = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];


// Short x-axis names for the stage chart
const STAGE_SHORT = {
  "Registration → Surveyor appointed": ["Surveyor", "appointed"],
  "Surveyor appointed → Survey done": ["Survey", "done"],
  "Survey → Assessment report": ["Assessment", "report"],
  "Document collection": ["Document", "collection"],
  Approval: ["Approval", ""],
  "Final invoice → Delivery order": ["Delivery", "order"],
  "Delivery order → Payment": ["Payment", ""],
};

// Chart types for the Stage-wise TAT card (all compare actual vs target per stage)
const STAGE_CHARTS = [
  { key: "column", label: "Column", icon: BarChart3, hint: "Avg TAT per stage with target line" },
  { key: "bar", label: "Bar", icon: BarChartHorizontal, hint: "Same, as horizontal bars" },
  { key: "line", label: "Line", icon: LineChartIcon, hint: "Avg TAT vs target across stages" },
  { key: "variance", label: "Variance", icon: ArrowLeftRight, hint: "Days over or under each target" },
];

const overBy = (s) => +(s.actual - s.target).toFixed(1);

// Status colours are reserved for SLA state and always come with an icon + label
const STATUS = {
  ok: { bar: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  risk: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-900", Icon: Clock },
  breach: { bar: "bg-red-600", chip: "bg-red-50 text-red-800", Icon: AlertTriangle },
};

/** Dropdown used in a card header to switch the card's view / chart type.
 *  Styled menu: icon + label (+ one-line hint), ✓ on the current choice, ↑ ↓ Enter Esc. */
function ViewSelect({ value, onChange, views, label }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef(null);
  const listId = useId();
  const cur = views.find((v) => v.key === value) || views[0];
  const CurIcon = cur.icon;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    setHi(Math.max(0, views.findIndex((v) => v.key === value)));
    setOpen(true);
  }
  function pick(v) {
    onChange(v.key);
    setOpen(false);
  }
  function onKey(e) {
    if (!open && ["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    } else if (open && e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, views.length - 1));
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      pick(views[hi]);
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${cur.label}`}
        className={`flex h-7 max-w-[190px] items-center gap-1.5 rounded-md border pl-2 pr-1.5 text-[12px] font-semibold transition ${
          open ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white"
        } focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/15`}
      >
        {CurIcon && <CurIcon className={`h-3.5 w-3.5 flex-none ${open ? "text-teal-700" : "text-slate-500"}`} aria-hidden="true" />}
        <span className="truncate">{cur.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-none text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1.5 w-max min-w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          <li className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400" role="presentation">
            {label}
          </li>
          {views.map((v, i) => {
            const sel = v.key === cur.key;
            const Icon = v.icon;
            return (
              <li
                key={v.key}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(v);
                }}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 ${hi === i ? "bg-slate-100" : ""}`}
              >
                <span className={`mt-px grid h-6 w-6 flex-none place-items-center rounded-md ${sel ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12.5px] leading-tight ${sel ? "font-semibold text-teal-900" : "font-medium text-slate-800"}`}>{v.label}</span>
                  {v.hint && <span className="block text-[11px] leading-snug text-slate-500">{v.hint}</span>}
                </span>
                <Check className={`mt-1 h-3.5 w-3.5 flex-none ${sel ? "text-teal-700" : "text-transparent"}`} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */
/** Shared legend for the stage charts */
function StageLegend({ type }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
      {type === "variance" ? (
        <>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" />Under target (days spare)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Over target (days late)</span>
        </>
      ) : type === "line" ? (
        <>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded bg-teal-600" aria-hidden="true" />Avg TAT</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />Over target</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-slate-800" aria-hidden="true" />Target</span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" />Avg TAT – on track</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Avg TAT – over target</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-slate-800" aria-hidden="true" />Target</span>
        </>
      )}
      <span className="ml-auto text-slate-400">days</span>
    </div>
  );
}

/** Tooltip text for a stage */
function StageTip({ s }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
      <p className="font-semibold">{s.stage}</p>
      <p className="tabular-nums text-slate-300">
        Avg {s.actual} d · target {s.target} d ·{" "}
        {s.actual > s.target ? <span className="text-red-300">over by {overBy(s)} d</span> : <span className="text-emerald-300">on track</span>}
        {s.breachedOpen > 0 && ` · ${s.breachedOpen} breached now`}
      </p>
    </div>
  );
}

/** Stage-wise TAT chart – picks the chart type */
function StageTatChart({ items, type }) {
  return (
    <div className="flex flex-col gap-1.5 px-3 pb-2 pt-2">
      <StageLegend type={type} />
      {type === "bar" ? <StageBars items={items} /> : type === "line" ? <StageLine items={items} /> : type === "variance" ? <StageVariance items={items} /> : <StageColumns items={items} />}
    </div>
  );
}

/** Horizontal bars: bar = average TAT, dashed tick = target */
function StageBars({ items }) {
  const [hover, setHover] = useState(null);
  const top = Math.ceil(Math.max(...items.map((s) => Math.max(s.actual, s.target))) / 2) * 2;
  const h = items.find((s) => s.stage === hover);
  return (
    <div className="relative mt-1" onMouseLeave={() => setHover(null)}>
      {h && <StageTip s={h} />}
      <ul className="flex flex-col gap-1 pt-1">
        {items.map((s) => {
          const over = s.actual > s.target;
          const on = hover === s.stage;
          return (
            <li
              key={s.stage}
              tabIndex={0}
              onMouseEnter={() => setHover(s.stage)}
              onFocus={() => setHover(s.stage)}
              aria-label={`${s.stage}: average ${s.actual} days, target ${s.target} days`}
              className={`grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_44px] items-center gap-2 rounded px-1 py-px text-[11.5px] ${on ? "bg-slate-100" : ""}`}
            >
              <span className="truncate text-slate-700" title={s.stage}>
                {(STAGE_SHORT[s.stage] || [s.stage]).join(" ")}
              </span>
              <span className="relative h-3 rounded-r bg-slate-100">
                <span className={`absolute inset-y-0 left-0 rounded-r ${over ? "bg-red-600" : "bg-teal-600"}`} style={{ width: `${(s.actual / top) * 100}%` }} />
                <span className="absolute -inset-y-1 border-l-2 border-dashed border-slate-800" style={{ left: `${(s.target / top) * 100}%` }} aria-hidden="true" />
              </span>
              <span className={`flex items-center justify-end gap-0.5 font-semibold tabular-nums ${over ? "text-red-700" : "text-slate-700"}`}>
                {over && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                {s.actual}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_44px] gap-2 px-1 text-[10px] text-slate-400" aria-hidden="true">
        <span />
        <span className="flex justify-between tabular-nums">
          {Array.from({ length: top / 2 + 1 }, (_, i) => (
            <span key={i}>{i * 2}</span>
          ))}
        </span>
        <span />
      </div>
    </div>
  );
}

/** Line: Avg TAT across stages vs the target line; dots turn red when over */
function StageLine({ items }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 168, L = 28, R = 12, T = 18, B = 34;
  const top = Math.ceil(Math.max(...items.map((s) => Math.max(s.actual, s.target))) / 2) * 2 + 2;
  const x = (i) => L + ((W - L - R) * (i + 0.5)) / items.length;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: top / 2 + 1 }, (_, i) => i * 2);
  const path = (k) => items.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s[k])}`).join(" ");
  const h = items.find((s) => s.stage === hover);
  return (
    <div className="relative mt-1" onMouseLeave={() => setHover(null)}>
      {h && <StageTip s={h} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Average TAT by stage compared with target">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#cbd5e1" : "#f1f5f9"} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{t}</text>
          </g>
        ))}
        <path d={path("target")} fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="5 4" />
        <path d={path("actual")} fill="none" stroke="#0d9488" strokeWidth="2" />
        {items.map((s, i) => {
          const over = s.actual > s.target;
          const [l1, l2] = STAGE_SHORT[s.stage] || [s.stage, ""];
          return (
            <g key={s.stage} onMouseEnter={() => setHover(s.stage)}>
              {hover === s.stage && <rect x={x(i) - 30} y={T - 6} width="60" height={H - T - B + 6} rx="4" fill="#f1f5f9" opacity="0.8" />}
              <circle cx={x(i)} cy={y(s.actual)} r="5" fill={over ? "#dc2626" : "#0d9488"} stroke="#fff" strokeWidth="2" />
              <text x={x(i)} y={y(Math.max(s.actual, s.target)) - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill={over ? "#b91c1c" : "#334155"}>
                {s.actual}
              </text>
              <text x={x(i)} y={H - B + 14} textAnchor="middle" fontSize="10.5" fill="#64748b">{l1}</text>
              <text x={x(i)} y={H - B + 27} textAnchor="middle" fontSize="10.5" fill="#64748b">{l2}</text>
              <rect x={x(i) - 40} y="0" width="80" height={H} fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Variance: days over (right, red) or under (left, teal) each stage's target */
function StageVariance({ items }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...items.map((s) => Math.abs(overBy(s))));
  const h = items.find((s) => s.stage === hover);
  return (
    <div className="relative mt-1" onMouseLeave={() => setHover(null)}>
      {h && <StageTip s={h} />}
      <ul className="flex flex-col gap-1 pt-1">
        {items.map((s) => {
          const d = overBy(s);
          const on = hover === s.stage;
          const pct = (Math.abs(d) / max) * 50;
          return (
            <li
              key={s.stage}
              tabIndex={0}
              onMouseEnter={() => setHover(s.stage)}
              onFocus={() => setHover(s.stage)}
              aria-label={`${s.stage}: ${d > 0 ? `${d} days over target` : `${Math.abs(d)} days under target`}`}
              className={`grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_58px] items-center gap-2 rounded px-1 py-px text-[11.5px] ${on ? "bg-slate-100" : ""}`}
            >
              <span className="truncate text-slate-700" title={s.stage}>
                {(STAGE_SHORT[s.stage] || [s.stage]).join(" ")}
              </span>
              <span className="relative h-3">
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-400" aria-hidden="true" />
                <span
                  className={`absolute inset-y-0 ${d > 0 ? "left-1/2 rounded-r bg-red-600" : "right-1/2 rounded-l bg-teal-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className={`flex items-center justify-end gap-0.5 font-semibold tabular-nums ${d > 0 ? "text-red-700" : "text-teal-800"}`}>
                {d > 0 && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                {d > 0 ? `+${d}` : d} d
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_58px] gap-2 px-1 text-[10px] text-slate-400" aria-hidden="true">
        <span />
        <span className="flex justify-between">
          <span>← spare</span>
          <span>target</span>
          <span>late →</span>
        </span>
        <span />
      </div>
    </div>
  );
}

/** Column per stage: height = average TAT, dashed line = target. Over target → red + ⚠ label. */
function StageColumns({ items }) {
  const [hover, setHover] = useState(null);
  const top = Math.ceil(Math.max(...items.map((s) => Math.max(s.actual, s.target))) / 2) * 2 + 2; // round up to even, + headroom
  const ticks = Array.from({ length: top / 2 + 1 }, (_, i) => i * 2);
  const H = 140; // plot height px
  const y = (v) => (v / top) * H;
  const h = items.find((s) => s.stage === hover);
  return (
    <div>
      <div className="relative mt-2 flex" style={{ height: H + 34 }} onMouseLeave={() => setHover(null)}>
        {/* y axis */}
        <div className="relative w-6 flex-none" style={{ height: H }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-1 translate-y-1/2 text-[10px] leading-none tabular-nums text-slate-400" style={{ bottom: y(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* grid */}
          {ticks.map((t) => (
            <span key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-slate-300" : "border-slate-100"}`} style={{ bottom: 34 + y(t) }} aria-hidden="true" />
          ))}
          <ul className="absolute inset-0 flex">
            {items.map((s) => {
              const over = s.actual > s.target;
              const [l1, l2] = STAGE_SHORT[s.stage] || [s.stage, ""];
              const on = hover === s.stage;
              return (
                <li
                  key={s.stage}
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
                  onMouseEnter={() => setHover(s.stage)}
                  onFocus={() => setHover(s.stage)}
                  tabIndex={0}
                  aria-label={`${s.stage}: average ${s.actual} days, target ${s.target} days${over ? `, over by ${(s.actual - s.target).toFixed(1)} days` : ", on track"}`}
                >
                  {on && <span className="absolute inset-x-1 bottom-[34px] top-0 rounded bg-slate-100/70" aria-hidden="true" />}
                  {/* value label – above the bar or the target line, whichever is higher */}
                  <span
                    className={`absolute z-20 flex items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold tabular-nums ${over ? "text-red-700" : "text-slate-700"}`}
                    style={{ bottom: 34 + y(Math.max(s.actual, s.target)) + 4 }}
                  >
                    {over && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                    {s.actual}
                  </span>
                  {/* bar */}
                  <span
                    className={`relative z-10 w-[clamp(14px,40%,30px)] rounded-t ${over ? "bg-red-600" : "bg-teal-600"} ${hover && !on ? "opacity-50" : ""}`}
                    style={{ height: y(s.actual) }}
                  />
                  {/* target line */}
                  <span
                    className="absolute z-20 w-[clamp(26px,70%,52px)] border-t-2 border-dashed border-slate-800"
                    style={{ bottom: 34 + y(s.target) - 1 }}
                    aria-hidden="true"
                  />
                  {/* x label */}
                  <span className="flex h-[34px] w-full flex-col items-center justify-start pt-1 text-center text-[10.5px] leading-tight text-slate-500">
                    <span className="max-w-full truncate">{l1}</span>
                    <span className="max-w-full truncate">{l2}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {h && <StageTip s={h} />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, note, action, children, className = "" }) {
  return (
    <section className={`flex flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex min-h-9 flex-none flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-0.5">
        <h2 className="truncate text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
        {action}
        {!action && note && (
          <span className="flex-none truncate text-xs text-slate-500" aria-live="polite">
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function StatusChip({ kind, children }) {
  const s = STATUS[kind];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0 text-[10.5px] font-semibold leading-[18px] ${s.chip}`}>
      <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Horizontal bar list – one hue. stacked = label above bar (narrow cards). */
function BarList({ items, labelKey, total, hover, setHover, stacked = false }) {
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className={`flex flex-col px-3 py-1.5 ${stacked ? "gap-1" : "gap-0.5"}`}>
      {items.map((it) => {
        const active = hover?.[labelKey] === it[labelKey];
        const bar = (
          <span className={`block rounded-r bg-slate-100 ${stacked ? "mt-1 h-1.5" : "h-2 flex-1"}`}>
            <span
              className={`block rounded-r ${stacked ? "h-1.5" : "h-2"} ${active ? "bg-teal-800" : "bg-teal-600"}`}
              style={{ width: `${(it.count / max) * 100}%` }}
            />
          </span>
        );
        const nums = (
          <>
            <span className="w-8 flex-none text-right font-semibold tabular-nums text-slate-800">{it.count}</span>
            <span className="w-9 flex-none text-right text-xs tabular-nums text-slate-500">{pct(it.count, total)}%</span>
          </>
        );
        return (
          <li
            key={it[labelKey]}
            onMouseEnter={() => setHover(it)}
            onMouseLeave={() => setHover(null)}
            className="rounded px-1 py-px text-[12px] leading-tight hover:bg-slate-50"
          >
            {stacked ? (
              <>
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-slate-600">{it[labelKey]}</span>
                  {nums}
                </span>
                {bar}
              </>
            ) : (
              <span className="flex items-center gap-3">
                <span className="w-32 flex-none truncate text-slate-600 sm:w-40" title={it[labelKey]}>{it[labelKey]}</span>
                {bar}
                {nums}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical columns with an optional dashed target line.
 *  With a target, values sit inside the bars so the line never covers them. */
// mtdLegend = false hides the "Current month to date" key (for charts that are not month trends)
function Columns({ items, labelKey, valueKey = "count", hover, setHover, colorFor, inkFor, height = 110, target, format = (v) => v, targetLabel, mtdLegend = true, legendExtra }) {
  const max = Math.max(...items.map((i) => i[valueKey]), target ?? 0) * 1.08;
  const inside = target != null;
  return (
    <div className="px-3 pb-1.5 pt-1.5">
      <div className="relative flex items-end gap-3" style={{ height: inside ? height : height + 20 }}>
        {inside && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-slate-700"
            style={{ bottom: (target / max) * height }}
            aria-hidden="true"
          />
        )}
        {items.map((it, i) => {
          const active = hover?.[labelKey] === it[labelKey];
          const h = (it[valueKey] / max) * height;
          return (
            <div
              key={it[labelKey]}
              onMouseEnter={() => setHover(it)}
              onMouseLeave={() => setHover(null)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              {!inside && <span className="text-xs font-semibold tabular-nums text-slate-700">{format(it[valueKey])}</span>}
              <span
                className={`flex w-full max-w-[48px] items-end justify-center rounded-t pb-1 ${active ? "bg-[#0B1F3A]" : colorFor(it, i)}`}
                style={{ height: h }}
              >
                {inside && (
                  <span className={`text-[11.5px] font-semibold tabular-nums ${active ? "text-white" : inkFor ? inkFor(it, i) : "text-white"}`}>
                    {format(it[valueKey])}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-3">
        {items.map((it) => (
          <span key={it[labelKey]} className="flex-1 text-center text-[11px] leading-tight text-slate-500">
            {it[labelKey]}
          </span>
        ))}
      </div>
      {inside && (
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-slate-700" aria-hidden="true" />
            {targetLabel ?? `Target ${format(target)}`}
          </span>
          {mtdLegend && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-300" aria-hidden="true" />
              Current month to date
            </span>
          )}
          {legendExtra}
        </p>
      )}
    </div>
  );
}

/** Pie / donut with a legend that carries every label, value and share. */
// centerLabel = word under the total in the donut hole ("open" by default)
function PieChart({ items, labelKey, colorFor, donut, hover, setHover, total, centerLabel = "open" }) {
  const size = 124;
  const c = size / 2;
  const r1 = c - 2;
  const r0 = donut ? r1 * 0.58 : 0;
  const pt = (r, a) => [c + r * Math.cos(a), c + r * Math.sin(a)];
  // start angle of each slice = sum of the slices before it (no mutable variable)
  const starts = items.map((_, i) => -Math.PI / 2 + (items.slice(0, i).reduce((acc, x) => acc + x.count, 0) / total) * Math.PI * 2);
  const slices = items.map((it, i) => {
    const a0 = starts[i];
    const a1 = a0 + (it.count / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(r1, a0);
    const [x1, y1] = pt(r1, a1);
    let d;
    if (r0 > 0) {
      const [ix1, iy1] = pt(r0, a1);
      const [ix0, iy0] = pt(r0, a0);
      d = `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${ix1},${iy1} A${r0},${r0} 0 ${large} 0 ${ix0},${iy0} Z`;
    } else {
      d = `M${c},${c} L${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} Z`;
    }
    return { it, d, color: colorFor(it, i) };
  });
  const active = hover ? items.find((x) => x[labelKey] === hover[labelKey]) : null;

  return (
    <div className="flex flex-wrap items-center gap-4 px-3 py-2">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={items.map((x) => `${x[labelKey]} ${x.count}`).join(", ")}
        >
          {slices.map(({ it, d, color }) => (
            <path
              key={it[labelKey]}
              d={d}
              fill={color}
              stroke="#fff"
              strokeWidth="2"
              opacity={active && active[labelKey] !== it[labelKey] ? 0.35 : 1}
              onMouseEnter={() => setHover(it)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {donut && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <span>
              <span className="block text-lg font-semibold leading-none tabular-nums text-slate-900">
                {active ? active.count : total}
              </span>
              <span className="block text-[10px] text-slate-500">{active ? `${pct(active.count, total)}%` : centerLabel}</span>
            </span>
          </div>
        )}
      </div>
      <ul className="flex min-w-[180px] flex-1 flex-col gap-0.5">
        {slices.map(({ it, color }) => (
          <li
            key={it[labelKey]}
            onMouseEnter={() => setHover(it)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded px-1 py-px text-[12px] leading-tight ${
              active && active[labelKey] === it[labelKey] ? "bg-slate-100" : "hover:bg-slate-50"
            }`}
          >
            <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-slate-600" title={it[labelKey]}>
              {it[labelKey]}
            </span>
            <span className="font-semibold tabular-nums text-slate-800">{it.count}</span>
            <span className="w-8 text-right text-[11px] tabular-nums text-slate-500">{pct(it.count, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


/* ================================================================== */
/* Team Dashboard                                                      */
/* ================================================================== */

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
const first = (name) => name.split(" ")[0];
const waitLabel = (h) => (h >= 24 ? `${Math.floor(h / 24)} d ${h % 24 ? `${h % 24} h` : ""}`.trim() : `${h} h`);
const approvalSlug = (no) => no.replaceAll("/", "-");

/* ---------------- card views (choice remembered per browser) ---------------- */
const SLA_VIEWS = [
  { key: "status", label: "SLA status (open)", icon: Gauge, hint: "Team open claims: on track · at risk · breached" },
  { key: "met", label: "SLA met by handler", icon: CheckCircle2, hint: "Claims closed within SLA, last 30 days" },
  { key: "tat", label: "Avg TAT by handler", icon: Timer, hint: "Average days to settle, last 30 days" },
];
// "bar" = vertical columns (same as the handler dashboard) · "hbar" = horizontal bars
// Pie / donut only where the numbers are shares of a whole (not for % or days per handler)
const SLA_CHARTS = { status: ["summary", "bar", "pie", "donut"], met: ["bar", "hbar"], tat: ["bar", "hbar"] };

const WORK_VIEWS = [
  { key: "capacity", label: "Open vs capacity", icon: Users, hint: `Open claims per handler · capacity ${HANDLER_CAPACITY}` },
  { key: "risk", label: "Breached & at risk", icon: AlertTriangle, hint: "Who needs help with SLA right now" },
  { key: "due", label: "Due today", icon: CalendarClock, hint: "Claims due today, by handler" },
  { key: "closed", label: "Closed (30 days)", icon: CalendarCheck, hint: "Claims closed in the last 30 days" },
];
const WORK_CHARTS = { capacity: ["hbar", "bar", "pie", "donut"], risk: ["hbar", "pie", "donut"], due: ["hbar", "bar", "pie", "donut"], closed: ["hbar", "bar", "pie", "donut"] };

const APPROVAL_VIEWS = [
  { key: "oldest", label: "Oldest first", icon: Hourglass, hint: "Longest waiting at the top" },
  { key: "sla", label: "Over SLA", icon: AlertTriangle, hint: `Waiting more than ${APPROVAL_SLA_HOURS / 24} days` },
  { key: "above", label: "Above my limit", icon: ArrowUpRight, hint: `Above ${lakh(MANAGER_AUTHORITY)} – refer to Zonal Head` },
  { key: "amount", label: "Highest amount", icon: ArrowDownWideNarrow, hint: "Largest recommended amount first" },
];

const WATCH_VIEWS = [
  { key: "all", label: "All", icon: ListFilter, hint: "High value and red-flag claims" },
  { key: "value", label: "High value", icon: IndianRupee, hint: "Total loss / reserve above ₹5 L" },
  { key: "fraud", label: "Red flags", icon: ShieldAlert, hint: "Fraud indicators, SIU, repeat claims" },
  { key: "late", label: "Late intimation", icon: Clock, hint: "Reported well after the loss" },
];

const KEY = {
  sla: "smartclaims-odm-sla-view",
  slaChart: "smartclaims-odm-sla-chart",
  work: "smartclaims-odm-work-view",
  workChart: "smartclaims-odm-work-chart",
  appr: "smartclaims-odm-approval-view",
  watch: "smartclaims-odm-watch-view",
  stage: "smartclaims-odm-stage-chart",
};

// Team TAT in the shape the shared stage chart expects
const STAGES = TEAM_TAT.map((s) => ({ stage: s.stage, target: s.target, actual: s.actual, breachedOpen: s.breached }));

/* ---------------- manager-only charts ---------------- */
// One row per handler: label · bar · numbers. Hover sets the readout line in the card.
function HandlerRow({ h, on, setHover, children, right }) {
  return (
    <li
      tabIndex={0}
      onMouseEnter={() => setHover(h)}
      onMouseLeave={() => setHover(null)}
      onFocus={() => setHover(h)}
      onBlur={() => setHover(null)}
      className={`grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-px text-[12px] leading-tight ${on ? "bg-slate-100" : "hover:bg-slate-50"}`}
    >
      <span className="flex min-w-0 items-center gap-1 text-slate-700" title={`${h.name} · ${h.userId}`}>
        <span className="truncate">{first(h.name)}</span>
        {h.status === "leave" && <Plane className="h-3 w-3 flex-none text-slate-400" aria-label="On leave" />}
      </span>
      {children}
      {right}
    </li>
  );
}

function CapacityBars({ hover, setHover, onReallocate }) {
  const max = Math.max(...TEAM.map((h) => h.open), HANDLER_CAPACITY) * 1.08;
  return (
    <div className="px-3 py-1.5">
      <ul className="flex flex-col gap-1">
        {TEAM.map((h) => {
          const load = h.open / HANDLER_CAPACITY;
          const tone = load > 1 ? "bg-red-600" : load > 0.85 ? "bg-amber-500" : "bg-teal-600";
          return (
            <HandlerRow
              key={h.userId}
              h={h}
              on={hover?.userId === h.userId}
              setHover={setHover}
              right={
                <span className="flex w-[78px] items-center justify-end gap-1 tabular-nums">
                  {h.status === "leave" && h.dueToday ? (
                    <button
                      type="button"
                      onClick={onReallocate}
                      title={`${h.leaveNote} · ${h.dueToday} due today – reallocate`}
                      className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 text-[10.5px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                    >
                      <Shuffle className="h-3 w-3" aria-hidden="true" />
                      {h.dueToday}
                    </button>
                  ) : null}
                  <span className={load > 1 ? "font-semibold text-red-700" : "font-semibold text-slate-800"}>{h.open}</span>
                  <span className="text-[11px] text-slate-400">/{HANDLER_CAPACITY}</span>
                </span>
              }
            >
              <span className="relative h-2.5 rounded-r bg-slate-100">
                <span className={`absolute inset-y-0 left-0 rounded-r ${tone} ${h.status === "leave" ? "opacity-50" : ""}`} style={{ width: `${(h.open / max) * 100}%` }} />
                <span className="absolute -inset-y-1 border-l-2 border-dashed border-slate-800" style={{ left: `${(HANDLER_CAPACITY / max) * 100}%` }} aria-hidden="true" />
              </span>
            </HandlerRow>
          );
        })}
      </ul>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-slate-800" aria-hidden="true" />Capacity {HANDLER_CAPACITY}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Over capacity</span>
        <span className="flex items-center gap-1.5"><Plane className="h-3 w-3 text-slate-400" aria-hidden="true" />On leave</span>
      </p>
    </div>
  );
}

function RiskBars({ hover, setHover }) {
  const max = Math.max(...TEAM.map((h) => h.breached + h.atRisk)) * 1.08;
  return (
    <div className="px-3 py-1.5">
      <ul className="flex flex-col gap-1">
        {TEAM.map((h) => (
          <HandlerRow
            key={h.userId}
            h={h}
            on={hover?.userId === h.userId}
            setHover={setHover}
            right={
              <span className="w-[78px] text-right tabular-nums">
                <span className="font-semibold text-red-700">{h.breached}</span>
                <span className="text-slate-300"> · </span>
                <span className="font-semibold text-amber-800">{h.atRisk}</span>
              </span>
            }
          >
            <span className="flex h-2.5 gap-px overflow-hidden rounded-r bg-slate-100">
              <span className={STATUS.breach.bar} style={{ width: `${(h.breached / max) * 100}%` }} />
              <span className={STATUS.risk.bar} style={{ width: `${(h.atRisk / max) * 100}%` }} />
            </span>
          </HandlerRow>
        ))}
      </ul>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Breached</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" />At risk (due ≤ 24 h)</span>
      </p>
    </div>
  );
}

// Horizontal bars per handler with a dashed target line (SLA met %, average TAT)
function TargetBars({ hover, setHover, valueOf, target, bad, format, targetLabel, badLabel }) {
  const max = Math.max(...TEAM.map(valueOf), target) * 1.08;
  return (
    <div className="px-3 py-1.5">
      <ul className="flex flex-col gap-1">
        {TEAM.map((h) => {
          const v = valueOf(h);
          return (
            <HandlerRow
              key={h.userId}
              h={h}
              on={hover?.userId === h.userId}
              setHover={setHover}
              right={<span className={`w-[52px] text-right font-semibold tabular-nums ${bad(v) ? "text-red-700" : "text-slate-800"}`}>{format(v)}</span>}
            >
              <span className="relative h-2.5 rounded-r bg-slate-100">
                <span className={`absolute inset-y-0 left-0 rounded-r ${bad(v) ? "bg-red-600" : "bg-teal-700"}`} style={{ width: `${(v / max) * 100}%` }} />
                <span className="absolute -inset-y-1 border-l-2 border-dashed border-slate-800" style={{ left: `${(target / max) * 100}%` }} aria-hidden="true" />
              </span>
            </HandlerRow>
          );
        })}
      </ul>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-slate-800" aria-hidden="true" />{targetLabel}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />{badLabel}</span>
      </p>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function ODManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = first(user?.name || "");
  const [toast, setToast] = useState("");

  const [slaView, setSlaView] = useState(() => readView(KEY.sla, SLA_VIEWS));
  const [slaChartPick, setSlaChartPick] = useState(() => readChart(KEY.slaChart));
  const [workView, setWorkView] = useState(() => readView(KEY.work, WORK_VIEWS));
  const [workChartPick, setWorkChartPick] = useState(() => readChart(KEY.workChart));
  const [apprView, setApprView] = useState(() => readView(KEY.appr, APPROVAL_VIEWS));
  const [watchView, setWatchView] = useState(() => readView(KEY.watch, WATCH_VIEWS));
  const [stageChart, setStageChart] = useState(() => readView(KEY.stage, STAGE_CHARTS));
  const [hSla, setHSla] = useState(null);
  const [hWork, setHWork] = useState(null);

  const slaChart = SLA_CHARTS[slaView].includes(slaChartPick) ? slaChartPick : SLA_CHARTS[slaView][0];
  const workChart = WORK_CHARTS[workView].includes(workChartPick) ? workChartPick : WORK_CHARTS[workView][0];
  const pick = (setter, key, reset) => (v) => {
    setter(v);
    saveView(key, v);
    reset?.(null);
  };

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
    { label: "SLA met (30 days)", value: `${K.slaMet}%`, sub: `Target ${K.slaTarget}%`, icon: Gauge, tone: slaOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700", ok: slaOk },
    { label: "Avg TAT (30 days)", value: fmtDays(K.avgTat), sub: `Target ${K.tatTarget} d`, icon: Timer, tone: tatOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700", ok: tatOk },
    { label: "SLA breached", value: K.breached, sub: "Open claims", icon: AlertTriangle, tone: "bg-red-50 text-red-700", go: "Team Work Queue" },
    { label: "At risk", value: K.atRisk, sub: "Due ≤ 24 h", icon: Clock, tone: "bg-amber-50 text-amber-800", go: "Team Work Queue" },
    { label: "Waiting for my approval", value: K.approvals, sub: `${lakh(K.approvalsValue)} · ${K.approvalsOverSla} over SLA`, icon: ClipboardCheck, tone: "bg-teal-50 text-teal-800", go: "Approvals" },
  ];

  /* data for the cards */
  const slaSummary = [
    { key: "ok", label: "On track", count: K.open - K.breached - K.atRisk },
    { key: "risk", label: "At risk (due ≤ 24 h)", count: K.atRisk },
    { key: "breach", label: "Breached", count: K.breached },
  ];
  const byHandler = (k) => TEAM.map((h) => ({ ...h, label: first(h.name), value: h[k], count: h[k] }));
  const onLeave = TEAM.filter((h) => h.status === "leave");
  // workload numbers per handler for the chosen view (risk = breached + at risk, i.e. needing attention)
  const WORK_FIELD = { capacity: "open", due: "dueToday", closed: "closed30" };
  const workItems = TEAM.map((h) => {
    const v = workView === "risk" ? h.breached + h.atRisk : h[WORK_FIELD[workView]];
    return { ...h, label: first(h.name), count: v, value: v };
  });
  const workTotal = workItems.reduce((t, h) => t + h.count, 0);

  const approvals = (() => {
    const list = [...APPROVALS];
    if (apprView === "sla") return list.filter((a) => a.waitingHours > APPROVAL_SLA_HOURS);
    if (apprView === "above") return list.filter((a) => a.amount > MANAGER_AUTHORITY);
    if (apprView === "amount") return list.sort((a, b) => b.amount - a.amount);
    return list; // already oldest first
  })();
  const watch = watchView === "all" ? WATCHLIST : WATCHLIST.filter((w) => w.kind === watchView);

  const handlerReadout = (h) =>
    `${h.name}${h.status === "leave" ? " (on leave)" : ""}: ${h.open} open · ${h.breached} breached · ${h.atRisk} at risk · ${h.dueToday} due today · SLA ${h.slaMet}% · TAT ${h.avgTat} d`;

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
                {...(k.go ? { type: "button", onClick: () => (k.go === "Approvals" ? navigate("/od/approvals") : notBuilt(k.go)), title: `Open ${k.go}` } : {})}
                className={`flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-left ${k.go ? "transition hover:border-teal-600" : ""}`}
              >
                <span className={`grid h-6 w-6 flex-none place-items-center rounded ${k.tone}`}>
                  <k.icon className="h-3.5 w-3.5" aria-hidden="true" />
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

        {/* ---------------- Row 2: Team SLA · Team workload · Approvals ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2 lg:grid-cols-3">
          {/* Team SLA */}
          <Card
            title="Team SLA"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <ViewSelect value={slaView} onChange={pick(setSlaView, KEY.sla, setHSla)} views={SLA_VIEWS} label="Choose SLA view" />
                <ViewSelect value={slaChart} onChange={pick(setSlaChartPick, KEY.slaChart)} views={chartOptions(SLA_CHARTS[slaView])} label="Chart type" />
              </div>
            }
          >
            <p className="truncate px-3 pt-1 text-[11px] text-slate-500" aria-live="polite">
              {slaView === "status" && (hSla?.key ? `${hSla.label}: ${hSla.count} claims (${pct(hSla.count, K.open)}%)` : `${K.open} team open claims by current SLA position`)}
              {slaView === "met" && (hSla?.userId ? `${hSla.name}: ${hSla.slaMet}% within SLA · ${hSla.closed30} closed` : `% of claims closed within SLA · team ${K.slaMet}%`)}
              {slaView === "tat" && (hSla?.userId ? `${hSla.name}: ${fmtDays(hSla.avgTat)} average to settle` : `Average days intimation → settlement · team ${fmtDays(K.avgTat)}`)}
            </p>

            {slaView === "status" && slaChart === "summary" && (
              <div className="flex flex-col gap-2 px-3 py-1.5">
                <div className="flex h-2.5 gap-[2px] overflow-hidden rounded" role="img" aria-label={slaSummary.map((x) => `${x.label} ${x.count}`).join(", ")}>
                  {slaSummary.map((x) => (
                    <span key={x.key} className={STATUS[x.key].bar} style={{ width: `${pct(x.count, K.open)}%` }} />
                  ))}
                </div>
                <ul className="grid grid-cols-3 gap-1.5">
                  {slaSummary.map((x) => {
                    const st = STATUS[x.key];
                    return (
                      <li key={x.key} className="flex min-w-0 items-center gap-1.5 rounded border border-slate-100 px-1.5 py-0.5" title={x.label}>
                        <span className={`grid h-5 w-5 flex-none place-items-center rounded ${st.chip}`}>
                          <st.Icon className="h-3 w-3" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] leading-tight text-slate-500">{x.label.split(" (")[0]}</span>
                          <span className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold tabular-nums text-slate-900">{x.count}</span>
                            <span className="text-xs tabular-nums text-slate-500">{pct(x.count, K.open)}%</span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10.5px] leading-snug text-slate-500">
                  Most breaches: <b className="font-semibold text-slate-700">{first([...TEAM].sort((a, b) => b.breached - a.breached)[0].name)}</b> ({Math.max(...TEAM.map((h) => h.breached))}) · Settlement SLA clock pauses while documents are with the insured.
                </p>
              </div>
            )}
            {slaView === "status" && slaChart === "bar" && (
              <Columns items={slaSummary} labelKey="label" hover={hSla} setHover={setHSla} height={70} colorFor={(x) => STATUS[x.key].bar} />
            )}
            {slaView === "status" && (slaChart === "pie" || slaChart === "donut") && (
              <PieChart items={slaSummary} labelKey="label" total={K.open} donut={slaChart === "donut"} hover={hSla} setHover={setHSla} colorFor={(x) => STATUS_HEX[x.key]} />
            )}
            {slaView === "met" && slaChart === "bar" && (
              <Columns
                items={byHandler("slaMet")}
                labelKey="label"
                valueKey="value"
                hover={hSla}
                setHover={setHSla}
                height={86}
                target={K.slaTarget}
                targetLabel={`Target ${K.slaTarget}% (higher is better)`}
                format={(v) => `${v}%`}
                mtdLegend={false}
                legendExtra={<span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Below target</span>}
                colorFor={(h) => (h.slaMet < K.slaTarget ? "bg-red-600" : "bg-teal-700")}
              />
            )}
            {slaView === "tat" && slaChart === "bar" && (
              <Columns
                items={byHandler("avgTat")}
                labelKey="label"
                valueKey="value"
                hover={hSla}
                setHover={setHSla}
                height={86}
                target={K.tatTarget}
                targetLabel={`Target ${K.tatTarget} days (lower is better)`}
                format={(v) => Number(v).toFixed(1)}
                mtdLegend={false}
                legendExtra={<span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Over target</span>}
                colorFor={(h) => (h.avgTat > K.tatTarget ? "bg-red-600" : "bg-teal-700")}
              />
            )}
            {slaView === "met" && slaChart === "hbar" && (
              <TargetBars hover={hSla} setHover={setHSla} valueOf={(h) => h.slaMet} target={K.slaTarget} bad={(v) => v < K.slaTarget} format={(v) => `${v}%`} targetLabel={`Target ${K.slaTarget}% (higher is better)`} badLabel="Below target" />
            )}
            {slaView === "tat" && slaChart === "hbar" && (
              <TargetBars hover={hSla} setHover={setHSla} valueOf={(h) => h.avgTat} target={K.tatTarget} bad={(v) => v > K.tatTarget} format={(v) => `${Number(v).toFixed(1)} d`} targetLabel={`Target ${K.tatTarget} days (lower is better)`} badLabel="Over target" />
            )}
          </Card>

          {/* Team workload */}
          <Card
            title="Team workload"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <ViewSelect value={workView} onChange={pick(setWorkView, KEY.work, setHWork)} views={WORK_VIEWS} label="Choose workload view" />
                <ViewSelect value={workChart} onChange={pick(setWorkChartPick, KEY.workChart)} views={chartOptions(WORK_CHARTS[workView])} label="Chart type" />
              </div>
            }
          >
            <p className="truncate px-3 pt-1 text-[11px] text-slate-500" aria-live="polite" title={hWork?.userId ? handlerReadout(hWork) : undefined}>
              {hWork?.userId
                ? handlerReadout(hWork)
                : workView === "capacity"
                  ? onLeave.length
                    ? `${onLeave.map((h) => first(h.name)).join(", ")} on leave · ${onLeave.reduce((t, h) => t + h.dueToday, 0)} due today need cover`
                    : `${K.open} open claims across ${TEAM.length} handlers`
                  : workView === "risk"
                    ? `${K.breached} breached · ${K.atRisk} at risk across the team${workChart === "hbar" ? "" : " · share by handler"}`
                    : workView === "due"
                      ? `${K.dueToday} claims due today · hover a handler`
                      : `${K.closed30} claims closed in the last 30 days`}
            </p>

            {/* custom horizontal views */}
            {workView === "capacity" && workChart === "hbar" && <CapacityBars hover={hWork} setHover={setHWork} onReallocate={() => notBuilt("Reallocation")} />}
            {workView === "risk" && workChart === "hbar" && <RiskBars hover={hWork} setHover={setHWork} />}
            {(workView === "due" || workView === "closed") && workChart === "hbar" && (
              <BarList items={workItems.map((h) => ({ ...h, label: h.name }))} labelKey="label" total={workTotal} hover={hWork} setHover={setHWork} />
            )}
            {/* columns */}
            {workView === "capacity" && workChart === "bar" && (
              <Columns
                items={workItems}
                labelKey="label"
                hover={hWork}
                setHover={setHWork}
                height={86}
                target={HANDLER_CAPACITY}
                targetLabel={`Capacity ${HANDLER_CAPACITY} open claims`}
                mtdLegend={false}
                legendExtra={<span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />Over capacity</span>}
                colorFor={(h) => (h.open > HANDLER_CAPACITY ? "bg-red-600" : h.open > HANDLER_CAPACITY * 0.85 ? "bg-amber-500" : h.status === "leave" ? "bg-teal-700/50" : "bg-teal-700")}
              />
            )}
            {(workView === "due" || workView === "closed") && workChart === "bar" && (
              <Columns items={workItems} labelKey="label" hover={hWork} setHover={setHWork} height={86} colorFor={() => "bg-teal-700"} />
            )}
            {/* shares of the team total */}
            {(workChart === "pie" || workChart === "donut") && (
              <PieChart items={workItems} labelKey="label" total={workTotal} donut={workChart === "donut"} hover={hWork} setHover={setHWork} colorFor={(_, i) => CAT_HEX[i]} centerLabel={{ capacity: "open", risk: "need action", due: "due today", closed: "closed" }[workView]} />
            )}
          </Card>

          {/* Waiting for my approval */}
          <Card
            className="md:col-span-2 lg:col-span-1"
            title="Waiting for my approval"
            action={<ViewSelect value={apprView} onChange={pick(setApprView, KEY.appr)} views={APPROVAL_VIEWS} label="Show" />}
          >
            <p className="truncate px-3 pt-1 text-[11px] text-slate-500">
              {K.approvals} claims · {lakh(K.approvalsValue)} · {K.approvalsOverSla} over SLA · {K.aboveAuthority} above my limit
            </p>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto lg:max-h-[176px] [@media(max-height:660px)]:lg:max-h-[136px]">
              {approvals.map((a) => {
                const overSla = a.waitingHours > APPROVAL_SLA_HOURS;
                const nearSla = !overSla && a.waitingHours > APPROVAL_SLA_HOURS - 12;
                const above = a.amount > MANAGER_AUTHORITY;
                return (
                  <li key={a.claimNo}>
                    <button type="button" onClick={() => navigate(`/od/approvals?claim=${approvalSlug(a.claimNo)}`)} className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-teal-50/40">
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[11.5px] font-semibold text-teal-800">{a.claimNo}</span>
                          {above && (
                            <span className="rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200" title={`Above your authority of ${inr(MANAGER_AUTHORITY)} – refer to the Zonal Claims Head`}>
                              Above my limit
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {first(a.handler)} · {a.insured} · {a.lossType}
                        </span>
                      </span>
                      <span className="flex-none text-right leading-tight">
                        <span className="block text-[12.5px] font-semibold tabular-nums text-slate-900">{inr(a.amount)}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold ${overSla ? "text-red-700" : nearSla ? "text-amber-800" : "text-slate-500"}`} title={`Approval SLA ${APPROVAL_SLA_HOURS / 24} days`}>
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
              {!approvals.length && <li className="px-3 py-6 text-center text-[12px] text-slate-500">Nothing in this view.</li>}
            </ul>
            <button
              type="button"
              onClick={() => navigate("/od/approvals")}
              className="mt-auto flex h-7 flex-none items-center justify-center gap-1 border-t border-slate-100 text-[12px] font-semibold text-teal-800 hover:bg-teal-50/60"
            >
              Open Approvals <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </Card>
        </div>

        {/* ---------------- Row 3: Team stage-wise TAT · Watch list ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Team stage-wise TAT vs target"
            action={
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 xl:inline">Average days · last 90 days</span>
                <ViewSelect value={stageChart} onChange={pick(setStageChart, KEY.stage)} views={STAGE_CHARTS} label="Chart type" />
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:divide-x lg:divide-slate-100">
              <StageTatChart items={STAGES} type={stageChart} />
              <table className="w-full self-start text-left text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-1 font-semibold">Stage</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-1 text-right font-semibold">Avg / target</th>
                    <th scope="col" className="hidden px-2 py-1 font-semibold min-[1340px]:table-cell">Status</th>
                    <th scope="col" className="px-3 py-1 text-right font-semibold" title="Team open claims now over the stage SLA">Breached</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((s) => {
                    const over = s.actual > s.target;
                    return (
                      <tr key={s.stage} className="border-t border-slate-100">
                        <td className="truncate px-3 py-1 [@media(max-height:660px)]:py-0.5 text-slate-700" title={s.stage}>{(STAGE_SHORT[s.stage] || [s.stage]).join(" ").trim()}</td>
                        <td className="whitespace-nowrap px-2 py-1 [@media(max-height:660px)]:py-0.5 text-right tabular-nums">
                          <span className={`font-semibold ${over ? "text-red-700" : "text-slate-800"}`}>{fmtDays(s.actual)}</span>
                          <span className="text-slate-400"> / {fmtDays(s.target)}</span>
                        </td>
                        <td className="hidden px-2 py-1 [@media(max-height:660px)]:py-0.5 min-[1340px]:table-cell">
                          {over ? <StatusChip kind="breach">Over {(s.actual - s.target).toFixed(1)} d</StatusChip> : <StatusChip kind="ok">On track</StatusChip>}
                        </td>
                        <td className="px-3 py-1 [@media(max-height:660px)]:py-0.5 text-right tabular-nums">
                          {s.breachedOpen > 0 ? (
                            <button type="button" onClick={() => notBuilt("Team Work Queue")} title="Open these claims in the Team Work Queue" className="font-semibold text-red-700 hover:underline">
                              {s.breachedOpen}
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <td className="px-3 py-1 [@media(max-height:660px)]:py-0.5" colSpan={2}>Team total breached</td>
                    <td className="hidden min-[1340px]:table-cell" />
                    <td className="px-3 py-1 text-right tabular-nums text-red-700 [@media(max-height:660px)]:py-0.5">{STAGES.reduce((t, s) => t + s.breachedOpen, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="Watch list" action={<ViewSelect value={watchView} onChange={pick(setWatchView, KEY.watch)} views={WATCH_VIEWS} label="Show" />}>
            <p className="truncate px-3 pt-1 text-[11px] text-slate-500">
              {watch.length} claims · reserve {lakh(watch.reduce((t, w) => t + w.reserve, 0))}
            </p>
            <ul className="divide-y divide-slate-100">
              {watch.map((w) => (
                <li key={w.claimNo}>
                  <button type="button" onClick={() => notBuilt("Escalations")} className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-teal-50/40" title={`${w.claimNo} · ${w.reason} · ${w.handler}`}>
                    <span className={`grid h-6 w-6 flex-none place-items-center rounded [@media(max-height:660px)]:h-5 [@media(max-height:660px)]:w-5 ${w.kind === "fraud" ? "bg-red-50 text-red-700" : w.kind === "late" ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-800"}`}>
                      {w.kind === "fraud" ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> : w.kind === "late" ? <Clock className="h-3.5 w-3.5" aria-hidden="true" /> : <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    {/* two lines on normal screens; one line on short screens (≤ 660 px high) so the page still fits */}
                    <span className="min-w-0 flex-1 leading-tight [@media(max-height:660px)]:truncate">
                      <span className="block font-mono text-[11.5px] font-semibold text-teal-800 [@media(max-height:660px)]:inline">{w.claimNo}</span>
                      <span className="block truncate text-[11px] text-slate-500 [@media(max-height:660px)]:inline">
                        <span className="hidden [@media(max-height:660px)]:inline"> · </span>
                        {w.reason} · {first(w.handler)}
                      </span>
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