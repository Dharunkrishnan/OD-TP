// src/components/DocViewer.jsx
// Opens an uploaded document (eye icon): the photo / PDF on the left and, for a document that was
// read (DL, RC), the details taken from it on the right – so the handler can check them side by side.
// Escape, the ✕ or a click outside closes it.

import { useEffect, useRef } from "react";
import { Download, FileText, X } from "lucide-react";
import { getDoc } from "../data/docStore";

export default function DocViewer({ name, title, details, onClose }) {
  const closeRef = useRef(null);
  const doc = getDoc(name);
  const isImg = doc && (doc.type.startsWith("image/") || /^data:image\//.test(doc.url));
  const isPdf = doc && (doc.type === "application/pdf" || /^data:application\/pdf/.test(doc.url));

  useEffect(() => {
    const back = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="doc-viewer-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex min-h-11 flex-none items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
          <div className="min-w-0">
            <h2 id="doc-viewer-title" className="text-[14px] font-semibold text-[#0B1F3A]">
              {title || "Document"}
            </h2>
            <p className="truncate text-[12px] text-slate-500">{name}</p>
          </div>
          <div className="flex items-center gap-1">
            {doc && (
              <a href={doc.url} download={name.replace(/^(DL|RC) – /, "")} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-teal-800 hover:bg-teal-50">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </a>
            )}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close document" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={`grid min-h-0 flex-1 grid-cols-1 ${details ? "md:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
          <div className="grid min-h-[320px] place-items-center overflow-auto bg-slate-100 p-3">
            {!doc ? (
              <p className="max-w-sm text-center text-[12.5px] text-slate-600">
                Preview not available – the file was too large to keep after the page was refreshed. Upload it again to view.
              </p>
            ) : isImg ? (
              <img src={doc.url} alt={title || name} className="max-h-[72vh] max-w-full rounded border border-slate-200 bg-white object-contain shadow-sm" />
            ) : isPdf ? (
              <iframe src={doc.url} title={title || name} className="h-[72vh] w-full rounded border border-slate-200 bg-white" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center text-[12.5px] text-slate-600">
                <FileText className="h-8 w-8 text-slate-400" aria-hidden="true" />
                No preview for this file type – use Download to open it.
              </div>
            )}
          </div>
          {details && (
            <div className="overflow-y-auto border-t border-slate-200 md:border-l md:border-t-0">
              <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">{details.title}</p>
              <dl className="divide-y divide-slate-100">
                {details.rows.map(([k, v]) => (
                  <div key={k} className="px-3 py-1.5">
                    <dt className="text-[11px] text-slate-500">{k}</dt>
                    <dd className="text-[12.5px] font-medium text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              {details.note && <p className="px-3 py-2 text-[11.5px] text-slate-500">{details.note}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}