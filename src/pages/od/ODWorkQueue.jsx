// src/pages/od/ODWorkQueue.jsx
// P05 · My Work Queue (persona: OD Claims Handler – Karthik Subramanian · OD0123)
// Full list of open claims assigned to me – one value per column, full width.
// Today's diary and Alerts open from buttons in the card header as a side drawer.
// Catalogue refs: Workqueue 159–164, SLA / TAT 165–170, Followup 158, Search 178–181
//
// URL filter: /od/worklist?tab=due | breach | risk | docs | nbnr   (used by dashboard links)

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
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
  CalendarClock,
  Bell,
  Columns3,
  ChevronDown,
  Layers,
  UserRound,
  Car,
  ArrowUpDown,
  Check,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { WORK_QUEUE, DIARY, ALERTS } from "../../data/odHandlerMock";
import { claimSlug } from "../../data/odClaimDetail";

const PAGE_SIZE = 15;
const SLA_RANK = { breach: 0, risk: 1, ok: 2 };

const TABS = [
  { key: "all", label: "All open", test: () => true },
  { key: "due", label: "Due today", test: (r) => dueInfo(r).label === "Today" }, // same rule as the Due column
  { key: "breach", label: "SLA breached", test: (r) => r.sla.status === "breach" },
  { key: "risk", label: "At risk", test: (r) => r.sla.status === "risk" },
  { key: "docs", label: "Docs pending", test: (r) => r.stage === "Documents pending" },
  { key: "nbnr", label: "NBNR", test: (r) => r.stage === "NBNR" },
];

// Count badge colours on the quick-filter tabs
const TAB_TONE = {
  due: "bg-amber-100 text-amber-900",
  breach: "bg-red-100 text-red-700",
  risk: "bg-amber-100 text-amber-900",
  docs: "bg-sky-100 text-sky-800",
  nbnr: "bg-violet-100 text-violet-800",
};

// Stage dot colours (by type of work)
const STAGE_DOT = {
  NBNR: "bg-violet-500",
  Registered: "bg-slate-400",
  "Survey pending": "bg-sky-500",
  Assessment: "bg-indigo-500",
  "Documents pending": "bg-amber-500",
  Approval: "bg-orange-500",
  "Repair / DO": "bg-teal-500",
  Payment: "bg-emerald-500",
};
// Row priority stripe (left edge) by SLA status
const SLA_STRIPE = { breach: "shadow-[inset_3px_0_0_#dc2626]", risk: "shadow-[inset_3px_0_0_#f59e0b]", ok: "shadow-[inset_3px_0_0_#10b981]" };

const SORTS = [
  { key: "priority", label: "Priority" },
  { key: "due", label: "Due date" },
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

const lakh = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : "₹" + Number(n).toLocaleString("en-IN"));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => `${iso.slice(8, 10)} ${MON[Number(iso.slice(5, 7)) - 1]}`;

/* Table columns – most-used first.
   min = narrowest the column may get. Columns are shown in this order only while they fit at
   their min width; the rest move out automatically (never squeezed, no sideways scroll) and come
   back when there is room. w = share of the spare width. The user can also hide columns. */
const COLUMNS = [
  { key: "claimNo", label: "Claim no", w: 164, min: 158, fixed: true },
  { key: "regNo", label: "Vehicle no", w: 110, min: 110 },
  { key: "insured", label: "Insured", w: 118, min: 116 },
  { key: "stage", label: "Stage", w: 140, min: 140 },
  { key: "pendingWith", label: "Pending with", w: 122, min: 114 },
  { key: "sla", label: "SLA", w: 118, min: 114 },
  { key: "due", label: "Due", w: 82, min: 80 },
  { key: "regDate", label: "Registered date", w: 114, min: 112 },
  { key: "age", label: "Age", w: 46, min: 46, right: true },
  { key: "reserve", label: "Reserve", w: 84, min: 80, right: true },
  { key: "nextAction", label: "Next action", w: 260, min: 150 },
  { key: "vehicle", label: "Make / model", w: 170, min: 150 },
  { key: "lossType", label: "Loss type", w: 120, min: 120 },
  { key: "lossDate", label: "Loss date", w: 74, min: 74 },
];
const COLS_KEY = "smartclaims-wq-hidden-cols-v3";

/* Follow-up due date for each claim, worked out from the SLA time left (relative to today's real date).
   In production this comes from the diary / task due date on the claim. */
const DAY = 86400000;
const todayLocal = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
function dueInfo(r) {
  const t0 = todayLocal();
  if (r.sla.status === "breach") return { label: "Overdue", tone: "red", at: t0.getTime() - DAY };
  if (r.dueToday) return { label: "Today", tone: "amber", at: t0.getTime() };
  const days = /(\d+) d left/.exec(r.sla.label);
  const hours = /(\d+) h left/.exec(r.sla.label);
  let offset;
  if (days) offset = Number(days[1]);
  else {
    // "x h left": the actual deadline time decides today or tomorrow
    const deadline = new Date(Date.now() + Number(hours?.[1] || 24) * 3600000);
    offset = Math.round((new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()) - t0) / DAY);
    if (offset <= 0) return { label: "Today", tone: "amber", at: t0.getTime() };
  }
  const at = new Date(t0.getTime() + offset * DAY);
  if (offset === 1) return { label: "Tomorrow", tone: "slate", at: at.getTime() };
  return { label: `${String(at.getDate()).padStart(2, "0")} ${MON[at.getMonth()]}`, tone: "plain", at: at.getTime() };
}
const DUE_TONE = {
  red: "bg-red-50 text-red-800 ring-red-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

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

// Compact flag icon next to the claim no (full text on hover / screen reader)
function FlagDot({ text }) {
  const fraud = text === "Fraud flag";
  const Icon = fraud ? ShieldAlert : TrendingUp;
  return (
    <span title={text} className={`grid h-4 w-4 flex-none place-items-center rounded ${fraud ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800"}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

// Pill-style filter: "Label: value ▾". Teal when set, with its own × to clear.
// Opens a styled menu (✓ on the current choice, claim count per option, ↑ ↓ Enter Esc).
function FilterPill({ label, icon: Icon, value, onChange, options, allLabel, showClear = true, counts, align = "left" }) {
  const opts = [
    ...(allLabel ? [{ key: "", label: allLabel }] : []),
    ...options.map((o) => ({ key: o.key ?? o, label: o.label ?? o })),
  ];
  const current = opts.find((o) => o.key === value);
  const on = Boolean(value) && Boolean(allLabel);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    setHi(Math.max(0, opts.findIndex((o) => o.key === value)));
    setOpen(true);
  }
  function pick(o) {
    onChange(o.key);
    setOpen(false);
  }
  function onKey(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
    } else if (open && e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, opts.length - 1));
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      pick(opts[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className="relative flex-none">
      <div
        className={`flex h-8 items-center rounded-full border text-[12px] transition ${
          on ? "border-teal-600 bg-teal-50 text-teal-900" : open ? "border-slate-400 bg-white text-slate-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
        }`}
      >
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKey}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label}: ${current ? current.label : allLabel}`}
          className="flex h-full items-center gap-1.5 rounded-full pl-3 pr-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/15"
        >
          {Icon && <Icon className={`h-3.5 w-3.5 flex-none ${on ? "text-teal-700" : "text-slate-400"}`} aria-hidden="true" />}
          <span className={on ? "text-teal-700" : "text-slate-500"}>{label}:</span>
          <span className="max-w-[150px] truncate font-semibold">{current ? current.label : allLabel}</span>
          <ChevronDown className={`h-3.5 w-3.5 flex-none transition ${open ? "rotate-180" : ""} ${on ? "text-teal-700" : "text-slate-400"}`} aria-hidden="true" />
        </button>
        {on && showClear && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label} filter`}
            className="mr-1 grid h-6 w-6 place-items-center rounded-full text-teal-700 hover:bg-teal-100"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute top-full z-30 mt-1.5 max-h-[300px] min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {opts.map((o, i) => {
            const sel = o.key === value;
            const n = counts ? (o.key === "" ? counts.__all : counts[o.key] || 0) : null;
            return (
              <li
                key={o.key || "__all"}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg py-1.5 pl-2 pr-2.5 text-[12.5px] ${
                  hi === i ? "bg-slate-100" : ""
                } ${sel ? "font-semibold text-teal-900" : "text-slate-700"} ${o.key === "" && opts.length > 1 ? "mb-0.5" : ""}`}
              >
                <Check className={`h-3.5 w-3.5 flex-none ${sel ? "text-teal-700" : "text-transparent"}`} aria-hidden="true" />
                <span className="flex-1">{o.label}</span>
                {n !== null && (
                  <span className={`min-w-6 rounded-full px-1.5 text-center text-[10.5px] font-semibold leading-[18px] ${sel ? "bg-teal-700 text-white" : n ? "bg-slate-100 text-slate-600" : "text-slate-300"}`}>
                    {n}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
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

  const [drawer, setDrawer] = useState(null); // null | "diary" | "alerts"
  const [colsOpen, setColsOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      const saved = localStorage.getItem(COLS_KEY);
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });
  const wanted = COLUMNS.filter((c) => !hidden.includes(c.key));
  // Fit columns to the table width (measured live)
  const tableBox = useRef(null);
  const [boxW, setBoxW] = useState(() => Math.max(320, window.innerWidth - 24));
  useEffect(() => {
    const el = tableBox.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = [];
  const noRoom = [];
  let usedMin = 0;
  for (const c of wanted) {
    if (noRoom.length === 0 && (c.fixed || usedMin + c.min <= boxW)) {
      cols.push(c);
      usedMin += c.min;
    } else noRoom.push(c.key);
  }
  // Every column gets its minimum; spare width → half to Next action, rest shared by size
  const spare = Math.max(0, boxW - usedMin);
  const hasNext = cols.some((c) => c.key === "nextAction");
  const otherMin = cols.reduce((t, c) => t + (c.key === "nextAction" ? 0 : c.min), 0) || 1;
  const colWidth = (c) =>
    c.min + (c.key === "nextAction" ? spare / 2 : (spare * (hasNext ? 0.5 : 1) * c.min) / otherMin);
  function toggleCol(key) {
    setHidden((h) => {
      const next = h.includes(key) ? h.filter((k) => k !== key) : [...h, key];
      try {
        localStorage.setItem(COLS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
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
      due: (a, b) => dueInfo(a).at - dueInfo(b).at || SLA_RANK[a.sla.status] - SLA_RANK[b.sla.status],
    }[sort];
    return [...list].sort(by);
  }, [tab, q, stage, pending, loss, sort]);

  // Claim counts shown in each filter menu: what you would get by picking that option
  const optionCounts = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    const term = q.trim().toLowerCase();
    const base = WORK_QUEUE.filter(
      (r) =>
        t.test(r) &&
        (!term ||
          r.claimNo.toLowerCase().includes(term) ||
          r.regNo.toLowerCase().replace(/\s/g, "").includes(term.replace(/\s/g, "")) ||
          r.insured.toLowerCase().includes(term) ||
          r.vehicle.toLowerCase().includes(term))
    );
    const countBy = (field, keep) => {
      const rows = base.filter(keep);
      const m = { __all: rows.length };
      rows.forEach((r) => (m[r[field]] = (m[r[field]] || 0) + 1));
      return m;
    };
    return {
      stage: countBy("stage", (r) => (!pending || r.pendingWith === pending) && (!loss || r.lossType === loss)),
      pending: countBy("pendingWith", (r) => (!stage || r.stage === stage) && (!loss || r.lossType === loss)),
      loss: countBy("lossType", (r) => (!stage || r.stage === stage) && (!pending || r.pendingWith === pending)),
    };
  }, [tab, q, stage, pending, loss]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const rows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const anyFilter = q || stage || pending || loss;

  function applySearch(text) {
    setQ(text);
    setPage(1);
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

  // What each column shows – one value per cell
  function cell(key, r) {
    switch (key) {
      case "claimNo":
        return (
          <span className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openClaim(r.claimNo);
              }}
              className="whitespace-nowrap font-mono text-[12px] font-semibold text-teal-800 hover:underline"
            >
              {r.claimNo}
            </button>
            {r.flags.map((f) => (
              <FlagDot key={f} text={f} />
            ))}
          </span>
        );
      case "regNo":
        return <span className="tabular-nums text-slate-700">{r.regNo}</span>;
      case "stage":
        return (
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-800">
            <span className={`h-1.5 w-1.5 flex-none rounded-full ${STAGE_DOT[r.stage] || "bg-slate-400"}`} aria-hidden="true" />
            <span className="truncate">{r.stage}</span>
          </span>
        );
      case "sla":
        return <SlaChip sla={r.sla} />;
      case "due": {
        const d = dueInfo(r);
        return d.tone === "plain" ? (
          <span className="tabular-nums text-slate-700">{d.label}</span>
        ) : (
          <span className={`rounded px-1.5 text-[11px] font-semibold leading-[18px] ring-1 ring-inset ${DUE_TONE[d.tone]}`}>{d.label}</span>
        );
      }
      case "age":
        return <span className="text-slate-700">{r.ageDays} d</span>;
      case "reserve":
        return <span className="text-slate-700">{inr(r.reserve)}</span>;
      case "lossDate":
        return <span className="tabular-nums text-slate-600">{fmtDate(r.lossDate)}</span>;
      case "regDate":
        return <span className="tabular-nums text-slate-700">{fmtDate(r.regDate)} {r.regDate.slice(0, 4)}</span>;
      default:
        return <span className="text-slate-700">{r[key]}</span>;
    }
  }

  // Esc closes the drawer
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => e.key === "Escape" && setDrawer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <ODShell
      active="queue"
      title="My Work Queue"
      subtitle={`${WORK_QUEUE.length} open claims assigned to me · priority order`}
      onNavigateMissing={notBuilt}
    >
      <div className="flex flex-col gap-2">
        {/* ================= Queue (full width) ================= */}
        <Card
          title="Claims"
          action={
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500">
                Showing <b className="font-semibold text-slate-700">{filtered.length}</b> of {WORK_QUEUE.length}
                <span className="mx-1.5 text-slate-300">·</span>
                Reserve <b className="font-semibold text-slate-700">{lakh(filtered.reduce((t, r) => t + r.reserve, 0))}</b>
              </span>
              <button
                type="button"
                onClick={() => setDrawer("diary")}
                aria-expanded={drawer === "diary"}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold ${
                  drawer === "diary" ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                Today's diary
                <span className="rounded bg-teal-700 px-1.5 text-[10.5px] text-white">{diaryLeft}</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawer("alerts")}
                aria-expanded={drawer === "alerts"}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold ${
                  drawer === "alerts" ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                Alerts
                <span className="rounded bg-red-600 px-1.5 text-[10.5px] text-white">{ALERTS.length}</span>
              </button>
            </span>
          }
        >
          {/* Quick filter tabs */}
          <div role="tablist" aria-label="Quick filters" className="flex flex-wrap gap-x-1 border-b border-slate-200 px-2.5">
            {TABS.map((t) => {
              const on = tab === t.key;
              const tone = TAB_TONE[t.key] || "bg-slate-100 text-slate-600";
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[12.5px] font-semibold transition ${
                    on ? "border-teal-700 text-teal-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-[10.5px] font-bold leading-[18px] ${on ? "bg-teal-700 text-white" : tone}`}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters – pill style */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-2.5 py-2">
            {/* Text filter chip – set when an alert is clicked (search itself is in the header) */}
            {q && (
              <span className="flex h-8 min-w-0 items-center gap-1 rounded-full border border-teal-600 bg-teal-50 pl-3 pr-1 text-[12px] font-semibold text-teal-900">
                <span className="truncate">“{q}”</span>
                <button type="button" onClick={() => applySearch("")} aria-label="Remove search filter" className="grid h-6 w-6 flex-none place-items-center rounded-full text-teal-700 hover:bg-teal-100">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
            <FilterPill label="Stage" icon={Layers} value={stage} onChange={(v) => { setStage(v); setPage(1); }} options={STAGES} allLabel="All" counts={optionCounts.stage} />
            <FilterPill label="Pending with" icon={UserRound} value={pending} onChange={(v) => { setPending(v); setPage(1); }} options={PENDING} allLabel="Anyone" counts={optionCounts.pending} />
            <FilterPill label="Loss type" icon={Car} value={loss} onChange={(v) => { setLoss(v); setPage(1); }} options={LOSSES} allLabel="All" counts={optionCounts.loss} />
            {anyFilter && (
              <button type="button" onClick={clearFilters} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-teal-700 hover:bg-teal-50">
                <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                Clear all
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <FilterPill
                label="Sort"
                icon={ArrowUpDown}
                value={sort}
                onChange={(v) => setSort(v || "priority")}
                options={SORTS}
                showClear={false}
                align="right"
              />
            <div className="relative">
              <button
                type="button"
                onClick={() => setColsOpen((v) => !v)}
                aria-expanded={colsOpen}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold ${
                  hidden.length ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                Columns{hidden.length ? ` (${COLUMNS.length - hidden.length})` : ""}
              </button>
              {colsOpen && (
                <>
                  <button type="button" aria-label="Close columns menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setColsOpen(false)} />
                  <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <p className="px-3 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Show columns</p>
                    {COLUMNS.map((c) => (
                      <label key={c.key} className={`flex items-center gap-2 px-3 py-1 text-[12.5px] ${c.fixed ? "text-slate-400" : "cursor-pointer text-slate-700 hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={!hidden.includes(c.key)} disabled={c.fixed} onChange={() => toggleCol(c.key)} className="h-3.5 w-3.5 accent-teal-700" />
                        <span className="flex-1">{c.title || c.label}</span>
                        {noRoom.includes(c.key) && <span className="text-[10.5px] text-amber-700">no room</span>}
                      </label>
                    ))}
                    {noRoom.length > 0 && (
                      <p className="border-t border-slate-100 px-3 pb-1 pt-1.5 text-[11px] leading-snug text-slate-500">
                        “No room” columns appear when the screen is wider, or when you untick other columns.
                      </p>
                    )}
                    {hidden.length > 0 && (
                      <button type="button" onClick={() => { setHidden([]); try { localStorage.removeItem(COLS_KEY); } catch { /* ignore */ } }} className="mt-1 w-full border-t border-slate-100 px-3 pt-1.5 text-left text-[12px] font-medium text-teal-700 hover:underline">
                        Show all columns
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            </div>
          </div>

          {/* Table – one value per column; claim no stays visible when scrolling sideways */}
          <div ref={tableBox} className="relative overflow-hidden">
            {/* Columns that fit (see COLUMNS); each gets its share of the width */}
            <table className="w-full table-fixed text-left text-[12px]">
              <colgroup>
                {cols.map((c) => (
                  <col key={c.key} style={{ width: `${((colWidth(c) / Math.max(boxW, usedMin)) * 100).toFixed(3)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="whitespace-nowrap bg-slate-50 text-[10.5px] uppercase tracking-normal text-slate-500">
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      title={c.title}
                      className={`py-2 align-bottom font-semibold leading-tight ${c.fixed ? "bg-slate-50 pl-3 pr-1.5" : "px-1.5"} ${c.right ? "text-right" : ""} ${
                        "truncate"
                      }`}
                    >
                      {Array.isArray(c.label) ? c.label.map((l) => <span key={l} className="block">{l}</span>) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.claimNo}
                    onClick={() => openClaim(r.claimNo)}
                    className="group cursor-pointer whitespace-nowrap border-t border-slate-100 hover:bg-teal-50/60"
                  >
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        title={["vehicle", "insured", "lossType", "stage", "pendingWith", "nextAction"].includes(c.key) ? String(r[c.key]) : undefined}
                        className={`py-2 ${c.fixed ? `pl-3 pr-1.5 ${SLA_STRIPE[r.sla.status]}` : "px-1.5"} ${
                          c.right ? "text-right tabular-nums" : ""
                        } truncate`}
                      >
                        {cell(c.key, r)}
                      </td>
                    ))}
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

      </div>

      {/* ================= Today's diary / Alerts – compact card, sized to its content ================= */}
      {drawer && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={drawer === "diary" ? "Today's diary" : "Alerts"}>
          <button type="button" aria-label="Close panel" onClick={() => setDrawer(null)} className="absolute inset-0 cursor-default bg-slate-900/10" />
          <aside className="absolute right-3 top-[92px] flex max-h-[calc(100vh-104px)] max-sm:top-[128px] max-sm:max-h-[calc(100vh-140px)] w-max min-w-[300px] max-w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex h-10 flex-none items-center justify-between gap-3 border-b border-slate-200 pl-2 pr-1.5">
              <div role="tablist" aria-label="Panel" className="flex gap-1">
                {[
                  ["diary", "Today's diary", `${diaryLeft} open`],
                  ["alerts", "Alerts", `${ALERTS.length} new`],
                ].map(([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={drawer === k}
                    onClick={() => setDrawer(k)}
                    className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold ${
                      drawer === k ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                    <span className={`text-[10.5px] font-medium ${drawer === k ? "text-white/70" : "text-slate-400"}`}>{n}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setDrawer(null)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto pb-1">
              {drawer === "diary" ? (
                <>
                  <div className="flex items-center justify-between px-3 pt-2">
                    <span className="text-[11.5px] text-slate-500">
                      {diaryLeft} of {diary.length} follow-ups open · tick when done
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdding((v) => !v)}
                      aria-expanded={adding}
                      className="flex h-7 items-center gap-1 rounded border border-slate-300 px-2 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {adding ? <X className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                      {adding ? "Cancel" : "Add"}
                    </button>
                  </div>
            {adding && (
              <form onSubmit={addDiary} className="mx-3 mt-2 flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
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
                </>
              ) : (
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
                        setDrawer(null);
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
              )}
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}