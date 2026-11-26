// src/pages/od/ODSearch.jsx
// Search Claims – Universal Claim Search (catalogue 178). Opens from the header search icon.
//   Quick search    : claim number, policy number, vehicle number, mobile number
//   Advanced search : customer name, garage name, surveyor type, surveyor name, status, loss type,
//                     registered from / to
// Searches open and closed claims. The criteria sit in the URL, so Back from a claim returns to the
// same results. Eye = Claim 360 read only; pen = Claim 360 ready to work (open claims only).

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ChevronDown, Eye, Pencil, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { useAuth, getRole } from "../../auth";
import { claimSlug } from "../../data/odClaimDetail";
import { BASIC_FIELDS, ADVANCED_KEYS, SEARCH_KEYS, searchIndex, searchOptions, runSearch, hasCriteria } from "../../data/claimSearch";

const PAGE_SIZE = 12;
const EMPTY = Object.fromEntries(SEARCH_KEYS.map((k) => [k, ""]));
const fmtDate = (iso) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–");
const SLA_TONE = { breach: "text-red-700", risk: "text-amber-700", ok: "text-slate-600" };

const INPUT =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-[13.5px] text-slate-900 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 aria-[invalid=true]:border-red-600";

function Field({ id, label, hint, error, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12.5px] font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-[12px] text-red-700">
          {error}
        </p>
      ) : (
        hint && <p className="sr-only">{hint}</p>
      )}
    </div>
  );
}

// Field rules: number fields need at least 3 characters; mobile is digits only (4 to 10)
function validate(c) {
  const e = {};
  ["claim", "policy", "vehicle"].forEach((k) => {
    const v = c[k].trim();
    if (v && v.replace(/[\s\-/.]/g, "").length < 3) e[k] = "Enter at least 3 characters";
  });
  const m = c.mobile.trim();
  if (m && !/^\d{4,10}$/.test(m)) e.mobile = "Enter 4 to 10 digits";
  if (c.from && c.to && c.from > c.to) e.to = "Must be on or after the From date";
  return e;
}

export default function ODSearch() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // The handler is the surveyor, so searching by surveyor name is for the Claims Manager (team view)
  const { user } = useAuth();
  const isManager = getRole(user, "OD")?.role === "CLAIMS_MANAGER";
  // a surveyor-name filter only counts for the manager (the handler has no such field)
  const applied = useMemo(
    () => ({ ...EMPTY, ...Object.fromEntries(SEARCH_KEYS.filter((k) => isManager || k !== "svName").map((k) => [k, params.get(k) || ""])) }),
    [params, isManager]
  );
  const searched = hasCriteria(applied);

  const [draft, setDraft] = useState(applied);
  const [advanced, setAdvanced] = useState(() => ADVANCED_KEYS.some((k) => applied[k]));
  // Back / Forward between searches: show that search's values in the form
  const [seenQuery, setSeenQuery] = useState(params.toString());
  if (seenQuery !== params.toString()) {
    setSeenQuery(params.toString());
    setDraft(applied);
    if (ADVANCED_KEYS.some((k) => applied[k])) setAdvanced(true);
  }
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");

  const [index] = useState(searchIndex);
  const options = useMemo(() => searchOptions(index), [index]);
  const results = useMemo(() => (searched ? runSearch(index, applied) : []), [index, applied, searched]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = results.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const set = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    if (formError) setFormError("");
  };

  function submit(e) {
    e.preventDefault();
    if (!hasCriteria(draft)) {
      setFormError("Enter at least one search value.");
      return;
    }
    const errs = validate(draft);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const next = {};
    SEARCH_KEYS.forEach((k) => draft[k].trim() && (next[k] = draft[k].trim()));
    setPage(1);
    setParams(next); // a new history entry, so Back returns to the previous search
  }
  function clearAll() {
    setDraft(EMPTY);
    setErrors({});
    setFormError("");
    setPage(1);
    setParams({}, { replace: true });
  }
  function notBuilt(what) {
    setToast(`${what} – this page comes in a later build step.`);
    window.clearTimeout(notBuilt.t);
    notBuilt.t = window.setTimeout(() => setToast(""), 2600);
  }
  const openClaim = (no, edit) => navigate(`/od/claims/${claimSlug(no)}${edit ? "?view=work&mode=edit" : ""}`);

  // summary of what was searched, shown above the results
  const LABEL = { claim: "Claim", policy: "Policy", vehicle: "Vehicle", mobile: "Mobile", name: "Customer", garage: "Garage", svType: "Surveyor type", svName: "Surveyor", status: "Status", loss: "Loss type", from: "From", to: "To" };
  const summary = SEARCH_KEYS.filter((k) => applied[k]).map((k) => `${LABEL[k]}: ${k === "from" || k === "to" ? fmtDate(applied[k]) : applied[k]}`);

  const select = (k, label, list, allLabel = "Any") => (
    <Field id={`s-${k}`} label={label}>
      <select id={`s-${k}`} value={draft[k]} onChange={(e) => set(k, e.target.value)} className={INPUT}>
        <option value="">{allLabel}</option>
        {list.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <ODShell active="search" title="Search Claims" subtitle="Open and closed claims · quick and advanced search" onNavigateMissing={notBuilt}>
      <div className="flex flex-col gap-3">
        {/* ---------------- Criteria ---------------- */}
        <form onSubmit={submit} noValidate className="rounded-lg border border-slate-200 bg-white" aria-label="Search criteria">
          <div className="grid grid-cols-1 items-start gap-x-3 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            {BASIC_FIELDS.map((f) => (
              <Field key={f.key} id={`s-${f.key}`} label={f.label} hint={f.hint} error={errors[f.key]}>
                <input
                  id={`s-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => set(f.key, f.key === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value)}
                  placeholder={f.placeholder}
                  inputMode={f.inputMode}
                  autoComplete="off"
                  aria-invalid={!!errors[f.key]}
                  aria-describedby={errors[f.key] ? `s-${f.key}-err` : undefined}
                  className={INPUT}
                />
              </Field>
            ))}
            {/* actions – level with the inputs */}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:pt-[22px]">
              <button type="submit" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </button>
              <button type="button" onClick={clearAll} aria-label="Clear search" title="Clear" className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                aria-expanded={advanced}
                aria-controls="advanced-fields"
                className={`inline-flex h-9 items-center gap-1 rounded-md border px-3 text-[13px] font-semibold transition ${
                  advanced ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Advanced
                <ChevronDown className={`h-4 w-4 transition ${advanced ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          {advanced && (
            <div id="advanced-fields" className="grid grid-cols-1 gap-x-3 gap-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Advanced search">
              <Field id="s-name" label="Customer name">
                <input id="s-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Insured name" autoComplete="off" className={INPUT} />
              </Field>
              {select("garage", "Garage name", options.garage)}
              {select("svType", "Surveyor type", options.svType)}
              {isManager && select("svName", "Surveyor name", options.svName)}
              {select("status", "Claim status", ["Open", "Closed"], "Open and closed")}
              {select("loss", "Loss type", options.loss)}
              <Field id="s-from" label="Registered from">
                <input id="s-from" type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} className={INPUT} />
              </Field>
              <Field id="s-to" label="Registered to" error={errors.to}>
                <input id="s-to" type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} aria-invalid={!!errors.to} aria-describedby={errors.to ? "s-to-err" : undefined} className={INPUT} />
              </Field>
            </div>
          )}

          <p role="alert" aria-live="assertive" className={formError ? "border-t border-slate-100 px-4 py-2 text-[12.5px] text-red-700" : "sr-only"}>
            {formError}
          </p>
        </form>

        {/* ---------------- Results ---------------- */}
        {searched && (
          <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="results-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <h2 id="results-title" className="text-[14px] font-semibold text-slate-900" aria-live="polite">
                {results.length} {results.length === 1 ? "claim" : "claims"} found
              </h2>
              <p className="min-w-0 truncate text-[12.5px] text-slate-500" title={summary.join(" · ")}>
                {summary.join(" · ")}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[14px] font-medium text-slate-800">No claims match these details.</p>
                <p className="mt-1 text-[13px] text-slate-500">Check the number, enter fewer characters to match part of it, or widen the advanced filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed text-left text-[13px]">
                  <colgroup>
                    <col className="w-[168px]" />
                    <col />
                    <col className="w-[200px]" />
                    <col className="w-[144px]" />
                    <col className="w-[178px]" />
                    <col />
                    <col />
                    <col className="w-[92px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-600">
                      {["Claim · vehicle", "Insured · mobile", "Policy number", "Loss · registered", "Status", "Garage", "Surveyor"].map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 first:pl-5">
                          {h}
                        </th>
                      ))}
                      <th scope="col" className="px-5 py-2 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.claimNo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="whitespace-nowrap py-2 pl-5 pr-3">
                          <button type="button" onClick={() => openClaim(r.claimNo)} className="block font-mono text-[12.5px] font-semibold text-teal-700 hover:underline">
                            {r.claimNo}
                          </button>
                          <span className="block text-[12px] text-slate-600">{r.regNo}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="block truncate text-slate-800" title={r.insured}>
                            {r.insured}
                          </span>
                          <span className="block font-mono text-[12px] text-slate-500">{r.mobile}</span>
                        </td>
                        <td className="truncate px-3 py-2 font-mono text-[12px] text-slate-700" title={r.policyNo}>
                          {r.policyNo}
                        </td>
                        <td className="px-3 py-2">
                          <span className="block truncate text-slate-800" title={r.lossType}>
                            {r.lossType}
                          </span>
                          <span className="block text-[12px] text-slate-500">{fmtDate(r.regDate)}</span>
                        </td>
                        <td className="truncate px-3 py-2" title={r.status === "Open" ? `Open · ${r.stage} · ${r.sla.label}` : `Closed · ${r.closureType}`}>
                          {r.status === "Open" ? (
                            <span className="flex flex-col leading-tight">
                              <span className="font-medium text-slate-900">Open · {r.stage}</span>
                              <span className={`text-[12px] ${SLA_TONE[r.sla.status]}`}>{r.sla.label}</span>
                            </span>
                          ) : (
                            <span className="flex flex-col leading-tight">
                              <span className="font-medium text-slate-900">Closed · {r.closureType}</span>
                              <span className="text-[12px] text-slate-500">{fmtDate(r.closedOn)}</span>
                            </span>
                          )}
                        </td>
                        <td className="truncate px-3 py-2 text-slate-700" title={r.garage}>
                          {r.garage || "–"}
                        </td>
                        <td className="px-3 py-2">
                          {r.svName ? (
                            <span className="flex flex-col leading-tight">
                              <span className="truncate text-slate-800" title={r.svName}>
                                {r.svName}
                              </span>
                              <span className="truncate text-[12px] text-slate-500">{r.svType}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500" title="Surveyor not appointed yet">
                              –
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pl-3 pr-5">
                          <span className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openClaim(r.claimNo)} aria-label={`View ${r.claimNo}`} title="View claim" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700">
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {r.status === "Open" && (
                              <button type="button" onClick={() => openClaim(r.claimNo, true)} aria-label={`Work on ${r.claimNo}`} title="Work on this claim" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700">
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {results.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-[12.5px] text-slate-600">
                <span>
                  {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, results.length)} of {results.length}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)} aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="px-2 tabular-nums">
                    Page {cur} of {pages}
                  </span>
                  <button type="button" disabled={cur === pages} onClick={() => setPage(cur + 1)} aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
            )}
          </section>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}