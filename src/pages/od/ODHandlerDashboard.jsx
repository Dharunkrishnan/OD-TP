// src/pages/od/ODHandlerDashboard.jsx
// P01 · OD Claims Handler Dashboard (persona: Karthik Subramanian · OD0123)
// The Claims Handler is also the surveyor (one persona).
// Two views, switched from the header:
//   My Day      – the work to act on today            → components/HandlerMyDay.jsx
//   Performance – SLA, TAT, ageing, pending, outcomes  → components/HandlerPerformance.jsx
// Catalogue: 160, 161, 166, 168, 180, 181, 182, 184. All figures are live and open My Work Queue.

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListTodo, BarChart3 } from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import HandlerMyDay from "../../components/HandlerMyDay";
import HandlerPerformance from "../../components/HandlerPerformance";

const VIEWS = [
  { key: "myday", label: "My Day", Icon: ListTodo, hint: "Claims and tasks to act on today" },
  { key: "performance", label: "Performance", Icon: BarChart3, hint: "SLA, TAT, ageing and outcomes of my claims" },
];

export default function ODHandlerDashboard() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "performance" ? "performance" : "myday";
  const setView = (v) => setParams(v === "performance" ? { view: v } : {}, { replace: true });
  const [toast, setToast] = useState("");

  function notBuilt(what) {
    setToast(`${what} – this page comes in a later build step.`);
    window.clearTimeout(notBuilt.t);
    notBuilt.t = window.setTimeout(() => setToast(""), 2600);
  }

  // View switch – shown in the header in place of the page title
  const viewTabs = (
    <div className="flex min-w-0 items-center gap-3">
      <div role="tablist" aria-label="Dashboard view" className="inline-flex flex-none rounded-lg bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200">
        {VIEWS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition sm:px-3 ${
              view === t.key ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <t.Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t.label}</span>
          </button>
        ))}
      </div>
      <span className="hidden truncate text-[12px] text-slate-500 md:inline">{VIEWS.find((t) => t.key === view).hint}</span>
    </div>
  );

  return (
    <ODShell active="dashboard" title="My Dashboard" headerSlot={viewTabs} onNavigateMissing={notBuilt}>
      {view === "myday" ? <HandlerMyDay /> : <HandlerPerformance />}
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}