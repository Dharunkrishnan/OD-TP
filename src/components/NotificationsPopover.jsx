// src/components/NotificationsPopover.jsx
// Bell icon in the header → notifications panel (same look as the search panel).
// Unread count badge · Unread / Earlier groups · click a notification → Claim 360 ·
// "Mark all as read" (remembered in this browser) · link to the alerts in My Work Queue.

import { useEffect, useRef, useState } from "react";
import { Bell, ShieldAlert, FileCheck2, AlertTriangle, FileUp, TrendingUp, Clock, IndianRupee, CheckCheck, ChevronRight } from "lucide-react";

const READ_KEY = "smartclaims-notifications-read";

const KIND = {
  fraud: { Icon: ShieldAlert, tile: "bg-red-50 text-red-700 ring-red-200" },
  sla: { Icon: AlertTriangle, tile: "bg-red-50 text-red-700 ring-red-200" },
  major: { Icon: TrendingUp, tile: "bg-amber-50 text-amber-800 ring-amber-200" },
  delay: { Icon: Clock, tile: "bg-amber-50 text-amber-800 ring-amber-200" },
  survey: { Icon: FileCheck2, tile: "bg-sky-50 text-sky-700 ring-sky-200" },
  docs: { Icon: FileUp, tile: "bg-sky-50 text-sky-700 ring-sky-200" },
  payment: { Icon: IndianRupee, tile: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

function readIds() {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function NotificationsPopover({ items, onOpenClaim, onViewAll }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(readIds);
  const wrap = useRef(null);

  const isUnread = (n) => n.unread && !read.includes(n.id);
  const unread = items.filter(isUnread).length;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function save(next) {
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  const markRead = (id) => !read.includes(id) && save([...read, id]);
  const markAll = () => save([...new Set([...read, ...items.map((n) => n.id)])]);

  const groups = [
    { label: "Unread", list: items.filter(isUnread) },
    { label: "Earlier", list: items.filter((n) => !isUnread(n)) },
  ].filter((g) => g.list.length);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors ${open ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[400px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 max-sm:fixed max-sm:inset-x-2 max-sm:top-14 max-sm:mt-0 max-sm:w-auto"
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between gap-2 border-b border-slate-100 px-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
              Notifications
              {unread > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">{unread} new</span>}
            </p>
            <button
              type="button"
              onClick={markAll}
              disabled={!unread}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all as read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[min(420px,62vh)] overflow-y-auto px-2 pb-2">
            {groups.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-slate-500">You're all caught up.</p>}
            {groups.map((g) => (
              <div key={g.label} className="pt-2">
                <p className="flex items-center justify-between px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.label}
                  <span className="font-medium normal-case tracking-normal text-slate-300">{g.list.length}</span>
                </p>
                <ul>
                  {g.list.map((n) => {
                    const k = KIND[n.kind] || KIND.docs;
                    const un = isUnread(n);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                            onOpenClaim?.(n.claimNo);
                          }}
                          className={`group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50 ${un ? "bg-teal-50/40" : ""}`}
                        >
                          <span className={`mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-lg ring-1 ring-inset ${k.tile}`}>
                            <k.Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={`truncate text-[13px] leading-tight ${un ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{n.title}</span>
                              <span className="flex-none text-[10.5px] text-slate-400">{n.time}</span>
                            </span>
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{n.text}</span>
                            <span className="mt-0.5 block font-mono text-[11px] font-semibold text-teal-700">{n.claimNo}</span>
                          </span>
                          <span className="mt-1 flex w-2 flex-none justify-center">
                            {un && <span className="h-2 w-2 rounded-full bg-teal-600" aria-label="Unread" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onViewAll?.();
            }}
            className="flex w-full items-center justify-center gap-1 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[12px] font-semibold text-teal-700 hover:bg-slate-100"
          >
            View alerts in My Work Queue
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}