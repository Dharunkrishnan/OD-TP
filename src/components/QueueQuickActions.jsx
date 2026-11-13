// src/components/QueueQuickActions.jsx
// My Work Queue – quick follow-up actions on a row, without opening the claim (Claims Handler):
//   Send document reminder · Add follow-up to diary · Add note · Log a call
// Nothing here changes money or claim status – decisions stay in Claim 360.
// Each action is written to the claim's timeline (src/data/claimWork.js).

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, BellRing, CalendarPlus, StickyNote, PhoneCall, X } from "lucide-react";
import { CALL_OUTCOMES, NOTE_VISIBILITY } from "../data/claimWork";

const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

const QUICK_ACTIONS = [
  { key: "remind", label: "Send document reminder", Icon: BellRing },
  { key: "diary", label: "Add follow-up to diary", Icon: CalendarPlus },
  { key: "note", label: "Add note", Icon: StickyNote },
  { key: "call", label: "Log a call", Icon: PhoneCall },
];

/** ⋯ button + menu on one queue row */
export function QuickActionsMenu({ row, pendingCount, onPick }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // fixed position – the table clips anything absolutely positioned
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    const off = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const up = r.bottom + 160 > window.innerHeight;
          setPos({ right: Math.max(8, window.innerWidth - r.right), ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Quick actions for ${row.claimNo}`}
        title="Quick actions"
        className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && pos && (
        <div role="menu" style={pos} className="fixed z-40 w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-[0_12px_32px_rgba(11,31,58,0.18)]">
          {QUICK_ACTIONS.map((a) => {
            const disabled = a.key === "remind" && pendingCount === 0;
            return (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onPick(a.key);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                <a.Icon className="h-3.5 w-3.5 flex-none text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">{a.label}</span>
                {a.key === "remind" && <span className="flex-none rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{pendingCount || "none"}</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/** dialog for the picked action */
export function QuickActionDialog({ kind, row, pendingDocs, onCancel, onDone }) {
  const ref = useRef(null);
  const [docs, setDocs] = useState(() => pendingDocs.map((d) => d.name));
  const [time, setTime] = useState("17:00");
  const [[today, maxDate]] = useState(() => {
    const t = new Date().toISOString().slice(0, 10);
    return [t, new Date(Date.parse(t) + 30 * 86400000).toISOString().slice(0, 10)];
  });
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [vis, setVis] = useState("team");
  const [outcome, setOutcome] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => {
    ref.current?.querySelector("input, select, textarea")?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const a = QUICK_ACTIONS.find((x) => x.key === kind);
  let error = null;
  if (kind === "remind" && docs.length === 0) error = "Tick at least one document.";
  if (kind === "diary" && text.trim().length < 3) error = "Write what to follow up.";
  if (kind === "diary" && (!date || date < today || date > maxDate)) error = "Choose a date within the next 30 days.";
  if (kind === "note" && text.trim().length < 3) error = "Write the note.";
  if (kind === "call" && !outcome) error = "Select the call outcome.";

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    onDone({ docs, time, date, text: text.trim(), vis, outcome });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form ref={ref} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="qa-title" className="w-full max-w-[440px] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="qa-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              {a.label}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              <span className="font-mono">{row.claimNo}</span> · {row.insured} · {row.vehicle}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          {kind === "remind" && (
            <fieldset>
              <legend className="mb-1 text-[12px] font-medium text-slate-700">Remind the insured about (SMS & email)</legend>
              <div className="space-y-1">
                {pendingDocs.map((d) => (
                  <label key={d.name} className="flex items-center gap-2 text-[12.5px] text-slate-800">
                    <input
                      type="checkbox"
                      checked={docs.includes(d.name)}
                      onChange={(e) => setDocs((x) => (e.target.checked ? [...x, d.name] : x.filter((n) => n !== d.name)))}
                      className="h-4 w-4 accent-teal-700"
                    />
                    <span className="flex-1">{d.name}</span>
                    <span className="text-[11px] text-slate-500">{d.status === "Rejected" ? "rejected" : `${d.reminders || 0} reminder(s) sent`}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {kind === "diary" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">Follow up</span>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Call garage for repair status" className={inputCls} />
              </label>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-slate-700">Date</span>
                  <input type="date" value={date} min={today} max={maxDate} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-slate-700">Time</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
                </label>
              </div>
            </>
          )}
          {kind === "note" && (
            <>
              <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Note for the claim file" className={`${inputCls} h-auto py-2`} aria-label="Note" />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {NOTE_VISIBILITY.map((v) => (
                  <label key={v.key} className="flex items-center gap-1.5 text-[12.5px] text-slate-800">
                    <input type="radio" name="qa-vis" checked={vis === v.key} onChange={() => setVis(v.key)} className="h-4 w-4 accent-teal-700" />
                    {v.label}
                  </label>
                ))}
              </div>
            </>
          )}
          {kind === "call" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-slate-700">Outcome</span>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>
                  <option value="">Select</option>
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What was discussed (optional)" className={`${inputCls} h-auto py-2`} aria-label="Call notes" />
            </>
          )}
          {tried && error && <p className="text-[11.5px] text-red-700">{error}</p>}
          <p className="text-[11.5px] text-slate-500">Saved to the claim's timeline.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="h-9 rounded-lg bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800">
            {kind === "remind" ? "Send reminder" : kind === "diary" ? "Set follow-up" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}