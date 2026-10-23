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
//   size           – "md" (36 px, header) or "sm" (28 px, filter rows)

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

  const btn = size === "sm" ? "h-7 w-7 rounded" : "h-9 w-9 rounded-lg";
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
          open || active ? "bg-teal-50 text-teal-800" : size === "sm" ? "border border-slate-300 bg-white" : ""
        }`}
      >
        <Search className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} aria-hidden="true" />
        {active && !open && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-50 mt-1.5 w-[400px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:mt-0 max-sm:w-auto ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
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
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-8 text-[13px] placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  input.current?.focus();
                }}
                aria-label="Clear search text"
                className="absolute right-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div id={listId} role="listbox" aria-label="Suggestions" className="max-h-[min(360px,60vh)] overflow-y-auto py-1">
            {flat.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-slate-500">
                {q.trim() ? `No match for “${q.trim()}”.` : "Start typing to search."}
              </p>
            ) : (
              groups.map(
                (g) =>
                  g.items.length > 0 && (
                    <div key={g.group}>
                      <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
                      {g.items.map((it) => {
                        n += 1;
                        const idx = n;
                        const Icon = it.icon;
                        return (
                          <button
                            key={it.id}
                            id={`${listId}-${idx}`}
                            type="button"
                            role="option"
                            aria-selected={hi === idx}
                            onMouseEnter={() => setHi(idx)}
                            onClick={() => choose(it)}
                            className={`flex w-full items-start gap-2.5 px-3 py-1.5 text-left ${hi === idx ? "bg-teal-50" : "hover:bg-slate-50"}`}
                          >
                            {Icon && <Icon className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold text-slate-800">{it.title}</span>
                              {it.subtitle && <span className="block truncate text-[11.5px] text-slate-500">{it.subtitle}</span>}
                            </span>
                            {it.meta && (
                              <span
                                className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                                  it.metaTone === "red"
                                    ? "bg-red-50 text-red-700"
                                    : it.metaTone === "amber"
                                    ? "bg-amber-50 text-amber-800"
                                    : it.metaTone === "teal"
                                    ? "bg-teal-50 text-teal-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {it.meta}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
              )
            )}
          </div>

          <p className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            <span>↑ ↓ to move</span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
              {onSubmit && submitLabel ? submitLabel : "to open"}
            </span>
            <span>Esc to close</span>
          </p>
        </div>
      )}
    </div>
  );
}