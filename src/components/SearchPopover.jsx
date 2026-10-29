// src/components/SearchPopover.jsx
// Search as an icon only. Click / tap the icon → a panel opens with a search box
// and suggestions. Suggestions show straight away (before typing) and narrow as you type.
//
// Props:
//   label          – accessible name + panel heading, e.g. "Search claims"
//   placeholder    – text inside the search box
//   suggest(q)     – returns [{ group, items: [{ id, title, subtitle, meta, metaTone, icon, onSelect }] }]
//                    called with "" when the panel opens (show recent / quick picks)
//   onSubmit(q)    – optional; Enter with no suggestion highlighted (e.g. apply as a filter)
//   submitLabel    – optional text for the "press Enter" hint, e.g. "filter the queue"
//   active         – optional applied search text; shows a dot on the icon
//   align          – "right" (default) or "left": which edge of the icon the panel lines up with
//   size           – "md" (36 px, header), "sm" (28 px) or "pill" (32 px round, matches pill filters)

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";

export default function SearchPopover({
  label = "Search",
  placeholder = "Search",
  suggest,
  onSubmit,
  submitLabel,
  active,
  align = "right",
  size = "md",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(-1); // highlighted suggestion index
  const wrap = useRef(null);
  const input = useRef(null);
  const listId = useId();

  const groups = useMemo(() => (open ? suggest?.(q.trim()) || [] : []), [open, q, suggest]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function openPanel() {
    setQ(active || "");
    setHi(-1);
    setOpen(true);
    window.setTimeout(() => input.current?.focus(), 0);
  }

  function choose(item) {
    setOpen(false);
    item.onSelect?.();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hi >= 0 && flat[hi]) choose(flat[hi]);
      else if (onSubmit) {
        onSubmit(q.trim());
        setOpen(false);
      } else if (flat.length === 1) choose(flat[0]);
    }
  }

  const btn = size === "sm" ? "h-7 w-7 rounded" : size === "pill" ? "h-8 w-8 rounded-full" : "h-9 w-9 rounded-lg";
  let n = -1;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={active ? `${label} (current: ${active})` : label}
        aria-expanded={open}
        title={label}
        className={`relative grid flex-none place-items-center text-slate-600 hover:bg-slate-100 ${btn} ${
          open || active
            ? `bg-teal-50 text-teal-800 ${size === "pill" ? "border border-teal-600" : ""}`
            : size === "sm" || size === "pill"
            ? "border border-slate-300 bg-white"
            : ""
        }`}
      >
        <Search className={size === "md" ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden="true" />
        {active && !open && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute z-50 w-[440px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 ${
            // Header (md): the search line opens ON the icon, in the header row itself; other sizes drop below
            size === "md"
              ? "-top-1.5 max-sm:fixed max-sm:inset-x-2 max-sm:top-0 max-sm:w-auto"
              : "top-full mt-2 max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:mt-0 max-sm:w-auto"
          } ${align === "left" ? "left-0" : "-right-1.5"}`}
        >
          {/* Search row – one clean line, no inner box */}
          <div className="flex h-12 items-center gap-2.5 border-b border-slate-100 px-4">
            <Search className="h-[18px] w-[18px] flex-none text-teal-700" aria-hidden="true" />
            <input
              ref={input}
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(-1);
              }}
              onKeyDown={onKey}
              placeholder={placeholder}
              aria-label={label}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={hi >= 0 ? `${listId}-${hi}` : undefined}
              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  input.current?.focus();
                }}
                aria-label="Clear search text"
                className="grid h-6 w-6 flex-none place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd className="flex-none rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-slate-500">Esc</kbd>
            )}
          </div>

          <div id={listId} role="listbox" aria-label="Suggestions" className="max-h-[min(380px,60vh)] overflow-y-auto px-2 pb-2 pt-1">
            {flat.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-[13px] font-medium text-slate-700">{q.trim() ? `No match for “${q.trim()}”` : "Start typing to search"}</p>
                <p className="text-[11.5px] text-slate-500">Try a claim no, vehicle no, policy no or the insured's name.</p>
              </div>
            ) : (
              groups.map(
                (g) =>
                  g.items.length > 0 && (
                    <div key={g.group} className="pt-2 first:pt-1">
                      <p className="flex items-center justify-between px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                        {g.group}
                        <span className="font-medium normal-case tracking-normal text-slate-300">{g.items.length}</span>
                      </p>
                      {g.items.map((it) => {
                        n += 1;
                        const idx = n;
                        const Icon = it.icon;
                        const on = hi === idx;
                        return (
                          <button
                            key={it.id}
                            id={`${listId}-${idx}`}
                            type="button"
                            role="option"
                            aria-selected={on}
                            onMouseEnter={() => setHi(idx)}
                            onClick={() => choose(it)}
                            className={`group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${on ? "bg-teal-50" : "hover:bg-slate-50"}`}
                          >
                            <span
                              className={`grid h-9 w-9 flex-none place-items-center rounded-lg transition-colors ${
                                on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-[13px] font-semibold leading-tight ${on ? "text-teal-900" : "text-slate-800"}`}>{it.title}</span>
                              {it.subtitle && <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-slate-500">{it.subtitle}</span>}
                            </span>
                            {it.meta && (
                              <span
                                className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                                  it.metaTone === "red"
                                    ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                                    : it.metaTone === "amber"
                                    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                                    : it.metaTone === "teal"
                                    ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {it.meta}
                              </span>
                            )}
                            <CornerDownLeft className={`h-3.5 w-3.5 flex-none ${on ? "text-teal-700" : "text-transparent"}`} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  )
              )
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px] shadow-sm">↑</kbd>
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px] shadow-sm">↓</kbd>
              to move
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px] shadow-sm">↵</kbd>
              {onSubmit && submitLabel ? submitLabel : "to open"}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px] shadow-sm">Esc</kbd>
              to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}