// src/components/DocAutoFill.jsx
// "Upload to auto-fill" tiles (e.g. Driving licence, RC on Claim Intimation). Pick a photo / PDF →
// the tile shows "Reading…" while the document is read (OCR), then calls onRead(key, fileName) so
// the page can fill its fields. A read tile shows what was filled, with View (eye) and Replace.
// items: [{ key, title, hint, icon, done }] – done: null, or { summary, fileName }

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, Loader2, Upload } from "lucide-react";

const READ_MS = 1200; // demo: time the "OCR" takes

export default function DocAutoFill({ items, onRead, onView }) {
  const [reading, setReading] = useState(null);
  const timer = useRef(null);
  const inputs = useRef({});
  useEffect(() => () => clearTimeout(timer.current), []);

  function pick(key, e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again
    if (!file) return;
    setReading(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReading(null);
      onRead(key, file.name, file);
    }, READ_MS);
  }

  return (
    <div className={`grid grid-cols-1 gap-2 ${items.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {items.map((it) => {
        const Icon = it.icon;
        const busy = reading === it.key;
        const done = !busy && it.done;
        const noun = /^[A-Z]+$/.test(it.title) ? it.title : it.title.toLowerCase(); // "RC" stays "RC"
        return (
          <div
            key={it.key}
            className={`flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 ${
              done ? "border-emerald-200 bg-emerald-50/60" : busy ? "border-teal-200 bg-teal-50/60" : "border-dashed border-slate-300 bg-slate-50/60"
            }`}
          >
            <span
              className={`grid h-8 w-8 flex-none place-items-center rounded-md ${done ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
              aria-hidden="true"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-[12.5px] font-semibold text-slate-800">
                {busy ? `Reading ${noun}…` : done ? `${it.title} read` : `Upload ${noun}`}
              </p>
              <p className="truncate text-[12px] text-slate-600" title={done ? `${it.done.fileName} – ${it.done.summary}` : it.hint}>
                {busy ? "Extracting details – a moment" : done ? it.done.summary : it.hint}
              </p>
            </div>
            <input
              ref={(el) => (inputs.current[it.key] = el)}
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => pick(it.key, e)}
            />
            {done && onView && (
              <button
                type="button"
                onClick={() => onView(it.key)}
                aria-label={`View ${it.title}`}
                title={`View ${it.title}`}
                className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-teal-800 hover:bg-white"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                View
              </button>
            )}
            <button
              type="button"
              disabled={!!reading}
              onClick={() => inputs.current[it.key]?.click()}
              className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold disabled:opacity-50 ${
                done ? "text-teal-800 hover:bg-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {!done && <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
              {done ? "Replace" : "Upload"}
              <span className="sr-only"> {it.title}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}