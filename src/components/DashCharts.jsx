// src/components/DashCharts.jsx
// Small chart set for the dashboard. Every bar, slice and legend row is clickable and calls
// onPick(item) – the dashboard uses it to open those claims in My Work Queue.
// Charts are plain SVG/CSS (no chart library) so they stay light and match the app styles.

import { BarChart3, BarChartHorizontal, PieChart, Donut, Table2 } from "lucide-react";

const ICONS = { column: BarChart3, bar: BarChartHorizontal, pie: PieChart, donut: Donut, table: Table2 };
const NAMES = { column: "Column chart", bar: "Bar chart", pie: "Pie chart", donut: "Donut chart", table: "Table" };

/* ------------------------------------------------------------------ */
/* View switch – icon buttons in a panel header                        */
/* ------------------------------------------------------------------ */
export function ViewSwitch({ views, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={`${label} – chart view`} className="inline-flex flex-none rounded-md border border-slate-200 p-0.5">
      {views.map((v) => {
        const Icon = ICONS[v];
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={NAMES[v]}
            title={NAMES[v]}
            onClick={() => onChange(v)}
            className={`grid h-6 w-7 place-items-center rounded ${on ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pie / donut with a clickable legend                                 */
/* items: [{ key, label, count, color }]                               */
/* ------------------------------------------------------------------ */
const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
};

export function PieView({ items, donut, onPick, centre, unit = "claims" }) {
  const total = items.reduce((t, i) => t + i.count, 0);
  const shown = items.filter((i) => i.count > 0);
  let a = 0;
  return (
    <div className="flex min-h-0 flex-1 items-center gap-4 px-4 py-3">
      <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] flex-none" role="img" aria-label={`${total} ${unit}: ${shown.map((i) => `${i.label} ${i.count}`).join(", ")}`}>
        {total === 0 && <circle cx="60" cy="60" r="56" className="fill-slate-100" />}
        {shown.length === 1 && <circle cx="60" cy="60" r="56" fill={shown[0].color} className="cursor-pointer" onClick={() => onPick(shown[0])} />}
        {shown.length > 1 &&
          shown.map((i) => {
            const a0 = a;
            a += (i.count / total) * Math.PI * 2;
            return (
              <path key={i.key} d={arc(60, 60, 56, a0, a)} fill={i.color} stroke="#fff" strokeWidth="1.5" className="cursor-pointer transition-opacity hover:opacity-80" onClick={() => onPick(i)}>
                <title>{`${i.label}: ${i.count}`}</title>
              </path>
            );
          })}
        {donut && <circle cx="60" cy="60" r="34" fill="#fff" pointerEvents="none" />}
        {donut && (
          <>
            <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[20px] font-semibold">
              {centre ?? total}
            </text>
            <text x="60" y="74" textAnchor="middle" className="fill-slate-500 text-[11px]">
              {unit}
            </text>
          </>
        )}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {items.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              disabled={!i.count}
              onClick={() => onPick(i)}
              className="grid w-full grid-cols-[0.625rem_minmax(0,1fr)_auto_2.5rem] items-center gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />
              <span className="truncate text-slate-700">{i.label}</span>
              <span className="text-right font-semibold tabular-nums text-slate-900">{i.count}</span>
              <span className="text-right tabular-nums text-slate-500">{total ? Math.round((i.count / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */
export function BarView({ items, onPick, highlight }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="flex flex-col gap-1 px-4 py-3">
      {items.map((i) => {
        const strong = highlight && highlight(i);
        return (
          <li key={i.key}>
            <button
              type="button"
              disabled={!i.count}
              onClick={() => onPick(i)}
              aria-label={`${i.label}: ${i.count}${i.count ? " – open in My Work Queue" : ""}`}
              className="grid w-full grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2rem] items-center gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className={`truncate ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>{i.label}</span>
              <span className="h-2 rounded-sm bg-slate-100">
                <span className="block h-2 rounded-sm" style={{ width: `${(i.count / max) * 100}%`, background: i.color }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-slate-900">{i.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical columns – optional red part (e.g. SLA breached)            */
/* ------------------------------------------------------------------ */
export function ColumnView({ items, onPick, height = 120 }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex items-end gap-3 px-4 pb-2 pt-4" style={{ height: height + 68 }}>
      {items.map((i) => {
        const h = Math.round((i.count / max) * height);
        const hr = i.count && i.red ? Math.round((i.red / i.count) * h) : 0;
        return (
          <div key={i.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[13px] font-semibold tabular-nums text-slate-900">{i.count}</span>
            <button
              type="button"
              disabled={!i.count}
              onClick={() => onPick(i)}
              aria-label={`${i.label}: ${i.count}${i.red != null ? `, ${i.red} SLA breached` : ""}${i.count ? " – open in My Work Queue" : ""}`}
              title={`${i.count} claims${i.red != null ? ` · ${i.red} SLA breached` : ""}`}
              className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t transition hover:opacity-85 disabled:cursor-default"
              style={{ height: Math.max(i.count ? 4 : 0, h), background: i.color }}
            >
              {hr > 0 && <span className="block w-full bg-red-600" style={{ height: hr }} />}
            </button>
            <span className="max-w-full truncate text-[12px] text-slate-500">{i.label}</span>
          </div>
        );
      })}
    </div>
  );
}