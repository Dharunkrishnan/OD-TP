// src/components/FilePicker.jsx
// One file field used by Upload document, Record invoice and Signed voucher.
// The browser's own "Choose File / No file chosen" control is hidden (its text got cut in narrow
// dialogs); the dashed box shows our own Browse button and the chosen file name in full.

import { Upload, Paperclip, X } from "lucide-react";

export default function FilePicker({ file, onChange, label, invalid, accept = ".pdf,.jpg,.jpeg,.png" }) {
  const kb = file ? Math.max(1, Math.round(file.size / 1024)) : 0;
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2 text-[12.5px] ${invalid ? "border-red-400 bg-red-50/30" : file ? "border-teal-600 bg-teal-50/40" : "border-slate-300"}`}>
      {file ? <Paperclip className="h-4 w-4 flex-none text-teal-700" aria-hidden="true" /> : <Upload className="h-4 w-4 flex-none text-slate-400" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        {file ? (
          <>
            <span className="block break-all font-medium text-slate-800">{file.name}</span>
            <span className="block text-[11px] text-slate-500">{kb.toLocaleString("en-IN")} KB</span>
          </>
        ) : (
          <span className="text-slate-500">No file chosen</span>
        )}
      </span>
      {file && (
        <button type="button" onClick={() => onChange(null)} aria-label="Remove file" title="Remove file" className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <label className="flex h-8 flex-none cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-teal-600/30">
        {file ? "Change" : "Browse"}
        <input
          type="file"
          accept={accept}
          aria-label={label}
          className="sr-only"
          onChange={(e) => {
            onChange(e.target.files?.[0] || null);
            e.target.value = ""; // allow picking the same file again after Remove
          }}
        />
      </label>
    </div>
  );
}