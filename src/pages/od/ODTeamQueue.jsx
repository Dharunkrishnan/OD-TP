// src/pages/od/ODTeamQueue.jsx
// OD Claims Manager – Team Work Queue with Reallocate built in (route /od/team-queue)
// Persona: Priya Raghavan · OD0150 · Claims Manager, Chennai
//
// Only what a manager needs here:
//   - every open claim of the team, worst SLA first
//   - who has it (handler strip with load vs capacity, on-leave marker)
//   - filters: Show (all / breached / at risk / due today) · Stage · Pending with · search
//   - Reallocate: one claim, ticked claims, or all / due-today claims of a handler on leave
//     → one handler, or spread across the team (lowest load first); reason mandatory
//   - quick read-only preview of a claim
// Deep links: ?handler=OD0145  ?show=breach|risk|due
//
// Demo data: the team's claims come from src/data/odManagerData.js (shared with the dashboard).
// Reallocations are kept for this browser session only (sessionStorage).
// Replace with: GET /od/manager/team-queue · POST /od/manager/reallocate { claimNos, toUserId, reason, remarks }

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Layers,
  ListFilter,
  Plane,
  Search,
  Shuffle,
  Undo2,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { auditLog, useAuth, getRole } from "../../auth";
import { claimSlug } from "../../data/odClaimDetail";
import { TEAM, HANDLER_CAPACITY } from "../../data/odTeamMock";
import { TEAM_CLAIMS, STAGE_ORDER, KEYS, readStore, saveStore } from "../../data/odManagerData";

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
const PAGE_SIZE = 15;
const SLA_RANK = { breach: 0, risk: 1, ok: 2 };
const HANDLER = Object.fromEntries(TEAM.map((h) => [h.userId, h]));
const first = (n) => n.split(" ")[0];
const initials = (n) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
const lakh = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : "₹" + Number(n).toLocaleString("en-IN"));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

const SHOW = [
  { key: "all", label: "All open" },
  { key: "breach", label: "Breached" },
  { key: "risk", label: "At risk" },
  { key: "due", label: "Due today" },
];
const SORTS = [
  { key: "priority", label: "Priority" },
  { key: "age", label: "Oldest first" },
  { key: "reserve", label: "Highest reserve" },
];
const REASONS = ["Handler on leave", "Workload balancing", "Needs specialist (total loss / theft / SIU)", "Conflict of interest", "Customer escalation", "Other"];

const STAGE_DOT = {
  NBNR: "bg-slate-400",
  Registered: "bg-slate-400",
  "Survey pending": "bg-sky-500",
  Assessment: "bg-indigo-500",
  "Documents pending": "bg-amber-500",
  Approval: "bg-orange-500",
  "Repair / DO": "bg-teal-500",
  Payment: "bg-emerald-500",
};
const SLA_STRIPE = { breach: "shadow-[inset_3px_0_0_#dc2626]", risk: "shadow-[inset_3px_0_0_#f59e0b]", ok: "shadow-[inset_3px_0_0_#10b981]" };

const readMoves = () => readStore(KEYS.moves);
const saveMoves = (m) => saveStore(KEYS.moves, m);

function SlaChip({ sla }) {
  const map = {
    breach: ["bg-red-50 text-red-700 ring-red-200", AlertTriangle],
    risk: ["bg-amber-50 text-amber-800 ring-amber-200", Clock],
    ok: ["bg-emerald-50 text-emerald-700 ring-emerald-200", Check],
  };
  const [tone, Icon] = map[sla.status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {sla.label}
    </span>
  );
}

/** Small dropdown pill used for the filters */
function Pill({ icon: Icon, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const current = options.find((o) => o.key === value) || options[0];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] ${value !== options[0].key ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}: <b className="font-semibold text-slate-900">{current.label}</b>
        {current.count != null && <span className="text-slate-400">{current.count}</span>}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                role="option"
                aria-selected={o.key === value}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-slate-100 ${o.key === value ? "font-semibold text-teal-800" : "text-slate-700"}`}
              >
                <span>{o.label}</span>
                <span className="flex items-center gap-1.5">
                  {o.count != null && <span className="tabular-nums text-slate-400">{o.count}</span>}
                  {o.key === value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================================================== */
/* Reallocate dialog                                                   */
/* ================================================================== */
// spread: each claim goes to the active handler with the lowest load at that moment
function spreadPlan(claims, loads, exclude) {
  const live = { ...loads };
  const targets = TEAM.filter((h) => h.status !== "leave" && !exclude.includes(h.userId));
  return claims.map((c) => {
    const to = targets.reduce((best, h) => (live[h.userId] < live[best.userId] ? h : best), targets[0]);
    live[to.userId] += 1;
    return { claimNo: c.claimNo, to: to.userId };
  });
}

function ReallocateDialog({ claims, loads, onCancel, onConfirm, defaultReason }) {
  const fromIds = [...new Set(claims.map((c) => c.effHandler))];
  const many = claims.length > 1;
  const [mode, setMode] = useState(many && fromIds.every((id) => HANDLER[id].status === "leave") ? "spread" : "one");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState(defaultReason || "");
  const [remarks, setRemarks] = useState("");
  const [overOk, setOverOk] = useState(false);
  const [tried, setTried] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const fromCounts = fromIds.map((id) => `${first(HANDLER[id].name)} (${claims.filter((c) => c.effHandler === id).length})`).join(", ");
  const reserve = claims.reduce((t, c) => t + c.reserve, 0);
  const breached = claims.filter((c) => c.sla.status === "breach").length;
  const plan = mode === "spread" ? spreadPlan(claims, loads, fromIds) : to ? claims.map((c) => ({ claimNo: c.claimNo, to })) : [];
  const incoming = plan.reduce((m, p) => ({ ...m, [p.to]: (m[p.to] || 0) + 1 }), {});
  const overList = Object.entries(incoming).filter(([id, n]) => loads[id] + n > HANDLER_CAPACITY);

  const errors = {};
  if (mode === "one" && !to) errors.to = "Choose a handler.";
  if (!reason) errors.reason = "Select a reason.";
  if (reason === "Other" && remarks.trim().length < 10) errors.remarks = "Write at least 10 characters.";
  if (overList.length && !overOk) errors.over = "Tick to confirm, or choose another handler.";
  const valid = Object.keys(errors).length === 0;
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (valid) onConfirm({ plan, reason, remarks: remarks.trim() });
  }

  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="realloc-title" className="flex max-h-[calc(100vh-32px)] w-full max-w-[520px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="realloc-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              Reallocate {claims.length} claim{many ? "s" : ""}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              From {fromCounts} · reserve {lakh(reserve)}
              {breached ? ` · ${breached} breached` : ""}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">
          {many && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-[12.5px]" role="radiogroup" aria-label="How to reallocate">
              {[
                ["one", "Assign to one handler"],
                ["spread", "Spread across the team"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  onClick={() => setMode(k)}
                  className={`h-8 rounded-md font-semibold ${mode === k ? "bg-white text-[#0B1F3A] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {mode === "one" ? (
            <div>
              <p className="mb-1 text-[12px] font-medium text-slate-700">
                New handler <span className="text-red-600">*</span>
              </p>
              <ul className="space-y-1" role="radiogroup" aria-label="New handler">
                {TEAM.filter((h) => !(fromIds.length === 1 && h.userId === fromIds[0])).map((h, i) => {
                  const leave = h.status === "leave";
                  const after = loads[h.userId] + claims.length;
                  const over = after > HANDLER_CAPACITY;
                  const on = to === h.userId;
                  return (
                    <li key={h.userId}>
                      <button
                        ref={i === 0 ? firstRef : undefined}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={leave}
                        onClick={() => setTo(h.userId)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left ${
                          leave ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60" : on ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`grid h-4 w-4 flex-none place-items-center rounded-full border-[1.5px] ${on ? "border-teal-600" : "border-slate-400"}`} aria-hidden="true">
                          {on && <span className="h-2 w-2 rounded-full bg-teal-600" />}
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block text-[13px] font-medium text-slate-800">
                            {h.name} <span className="font-mono text-[10.5px] font-normal text-slate-400">{h.userId}</span>
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {leave ? h.leaveNote : `${h.breached} breached · ${h.atRisk} at risk · SLA ${h.slaMet}%`}
                          </span>
                        </span>
                        {!leave && (
                          <span className="flex-none text-right text-[11.5px] leading-tight tabular-nums">
                            <span className="block text-slate-500">
                              {loads[h.userId]} → <b className={over ? "text-red-700" : "text-slate-900"}>{after}</b>
                              <span className="text-slate-400">/{HANDLER_CAPACITY}</span>
                            </span>
                            {over && <span className="text-[10.5px] font-semibold text-red-700">Over capacity</span>}
                          </span>
                        )}
                        {leave && <Plane className="h-4 w-4 flex-none text-slate-400" aria-label="On leave" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {err("to") && <p className="mt-1 text-[11.5px] text-red-700">{err("to")}</p>}
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[12px] font-medium text-slate-700">Each claim goes to the handler with the lowest load at that moment (worst SLA first)</p>
              <table className="w-full text-[12.5px] tabular-nums">
                <tbody className="divide-y divide-slate-100">
                  {TEAM.filter((h) => h.status !== "leave" && !fromIds.includes(h.userId)).map((h) => {
                    const n = incoming[h.userId] || 0;
                    const after = loads[h.userId] + n;
                    return (
                      <tr key={h.userId}>
                        <td className="py-1 text-slate-800">{h.name}</td>
                        <td className="py-1 text-right font-semibold text-teal-800">{n ? `+${n}` : "–"}</td>
                        <td className="py-1 pl-3 text-right text-slate-500">
                          {loads[h.userId]} → <b className={after > HANDLER_CAPACITY ? "text-red-700" : "text-slate-900"}>{after}</b>/{HANDLER_CAPACITY}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {overList.length > 0 && (
            <div>
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                <input type="checkbox" checked={overOk} onChange={(e) => setOverOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
                <span>
                  {overList.map(([id]) => first(HANDLER[id].name)).join(", ")} will go over capacity ({HANDLER_CAPACITY}). Assign anyway.
                </span>
              </label>
              {err("over") && <p className="mt-1 text-[11.5px] text-red-700">{err("over")}</p>}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-slate-700">
              Reason <span className="text-red-600">*</span>
            </span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} aria-invalid={!!err("reason")}>
              <option value="">Select</option>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            {err("reason") && <span className="mt-1 block text-[11.5px] text-red-700">{err("reason")}</span>}
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-slate-700">
              Remarks {reason === "Other" && <span className="text-red-600">*</span>}
            </span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, 300))}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              aria-invalid={!!err("remarks")}
            />
            {err("remarks") ? (
              <span className="mt-1 block text-[11.5px] text-red-700">{err("remarks")}</span>
            ) : (
              <span className="mt-1 block text-[11.5px] text-slate-500">Both handlers are notified. The SLA clock keeps running – reallocation does not reset TAT.</span>
            )}
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white hover:bg-[#13305a]">
            <Shuffle className="h-4 w-4" aria-hidden="true" /> Reallocate
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================== */
/* Claim preview (read-only)                                           */
/* ================================================================== */
function Preview({ c, move, onClose, onReallocate, onOpen }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const rows = [
    ["Handler", HANDLER[c.effHandler].name + (move ? ` (from ${first(HANDLER[move.from].name)})` : "")],
    ["Insured", c.insured],
    ["Vehicle", `${c.vehicle} · ${c.regNo}`],
    ["Loss type", c.lossType],
    ["Stage", c.stage],
    ["Pending with", c.pendingWith],
    ["Age", `${c.ageDays} days since registration`],
    ["Reserve", inr(c.reserve)],
    ["Next action", c.nextAction],
  ];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={`Claim ${c.claimNo}`} className="flex h-full w-full max-w-[380px] flex-col bg-white shadow-[-12px_0_32px_rgba(11,31,58,0.15)]">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[14px] font-semibold text-[#0B1F3A]">{c.claimNo}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <SlaChip sla={c.sla} />
              {c.dueToday && <span className="rounded bg-slate-100 px-1.5 py-px text-[11px] font-semibold text-slate-700">Due today</span>}
              {c.flags.map((f) => (
                <span key={f} className="rounded bg-amber-50 px-1.5 py-px text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[96px_1fr] gap-2 border-b border-slate-50 py-1.5 text-[12.5px]">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onReallocate} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0B1F3A] text-[13px] font-semibold text-white hover:bg-[#13305a]">
            <Shuffle className="h-4 w-4" aria-hidden="true" /> Reallocate
          </button>
          {c.real && (
            <button type="button" onClick={onOpen} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
              <Eye className="h-4 w-4" aria-hidden="true" /> Open Claim 360
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
export default function ODTeamQueue() {
  const { user } = useAuth();
  if (getRole(user, "OD")?.role !== "CLAIMS_MANAGER") return <NotForRole />;
  return <TeamQueuePage />;
}

function NotForRole() {
  const navigate = useNavigate();
  return (
    <ODShell active="teamqueue" title="Team Work Queue">
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <XCircle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="mt-2 text-[15px] font-semibold text-[#0B1F3A]">Team Work Queue is for the Claims Manager</h2>
        <p className="mt-1 text-[13px] text-slate-500">Change role from your name at the top right → Select role.</p>
        <button type="button" onClick={() => navigate("/od/dashboard")} className="mt-4 h-9 rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white">
          Go to my dashboard
        </button>
      </div>
    </ODShell>
  );
}

function TeamQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [moves, setMoves] = useState(readMoves);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [pending, setPending] = useState("all");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { claims, reason }
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  const handlerKey = params.get("handler") || "all";
  const show = SHOW.some((s) => s.key === params.get("show")) ? params.get("show") : "all";
  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
    setPage(0);
    setSelected(new Set());
  };

  // claims with their current handler (after this session's reallocations)
  const claims = useMemo(() => TEAM_CLAIMS.map((c) => ({ ...c, effHandler: moves[c.claimNo]?.to || c.handlerId })), [moves]);
  const loads = useMemo(() => Object.fromEntries(TEAM.map((h) => [h.userId, claims.filter((c) => c.effHandler === h.userId).length])), [claims]);
  const statsFor = (list) => ({ n: list.length, breach: list.filter((c) => c.sla.status === "breach").length, risk: list.filter((c) => c.sla.status === "risk").length, due: list.filter((c) => c.dueToday).length });

  const showTest = { all: () => true, breach: (c) => c.sla.status === "breach", risk: (c) => c.sla.status === "risk", due: (c) => c.dueToday };
  const byHandler = claims.filter((c) => handlerKey === "all" || c.effHandler === handlerKey);
  const q = query.trim().toLowerCase();
  const list = byHandler
    .filter(showTest[show])
    .filter((c) => stage === "all" || c.stage === stage)
    .filter((c) => pending === "all" || c.pendingWith === pending)
    .filter((c) => !q || [c.claimNo, c.insured, c.regNo, c.vehicle].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "age"
        ? b.ageDays - a.ageDays
        : sort === "reserve"
          ? b.reserve - a.reserve
          : SLA_RANK[a.sla.status] - SLA_RANK[b.sla.status] || Number(b.dueToday) - Number(a.dueToday) || b.ageDays - a.ageDays
    );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageNo = Math.min(page, pages - 1);
  const pageRows = list.slice(pageNo * PAGE_SIZE, pageNo * PAGE_SIZE + PAGE_SIZE);
  const reserveShown = list.reduce((t, c) => t + c.reserve, 0);

  const countIn = (key, val) => byHandler.filter(showTest[show]).filter((c) => c[key] === val).length;
  const stageOpts = [{ key: "all", label: "All" }, ...STAGE_ORDER.filter((s) => countIn("stage", s)).map((s) => ({ key: s, label: s, count: countIn("stage", s) }))];
  const pendingOpts = [{ key: "all", label: "Anyone" }, ...[...new Set(claims.map((c) => c.pendingWith))].sort().filter((p) => countIn("pendingWith", p)).map((p) => ({ key: p, label: p, count: countIn("pendingWith", p) }))];
  const showOpts = SHOW.map((s) => ({ ...s, count: byHandler.filter(showTest[s.key]).length }));

  const onLeave = TEAM.filter((h) => h.status === "leave" && loads[h.userId] > 0);
  const selectedClaims = claims.filter((c) => selected.has(c.claimNo));
  const allPageSelected = pageRows.length > 0 && pageRows.every((c) => selected.has(c.claimNo));

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function toggle(no) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(no)) n.delete(no);
      else n.add(no);
      return n;
    });
  }
  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      pageRows.forEach((c) => (allPageSelected ? n.delete(c.claimNo) : n.add(c.claimNo)));
      return n;
    });
  }

  function confirmMove({ plan, reason, remarks }) {
    const at = new Date().toISOString();
    const prev = moves;
    const next = { ...moves };
    plan.forEach((p) => {
      const c = claims.find((x) => x.claimNo === p.claimNo);
      // back to the original handler = no longer a move
      if (p.to === c.handlerId) delete next[p.claimNo];
      else next[p.claimNo] = { to: p.to, from: c.handlerId, at, reason };
    });
    setMoves(next);
    saveMoves(next);
    auditLog("CLAIMS_REALLOCATED", { count: plan.length, plan, reason, remarks });
    setDialog(null);
    setPreview(null);
    setSelected(new Set());
    const names = [...new Set(plan.map((p) => first(HANDLER[p.to].name)))];
    setToast({ text: `${plan.length} claim${plan.length > 1 ? "s" : ""} moved to ${names.join(", ")}`, undo: prev });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }
  function undo() {
    setMoves(toast.undo);
    saveMoves(toast.undo);
    auditLog("CLAIMS_REALLOCATION_UNDONE", {});
    setToast(null);
  }

  const allStats = statsFor(claims);

  return (
    <ODShell active="teamqueue" title="Team Work Queue" subtitle={`${claims.length} open claims · ${TEAM.length} handlers · worst SLA first`} onNavigateMissing={(l) => {
      setToast({ text: `${l} comes in a later build step.` });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2600);
    }}>
      <section className="flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.08)] lg:h-[calc(100vh-68px)]">
        {/* Handler strip */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-2.5 py-2" role="tablist" aria-label="Filter by handler">
          {[{ userId: "all", name: "All handlers" }, ...TEAM].map((h) => {
            const on = handlerKey === h.userId;
            const st = statsFor(h.userId === "all" ? claims : claims.filter((c) => c.effHandler === h.userId));
            const leave = h.status === "leave";
            const over = h.userId !== "all" && st.n > HANDLER_CAPACITY;
            return (
              <button
                key={h.userId}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setParam("handler", h.userId)}
                className={`flex min-w-[150px] flex-1 items-center gap-2 rounded-lg border px-2 py-1 text-left ${on ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[10.5px] font-semibold ${h.userId === "all" ? "bg-[#0B1F3A] text-white" : leave ? "bg-slate-100 text-slate-500" : "bg-teal-100 text-teal-800"}`}>
                  {h.userId === "all" ? <Users className="h-3.5 w-3.5" aria-hidden="true" /> : initials(h.name)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-800">
                    <span className="truncate">{h.userId === "all" ? "All" : first(h.name)}</span>
                    {leave && <Plane className="h-3 w-3 flex-none text-slate-400" aria-label="On leave" />}
                    <span
                      className={`ml-auto flex-none rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${over ? "bg-red-50 text-red-700" : on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
                      title={h.userId === "all" ? undefined : `Open claims / capacity ${HANDLER_CAPACITY}`}
                    >
                      {st.n}
                      {h.userId !== "all" && <span className={on && !over ? "text-teal-100" : "text-slate-400"}>/{HANDLER_CAPACITY}</span>}
                    </span>
                  </span>
                  <span className="block whitespace-nowrap text-[10.5px]">
                    <span className="font-semibold text-red-700">{st.breach}</span>
                    <span className="text-slate-400"> breached · </span>
                    <span className="font-semibold text-amber-800">{st.risk}</span>
                    <span className="text-slate-400"> at risk</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* On-leave banner */}
        {onLeave.map((h) => {
          const mine = claims.filter((c) => c.effHandler === h.userId);
          const due = mine.filter((c) => c.dueToday);
          return (
            <div key={h.userId} className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 text-[12.5px] text-amber-900">
              <Plane className="h-4 w-4 flex-none" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{h.name}</b> is on leave ({h.leaveNote.replace("On leave · ", "")}) – {mine.length} open claims, <b className="font-semibold">{due.length} due today</b>.
              </span>
              {due.length > 0 && (
                <button type="button" onClick={() => setDialog({ claims: due, reason: "Handler on leave" })} className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-600 px-2.5 text-[12px] font-semibold text-white hover:bg-amber-700">
                  <Shuffle className="h-3.5 w-3.5" aria-hidden="true" /> Reallocate {due.length} due today
                </button>
              )}
              <button type="button" onClick={() => setDialog({ claims: mine, reason: "Handler on leave" })} className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-100">
                Reallocate all {mine.length}
              </button>
            </div>
          );
        })}

        {/* Filters / bulk bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
          {selected.size > 0 ? (
            <>
              <span className="text-[13px] font-semibold text-[#0B1F3A]">{selected.size} selected</span>
              <span className="text-[12px] text-slate-500">reserve {lakh(selectedClaims.reduce((t, c) => t + c.reserve, 0))}</span>
              {selected.size < list.length && (
                <button type="button" onClick={() => setSelected(new Set(list.map((c) => c.claimNo)))} className="text-[12px] font-semibold text-teal-800 hover:underline">
                  Select all {list.length} shown
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-lg border border-slate-300 px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
              <button type="button" onClick={() => setDialog({ claims: selectedClaims })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 text-[12.5px] font-semibold text-white hover:bg-[#13305a]">
                <Shuffle className="h-4 w-4" aria-hidden="true" /> Reallocate {selected.size}
              </button>
            </>
          ) : (
            <>
              <Pill icon={ListFilter} label="Show" value={show} options={showOpts} onChange={(v) => setParam("show", v)} />
              <Pill icon={Layers} label="Stage" value={stage} options={stageOpts} onChange={(v) => { setStage(v); setPage(0); }} />
              <Pill icon={User} label="Pending with" value={pending} options={pendingOpts} onChange={(v) => { setPending(v); setPage(0); }} />
              <label className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-full border border-slate-300 px-3 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 sm:max-w-[300px]">
                <Search className="h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Claim no, insured or vehicle no" aria-label="Search claims" className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-slate-400" />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              <span className="flex-1" />
              <span className="hidden text-[12px] text-slate-500 xl:inline">
                Showing <b className="font-semibold text-slate-700">{list.length}</b> of {claims.length} · reserve {lakh(reserveShown)}
              </span>
              <Pill icon={ArrowUpDown} label="Sort" value={sort} options={SORTS} onChange={setSort} />
            </>
          )}
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[960px] text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-9 py-2 pl-3">
                  <input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Select all claims on this page" className="h-4 w-4 accent-teal-700" />
                </th>
                <th className="py-2 pr-2 font-semibold">Claim no</th>
                <th className="py-2 pr-2 font-semibold">Handler</th>
                <th className="py-2 pr-2 font-semibold">Insured</th>
                <th className="py-2 pr-2 font-semibold">Stage</th>
                <th className="py-2 pr-2 font-semibold">Pending with</th>
                <th className="py-2 pr-2 font-semibold">SLA</th>
                <th className="py-2 pr-2 text-right font-semibold">Age</th>
                <th className="py-2 pr-3 text-right font-semibold">Reserve</th>
                <th className="py-2 pr-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((c) => {
                const mv = moves[c.claimNo];
                const h = HANDLER[c.effHandler];
                const sel = selected.has(c.claimNo);
                return (
                  <tr key={c.claimNo} className={`${SLA_STRIPE[c.sla.status]} ${sel ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={sel} onChange={() => toggle(c.claimNo)} aria-label={`Select ${c.claimNo}`} className="h-4 w-4 accent-teal-700" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <button type="button" onClick={() => setPreview(c.claimNo)} className="font-mono text-[11.5px] font-semibold text-teal-800 hover:underline">
                        {c.claimNo}
                      </button>
                      {c.flags.length > 0 && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{c.flags[0]}</span>}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-1 whitespace-nowrap text-slate-800">
                        {first(h.name)}
                        {h.status === "leave" && <Plane className="h-3 w-3 text-slate-400" aria-label="On leave" />}
                      </span>
                      {mv && <span className="block whitespace-nowrap text-[10.5px] font-semibold text-indigo-700">Moved from {first(HANDLER[mv.from].name)}</span>}
                    </td>
                    <td className="max-w-[160px] truncate py-1.5 pr-2 text-slate-700" title={`${c.insured} · ${c.vehicle} · ${c.regNo}`}>
                      {c.insured}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-slate-700">
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STAGE_DOT[c.stage]}`} aria-hidden="true" />
                      {c.stage}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-slate-600">{c.pendingWith}</td>
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-1">
                        <SlaChip sla={c.sla} />
                        {c.dueToday && c.sla.status !== "breach" && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">Today</span>}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{c.ageDays} d</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-800">{inr(c.reserve)}</td>
                    <td className="py-1.5 pr-3">
                      <span className="flex justify-end gap-0.5">
                        <button type="button" onClick={() => setPreview(c.claimNo)} title="View claim" aria-label={`View ${c.claimNo}`} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-teal-800">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setDialog({ claims: [c] })} title="Reallocate" aria-label={`Reallocate ${c.claimNo}`} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-teal-800">
                          <Shuffle className="h-4 w-4" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[13px] text-slate-500">
                    No claims match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 text-[12px] text-slate-500">
          <span>
            {list.length ? `${pageNo * PAGE_SIZE + 1}–${Math.min(list.length, (pageNo + 1) * PAGE_SIZE)} of ${list.length}` : "0 claims"} · team {allStats.breach} breached · {allStats.risk} at risk · {allStats.due} due today
          </span>
          <span className="flex items-center gap-1">
            <button type="button" disabled={pageNo === 0} onClick={() => setPage(pageNo - 1)} aria-label="Previous page" className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {pageNo + 1} / {pages}
            </span>
            <button type="button" disabled={pageNo >= pages - 1} onClick={() => setPage(pageNo + 1)} aria-label="Next page" className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </span>
        </div>
      </section>

      {preview && (() => {
        const c = claims.find((x) => x.claimNo === preview);
        return (
          <Preview
            c={c}
            move={moves[c.claimNo]}
            onClose={() => setPreview(null)}
            onReallocate={() => setDialog({ claims: [c] })}
            onOpen={() => navigate(`/od/claims/${claimSlug(c.claimNo)}`)}
          />
        );
      })()}

      {dialog && <ReallocateDialog claims={dialog.claims} loads={loads} defaultReason={dialog.reason} onCancel={() => setDialog(null)} onConfirm={confirmMove} />}

      {toast && (
        <div role="status" className="fixed right-4 top-14 z-50 flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl bg-[#0B1F3A] py-2 pl-3 pr-2 text-[12.5px] text-white shadow-[0_12px_32px_rgba(11,31,58,0.35)]">
          <Shuffle className="h-4 w-4 flex-none text-teal-300" aria-hidden="true" />
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={undo} className="inline-flex flex-none items-center gap-1 rounded-md px-2 py-1 font-semibold text-teal-300 hover:bg-white/10">
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
            </button>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </ODShell>
  );
}