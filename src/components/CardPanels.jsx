// src/components/CardPanels.jsx
// Page panels inside the main card (e.g. Registration checks, Call guide on Claim Intimation) –
// "peek and pin":
//   • Peek – hover a button in the card header (or tab onto it) and a quick preview drops down
//     under it. Moving away closes it. Nothing on the page moves.
//   • Pin – click the button (or "Pin" in the preview) and the panel stays open as a floating card
//     over the right side of the form (the form keeps its full width), kept in view while the page
//     scrolls. Several panels can be pinned;
//     they stack. Click the button again, or the pin on the card, to unpin.
//   Escape closes a preview. Pinned panels stay until unpinned – that is the point of pinning.
// tools: [{ key, label, title, icon, status, content }]
//   status – optional { tone: "green" | "amber" | "red" | "slate", text }: a number shows as a count,
//            any other text as a coloured dot (spelled out on hover and for screen readers)

import { useEffect, useRef, useState } from "react";
import { Pin, PinOff } from "lucide-react";

const DOT = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-600", slate: "bg-slate-400" };
const SHADOW = "shadow-[0_12px_32px_-8px_rgba(15,23,42,0.28),0_2px_6px_rgba(15,23,42,0.08)]";
const OPEN_DELAY = 180; // ms – a pointer just passing over the header should not flash previews
const CLOSE_DELAY = 160; // ms – time to move the pointer from the button into the preview

export function PanelButtons({ tools, pinned, onTogglePin }) {
  const [peek, setPeek] = useState(null);
  const timer = useRef(null);
  const clear = () => clearTimeout(timer.current);
  const later = (fn, ms) => {
    clear();
    timer.current = setTimeout(fn, ms);
  };
  useEffect(() => clear, []);
  // a preview for a panel that has gone (e.g. "Search tips" once a policy is picked) closes itself
  const peekTool = tools.find((t) => t.key === peek && !pinned.includes(t.key)) || null;

  useEffect(() => {
    if (!peekTool) return undefined;
    const onKey = (e) => e.key === "Escape" && setPeek(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [peekTool]);

  return (
    <div role="group" aria-label="Side panels" className="flex flex-wrap items-center gap-1">
      {tools.map((t) => {
        const on = pinned.includes(t.key);
        const peeking = peekTool?.key === t.key;
        const Icon = t.icon;
        const st = t.status;
        const count = st && /^\d+$/.test(String(st.text));
        const name = `${t.title}${st?.text ? ` – ${st.text}` : ""}`;
        return (
          <div
            key={t.key}
            className="relative"
            onPointerEnter={(e) => e.pointerType === "mouse" && !on && later(() => setPeek(t.key), peek ? 0 : OPEN_DELAY)}
            onPointerLeave={(e) => e.pointerType === "mouse" && later(() => setPeek(null), CLOSE_DELAY)}
          >
            <button
              type="button"
              onClick={() => {
                clear();
                setPeek(null);
                onTogglePin(t.key);
              }}
              onFocus={(e) => !on && e.target.matches(":focus-visible") && setPeek(t.key)}
              onBlur={(e) => !e.currentTarget.parentElement.contains(e.relatedTarget) && setPeek(null)}
              aria-pressed={on}
              aria-expanded={on ? undefined : peeking}
              aria-controls={on ? `card-panel-${t.key}` : peeking ? `card-peek-${t.key}` : undefined}
              aria-label={`${name}${on ? " – pinned" : ""}`}
              title={on ? `${name} – click to unpin` : `${name} – click to pin`}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-semibold transition ${
                on
                  ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
                  : peeking
                    ? "border-slate-300 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
              {count && (
                <span className={`rounded px-1 text-[11px] font-bold leading-4 ${on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`} aria-hidden="true">
                  {st.text}
                </span>
              )}
              {st && !count && <span className={`h-2 w-2 rounded-full ${DOT[st.tone || "slate"]}`} aria-hidden="true" />}
              {on && <Pin className="h-3 w-3 fill-current" aria-hidden="true" />}
            </button>

            {peeking && (
              <div
                id={`card-peek-${t.key}`}
                role="region"
                aria-label={`${t.title} – preview`}
                className={`absolute right-0 top-full z-40 mt-1 flex w-[300px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left font-normal ${SHADOW}`}
              >
                <div className="flex min-h-9 flex-none items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1">
                  <p className="text-[12.5px] font-semibold text-[#0B1F3A]">{t.title}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPeek(null);
                      onTogglePin(t.key);
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[12px] font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    Pin
                  </button>
                </div>
                <div className="max-h-[min(60vh,420px)] min-h-0 overflow-y-auto">{t.content}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The pinned panels, stacked in the order they were pinned
export function PinnedPanels({ tools, onUnpin }) {
  if (!tools.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {tools.map((t) => (
        <aside key={t.key} id={`card-panel-${t.key}`} aria-label={t.title} className={`flex w-full flex-none flex-col overflow-hidden rounded-lg border border-slate-200 bg-white ${SHADOW}`}>
          <div className="flex min-h-9 flex-none items-center justify-between gap-2 border-b border-slate-100 px-3 py-1">
            <h2 className="text-[13px] font-semibold text-[#0B1F3A]">{t.title}</h2>
            <button
              type="button"
              onClick={() => onUnpin(t.key)}
              aria-label={`Unpin ${t.title}`}
              title="Unpin"
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <PinOff className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div>{t.content}</div>
        </aside>
      ))}
    </div>
  );
}