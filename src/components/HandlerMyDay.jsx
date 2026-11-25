// src/components/HandlerMyDay.jsx
// Claims Handler dashboard → "My Day" tab: the work to act on today (Performance is the other tab).
//   • Quick actions   – new intimation, NBNR to resolve, documents pending (search is in the header)
//   • Due today & overdue – breached / at-risk / due-today claims with row quick actions (catalogue 160, 166)
//   • Diary           – today's follow-ups, tick done; upcoming dates (catalogue 161)
//   • Alerts & approvals – manager decisions on my requests, requests waiting, system alerts (20, 94, 181)
// Counts come from the live open queue, so a claim closed in Claim 360 drops out at once.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FilePlus2,
  Inbox,
  FileStack,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pencil,
  ChevronRight,
  XCircle,
  Hourglass,
  ShieldAlert,
  TrendingUp,
  Info,
} from "lucide-react";
import { openQueue } from "../data/claimLists";
import { queueLink } from "../data/handlerDashboard";
import { DIARY, ALERTS } from "../data/odHandlerMock";
import { claimSlug } from "../data/odClaimDetail";
import { listHandlerRequests, managerDecisions, REQUEST_KIND } from "../data/handlerRequests";
import { logWorkFor, pendingDocsFor, isoToday, NOTE_VISIBILITY, DATA_EVENT } from "../data/claimWork";
import { QuickActionsMenu, QuickActionDialog } from "./QueueQuickActions";

const DIARY_KEY = "smartclaims-diary"; // shared with My Work Queue
const CARD = "flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 bg-white";
const SLA_RANK = { breach: 0, risk: 1, ok: 2 };
const DUE_LIMIT = 10;

const readDiary = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DIARY_KEY) || "null") || DIARY;
  } catch {
    return DIARY;
  }
};
const saveDiary = (list) => {
  try {
    sessionStorage.setItem(DIARY_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
};
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

function Card({ title, right, children, className = "" }) {
  return (
    <section className={`${CARD} ${className}`}>
      <header className="flex min-h-[42px] flex-none items-center justify-between gap-2 border-b border-slate-100 px-4 py-1.5">
        <h2 className="truncate text-[13.5px] font-semibold text-slate-900">{title}</h2>
        {right}
      </header>
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
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[12px] font-semibold leading-[18px] ring-1 ring-inset ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {sla.label}
    </span>
  );
}

const STRIPE = { breach: "border-l-red-600", risk: "border-l-amber-500", ok: "border-l-transparent" };
const ALERT_ICON = {
  critical: { Icon: ShieldAlert, cls: "bg-red-50 text-red-700" },
  warning: { Icon: TrendingUp, cls: "bg-amber-50 text-amber-800" },
  info: { Icon: Info, cls: "bg-sky-50 text-sky-800" },
};

export default function HandlerMyDay() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0); // re-read live data after an action
  const [diary, setDiary] = useState(readDiary);
  const [quick, setQuick] = useState(null); // { kind, row, pendingDocs }
  const [toast, setToast] = useState("");
  const [todayIso] = useState(isoToday);

  useEffect(() => {
    const bump = () => {
      setTick((t) => t + 1);
      setDiary(readDiary());
    };
    window.addEventListener(DATA_EVENT, bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(DATA_EVENT, bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  // live lists (tick forces a re-read after actions on this page)
  void tick;
  const open = openQueue();
  const openNos = new Set(open.map((r) => r.claimNo));
  const dueRows = open
    .filter((r) => r.sla.status !== "ok" || r.dueToday)
    .sort((a, b) => SLA_RANK[a.sla.status] - SLA_RANK[b.sla.status] || b.ageDays - a.ageDays);
  const overdue = dueRows.filter((r) => r.sla.status === "breach").length;
  const nbnr = open.filter((r) => r.stage === "NBNR").length;
  const docs = open.filter((r) => r.stage === "Documents pending").length;
  const waiting = listHandlerRequests();
  const decisions = managerDecisions().slice(0, 4);
  const alerts = ALERTS.filter((a) => openNos.has(a.text.split(" ")[0]));

  const todayList = diary
    .map((d, i) => ({ ...d, i }))
    .filter((d) => !d.date || d.date <= todayIso)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = diary
    .filter((d) => d.date && d.date > todayIso && !d.done)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const diaryLeft = todayList.filter((d) => !d.done).length;

  function flash(text) {
    setToast(text);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(""), 2600);
  }
  function toggleDiary(i) {
    const next = diary.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
    setDiary(next);
    saveDiary(next);
  }
  const openClaim = (no, edit) => navigate(`/od/claims/${claimSlug(no)}${edit ? "?mode=edit" : ""}`);

  // Row quick actions – same behaviour as My Work Queue
  function doQuick({ docs: picked, time, date, text, vis, outcome }) {
    const { kind, row } = quick;
    if (kind === "remind") {
      logWorkFor(row.claimNo, "Document reminder sent", `${picked.join(", ")} · SMS + email to insured`, (w) => ({
        ...w,
        docs: Object.fromEntries([
          ...Object.entries(w.docs),
          ...picked.map((n) => {
            const d = quick.pendingDocs.find((x) => x.name === n);
            return [n, { ...w.docs[n], status: d.status, requestedOn: d.requestedOn || isoToday(), reminders: (d.reminders || 0) + 1 }];
          }),
        ]),
      }));
      flash(`Reminder sent for ${picked.length} document(s) · ${row.claimNo}`);
    } else if (kind === "diary") {
      const next = [...diary, { date, time, claimNo: row.claimNo, text, done: false }].sort((a, b) => a.time.localeCompare(b.time));
      setDiary(next);
      saveDiary(next);
      logWorkFor(row.claimNo, "Follow-up set", `${text} · ${date} ${time}`);
      flash(date === todayIso ? `Added to today's diary at ${time}` : `Follow-up set for ${fmtDate(date)} at ${time}`);
    } else if (kind === "note") {
      const v = NOTE_VISIBILITY.find((x) => x.key === vis);
      logWorkFor(row.claimNo, "Note added", text, undefined, { visibility: v.label });
      flash(`Note added to ${row.claimNo}`);
    } else {
      logWorkFor(row.claimNo, "Call logged", `${outcome}${text ? ` – ${text}` : ""}`);
      flash(`Call logged on ${row.claimNo}`);
    }
    setQuick(null);
    setTick((t) => t + 1);
  }

  const TILES = [
    { key: "new", label: "New claim intimation", sub: "Register a Motor OD claim", icon: FilePlus2, primary: true, onClick: () => navigate("/od/intimation") },
    { key: "nbnr", label: "NBNR to resolve", sub: "Notified, not registered", icon: Inbox, count: nbnr, onClick: () => navigate(queueLink({}, { stage: "NBNR" })) },
    { key: "docs", label: "Documents pending", sub: "Claims waiting on documents", icon: FileStack, count: docs, onClick: () => navigate(queueLink({}, { stage: "Documents pending" })) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* ---------------- Quick actions ---------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={t.onClick}
            className={`group flex min-w-0 items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
              t.primary ? "border-teal-700 bg-teal-700 text-white hover:bg-teal-800" : "border-slate-200 bg-white hover:border-teal-600 hover:bg-slate-50"
            }`}
          >
            <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${t.primary ? "bg-white/15" : "bg-teal-50 text-teal-700"}`}>
              <t.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13.5px] font-semibold ${t.primary ? "text-white" : "text-[#0B1F3A]"}`}>{t.label}</span>
              <span className={`block truncate text-[12px] ${t.primary ? "text-teal-50" : "text-slate-500"}`}>{t.sub}</span>
            </span>
            {t.count != null && (
              <span className="flex-none rounded-full bg-slate-100 px-2 text-[13px] font-bold leading-6 tabular-nums text-slate-800">{t.count}</span>
            )}
            <ChevronRight className={`h-4 w-4 flex-none ${t.primary ? "text-teal-100" : "text-slate-500 group-hover:text-teal-700"}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ---------------- Due today & overdue ---------------- */}
        <Card
          title="Due today & overdue"
          className="lg:col-span-2"
          right={
            <span className="flex items-center gap-1.5 text-[12px]">
              <button type="button" disabled={!overdue} onClick={() => navigate(queueLink({}, { sla: "breach" }))} className="rounded bg-red-50 px-1.5 font-semibold leading-6 text-red-800 hover:ring-1 hover:ring-inset hover:ring-red-300 disabled:hover:ring-0">
                {overdue} overdue
              </button>
              <button type="button" disabled={dueRows.length === overdue} onClick={() => navigate(queueLink({}, { due: "due" }))} className="rounded bg-amber-50 px-1.5 font-semibold leading-6 text-amber-900 hover:ring-1 hover:ring-inset hover:ring-amber-300 disabled:hover:ring-0">
                {dueRows.length - overdue} due today
              </button>
            </span>
          }
        >
          {dueRows.length === 0 ? (
            <p className="flex flex-1 items-center justify-center gap-2 p-6 text-[13px] text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> No claims due today or overdue.
            </p>
          ) : (
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-[200px] py-1.5 pl-3 font-semibold">Claim</th>
                  <th className="py-1.5 font-semibold">Next action</th>
                  <th className="w-[130px] py-1.5 font-semibold">Stage</th>
                  <th className="w-[112px] py-1.5 font-semibold">SLA</th>
                  <th className="w-[76px] py-1.5 pr-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dueRows.slice(0, DUE_LIMIT).map((r) => (
                  <tr
                    key={r.claimNo}
                    // a click anywhere on the row opens the claim in Claim 360 (view); buttons keep their own action
                    onClick={(e) => !e.target.closest("button, a") && !window.getSelection()?.toString() && openClaim(r.claimNo)}
                    className="cursor-pointer border-t border-slate-100 align-middle hover:bg-slate-50/70"
                  >
                    <td className={`border-l-[3px] py-1.5 pl-2.5 ${STRIPE[r.sla.status]}`}>
                      <button type="button" onClick={() => openClaim(r.claimNo)} className="block font-mono text-[12.5px] font-semibold text-teal-700 hover:underline">
                        {r.claimNo}
                      </button>
                      <span className="block truncate text-[12px] text-slate-500">
                        {r.regNo} · {r.insured}
                      </span>
                    </td>
                    <td className="truncate pr-2 text-[12.5px] text-slate-800" title={r.nextAction}>
                      {r.nextAction}
                    </td>
                    <td className="truncate pr-2 text-[12.5px] text-slate-600">{r.stage}</td>
                    <td>
                      <SlaChip sla={r.sla} />
                    </td>
                    <td className="pr-3">
                      <span className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openClaim(r.claimNo, true)}
                          aria-label={`Work on ${r.claimNo}`}
                          title="Work on this claim"
                          className="grid h-7 w-7 place-items-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <QuickActionsMenu row={r} pendingCount={pendingDocsFor(r.claimNo).length} onPick={(kind) => setQuick({ kind, row: r, pendingDocs: pendingDocsFor(r.claimNo) })} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {dueRows.length > DUE_LIMIT && (
            <button
              type="button"
              onClick={() => navigate(queueLink({}, { due: "all" }))}
              className="mt-auto flex items-center justify-center gap-1 border-t border-slate-100 py-2 text-[12.5px] font-semibold text-teal-700 hover:bg-teal-50/50"
            >
              View all {dueRows.length} in My Work Queue <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </Card>

        <div className="flex min-h-0 flex-col gap-3">
          {/* ---------------- Diary ---------------- */}
          <Card title="Today's diary" right={<span className="text-[12px] text-slate-500">{diaryLeft} left</span>}>
            <ul className="flex flex-col px-3 py-1">
              {todayList.map((d) => (
                <li key={`${d.i}-${d.time}`} className="flex items-start gap-2 border-b border-slate-100 py-1.5 last:border-0">
                  <input
                    type="checkbox"
                    checked={!!d.done}
                    onChange={() => toggleDiary(d.i)}
                    aria-label={`Mark "${d.text}" ${d.done ? "not done" : "done"}`}
                    className="mt-0.5 h-4 w-4 flex-none accent-teal-700"
                  />
                  <span className="w-11 flex-none text-[12px] font-semibold tabular-nums text-slate-600">{d.time}</span>
                  <span className={`min-w-0 flex-1 text-[12.5px] leading-snug ${d.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                    {d.text}
                    <button type="button" onClick={() => openClaim(d.claimNo)} className="block font-mono text-[12px] text-teal-700 hover:underline">
                      {d.claimNo}
                    </button>
                  </span>
                </li>
              ))}
              {todayList.length === 0 && <li className="py-2 text-[12.5px] text-slate-500">No follow-ups today.</li>}
            </ul>
            {upcoming.length > 0 && (
              <p className="border-t border-slate-100 px-3 py-1.5 text-[12px] text-slate-500">
                Upcoming: <span className="font-semibold text-slate-700">{upcoming.length}</span> · next {fmtDate(upcoming[0].date)} {upcoming[0].time} – {upcoming[0].text}
              </p>
            )}
          </Card>

          {/* ---------------- Alerts & approvals ---------------- */}
          <Card title="Alerts & approvals" className="flex-1" right={<span className="text-[12px] text-slate-500">{decisions.length + waiting.length + alerts.length}</span>}>
            <ul className="flex flex-col px-3 py-1">
              {decisions.map((d, i) => (
                <li key={`d${i}`} className="flex items-start gap-2 border-b border-slate-100 py-1.5">
                  <span className={`grid h-6 w-6 flex-none place-items-center rounded-md ${d.approved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {d.approved ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                  <button type="button" onClick={() => openClaim(d.claimNo)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[12.5px] font-semibold text-slate-800">{d.title}</span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {d.claimNo} · {d.time}
                    </span>
                  </button>
                </li>
              ))}
              {waiting.map((w) => (
                <li key={w.id} className="flex items-start gap-2 border-b border-slate-100 py-1.5">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-slate-100 text-slate-600">
                    <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <button type="button" onClick={() => openClaim(w.claimNo)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[12.5px] font-semibold text-slate-800">{REQUEST_KIND[w.kind].label} – waiting for manager</span>
                    <span className="block truncate text-[12px] text-slate-500">{w.claimNo}</span>
                  </button>
                </li>
              ))}
              {alerts.map((a, i) => {
                const s = ALERT_ICON[a.severity];
                const no = a.text.split(" ")[0];
                return (
                  <li key={`a${i}`} className="flex items-start gap-2 border-b border-slate-100 py-1.5 last:border-0">
                    <span className={`grid h-6 w-6 flex-none place-items-center rounded-md ${s.cls}`}>
                      <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <button type="button" onClick={() => openClaim(no)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-slate-800">
                        {a.title}
                        <span className="flex-none text-[12px] font-normal text-slate-500">{a.time}</span>
                      </span>
                      <span className="block truncate text-[12px] text-slate-500" title={a.text}>
                        {a.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      {quick && <QuickActionDialog kind={quick.kind} row={quick.row} pendingDocs={quick.pendingDocs} onCancel={() => setQuick(null)} onDone={doQuick} />}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}