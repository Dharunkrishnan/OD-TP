// src/pages/od/ODHandlerDashboard.jsx
// P01 · OD Claims Handler Dashboard (persona: Karthik Subramanian · OD0123)
// Dashboard = SLA / TAT performance and portfolio summary only.
// Claim list, Today's diary and Alerts live on the My Work Queue page (P05).
// Catalogue refs: SLA / TAT Management 165–170, Search / Dashboard 178–181
// Page scrolls normally; sidebar and header stay fixed.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen,
  Gauge,
  Timer,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { useAuth } from "../../auth";
import {
  HANDLER_KPIS,
  SLA_KPIS,
  SLA_SUMMARY,
  TAT_STAGES,
  SLA_TREND,
  TAT_TREND,
  AGEING_BUCKETS,
  STAGE_COUNTS,
  LOSS_TYPES,
  PENDING_WITH,
  CLOSED_TREND,
} from "../../data/odHandlerMock";

// Stages the system does automatically (intimation submit runs the registration jobs and
// generates the claim no) – no handler TAT to track, so they are left out of the stage table.
const AUTOMATED_STAGES = ["Intimation → Registration"];
const HANDLER_TAT_STAGES = TAT_STAGES.filter((s) => !AUTOMATED_STAGES.includes(s.stage));

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const pct = (n, total) => Math.round((n / total) * 100);
const fmtDays = (d) => `${Number(d).toFixed(1)} d`;

// Combined SLA card – views selectable from a dropdown (choice remembered per browser)
const SLA_VIEWS = [
  { key: "status", label: "SLA status (open)" },
  { key: "compliance", label: "SLA % by month" },
  { key: "tat", label: "Avg TAT by month" },
];
const SLA_VIEW_KEY = "smartclaims-od-sla-view";

// Combined portfolio card – same pattern
const PORT_VIEWS = [
  { key: "ageing", label: "Ageing" },
  { key: "stage", label: "By stage" },
  { key: "loss", label: "By loss type" },
];

// Third card – workload & productivity
const WORK_VIEWS = [
  { key: "pending", label: "Pending with" },
  { key: "closed", label: "Closed by month" },
];
const WORK_VIEW_KEY = "smartclaims-od-work-view";
const PORT_VIEW_KEY = "smartclaims-od-portfolio-view";

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
const CHART_LABEL = { summary: "Summary", bar: "Bar", pie: "Pie", donut: "Donut", line: "Line" };
const SLA_CHARTS = { status: ["summary", "bar", "pie", "donut"], compliance: ["bar", "line"], tat: ["bar", "line"] };
const PORT_CHARTS = { ageing: ["bar", "pie", "donut"], stage: ["bar", "pie", "donut"], loss: ["bar", "pie", "donut"] };
const WORK_CHARTS = { pending: ["bar", "pie", "donut"], closed: ["bar", "line"] };
const WORK_CHART_KEY = "smartclaims-od-work-chart";
const SLA_CHART_KEY = "smartclaims-od-sla-chart";
const PORT_CHART_KEY = "smartclaims-od-portfolio-chart";
const readChart = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const chartOptions = (types) => types.map((t) => ({ key: t, label: CHART_LABEL[t] }));

// Slice colours. Status = reserved SLA colours; ageing = one-hue ramp (ordered);
// stage / loss type = fixed categorical order (colour follows the category).
const STATUS_HEX = { ok: "#059669", risk: "#f59e0b", breach: "#dc2626" };
const AGE_HEX = ["#99f6e4", "#5eead4", "#14b8a6", "#0f766e", "#134e4a"];
const CAT_HEX = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];

/** Pie charts read best with ≤ 6 slices: keep the 5 largest, fold the rest into "Other". */
function foldToSix(items, labelKey) {
  if (items.length <= 6) return items;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const keep = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  return [
    ...keep,
    { [labelKey]: `Other (${rest.map((r) => r[labelKey]).join(", ")})`, count: rest.reduce((a, r) => a + r.count, 0), other: true },
  ];
}

/** Dropdown used in a card header to switch the card's view. */
function ViewSelect({ value, onChange, views, label }) {
  return (
    <label className="flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 max-w-full rounded border border-slate-300 bg-white py-0 pl-2 pr-7 text-[11.5px] font-medium text-slate-800 hover:border-teal-600 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15"
      >
        {views.map((v) => (
          <option key={v.key} value={v.key}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */
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
  { key: "column", label: "Column" },
  { key: "bar", label: "Bar" },
  { key: "line", label: "Line" },
  { key: "variance", label: "Variance" },
];
const STAGE_CHART_KEY = "smartclaims-od-stage-chart";
const overBy = (s) => +(s.actual - s.target).toFixed(1);

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
      <ul className="flex flex-col gap-1.5 pt-1">
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
              className={`grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_44px] items-center gap-2 rounded px-1 py-0.5 text-[11.5px] ${on ? "bg-slate-100" : ""}`}
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
  const W = 640, H = 190, L = 28, R = 12, T = 18, B = 34;
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
      <ul className="flex flex-col gap-1.5 pt-1">
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
              className={`grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_58px] items-center gap-2 rounded px-1 py-0.5 text-[11.5px] ${on ? "bg-slate-100" : ""}`}
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
  const H = 168; // plot height px
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

// Status colours are reserved for SLA state and always come with an icon + label
const STATUS = {
  ok: { bar: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  risk: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-900", Icon: Clock },
  breach: { bar: "bg-red-600", chip: "bg-red-50 text-red-800", Icon: AlertTriangle },
};

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
function Columns({ items, labelKey, valueKey = "count", hover, setHover, colorFor, inkFor, height = 110, target, format = (v) => v, targetLabel }) {
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
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-300" aria-hidden="true" />
            Current month to date
          </span>
        </p>
      )}
    </div>
  );
}

/** Pie / donut with a legend that carries every label, value and share. */
function PieChart({ items, labelKey, colorFor, donut, hover, setHover, total }) {
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
              <span className="block text-[10px] text-slate-500">{active ? `${pct(active.count, total)}%` : "open"}</span>
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

/** Line chart for month trends. Scale is zoomed to the data range (lines need not start at 0). */
function LineChart({ items, labelKey, valueKey, hover, setHover, height = 80, target, format = (v) => v, targetLabel }) {
  const vals = items.map((i) => i[valueKey]);
  const lo = Math.min(...vals, target ?? Infinity);
  const hi = Math.max(...vals, target ?? -Infinity);
  const pad = (hi - lo) * 0.35 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const n = items.length;
  const x = (i) => ((i + 0.5) / n) * 100;
  const y = (v) => ((v - min) / (max - min)) * 100;
  const points = items.map((it, i) => `${x(i)},${100 - y(it[valueKey])}`).join(" ");

  return (
    <div className="px-3 pb-1.5 pt-3">
      <div className="relative" style={{ height }}>
        {target != null && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-slate-700"
            style={{ bottom: `${y(target)}%` }}
            aria-hidden="true"
          />
        )}
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} fill="none" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {items.map((it, i) => {
          const active = hover?.[labelKey] === it[labelKey];
          return (
            <div key={it[labelKey]} className="pointer-events-none absolute" style={{ left: `${x(i)}%`, bottom: `${y(it[valueKey])}%` }}>
              <span
                className={`absolute bottom-0 left-1/2 block -translate-x-1/2 translate-y-1/2 rounded-full ${
                  it.mtd ? "h-3 w-3 border-2 border-teal-700 bg-white" : "h-3 w-3 bg-teal-700 ring-2 ring-white"
                } ${active ? "scale-125" : ""}`}
              />
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-0.5 text-[11px] font-semibold tabular-nums text-slate-800">
                {format(it[valueKey])}
              </span>
            </div>
          );
        })}
        {/* hover columns */}
        <div className="absolute inset-0 flex" role="list" aria-label={items.map((it) => `${it[labelKey]} ${format(it[valueKey])}`).join(", ")}>
          {items.map((it) => (
            <div
              key={it[labelKey]}
              role="listitem"
              className="h-full flex-1"
              onMouseEnter={() => setHover(it)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex">
        {items.map((it) => (
          <span key={it[labelKey]} className="flex-1 text-center text-[11px] leading-tight text-slate-500">
            {it[labelKey]}
          </span>
        ))}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
        {target != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-slate-700" aria-hidden="true" />
            {targetLabel ?? `Target ${format(target)}`}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-teal-700 bg-white" aria-hidden="true" />
          Current month to date
        </span>
        <span>Scale zoomed to data range</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function ODHandlerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [hAge, setHAge] = useState(null);
  const [hStage, setHStage] = useState(null);
  const [hLoss, setHLoss] = useState(null);
  const [hSla, setHSla] = useState(null);
  const [hTat, setHTat] = useState(null);
  const [slaView, setSlaView] = useState(() => readView(SLA_VIEW_KEY, SLA_VIEWS));
  const [portView, setPortView] = useState(() => readView(PORT_VIEW_KEY, PORT_VIEWS));
  const [stageChart, setStageChart] = useState(() => readView(STAGE_CHART_KEY, STAGE_CHARTS));
  const [slaChartPick, setSlaChartPick] = useState(() => readChart(SLA_CHART_KEY));
  const [portChartPick, setPortChartPick] = useState(() => readChart(PORT_CHART_KEY));
  const [workView, setWorkView] = useState(() => readView(WORK_VIEW_KEY, WORK_VIEWS));
  const [workChartPick, setWorkChartPick] = useState(() => readChart(WORK_CHART_KEY));
  const [hPend, setHPend] = useState(null);
  const [hClosed, setHClosed] = useState(null);
  const workChart = WORK_CHARTS[workView].includes(workChartPick) ? workChartPick : WORK_CHARTS[workView][0];

  function changeWorkView(v) {
    setWorkView(v);
    setHPend(null);
    setHClosed(null);
    saveView(WORK_VIEW_KEY, v);
  }
  function changeWorkChart(t) {
    setWorkChartPick(t);
    saveView(WORK_CHART_KEY, t);
  }

  // If the saved chart type does not suit the current view, use that view's default
  const slaChart = SLA_CHARTS[slaView].includes(slaChartPick) ? slaChartPick : SLA_CHARTS[slaView][0];
  const portChart = PORT_CHARTS[portView].includes(portChartPick) ? portChartPick : PORT_CHARTS[portView][0];

  function changeStageChart(t) {
    setStageChart(t);
    saveView(STAGE_CHART_KEY, t);
  }
  function changeSlaChart(t) {
    setSlaChartPick(t);
    saveView(SLA_CHART_KEY, t);
  }
  function changePortChart(t) {
    setPortChartPick(t);
    saveView(PORT_CHART_KEY, t);
  }

  function changeSlaView(v) {
    setSlaView(v);
    setHSla(null);
    setHTat(null);
    saveView(SLA_VIEW_KEY, v);
  }

  function changePortView(v) {
    setPortView(v);
    setHAge(null);
    setHStage(null);
    setHLoss(null);
    saveView(PORT_VIEW_KEY, v);
  }

  const firstName = (user?.name || "").split(" ")[0];
  const total = HANDLER_KPIS.open;

  function notBuilt(what) {
    setToast(`${what} – this page comes in a later build step.`);
    window.clearTimeout(notBuilt.t);
    notBuilt.t = window.setTimeout(() => setToast(""), 2600);
  }

  const slaOk = SLA_KPIS.slaCompliance >= SLA_KPIS.slaTarget;
  const tatOk = SLA_KPIS.avgSettlementTat <= SLA_KPIS.settlementTarget;

  const KPIS = [
    {
      label: "Open claims",
      tab: "all",
      value: total,
      sub: "Assigned to me",
      icon: FolderOpen,
      tone: "bg-slate-100 text-slate-700",
    },
    {
      label: "SLA met",
      value: `${SLA_KPIS.slaCompliance}%`,
      sub: `Target ${SLA_KPIS.slaTarget}%`,
      icon: Gauge,
      tone: slaOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      status: slaOk ? "ok" : "breach",
      statusText: slaOk ? "Met" : "Below",
    },
    {
      label: "Avg TAT",
      value: fmtDays(SLA_KPIS.avgSettlementTat),
      sub: `Target ${SLA_KPIS.settlementTarget} d`,
      icon: Timer,
      tone: tatOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      status: tatOk ? "ok" : "breach",
      statusText: tatOk ? "Within" : "Over",
    },
    {
      label: "SLA breached",
      tab: "breach",
      value: HANDLER_KPIS.slaBreached,
      sub: "Open claims",
      icon: AlertTriangle,
      tone: "bg-red-50 text-red-700",
    },
    {
      label: "At risk",
      tab: "risk",
      value: SLA_KPIS.atRisk,
      sub: "Due ≤ 24 h",
      icon: Clock,
      tone: "bg-amber-50 text-amber-800",
    },
    {
      label: "Closed (MTD)",
      value: HANDLER_KPIS.closedMtd,
      sub: "This month",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];


  return (
    <ODShell
      active="dashboard"
      title={`${greeting()}, ${firstName}`}
      subtitle={`${todayLabel()} · Your SLA and TAT performance`}
      onNavigateMissing={notBuilt}
    >
      <div className="flex flex-col gap-2">
        {/* ---------------- KPI row ---------------- */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {KPIS.map((k) => {
            const Tag = k.tab ? "button" : "div";
            return (
            <Tag
              key={k.label}
              {...(k.tab
                ? {
                    type: "button",
                    onClick: () => navigate(k.tab === "all" ? "/od/worklist" : `/od/worklist?tab=${k.tab}`),
                    title: "Open in My Work Queue",
                  }
                : {})}
              className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-left ${
                k.tab ? "transition hover:border-teal-600" : ""
              }`}
            >
              <span className={`grid h-6 w-6 flex-none place-items-center rounded ${k.tone}`}>
                <k.icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium leading-tight text-slate-500" title={k.label}>{k.label}</span>
                <span className="block text-base font-semibold leading-tight text-slate-900 tabular-nums">{k.value}</span>
                <span className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-slate-500">
                  {k.sub}
                  {k.status && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${k.status === "ok" ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {k.status === "ok" ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span className="sr-only">{k.statusText}</span>
                    </span>
                  )}
                </span>
              </span>
            </Tag>
            );
          })}
        </div>

        {/* ---------------- Row 2: SLA · Portfolio · Workload (view + chart-type dropdowns) ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2 lg:grid-cols-3">
          <Card
            title="SLA"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <ViewSelect value={slaView} onChange={changeSlaView} views={SLA_VIEWS} label="Choose SLA view" />
                <ViewSelect value={slaChart} onChange={changeSlaChart} views={chartOptions(SLA_CHARTS[slaView])} label="Chart type" />
              </div>
            }
          >
            {/* sub-header: what this view measures / hover readout */}
            <p className="px-3 pt-1 text-[11px] text-slate-500" aria-live="polite">
              {slaView === "status" &&
                (hSla?.key
                  ? `${hSla.label}: ${hSla.count} claims (${pct(hSla.count, total)}%)`
                  : `${total} open claims by current SLA position`)}
              {slaView === "compliance" &&
                (hSla?.month
                  ? `${hSla.month}${hSla.mtd ? " (to date)" : ""}: ${hSla.value}% closed within SLA`
                  : "% of claims closed within SLA · hover a month")}
              {slaView === "tat" &&
                (hTat
                  ? `${hTat.month}${hTat.mtd ? " (to date)" : ""}: ${fmtDays(hTat.value)} intimation → settlement`
                  : "Average days from intimation to settlement · hover a month")}
            </p>

            {/* --- SLA status --- */}
            {slaView === "status" && slaChart === "summary" && (
              <div className="flex flex-col gap-2 px-3 py-1.5">
                <div
                  className="flex h-2.5 gap-[2px] overflow-hidden rounded"
                  role="img"
                  aria-label={SLA_SUMMARY.map((x) => `${x.label} ${x.count}`).join(", ")}
                >
                  {SLA_SUMMARY.map((x) => (
                    <span key={x.key} className={STATUS[x.key].bar} style={{ width: `${pct(x.count, total)}%` }} />
                  ))}
                </div>
                <ul className="grid grid-cols-3 gap-1.5">
                  {SLA_SUMMARY.map((x) => {
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
                            <span className="text-xs tabular-nums text-slate-500">{pct(x.count, total)}%</span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10.5px] leading-snug text-slate-500">
                  Settlement SLA clock pauses while documents are with the insured.
                </p>
              </div>
            )}
            {slaView === "status" && slaChart === "bar" && (
              <Columns
                items={SLA_SUMMARY}
                labelKey="label"
                hover={hSla}
                setHover={setHSla}
                height={70}
                colorFor={(x) => STATUS[x.key].bar}
              />
            )}
            {slaView === "status" && (slaChart === "pie" || slaChart === "donut") && (
              <PieChart
                items={SLA_SUMMARY}
                labelKey="label"
                total={total}
                donut={slaChart === "donut"}
                hover={hSla}
                setHover={setHSla}
                colorFor={(x) => STATUS_HEX[x.key]}
              />
            )}

            {/* --- SLA compliance trend --- */}
            {slaView === "compliance" && slaChart === "bar" && (
              <Columns
                items={SLA_TREND}
                labelKey="month"
                valueKey="value"
                hover={hSla}
                setHover={setHSla}
                height={70}
                target={SLA_KPIS.slaTarget}
                targetLabel={`Target ${SLA_KPIS.slaTarget}% (higher is better)`}
                format={(v) => `${v}%`}
                colorFor={(m) => (m.mtd ? "bg-teal-300" : "bg-teal-700")}
                inkFor={(m) => (m.mtd ? "text-slate-900" : "text-white")}
              />
            )}
            {slaView === "compliance" && slaChart === "line" && (
              <LineChart
                items={SLA_TREND}
                labelKey="month"
                valueKey="value"
                hover={hSla}
                setHover={setHSla}
                target={SLA_KPIS.slaTarget}
                targetLabel={`Target ${SLA_KPIS.slaTarget}% (higher is better)`}
                format={(v) => `${v}%`}
              />
            )}

            {/* --- Settlement TAT trend --- */}
            {slaView === "tat" && slaChart === "bar" && (
              <Columns
                items={TAT_TREND}
                labelKey="month"
                valueKey="value"
                hover={hTat}
                setHover={setHTat}
                height={70}
                target={SLA_KPIS.settlementTarget}
                targetLabel={`Target ${SLA_KPIS.settlementTarget} days (lower is better)`}
                format={(v) => `${Number(v).toFixed(1)}`}
                colorFor={(m) => (m.mtd ? "bg-teal-300" : "bg-teal-700")}
                inkFor={(m) => (m.mtd ? "text-slate-900" : "text-white")}
              />
            )}
            {slaView === "tat" && slaChart === "line" && (
              <LineChart
                items={TAT_TREND}
                labelKey="month"
                valueKey="value"
                hover={hTat}
                setHover={setHTat}
                target={SLA_KPIS.settlementTarget}
                targetLabel={`Target ${SLA_KPIS.settlementTarget} days (lower is better)`}
                format={(v) => `${Number(v).toFixed(1)}`}
              />
            )}
          </Card>

          <Card
            title="Portfolio"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <ViewSelect value={portView} onChange={changePortView} views={PORT_VIEWS} label="Choose portfolio view" />
                <ViewSelect value={portChart} onChange={changePortChart} views={chartOptions(PORT_CHARTS[portView])} label="Chart type" />
              </div>
            }
          >
            <p className="px-3 pt-1 text-[11px] text-slate-500" aria-live="polite">
              {portView === "ageing" &&
                (hAge
                  ? `${hAge.bucket}: ${hAge.count} claims (${pct(hAge.count, total)}%)`
                  : `${total} open claims by days since registration · hover for detail`)}
              {portView === "stage" &&
                (hStage
                  ? `${hStage.stage}: ${hStage.count} claims (${pct(hStage.count, total)}%)`
                  : `${total} open claims by current lifecycle stage`)}
              {portView === "loss" &&
                (hLoss
                  ? `${hLoss.type}: ${hLoss.count} claims (${pct(hLoss.count, total)}%)`
                  : `${total} open claims by loss type`)}
            </p>

            {/* --- Ageing --- */}
            {portView === "ageing" && portChart === "bar" && (
              <Columns
                items={AGEING_BUCKETS}
                labelKey="bucket"
                hover={hAge}
                setHover={setHAge}
                height={70}
                colorFor={(_, i) => ["bg-teal-300", "bg-teal-400", "bg-teal-600", "bg-teal-700", "bg-teal-900"][i]}
              />
            )}
            {portView === "ageing" && portChart !== "bar" && (
              <PieChart
                items={AGEING_BUCKETS}
                labelKey="bucket"
                total={total}
                donut={portChart === "donut"}
                hover={hAge}
                setHover={setHAge}
                colorFor={(_, i) => AGE_HEX[i]}
              />
            )}

            {/* --- Stage --- */}
            {portView === "stage" && portChart === "bar" && (
              <BarList items={STAGE_COUNTS} labelKey="stage" total={total} hover={hStage} setHover={setHStage} />
            )}
            {portView === "stage" && portChart !== "bar" && (
              <PieChart
                items={foldToSix(STAGE_COUNTS, "stage")}
                labelKey="stage"
                total={total}
                donut={portChart === "donut"}
                hover={hStage}
                setHover={setHStage}
                colorFor={(x, i) => (x.other ? "#94a3b8" : CAT_HEX[i])}
              />
            )}

            {/* --- Loss type --- */}
            {portView === "loss" && portChart === "bar" && (
              <BarList items={LOSS_TYPES} labelKey="type" total={total} hover={hLoss} setHover={setHLoss} />
            )}
            {portView === "loss" && portChart !== "bar" && (
              <PieChart
                items={LOSS_TYPES}
                labelKey="type"
                total={total}
                donut={portChart === "donut"}
                hover={hLoss}
                setHover={setHLoss}
                colorFor={(_, i) => CAT_HEX[i]}
              />
            )}
          </Card>

          <Card
            className="md:col-span-2 lg:col-span-1"
            title="Workload"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <ViewSelect value={workView} onChange={changeWorkView} views={WORK_VIEWS} label="Choose workload view" />
                <ViewSelect value={workChart} onChange={changeWorkChart} views={chartOptions(WORK_CHARTS[workView])} label="Chart type" />
              </div>
            }
          >
            <p className="px-3 pt-1 text-[11px] text-slate-500" aria-live="polite">
              {workView === "pending" &&
                (hPend
                  ? `${hPend.party}: ${hPend.count} claims (${pct(hPend.count, total)}%)`
                  : `Who my ${total} open claims are waiting on`)}
              {workView === "closed" &&
                (hClosed
                  ? `${hClosed.month}${hClosed.mtd ? " (to date)" : ""}: ${hClosed.count} claims closed`
                  : "Claims I closed each month · hover for detail")}
            </p>

            {workView === "pending" && workChart === "bar" && (
              <BarList items={PENDING_WITH} labelKey="party" total={total} hover={hPend} setHover={setHPend} />
            )}
            {workView === "pending" && workChart !== "bar" && (
              <PieChart
                items={foldToSix(PENDING_WITH, "party")}
                labelKey="party"
                total={total}
                donut={workChart === "donut"}
                hover={hPend}
                setHover={setHPend}
                colorFor={(x, i) => (x.other ? "#94a3b8" : CAT_HEX[i])}
              />
            )}

            {workView === "closed" && workChart === "bar" && (
              <Columns
                items={CLOSED_TREND}
                labelKey="month"
                hover={hClosed}
                setHover={setHClosed}
                height={70}
                colorFor={(m) => (m.mtd ? "bg-teal-300" : "bg-teal-700")}
              />
            )}
            {workView === "closed" && workChart === "line" && (
              <LineChart items={CLOSED_TREND} labelKey="month" valueKey="count" hover={hClosed} setHover={setHClosed} />
            )}
          </Card>
        </div>

        {/* ---------------- Row 3: Stage-wise TAT vs target (only what a handler needs) ---------------- */}
        <Card
          title="Stage-wise TAT vs target"
          action={
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:inline">Average days · last 90 days</span>
              <ViewSelect value={stageChart} onChange={changeStageChart} views={STAGE_CHARTS} label="Chart type" />
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:divide-x lg:divide-slate-100">
          <StageTatChart items={HANDLER_TAT_STAGES} type={stageChart} />
          <table className="w-full self-start text-left text-[12px]">
            <thead>
              <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-1.5 font-semibold">Stage</th>
                <th scope="col" className="whitespace-nowrap px-3 py-1.5 text-right font-semibold">Avg TAT / target</th>
                <th scope="col" className="hidden px-3 py-1.5 font-semibold sm:table-cell">Status</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Breached</th>
              </tr>
            </thead>
            <tbody>
              {HANDLER_TAT_STAGES.map((s) => {
                const over = s.actual > s.target;
                const diff = Math.abs(s.actual - s.target).toFixed(1);
                return (
                  <tr key={s.stage} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-700">{s.stage}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      <span className={`font-semibold ${over ? "text-red-700" : "text-slate-800"}`}>{fmtDays(s.actual)}</span>
                      <span className="text-slate-400"> / {fmtDays(s.target)}</span>
                    </td>
                    <td className="hidden px-3 py-1.5 sm:table-cell">
                      {over ? <StatusChip kind="breach">Over by {diff} d</StatusChip> : <StatusChip kind="ok">On track</StatusChip>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {s.breachedOpen > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate("/od/worklist?tab=breach")}
                          title="Open the breached claims in My Work Queue"
                          className="font-semibold text-red-700 hover:underline"
                        >
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
          </table>
          </div>
        </Card>

      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </ODShell>
  );
}