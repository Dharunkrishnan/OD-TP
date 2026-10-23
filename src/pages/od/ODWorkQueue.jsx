// src/pages/od/ODWorkQueue.jsx
// P05 · My Work Queue (persona: OD Claims Handler – Karthik Subramanian · OD0123)
// Full list of open claims assigned to me + Today's diary + Alerts.
// Catalogue refs: Workqueue 159–164, SLA / TAT 165–170, Followup 158, Search 178–181
//
// URL filter: /od/worklist?tab=due | breach | risk | docs | nbnr   (used by dashboard links)

import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  TrendingUp,
  Info,
  Circle,
  CheckCircle,
  Plus,
  X,
  FilterX,
  Inbox,
  FileText,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import SearchPopover from "../../components/SearchPopover";
import { searchClaims, dueTodayClaims, slaTone } from "../../data/searchIndex";
import { WORK_QUEUE, DIARY, ALERTS } from "../../data/odHandlerMock";
import { claimSlug } from "../../data/odClaimDetail";

const PAGE_SIZE = 10;
const SLA_RANK = { breach: 0, risk: 1, ok: 2 };

const TABS = [
  { key: "all", label: "All open", test: () => true },
  { key: "due", label: "Due today", test: (r) => r.dueToday },
  { key: "breach", label: "SLA breached", test: (r) => r.sla.status === "breach" },
  { key: "risk", label: "At risk", test: (r) => r.sla.status === "risk" },
  { key: "docs", label: "Docs pending", test: (r) => r.stage === "Documents pending" },
  { key: "nbnr", label: "NBNR", test: (r) => r.stage === "NBNR" },
];

const SORTS = [
  { key: "priority", label: "Priority" },
  { key: "oldest", label: "Oldest first" },
  { key: "newest", label: "Newest first" },
  { key: "reserve", label: "Highest reserve" },
];

const uniq = (key) => [...new Set(WORK_QUEUE.map((r) => r[key]))].sort();
const STAGES = [
  "NBNR",
  "Registered",
  "Survey pending",
  "Assessment",
  "Documents pending",
  "Approval",
  "Repair / DO",
  "Payment",
].filter((s) => WORK_QUEUE.some((r) => r.stage === s));
const PENDING = uniq("pendingWith");
const LOSSES = uniq("lossType");

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/* ------------------------------------------------------------------ */
/* Small blocks                                                        */
/* ------------------------------------------------------------------ */
function Card({ title, note, action, children, className = "" }) {
  return (
    <section className={`flex flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex min-h-9 flex-none flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-0.5">
        <h2 className="truncate text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
        {action ?? (note && <span className="text-[11px] text-slate-500">{note}</span>)}
      </div>
      {children}
    </section>
  );
}

function SlaChip({ sla }) {
  const map = {
    breach: { cls: "bg-red-50 text-red-800 ring-red-200", Icon: AlertTriangle },
    risk: { cls: "bg-amber-50 text-amber-900 ring-amber-200", Icon: Clock },
    ok: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  };
  const { cls, Icon } = map[sla.status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-semibold leading-[18px] ring-1 ring-inset ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {sla.label}
    </span>
  );
}

function FlagChip({ text }) {
  const strong = text === "Fraud flag";
  return (
    <span
      className={`whitespace-nowrap rounded px-1 text-[10px] font-semibold leading-4 ${
        strong ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"
      }`}
    >
      {text}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <label className="flex min-w-0 flex-col" title={label}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 w-full rounded border bg-white py-0 pl-2 pr-7 text-[12px] hover:border-teal-600 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15 ${
          value && allLabel ? "border-teal-600 font-medium text-teal-900" : "border-slate-300 text-slate-800"
        }`}
        
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.key ?? o} value={o.key ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function ODWorkQueue() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const openClaim = (claimNo) => navigate(`/od/claims/${claimSlug(claimNo)}`);
  const initialTab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all";

  const [tab, setTabState] = useState(initialTab);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [pending, setPending] = useState("");
  const [loss, setLoss] = useState("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");

  const [diary, setDiary] = useState(DIARY);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ time: "17:00", claimNo: "", text: "" });

  function setTab(t) {
    setTabState(t);
    setPage(1);
    const next = new URLSearchParams(params);
    if (t === "all") next.delete("tab");
    else next.set("tab", t);
    setParams(next, { replace: true });
  }

  function notBuilt(what) {
    setToast(`${what} – this page comes in a later build step.`);
    window.clearTimeout(notBuilt.t);
    notBuilt.t = window.setTimeout(() => setToast(""), 2600);
  }

  // Tab counts are always on the full queue
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, WORK_QUEUE.filter(t.test).length])),
    []
  );

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    const term = q.trim().toLowerCase();
    const list = WORK_QUEUE.filter(
      (r) =>
        t.test(r) &&
        (!stage || r.stage === stage) &&
        (!pending || r.pendingWith === pending) &&
        (!loss || r.lossType === loss) &&
        (!term ||
          r.claimNo.toLowerCase().includes(term) ||
          r.regNo.toLowerCase().replace(/\s/g, "").includes(term.replace(/\s/g, "")) ||
          r.insured.toLowerCase().includes(term) ||
          r.vehicle.toLowerCase().includes(term))
    );
    const by = {
      priority: (a, b) => SLA_RANK[a.sla.status] - SLA_RANK[b.sla.status] || b.ageDays - a.ageDays,
      oldest: (a, b) => b.ageDays - a.ageDays,
      newest: (a, b) => a.ageDays - b.ageDays,
      reserve: (a, b) => b.reserve - a.reserve,
    }[sort];
    return [...list].sort(by);
  }, [tab, q, stage, pending, loss, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const rows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const anyFilter = q || stage || pending || loss;

  function applySearch(text) {
    setQ(text);
    setPage(1);
  }

  // Suggestions for the queue search panel
  function queueSuggest(text) {
    const claimItem = (r) => ({
      id: r.claimNo,
      icon: FileText,
      title: `${r.claimNo} · ${r.regNo}`,
      subtitle: `${r.insured} · ${r.stage}`,
      meta: r.sla.label,
      metaTone: slaTone(r.sla.status),
      onSelect: () => openClaim(r.claimNo),
    });
    if (!text) return [{ group: "Due today", items: dueTodayClaims().map(claimItem) }];
    const hits = searchClaims(text, 8);
    return [
      {
        group: "Filter",
        items: [
          {
            id: "filter",
            icon: Search,
            title: `Show all claims matching “${text}”`,
            subtitle: `${hits.length ? `${hits.length}${hits.length === 8 ? "+" : ""} ${hits.length === 1 ? "match" : "matches"}` : "No match"} in your queue`,
            onSelect: () => applySearch(text),
          },
        ],
      },
      { group: "Open a claim", items: hits.map(claimItem) },
    ];
  }

  function clearFilters() {
    setQ("");
    setStage("");
    setPending("");
    setLoss("");
    setPage(1);
  }

  function addDiary(e) {
    e.preventDefault();
    if (!newItem.claimNo || !newItem.text.trim()) return;
    setDiary((list) =>
      [...list, { ...newItem, text: newItem.text.trim(), done: false }].sort((a, b) => a.time.localeCompare(b.time))
    );
    setNewItem({ time: "17:00", claimNo: "", text: "" });
    setAdding(false);
  }

  const diaryLeft = diary.filter((d) => !d.done).length;

  return (
    <ODShell
      active="queue"
      title="My Work Queue"
      subtitle={`${WORK_QUEUE.length} open claims assigned to me · priority order`}
      onNavigateMissing={notBuilt}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_290px]">
        {/* ================= Queue ================= */}
        <Card title="Claims" note={`Showing ${filtered.length} of ${WORK_QUEUE.length}`}>
          {/* Quick filter tabs */}
          <div role="tablist" aria-label="Quick filters" className="flex flex-wrap gap-1 border-b border-slate-100 px-2.5 py-1.5">
            {TABS.map((t) => {
              const on = tab === t.key;
              const danger = t.key === "breach";
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`flex h-7 items-center gap-1.5 rounded px-2 text-[12px] font-medium transition ${
                    on ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded px-1.5 text-[10.5px] font-semibold ${
                      on ? "bg-white/15 text-white" : danger ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5 sm:grid-cols-3 lg:grid-cols-[minmax(90px,auto)_repeat(4,minmax(0,1fr))_auto]">
            {/* Search – icon only; opens suggestions */}
            <div className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-3 lg:col-span-1">
              <SearchPopover
                size="sm"
                align="left"
                label="Search my queue"
                placeholder="Claim no, vehicle no or insured name"
                suggest={queueSuggest}
                onSubmit={applySearch}
                submitLabel="to filter the queue"
                active={q}
              />
              {q ? (
                <span className="flex h-7 min-w-0 items-center gap-1 rounded bg-teal-50 pl-2 pr-1 text-[12px] font-medium text-teal-800">
                  <span className="truncate">“{q}”</span>
                  <button type="button" onClick={() => applySearch("")} aria-label="Remove search filter" className="grid h-5 w-5 flex-none place-items-center rounded hover:bg-teal-100">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <span className="hidden text-[11.5px] text-slate-400 xl:inline">Search</span>
              )}
            </div>
            <FilterSelect label="Stage" value={stage} onChange={(v) => { setStage(v); setPage(1); }} options={STAGES} allLabel="All stages" />
            <FilterSelect label="Pending with" value={pending} onChange={(v) => { setPending(v); setPage(1); }} options={PENDING} allLabel="Anyone" />
            <FilterSelect label="Loss type" value={loss} onChange={(v) => { setLoss(v); setPage(1); }} options={LOSSES} allLabel="All types" />
            <FilterSelect label="Sort by" value={sort} onChange={setSort} options={SORTS.map((o) => ({ ...o, label: `Sort: ${o.label}` }))} />
            <button
              type="button"
              onClick={clearFilters}
              disabled={!anyFilter}
              className="flex h-7 items-center justify-center gap-1 rounded border border-slate-300 px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>

          {/* Table */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[780px] table-fixed text-left text-[12px]">
              <thead>
                <tr className="whitespace-nowrap bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="w-[22%] px-3 py-1.5 font-semibold">Claim / vehicle</th>
                  <th scope="col" className="w-[15%] px-2 py-1.5 font-semibold">Insured / loss</th>
                  <th scope="col" className="w-[15%] px-2 py-1.5 font-semibold">Stage / pending</th>
                  <th scope="col" className="w-[6%] px-2 py-1.5 text-right font-semibold">Age</th>
                  <th scope="col" className="w-[12%] px-2 py-1.5 font-semibold">SLA</th>
                  <th scope="col" className="w-[9%] px-2 py-1.5 text-right font-semibold">Reserve</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Next action</th>
                  <th scope="col" className="w-7 px-1 py-1.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.claimNo}
                    onClick={() => openClaim(r.claimNo)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/40"
                  >
                    <td className="px-3 py-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openClaim(r.claimNo);
                          }}
                          className="font-mono text-[12px] font-semibold text-teal-800 hover:underline"
                        >
                          {r.claimNo}
                        </button>
                        {r.flags.map((f) => (
                          <FlagChip key={f} text={f} />
                        ))}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {r.regNo} · {r.vehicle}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="truncate text-slate-800">{r.insured}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        <span title={`Loss date ${fmtDate(r.lossDate)}`}>{r.lossType}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="truncate font-medium text-slate-800">{r.stage}</div>
                      <div className="truncate text-[11px] text-slate-500" title={`Pending with ${r.pendingWith}`}>with {r.pendingWith}</div>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.ageDays} d</td>
                    <td className="px-2 py-1">
                      <SlaChip sla={r.sla} />
                      {r.dueToday && (
                        <span className="mt-0.5 block text-[10.5px] font-semibold leading-none text-teal-800">Due today</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-700">{inr(r.reserve)}</td>
                    <td className="px-2 py-1 text-slate-700" title={r.nextAction}>
                      {r.nextAction}
                    </td>
                    <td className="px-1 py-1 text-slate-400">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700">No claims match these filters</p>
                <button type="button" onClick={clearFilters} className="text-[12px] font-medium text-teal-700 hover:underline">
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 text-[11.5px] text-slate-500">
            <span>
              {filtered.length === 0
                ? "0 claims"
                : `${(curPage - 1) * PAGE_SIZE + 1}–${Math.min(curPage * PAGE_SIZE, filtered.length)} of ${filtered.length} claims`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={curPage === 1}
                aria-label="Previous page"
                className="grid h-7 w-7 place-items-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === curPage ? "page" : undefined}
                  className={`h-7 min-w-7 rounded px-2 text-[12px] font-medium ${
                    n === curPage ? "bg-[#0B1F3A] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={curPage === pages}
                aria-label="Next page"
                className="grid h-7 w-7 place-items-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* ================= Right panel ================= */}
        <div className="flex flex-col gap-2">
          <Card
            title="Today's diary"
            action={
              <span className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  {diaryLeft} of {diary.length} open
                </span>
                <button
                  type="button"
                  onClick={() => setAdding((v) => !v)}
                  aria-expanded={adding}
                  className="flex h-6 items-center gap-1 rounded border border-slate-300 px-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  {adding ? <X className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                  {adding ? "Cancel" : "Add"}
                </button>
              </span>
            }
          >
            {adding && (
              <form onSubmit={addDiary} className="flex flex-col gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-1.5">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] text-slate-500">Time</span>
                    <input
                      type="time"
                      value={newItem.time}
                      onChange={(e) => setNewItem((n) => ({ ...n, time: e.target.value }))}
                      className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[12px]"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10.5px] text-slate-500">Claim</span>
                    <select
                      value={newItem.claimNo}
                      onChange={(e) => setNewItem((n) => ({ ...n, claimNo: e.target.value }))}
                      className="h-7 rounded border border-slate-300 bg-white py-0 pl-1.5 pr-6 font-mono text-[11.5px]"
                      required
                    >
                      <option value="">Select claim</option>
                      {WORK_QUEUE.map((r) => (
                        <option key={r.claimNo} value={r.claimNo}>
                          {r.claimNo}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] text-slate-500">Follow-up</span>
                  <input
                    type="text"
                    value={newItem.text}
                    onChange={(e) => setNewItem((n) => ({ ...n, text: e.target.value }))}
                    placeholder="e.g. Call surveyor for report"
                    className="h-7 rounded border border-slate-300 bg-white px-2 text-[12px]"
                    required
                  />
                </label>
                <button type="submit" className="h-7 rounded bg-teal-700 text-[12px] font-semibold text-white hover:bg-teal-800">
                  Add to diary
                </button>
              </form>
            )}
            <ul className="flex flex-col px-1.5 py-1">
              {diary.map((d, idx) => (
                <li key={d.time + d.claimNo + idx}>
                  <button
                    type="button"
                    onClick={() => setDiary((list) => list.map((x, j) => (j === idx ? { ...x, done: !x.done } : x)))}
                    aria-pressed={d.done}
                    className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-slate-50"
                  >
                    {d.done ? (
                      <CheckCircle className="mt-px h-3.5 w-3.5 flex-none text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Circle className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[12px] leading-tight ${d.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {d.text}
                      </span>
                      <span className="block font-mono text-[10.5px] text-slate-500">{d.claimNo}</span>
                    </span>
                    <span className="flex-none text-[11px] font-semibold tabular-nums text-slate-600">{d.time}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Alerts" note={`${ALERTS.length} new`}>
            <ul className="flex flex-col px-1.5 py-1">
              {ALERTS.map((a) => {
                const s = {
                  critical: { Icon: ShieldAlert, cls: "text-red-700 bg-red-50" },
                  warning: { Icon: TrendingUp, cls: "text-amber-800 bg-amber-50" },
                  info: { Icon: Info, cls: "text-sky-800 bg-sky-50" },
                }[a.severity];
                const claim = a.text.split(" ")[0];
                return (
                  <li key={a.title + a.text}>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("all");
                        setQ(claim);
                        setPage(1);
                      }}
                      title="Show this claim in the queue"
                      className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-slate-50"
                    >
                      <span className={`grid h-6 w-6 flex-none place-items-center rounded ${s.cls}`}>
                        <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[12px] font-semibold text-slate-800">{a.title}</span>
                          <span className="flex-none text-[10.5px] text-slate-500">{a.time}</span>
                        </span>
                        <span className="block text-[11px] leading-snug text-slate-600">{a.text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
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