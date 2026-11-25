// src/components/HandlerPerformance.jsx
// Claims Handler dashboard → "Performance" tab. Only what the catalogue asks for:
//   180  pending (pending with, open by stage), TAT (stage-wise vs target), ageing, outstanding
//   166  breach alerts (SLA breached, at risk), ageing
//   168  IRDAI regulatory TAT (survey report 15 d, claim decision 7 d)
//   184  closed by outcome – paid, withdrawn, repudiated, closed without payment, NBNR closed
// Every figure is calculated live (data/handlerDashboard.js) and opens the same claims in
// My Work Queue. Filters: registered in (period) and loss type – kept in the URL.

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { dashboardSummary, lossTypes, queueLink, PERIODS, PERIOD_TEXT } from "../data/handlerDashboard";
import { DATA_EVENT } from "../data/claimWork";
import { ViewSwitch, PieView, BarView, ColumnView } from "./DashCharts";

// Colours: ageing = one ordered teal ramp; parties and outcomes = fixed colour per category
const AGE_COLOURS = ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#115e59"];
const PARTY_COLOURS = { "Me (handler)": "#0d9488", Insured: "#0284c7", "Garage / dealer": "#d97706", "Claims approver": "#7c3aed", "External surveyor (IPS)": "#0891b2", Finance: "#16a34a", "PAS / underwriting": "#64748b", "SIU / investigator": "#dc2626" };
const OUTCOME_COLOURS = { Paid: "#16a34a", Withdrawn: "#94a3b8", Repudiated: "#dc2626", "Closed without payment": "#d97706", "NBNR closed": "#7c3aed" };
// chart views offered per panel (first = default)
const VIEWS = { ageing: ["column", "bar", "pie", "donut"], pending: ["bar", "pie", "donut"], outcome: ["table", "donut", "bar"], tat: ["table", "column"] };

// chosen view per chart, remembered in this browser
const VIEW_KEY = "smartclaims-dash-views";
function readViews() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveViews(v) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

const lakh = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`);
const days = (d) => (d == null ? "–" : `${d.toFixed(1)} d`);
const timeNow = () => new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function Panel({ title, sub, right, children, className = "" }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <header className="flex min-h-[44px] items-center justify-between gap-3 border-b border-slate-100 px-4 py-1.5">
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold leading-tight text-slate-900">{title}</h2>
          {sub && <p className="truncate text-[12px] leading-tight text-slate-500">{sub}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

// Stage-wise TAT as columns: average days (teal within target, red over) with the target marked
const SHORT = { Registered: "Inspection", "Survey pending": "Survey", Assessment: "Assessment", "Documents pending": "Documents", Approval: "Approval", "Repair / DO": "Delivery order", Payment: "Payment" };
function TatColumns({ stages, onPick }) {
  const H = 150;
  const max = Math.max(1, ...stages.map((t) => Math.max(t.avg || 0, t.target))) * 1.15;
  return (
    <div className="flex items-end gap-3 px-4 pb-2 pt-3" style={{ height: H + 64 }}>
      {stages.map((t) => {
        const over = t.avg != null && t.avg > t.target;
        return (
          <div key={t.stage} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className={`text-[12.5px] font-semibold tabular-nums ${over ? "text-red-700" : "text-slate-900"}`}>{t.avg == null ? "–" : t.avg.toFixed(1)}</span>
            <div className="relative flex w-full max-w-14 items-end" style={{ height: H }}>
              {t.avg != null && (
                <button
                  type="button"
                  onClick={() => onPick(t.stage)}
                  aria-label={`${t.label}: average ${t.avg.toFixed(1)} days against target ${t.target} days – open ${t.open} open claims`}
                  title={`${t.label} · avg ${t.avg.toFixed(1)} d · target ${t.target} d · ${t.open} open`}
                  className={`w-full rounded-t transition hover:opacity-85 ${over ? "bg-red-600" : "bg-teal-600"}`}
                  style={{ height: Math.max(3, (t.avg / max) * H) }}
                />
              )}
              <span className="pointer-events-none absolute -inset-x-1 h-0.5 bg-slate-900" style={{ bottom: (t.target / max) * H }} aria-hidden="true" />
            </div>
            <span className="max-w-full truncate text-[12px] text-slate-500" title={t.label}>
              {SHORT[t.stage]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// A number that opens its claims in My Work Queue; zero is shown plain
function Figure({ n, to, label, className = "", go }) {
  if (!n) return <span className={`tabular-nums text-slate-500 ${className}`}>{n === 0 ? "0" : "–"}</span>;
  return (
    <button type="button" onClick={() => go(to)} aria-label={`${label}: ${n} – open in My Work Queue`} className={`tabular-nums underline-offset-2 hover:text-teal-700 hover:underline ${className}`}>
      {n}
    </button>
  );
}

export default function HandlerPerformance() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = { reg: params.get("reg") || "", loss: params.get("loss") || "" };
  const [, setTick] = useState(0);
  const [asOf, setAsOf] = useState(timeNow);
  const [losses] = useState(lossTypes);
  const [views, setViews] = useState(readViews);
  const viewOf = (chart) => (VIEWS[chart].includes(views[chart]) ? views[chart] : VIEWS[chart][0]);
  const switcher = (chart, label) => (
    <ViewSwitch
      views={VIEWS[chart]}
      value={viewOf(chart)}
      label={label}
      onChange={(v) => {
        const next = { ...views, [chart]: v };
        setViews(next);
        saveViews(next);
      }}
    />
  );

  // recount when a claim changes elsewhere on the page (closing, reopening, settling)
  useEffect(() => {
    const refresh = () => {
      setTick((t) => t + 1);
      setAsOf(timeNow());
    };
    window.addEventListener(DATA_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(DATA_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const s = dashboardSummary(filters);
  const k = s.kpis;
  const go = (to) => navigate(to);
  const link = (extra, closed) => queueLink(s.filters, extra, closed);
  const setFilter = (key, value) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value) n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: true }
    );
  const filtered = filters.reg || filters.loss;
  const scope = [filters.reg && PERIOD_TEXT[filters.reg], filters.loss && filters.loss.toLowerCase()].filter(Boolean).join(" · ");

  const KPIS = [
    { label: "All claims", n: k.all, sub: `${k.open} open · ${k.closed} closed`, to: null },
    { label: "Open", n: k.open, sub: `${lakh(k.outstanding)} outstanding reserve`, to: link({}) },
    { label: "Closed", n: k.closed, sub: `${lakh(k.paid)} paid`, to: link({}, true) },
    { label: "SLA breached", n: k.breached, sub: "Open claims past stage TAT", to: link({ sla: "breach" }), tone: "text-red-700" },
    { label: "At risk", n: k.atRisk, sub: "Stage TAT ends within 24 h", to: link({ sla: "risk" }), tone: "text-amber-700" },
  ];
  // chart items – each carries the queue link it opens
  const ageItems = s.ageing.map((a, i) => ({ key: a.key, label: a.label, count: a.count, red: a.breached, color: AGE_COLOURS[i], to: link({ age: a.key }) }));
  const partyItems = s.pendingWith.map((p) => ({ key: p.party, label: p.party, count: p.count, color: PARTY_COLOURS[p.party] || "#64748b", to: link({ with: p.party }) }));
  const outcomeItems = s.closedByType.map((c) => ({ key: c.type, label: c.type, count: c.count, color: OUTCOME_COLOURS[c.type], to: link({ closure: c.type }, true) }));
  const pick = (i) => i.count && go(i.to);

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------- Filters ---------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <span id="f-reg" className="text-[12px] font-medium text-slate-600">Registered</span>
          <div role="radiogroup" aria-labelledby="f-reg" className="inline-flex max-w-full overflow-x-auto rounded-md border border-slate-200 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key || "all"}
                type="button"
                role="radio"
                aria-checked={filters.reg === p.key}
                onClick={() => setFilter("reg", p.key)}
                className={`h-7 whitespace-nowrap rounded px-2 text-[12.5px] font-medium sm:px-2.5 ${filters.reg === p.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-600">Loss type</span>
          <select
            value={filters.loss}
            onChange={(e) => setFilter("loss", e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12.5px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="">All</option>
            {losses.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        {filtered && (
          <button type="button" onClick={() => setParams({ view: "performance" }, { replace: true })} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal-700 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
        <p className="ml-auto text-[12px] text-slate-500">
          {filtered ? `Claims ${scope}` : "All claims assigned to me"} · as of {asOf}
        </p>
      </div>

      {/* ---------------- KPI strip ---------------- */}
      <div className="grid grid-cols-2 divide-slate-100 rounded-lg border border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {KPIS.map((c) => {
          const body = (
            <>
              <span className="block text-[12px] font-medium text-slate-500">{c.label}</span>
              <span className={`mt-0.5 block text-[24px] font-semibold leading-tight tabular-nums ${c.tone && c.n ? c.tone : "text-slate-900"}`}>{c.n}</span>
              <span className="block truncate text-[12px] text-slate-500">{c.sub}</span>
            </>
          );
          return c.to && c.n ? (
            <button key={c.label} type="button" onClick={() => go(c.to)} title="Open in My Work Queue" className="px-4 py-2.5 text-left transition hover:bg-slate-50">
              {body}
            </button>
          ) : (
            <div key={c.label} className="px-4 py-2.5">
              {body}
            </div>
          );
        })}
      </div>

      {/* ---------------- Ageing · Pending with · Closed by outcome ---------------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Ageing of open claims" sub="Days since registration" right={switcher("ageing", "Ageing")}>
          {viewOf("ageing") === "column" && <ColumnView items={ageItems.map((i) => ({ ...i, color: "#0d9488" }))} onPick={pick} />}
          {viewOf("ageing") === "bar" && <BarView items={ageItems.map((i) => ({ ...i, color: "#0d9488" }))} onPick={pick} />}
          {viewOf("ageing") === "pie" && <PieView items={ageItems} onPick={pick} unit="open" />}
          {viewOf("ageing") === "donut" && <PieView items={ageItems} donut onPick={pick} unit="open" />}
          {viewOf("ageing") === "column" && (
            <p className="mt-auto flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[12px] text-slate-500">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" /> Within SLA</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" /> SLA breached</span>
            </p>
          )}
        </Panel>

        <Panel title="Pending with" sub="Who the open claims are waiting on" right={switcher("pending", "Pending with")}>
          {partyItems.length === 0 && <p className="px-4 py-3 text-[12.5px] text-slate-500">No open claims.</p>}
          {partyItems.length > 0 && viewOf("pending") === "bar" && (
            <BarView items={partyItems.map((i) => ({ ...i, color: i.key === "Me (handler)" ? "#0d9488" : "#94a3b8" }))} highlight={(i) => i.key === "Me (handler)"} onPick={pick} />
          )}
          {partyItems.length > 0 && viewOf("pending") === "pie" && <PieView items={partyItems} onPick={pick} unit="open" />}
          {partyItems.length > 0 && viewOf("pending") === "donut" && <PieView items={partyItems} donut onPick={pick} unit="open" />}
        </Panel>

        <Panel title="Closed claims by outcome" sub={`${k.closed} closed · ${lakh(k.paid)} paid`} right={switcher("outcome", "Closed claims by outcome")}>
          {viewOf("outcome") === "donut" && <PieView items={outcomeItems} donut onPick={pick} unit="closed" />}
          {viewOf("outcome") === "bar" && <BarView items={outcomeItems} onPick={pick} />}
          {viewOf("outcome") === "table" && (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[12px] text-slate-500">
                <th scope="col" className="px-4 py-1.5 font-medium">Outcome</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Claims</th>
                <th scope="col" className="px-4 py-1.5 text-right font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {s.closedByType.map((c) => (
                <tr key={c.type} className="border-t border-slate-100">
                  <td className="px-4 py-1.5 text-slate-700">{c.type}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                    <Figure n={c.count} to={link({ closure: c.type }, true)} label={`Closed – ${c.type}`} go={go} />
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{c.paid ? lakh(c.paid) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </Panel>
      </div>

      {/* ---------------- IRDAI TAT · Stage-wise TAT ---------------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="IRDAI claim timelines" sub="Open claims">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[12px] text-slate-500">
                <th scope="col" className="px-4 py-1.5 font-medium">Milestone</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Open</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium" title="IRDAI limit ends within 24 hours">Due 24 h</th>
                <th scope="col" className="px-4 py-1.5 text-right font-medium">Breached</th>
              </tr>
            </thead>
            <tbody>
              {s.irdai.map((st) => (
                <tr key={st.key} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className="block font-medium text-slate-900">{st.label}</span>
                    <span className="block text-[12px] text-slate-500">{st.rule}</span>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-900">
                    <Figure n={st.total} to={link({ irdai: st.key })} label={`${st.label} – open`} go={go} />
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-amber-700">
                    <Figure n={st.due} to={link({ irdai: st.key, sla: "risk" })} label={`${st.label} – due within 24 h`} go={go} />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-red-700">
                    <Figure n={st.late} to={link({ irdai: st.key, sla: "breach" })} label={`${st.label} – breached`} go={go} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-auto border-t border-slate-100 px-4 py-2 text-[12px] leading-snug text-slate-500">
            Surveyor allocation (24 h of intimation) is met at registration, as claims are allocated to you as the surveyor. Timelines as per IRDAI Master Circular, June 2024.
          </p>
        </Panel>

        <Panel title="Stage-wise TAT" sub="Average days per stage against target" right={switcher("tat", "Stage-wise TAT")} className="lg:col-span-2">
          {viewOf("tat") === "column" && <TatColumns stages={s.stageTat} onPick={(st) => go(link({ stage: st }))} />}
          {viewOf("tat") === "table" && (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[12px] text-slate-500">
                <th scope="col" className="px-4 py-1.5 font-medium">Stage</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Open now</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Breached</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Avg TAT</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Target</th>
                <th scope="col" className="w-[30%] px-4 py-1.5 font-medium">
                  <span className="sr-only">Average against target</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* NBNR – notified, not yet registered: no stage TAT, counted so the column adds up to Open */}
              <tr className="border-t border-slate-100">
                <td className="px-4 py-1.5 text-slate-800">NBNR – awaiting registration</td>
                <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                  <Figure n={s.nbnr} to={link({ stage: "NBNR" })} label="NBNR – open" go={go} />
                </td>
                <td className="px-2 py-1.5 text-right font-semibold text-red-700">
                  <Figure n={s.nbnrBreached} to={link({ stage: "NBNR", sla: "breach" })} label="NBNR – breached" go={go} />
                </td>
                <td className="px-2 py-1.5 text-right text-slate-500">–</td>
                <td className="px-2 py-1.5 text-right text-slate-500">–</td>
                <td className="px-4 py-1.5 text-[12px] text-slate-500">Not registered – no stage TAT</td>
              </tr>
              {s.stageTat.map((t) => {
                const over = t.avg != null && t.avg > t.target;
                const scale = Math.max(t.target * 1.6, t.avg || 0);
                return (
                  <tr key={t.stage} className="border-t border-slate-100">
                    <td className="px-4 py-1.5 text-slate-800">{t.label}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                      <Figure n={t.open} to={link({ stage: t.stage })} label={`${t.label} – open`} go={go} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-red-700">
                      <Figure n={t.breached} to={link({ stage: t.stage, sla: "breach" })} label={`${t.label} – breached`} go={go} />
                    </td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${over ? "text-red-700" : "text-slate-900"}`} title={t.samples ? `Based on ${t.samples} claims` : "No completed claims in this filter"}>
                      {days(t.avg)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{days(t.target)}</td>
                    <td className="px-4 py-1.5">
                      {t.avg != null ? (
                        <span className="relative block h-2 rounded-sm bg-slate-100" aria-hidden="true">
                          <span className={`absolute inset-y-0 left-0 rounded-sm ${over ? "bg-red-600" : "bg-teal-600"}`} style={{ width: `${(t.avg / scale) * 100}%` }} />
                          <span className="absolute -inset-y-1 w-0.5 bg-slate-900" style={{ left: `${(t.target / scale) * 100}%` }} />
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-500">No completed claims</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          <p className="mt-auto flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[12px] text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" /> Within target</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" /> Over target</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-0.5 bg-slate-900" aria-hidden="true" /> Target</span>
            <span className="ml-auto">Average of completed stages · open claims count where they are now</span>
          </p>
        </Panel>
      </div>
    </div>
  );
}