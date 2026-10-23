// src/pages/od/ODIntimation.jsx
// P02 · Claim Intimation (FNOL – First Notice of Loss) for Motor OD.
// One combined activity: intimation + registration. On submit the system runs the
// registration jobs (duplicate check, policy & coverage validation, dates, reserve,
// assignment). Result = Claim registered, NBNR (Notified But Not Registered) or Duplicate.
// Catalogue refs: FNOL 1–12, Claim Registration 13–17, Reserve 18, Policy & Coverage 22–29.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  X,
  Pencil,
  Car,
  ShieldCheck,
  Inbox,
  Copy,
  CloudRain,
  Wrench,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { claimSlug } from "../../data/odClaimDetail";
import {
  TODAY_ISO,
  searchPolicy,
  registrationIssues,
  findDuplicate,
  catEventFor,
  submitIntimation,
  daysBetween,
  LOSS_CAUSES,
  CHANNELS,
  INTIMATED_BY,
  NETWORK_GARAGES,
  LATE_INTIMATION_DAYS,
  DEMO_POLICIES,
} from "../../data/odPolicyMock";

const STEPS = ["Policy & Vehicle Details", "Customer Details", "Incident Details", "Additional Information", "Review & Submit"];

const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));
const dt = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";
const maskMobile = (m) => (m && m.length === 10 ? `${m.slice(0, 2)}XXXXX${m.slice(7)}` : m || "–");

const EMPTY = {
  // step 1
  search: "",
  policy: null,
  noPolicy: false,
  manualRegNo: "",
  manualVehicle: "",
  // step 2
  lossDate: "",
  lossTime: "",
  cause: "",
  place: "",
  city: "Chennai",
  description: "",
  beingDriven: "yes",
  policeReported: "no",
  firNo: "",
  policeStation: "",
  tpInvolved: "no",
  tpVehicleNo: "",
  injury: "no",
  lateReason: "",
  catEvent: null,
  // step 3
  mobile: "",
  altMobile: "",
  email: "",
  language: "Tamil",
  intimatedBy: "Insured",
  channel: "Call centre",
  callerName: "",
  driverSameAsInsured: true,
  driverName: "",
  dlNo: "",
  dlValidTill: "",
  // step 4
  vehicleLocation: "garage",
  garage: "",
  otherGarage: "",
  surveyType: "garage",
  files: [],
  remarks: "",
  // step 5
  declaration: false,
};

/* ------------------------------------------------------------------ */
/* Small UI blocks                                                     */
/* ------------------------------------------------------------------ */
function Card({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 px-3 py-0.5">
          <h2 className="text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, required, error, hint, children, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[12px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="text-[11.5px] text-red-700">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls = (err) =>
  `h-9 w-full rounded-md border bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500 ${
    err ? "border-red-500 focus:border-red-600 focus:ring-red-600/15" : "border-slate-300 focus:border-teal-700 focus:ring-teal-700/15"
  }`;

function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex self-start rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded px-3 text-[12.5px] font-medium ${value === o.value ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Banner({ kind = "info", title, children }) {
  const map = {
    info: { cls: "border-sky-200 bg-sky-50 text-sky-900", Icon: Info },
    warn: { cls: "border-amber-300 bg-amber-50 text-amber-900", Icon: AlertTriangle },
    error: { cls: "border-red-200 bg-red-50 text-red-900", Icon: XCircle },
    ok: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  };
  const { cls, Icon } = map[kind];
  return (
    <div role={kind === "error" || kind === "warn" ? "alert" : "status"} className={`flex gap-2.5 rounded-md border px-3 py-2 text-[12.5px] ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

function Check3({ ok, label, note }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px]">
      {ok ? (
        <CheckCircle2 className="mt-px h-4 w-4 flex-none text-emerald-600" aria-label="Passed" />
      ) : (
        <XCircle className="mt-px h-4 w-4 flex-none text-red-600" aria-label="Failed" />
      )}
      <span>
        <span className="text-slate-800">{label}</span>
        {note && <span className={`block text-[11.5px] ${ok ? "text-slate-500" : "text-red-700"}`}>{note}</span>}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Validation per step                                                 */
/* ------------------------------------------------------------------ */
function validate(step, f) {
  const e = {};
  if (step === 0) {
    if (!f.policy && !f.noPolicy) e.policy = "Search and select the policy, or continue without a policy.";
    if (f.noPolicy && !f.manualRegNo.trim()) e.manualRegNo = "Enter the vehicle registration number.";
  }
  if (step === 1) {
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
    if (f.altMobile && !/^[6-9]\d{9}$/.test(f.altMobile)) e.altMobile = "Enter a valid 10-digit number or leave blank.";
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email or leave blank.";
    if (f.intimatedBy !== "Insured" && !f.callerName.trim()) e.callerName = "Enter the name of the person intimating.";
  }
  if (step === 2) {
    if (!f.lossDate) e.lossDate = "Enter the date of loss.";
    else if (f.lossDate > TODAY_ISO) e.lossDate = "Loss date cannot be in the future.";
    if (!f.lossTime) e.lossTime = "Enter the approximate time of loss.";
    if (!f.cause) e.cause = "Select the cause of loss.";
    if (!f.place.trim()) e.place = "Enter where the loss happened.";
    if (f.description.trim().length < 20) e.description = "Describe what happened (at least 20 characters).";
    if (f.lossDate && daysBetween(f.lossDate, TODAY_ISO) > LATE_INTIMATION_DAYS && !f.lateReason.trim())
      e.lateReason = `Intimation is more than ${LATE_INTIMATION_DAYS} days after the loss – give the reason.`;
    const firNeeded = f.cause === "theft" || f.cause === "fire" || f.injury === "yes";
    if ((firNeeded || f.policeReported === "yes") && !f.firNo.trim())
      e.firNo = firNeeded ? "FIR / police report number is mandatory for this loss." : "Enter the FIR / report number.";
    if (f.tpInvolved === "yes" && !f.tpVehicleNo.trim()) e.tpVehicleNo = "Enter the third-party vehicle number (or 'Unknown').";
    if (driverNeeded(f)) {
      if (!f.driverSameAsInsured && !f.driverName.trim()) e.driverName = "Enter the driver's name.";
      if (!f.dlNo.trim()) e.dlNo = "Enter the driving licence number.";
      if (!f.dlValidTill) e.dlValidTill = "Enter the DL validity date.";
    }
  }
  if (step === 3) {
    // Theft: vehicle is not traced, so no garage is needed
    if (f.cause !== "theft" && f.vehicleLocation === "garage" && !f.garage) e.garage = "Select the garage where the vehicle is / will be taken.";
    if (f.cause !== "theft" && f.garage === "other" && !f.otherGarage.trim()) e.otherGarage = "Enter the garage name and address.";
  }
  if (step === 4) {
    if (!f.declaration) e.declaration = "Confirm the declaration to submit.";
  }
  return e;
}

const driverNeeded = (f) => f.beingDriven === "yes" && !["theft", "flood", "partialTheft"].includes(f.cause);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function ODIntimation() {
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState(null); // null = not searched
  const [result, setResult] = useState(null); // outcome after submit
  const [toast, setToast] = useState("");

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(""), 2600);
  }
  const notBuilt = (what) => flash(`${what} – this page comes in a later build step.`);

  // Live checks (immediate validation)
  const issues = useMemo(() => (f.policy || f.noPolicy ? registrationIssues(f.policy, f.lossDate) : []), [f.policy, f.noPolicy, f.lossDate]);
  const duplicate = useMemo(() => findDuplicate(f.policy?.regNo || f.manualRegNo, f.lossDate), [f.policy, f.manualRegNo, f.lossDate]);
  const suggestedCat = useMemo(() => (f.cause && f.lossDate ? catEventFor(f.cause, f.lossDate) : null), [f.cause, f.lossDate]);
  const delay = f.lossDate ? daysBetween(f.lossDate, TODAY_ISO) : 0;
  const brand = (f.policy?.vehicle || f.manualVehicle || "").split(" ")[0];
  const recommended = NETWORK_GARAGES.filter((g) => g.brands.includes(brand));

  function doSearch(e) {
    e?.preventDefault();
    const r = searchPolicy(f.search);
    setResults(r);
    if (r.length === 1) set({ policy: r[0], noPolicy: false });
    else set({ policy: null });
  }

  function choosePolicy(p) {
    set({ policy: p, noPolicy: false, mobile: f.mobile || p.mobile, email: f.email || p.email });
    setErrors({});
  }

  function next() {
    const e = validate(step, f);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step === 0 && f.policy) set({ mobile: f.mobile || f.policy.mobile, email: f.email || f.policy.email });
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }
  function goTo(i) {
    if (i <= maxStep) {
      setErrors({});
      setStep(i);
    }
  }
  function submit() {
    const e = validate(4, f);
    setErrors(e);
    if (Object.keys(e).length) return;
    setResult(submitIntimation(f));
  }
  function reset() {
    setF(EMPTY);
    setStep(0);
    setMaxStep(0);
    setErrors({});
    setResults(null);
    setResult(null);
  }

  /* ================= Outcome screen ================= */
  if (result) {
    const mobile = maskMobile(f.mobile);
    return (
      <ODShell active="intimation" title="Claim Intimation" subtitle="Motor Own Damage · FNOL" onNavigateMissing={notBuilt}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {result.outcome === "registered" && (
            <Card>
              <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-[#0B1F3A]">Claim registered</h2>
                <p className="font-mono text-xl font-semibold text-teal-800">{result.claimNo}</p>
                <p className="text-[12.5px] text-slate-600">
                  Acknowledgement with claim number sent by SMS to {mobile}
                  {f.email ? " and by email" : ""}. e-Claim form generated and saved to the claim.
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-100 px-6 py-4 text-[12.5px] sm:grid-cols-2">
                {[
                  ["Insured", f.policy.insured],
                  ["Vehicle", `${f.policy.regNo} · ${f.policy.vehicle}`],
                  ["Loss", `${result.lossType} · ${dt(f.lossDate)} ${f.lossTime}`],
                  ["Initial reserve (standard)", inr(result.reserve)],
                  ["Assigned to", result.assignedTo],
                  ["Next step", result.surveyRoute],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {result.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-6 py-3">
                  {result.flags.map((fl) => (
                    <span key={fl} className="rounded bg-amber-50 px-2 text-[11.5px] font-semibold leading-6 text-amber-900">
                      {fl}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {result.outcome === "nbnr" && (
            <Card>
              <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
                  <Inbox className="h-7 w-7" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-[#0B1F3A]">Notified but not registered (NBNR)</h2>
                <p className="font-mono text-xl font-semibold text-amber-800">{result.ref}</p>
                <p className="max-w-lg text-[12.5px] text-slate-600">
                  The intimation is saved with a reference number and parked in the NBNR bucket. No claim number or reserve is created until the
                  reason below is resolved. Acknowledgement sent by SMS to {mobile}.
                </p>
              </div>
              <div className="border-t border-slate-100 px-6 py-4">
                <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Reason(s)</p>
                <ul className="flex flex-col gap-1">
                  {result.reasons.map((r) => (
                    <li key={r.code} className="flex items-start gap-2 text-[12.5px] text-slate-800">
                      <XCircle className="mt-px h-4 w-4 flex-none text-amber-600" aria-hidden="true" />
                      {r.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11.5px] text-slate-500">
                  Next: resolve from the NBNR bucket – convert to a claim once fixed (e.g. premium realised, correct policy found), or close with
                  reason.
                </p>
              </div>
            </Card>
          )}

          {result.outcome === "duplicate" && (
            <Card>
              <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700">
                  <Copy className="h-7 w-7" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-[#0B1F3A]">Duplicate – not registered</h2>
                <p className="max-w-lg text-[12.5px] text-slate-600">
                  A claim already exists for this vehicle with a loss date within one day. The new intimation was not registered. Add any new
                  information to the existing claim instead.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/od/claims/${claimSlug(result.existing.claimNo)}`)}
                  className="mt-1 flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="font-mono text-[13px] font-semibold text-teal-800">{result.existing.claimNo}</span>
                  <span className="text-[12px] text-slate-600">
                    {result.existing.stage} · loss {dt(result.existing.lossDate)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </button>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={reset} className="h-9 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800">
              Intimate another claim
            </button>
            <button
              type="button"
              onClick={() => navigate("/od/worklist")}
              className="h-9 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go to My Work Queue
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">Demo: new claims are not added to the demo work queue.</p>
        </div>
      </ODShell>
    );
  }

  /* ================= Wizard ================= */
  // After the user tries to move on, errors re-check live as fields are corrected
  const err = Object.keys(errors).length ? validate(step, f) : {};
  const willBeNbnr = issues.some((i) => i.nbnr);

  return (
    <ODShell active="intimation" title="Claim Intimation" subtitle="Motor Own Damage · FNOL – intimation and registration in one step" onNavigateMissing={notBuilt}>
      <div className="flex flex-col gap-2">
        {/* ---------- Stepper ---------- */}
        <Card>
          <ol className="flex items-center overflow-x-auto px-4 py-2.5" aria-label="Intimation steps">
            {STEPS.map((label, i) => {
              const done = i < maxStep && i !== step; // steps before the furthest one reached
              const cur = i === step;
              const reachable = i <= maxStep;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={cur ? "step" : undefined}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={!reachable}
                    className="flex min-w-max items-center gap-2.5 rounded-md text-left disabled:cursor-default"
                  >
                    <span
                      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[12.5px] font-semibold ${
                        done && !cur
                          ? "bg-teal-700 text-white"
                          : cur
                          ? "bg-teal-700 text-white ring-4 ring-teal-100"
                          : "border-2 border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      {done && !cur ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="leading-tight">
                      <span className={`block text-[13px] font-semibold ${cur ? "text-teal-800" : done ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
                      <span className={`block text-[11.5px] ${cur || done ? "text-teal-700" : "text-slate-400"}`}>
                        {cur ? "In Progress" : done ? "Completed" : "Pending"}
                      </span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className={`mx-3 h-0.5 min-w-6 flex-1 rounded ${i < step ? "bg-teal-600" : "bg-slate-200"}`} aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* ---------- Step body ---------- */}
          <Card>
            <div className="flex flex-col gap-3 p-3">
              {/* ===== Step 1: Policy & Vehicle ===== */}
              {step === 0 && (
                <>
                  <form onSubmit={doSearch} className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-700">
                      Search policy <span className="text-red-600">*</span>
                    </span>
                    <div className="flex gap-2">
                      <span className="relative flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                          value={f.search}
                          onChange={(e) => set({ search: e.target.value })}
                          placeholder="Policy no, vehicle registration no or insured mobile"
                          aria-label="Search policy"
                          className={`${inputCls(err.policy)} pl-8`}
                        />
                      </span>
                      <button type="submit" className="h-9 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800">
                        Search
                      </button>
                    </div>
                    {err.policy && <span className="text-[11.5px] text-red-700">{err.policy}</span>}
                    <span className="text-[11px] text-slate-500">
                      Demo vehicles: {DEMO_POLICIES.map((p) => p.regNo).join(" · ")}
                    </span>
                  </form>

                  {results && results.length === 0 && !f.noPolicy && (
                    <Banner kind="warn" title="No policy found">
                      Check the number and search again. If the policy still can't be found, you can record the intimation – it will be parked as
                      NBNR (policy not found).
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => set({ noPolicy: true, policy: null, manualRegNo: f.search.toUpperCase() })}
                          className="rounded border border-amber-400 bg-white px-2 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Continue without policy (NBNR)
                        </button>
                      </div>
                    </Banner>
                  )}

                  {results && results.length > 1 && (
                    <ul className="flex flex-col gap-1">
                      {results.map((p) => (
                        <li key={p.policyNo}>
                          <button
                            type="button"
                            onClick={() => choosePolicy(p)}
                            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[12.5px] ${
                              f.policy?.policyNo === p.policyNo ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <span className="font-mono">{p.policyNo}</span>
                            <span>{p.regNo} · {p.insured}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {f.noPolicy && (
                    <Card title="Vehicle (policy not found)" action={<button type="button" onClick={() => set({ noPolicy: false })} className="text-[12px] font-medium text-teal-700 hover:underline">Search again</button>}>
                      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                        <Field label="Vehicle registration no" required error={err.manualRegNo}>
                          <input value={f.manualRegNo} onChange={(e) => set({ manualRegNo: e.target.value.toUpperCase() })} className={inputCls(err.manualRegNo)} placeholder="TN 09 AB 1234" />
                        </Field>
                        <Field label="Make / model">
                          <input value={f.manualVehicle} onChange={(e) => set({ manualVehicle: e.target.value })} className={inputCls()} placeholder="e.g. Maruti Swift VXi" />
                        </Field>
                      </div>
                    </Card>
                  )}

                  {f.policy && (
                    <>
                      <Card title="Policy" action={<span className={`rounded px-1.5 text-[11px] font-semibold leading-5 ${f.policy.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{f.policy.status}</span>}>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2.5 text-[12.5px] lg:grid-cols-4">
                          {[
                            ["Policy no", f.policy.policyNo],
                            ["Insured", f.policy.insured],
                            ["Product", f.policy.product],
                            ["Period", `${dt(f.policy.periodFrom)} – ${dt(f.policy.periodTo)}`],
                            ["IDV", inr(f.policy.idv)],
                            ["NCB", f.policy.ncb],
                            ["Add-ons", f.policy.addOns.join(", ") || "None"],
                            ["Financier", f.policy.financier || "None"],
                          ].map(([k, v]) => (
                            <div key={k} className="min-w-0">
                              <dt className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                              <dd className={`text-slate-800 ${k === "Policy no" ? "font-mono text-[12px]" : ""}`}>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                      <Card title="Vehicle">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2.5 text-[12.5px] lg:grid-cols-4">
                          {[
                            ["Registration no", f.policy.regNo],
                            ["Make / model", f.policy.vehicle],
                            ["Year of manufacture", f.policy.yearOfMfg],
                            ["Chassis / engine", `${f.policy.chassis} / ${f.policy.engine}`],
                          ].map(([k, v]) => (
                            <div key={k} className="min-w-0">
                              <dt className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                              <dd className="break-words text-slate-800">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                      {willBeNbnr && (
                        <Banner kind="warn" title="This intimation will be parked as NBNR">
                          {issues.map((i) => i.text).join(" · ")}. You can still record it – a reference number is issued and it goes to the NBNR bucket
                          for resolution.
                        </Banner>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ===== Step 2: Customer ===== */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Insured name">
                      <input value={f.policy?.insured || "(from policy – not found)"} disabled className={inputCls()} />
                    </Field>
                    <Field label="Contact mobile" required error={err.mobile} hint="Claim acknowledgement is sent by SMS">
                      <input inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, "") })} className={inputCls(err.mobile)} placeholder="10-digit mobile" />
                    </Field>
                    <Field label="Alternate mobile" error={err.altMobile}>
                      <input inputMode="numeric" maxLength={10} value={f.altMobile} onChange={(e) => set({ altMobile: e.target.value.replace(/\D/g, "") })} className={inputCls(err.altMobile)} />
                    </Field>
                    <Field label="Email" error={err.email}>
                      <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls(err.email)} />
                    </Field>
                    <Field label="Preferred language">
                      <select value={f.language} onChange={(e) => set({ language: e.target.value })} className={inputCls()}>
                        {["Tamil", "English", "Hindi", "Telugu", "Kannada", "Malayalam"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                    <Field label="Intimation channel" required>
                      <select value={f.channel} onChange={(e) => set({ channel: e.target.value })} className={inputCls()}>
                        {CHANNELS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Intimated by" required>
                      <select value={f.intimatedBy} onChange={(e) => set({ intimatedBy: e.target.value })} className={inputCls()}>
                        {INTIMATED_BY.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    {f.intimatedBy !== "Insured" && (
                      <Field label="Name of person intimating" required error={err.callerName}>
                        <input value={f.callerName} onChange={(e) => set({ callerName: e.target.value })} className={inputCls(err.callerName)} />
                      </Field>
                    )}
                  </div>

                </>
              )}

              {/* ===== Step 3: Incident (incl. driver) ===== */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Date of loss" required error={err.lossDate}>
                      <input type="date" max={TODAY_ISO} value={f.lossDate} onChange={(e) => set({ lossDate: e.target.value, catEvent: null })} className={inputCls(err.lossDate)} />
                    </Field>
                    <Field label="Time of loss (approx.)" required error={err.lossTime}>
                      <input type="time" value={f.lossTime} onChange={(e) => set({ lossTime: e.target.value })} className={inputCls(err.lossTime)} />
                    </Field>
                    <Field label="Cause of loss" required error={err.cause}>
                      <select value={f.cause} onChange={(e) => set({ cause: e.target.value, catEvent: null })} className={inputCls(err.cause)}>
                        <option value="">Select cause</option>
                        {LOSS_CAUSES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {/* live checks for the date */}
                  {f.lossDate && f.policy && issues.some((i) => i.code === "OUTSIDE_PERIOD") && (
                    <Banner kind="warn" title="Loss date is outside the policy period">
                      Policy period {dt(f.policy.periodFrom)} – {dt(f.policy.periodTo)}. The intimation will be parked as NBNR.
                    </Banner>
                  )}
                  {duplicate && (
                    <Banner kind="error" title="Possible duplicate claim">
                      Claim <span className="font-mono font-semibold">{duplicate.claimNo}</span> already exists for this vehicle (loss {dt(duplicate.lossDate)},{" "}
                      {duplicate.stage}). If you submit, it will not be registered again.
                    </Banner>
                  )}
                  {f.lossDate && delay > LATE_INTIMATION_DAYS && (
                    <Field label={`Reason for late intimation (${delay} days after loss)`} required error={err.lateReason}>
                      <input value={f.lateReason} onChange={(e) => set({ lateReason: e.target.value })} className={inputCls(err.lateReason)} placeholder="e.g. Insured was travelling; vehicle was at native place" />
                    </Field>
                  )}
                  {suggestedCat && (
                    <Banner kind="info" title={`Matches declared catastrophe event ${suggestedCat.code}`}>
                      {suggestedCat.name} ({dt(suggestedCat.from)} – {dt(suggestedCat.to)}).
                      <label className="mt-1 flex items-center gap-2 font-medium">
                        <input type="checkbox" checked={!!f.catEvent} onChange={(e) => set({ catEvent: e.target.checked ? suggestedCat.code : null })} className="h-4 w-4 accent-teal-700" />
                        Tag this claim to {suggestedCat.code}
                      </label>
                    </Banner>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Place of loss" required error={err.place} className="sm:col-span-2">
                      <input value={f.place} onChange={(e) => set({ place: e.target.value })} className={inputCls(err.place)} placeholder="Road / landmark / area" />
                    </Field>
                    <Field label="City">
                      <input value={f.city} onChange={(e) => set({ city: e.target.value })} className={inputCls()} />
                    </Field>
                  </div>
                  <Field label="What happened?" required error={err.description} hint={`${f.description.trim().length} characters`}>
                    <textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className={`${inputCls(err.description)} h-auto py-2`} placeholder="Brief description of how the loss occurred and damage seen" />
                  </Field>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {!["theft", "flood", "partialTheft"].includes(f.cause) && (
                      <Field label="Was the vehicle being driven?">
                        <Segmented name="Being driven" value={f.beingDriven} onChange={(v) => set({ beingDriven: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (parked)" }]} />
                      </Field>
                    )}
                    <Field label="Third party involved?">
                      <Segmented name="Third party" value={f.tpInvolved} onChange={(v) => set({ tpInvolved: v })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                    </Field>
                    <Field label="Anyone injured?">
                      <Segmented name="Injury" value={f.injury} onChange={(v) => set({ injury: v })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                    </Field>
                    <Field label="Reported to police?">
                      <Segmented name="Police" value={f.policeReported} onChange={(v) => set({ policeReported: v })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                    </Field>
                  </div>

                  {f.tpInvolved === "yes" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Third-party vehicle no" required error={err.tpVehicleNo} hint="TP intimation is passed to the TP claims system automatically.">
                        <input value={f.tpVehicleNo} onChange={(e) => set({ tpVehicleNo: e.target.value.toUpperCase() })} className={inputCls(err.tpVehicleNo)} placeholder="TN 01 XY 1234 or Unknown" />
                      </Field>
                    </div>
                  )}
                  {(f.policeReported === "yes" || f.cause === "theft" || f.cause === "fire" || f.injury === "yes") && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="FIR / police report no" required error={err.firNo}>
                        <input value={f.firNo} onChange={(e) => set({ firNo: e.target.value })} className={inputCls(err.firNo)} placeholder="e.g. 1234/2026" />
                      </Field>
                      <Field label="Police station">
                        <input value={f.policeStation} onChange={(e) => set({ policeStation: e.target.value })} className={inputCls()} placeholder="e.g. J-3 Guindy" />
                      </Field>
                    </div>
                  )}
                  {driverNeeded(f) ? (
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[#0B1F3A]">Driver at the time of loss</p>
                        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                          <input type="checkbox" checked={f.driverSameAsInsured} onChange={(e) => set({ driverSameAsInsured: e.target.checked })} className="h-4 w-4 accent-teal-700" />
                          Driver is the insured
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Driver name" required={!f.driverSameAsInsured} error={err.driverName}>
                          <input value={f.driverSameAsInsured ? f.policy?.insured || "" : f.driverName} disabled={f.driverSameAsInsured} onChange={(e) => set({ driverName: e.target.value })} className={inputCls(err.driverName)} />
                        </Field>
                        <Field label="Driving licence no" required error={err.dlNo}>
                          <input value={f.dlNo} onChange={(e) => set({ dlNo: e.target.value.toUpperCase() })} className={inputCls(err.dlNo)} placeholder="TN09 20150012345" />
                        </Field>
                        <Field
                          label="DL valid till"
                          required
                          error={err.dlValidTill}
                          hint={f.dlValidTill && f.lossDate && f.dlValidTill < f.lossDate ? undefined : "Checked against the loss date"}
                        >
                          <input type="date" value={f.dlValidTill} onChange={(e) => set({ dlValidTill: e.target.value })} className={inputCls(err.dlValidTill)} />
                        </Field>
                      </div>
                      {f.dlValidTill && f.lossDate && f.dlValidTill < f.lossDate && (
                        <Banner kind="warn" title="Driving licence had expired on the loss date">
                          The claim can be intimated, but it will be flagged for admissibility review (invalid DL is a policy exclusion).
                        </Banner>
                      )}
                    </div>
                  ) : (
                    <p className="border-t border-slate-100 pt-3 text-[12px] text-slate-500">Driver details not required – vehicle was not being driven at the time of loss.</p>
                  )}
                </>
              )}

              {/* ===== Step 4: Additional ===== */}
              {step === 3 && (
                <>
                  <Field label="Where is the vehicle now?">
                    <Segmented
                      name="Vehicle location"
                      value={f.cause === "theft" ? "nottraced" : f.vehicleLocation}
                      onChange={(v) => set({ vehicleLocation: v })}
                      options={
                        f.cause === "theft"
                          ? [{ value: "nottraced", label: "Not traced" }]
                          : [
                              { value: "garage", label: "At / going to garage" },
                              { value: "spot", label: "At accident spot" },
                              { value: "home", label: "At residence" },
                            ]
                      }
                    />
                  </Field>

                  {f.cause !== "theft" && f.vehicleLocation === "garage" && (
                    <div className="flex flex-col gap-2">
                      {recommended.length > 0 && (
                        <Banner kind="info" title="Network steering – recommended garage">
                          {recommended.map((g) => g.name).join(", ")} – authorised {brand} dealer in our network. Cashless repair available.
                        </Banner>
                      )}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Garage" required error={err.garage}>
                          <select value={f.garage} onChange={(e) => set({ garage: e.target.value })} className={inputCls(err.garage)}>
                            <option value="">Select garage</option>
                            <optgroup label="Network garages (cashless)">
                              {NETWORK_GARAGES.map((g) => (
                                <option key={g.name} value={g.name}>
                                  {g.name} · {g.type}
                                  {recommended.includes(g) ? " (recommended)" : ""}
                                </option>
                              ))}
                            </optgroup>
                            <option value="other">Other / non-network garage (reimbursement)</option>
                          </select>
                        </Field>
                        {f.garage === "other" && (
                          <Field label="Garage name & address" required error={err.otherGarage}>
                            <input value={f.otherGarage} onChange={(e) => set({ otherGarage: e.target.value })} className={inputCls(err.otherGarage)} />
                          </Field>
                        )}
                      </div>
                    </div>
                  )}

                  {f.cause !== "theft" && (
                    <Field label="Survey type requested">
                      <Segmented name="Survey type" value={f.surveyType} onChange={(v) => set({ surveyType: v })} options={[{ value: "garage", label: "Garage survey" }, { value: "spot", label: "Spot survey" }]} />
                    </Field>
                  )}

                  <Field label="Photos / documents (optional)" hint="Accident photos, RC, DL, FIR – can also be added later from Claim 360">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-3 py-4 text-[12.5px] text-slate-600 hover:border-teal-600 hover:bg-teal-50/40">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Choose files to attach
                      <input
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={(e) => set({ files: [...f.files, ...Array.from(e.target.files || []).map((x) => x.name)] })}
                      />
                    </label>
                  </Field>
                  {f.files.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {f.files.map((n, i) => (
                        <li key={n + i} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[12px] text-slate-700">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          {n}
                          <button type="button" aria-label={`Remove ${n}`} onClick={() => set({ files: f.files.filter((_, j) => j !== i) })} className="ml-0.5 text-slate-500 hover:text-red-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Field label="Remarks for the claims team">
                    <textarea rows={2} value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} className={`${inputCls()} h-auto py-2`} />
                  </Field>
                </>
              )}

              {/* ===== Step 5: Review ===== */}
              {step === 4 && (
                <>
                  {[
                    {
                      title: "Policy & vehicle",
                      to: 0,
                      rows: f.policy
                        ? [
                            ["Policy", `${f.policy.policyNo} · ${f.policy.status}`],
                            ["Insured", f.policy.insured],
                            ["Vehicle", `${f.policy.regNo} · ${f.policy.vehicle}`],
                          ]
                        : [["Vehicle", `${f.manualRegNo} ${f.manualVehicle} (policy not found)`]],
                    },
                    {
                      title: "Customer",
                      to: 1,
                      rows: [
                        ["Contact", `${f.mobile}${f.email ? ` · ${f.email}` : ""}`],
                        ["Intimated via", `${f.channel} · by ${f.intimatedBy}${f.callerName ? ` (${f.callerName})` : ""}`],
                      ],
                    },
                    {
                      title: "Incident",
                      to: 2,
                      rows: [
                        ["Loss", `${dt(f.lossDate)} · ${f.lossTime}`],
                        ["Cause", LOSS_CAUSES.find((c) => c.key === f.cause)?.label],
                        ["Place", `${f.place}, ${f.city}`],
                        ["Description", f.description],
                        ["Third party / injury / police", `${f.tpInvolved === "yes" ? `TP ${f.tpVehicleNo}` : "No TP"} · ${f.injury === "yes" ? "Injury" : "No injury"} · ${f.firNo ? `FIR ${f.firNo}` : "No FIR"}`],
                        driverNeeded(f) && ["Driver", `${f.driverSameAsInsured ? f.policy?.insured : f.driverName} · DL ${f.dlNo} valid till ${dt(f.dlValidTill)}`],
                        f.catEvent && ["CAT event", f.catEvent],
                        f.lateReason && ["Late intimation reason", f.lateReason],
                      ].filter(Boolean),
                    },
                    {
                      title: "Additional",
                      to: 3,
                      rows: [
                        ["Vehicle location", f.cause === "theft" ? "Not traced" : f.vehicleLocation === "garage" ? (f.garage === "other" ? f.otherGarage : f.garage) : f.vehicleLocation === "spot" ? "At accident spot" : "At residence"],
                        f.cause !== "theft" && ["Survey", f.surveyType === "spot" ? "Spot survey" : "Garage survey"],
                        ["Attachments", f.files.length ? f.files.join(", ") : "None"],
                      ].filter(Boolean),
                    },
                  ].map((sec) => (
                    <Card
                      key={sec.title}
                      title={sec.title}
                      action={
                        <button type="button" onClick={() => goTo(sec.to)} className="flex items-center gap-1 text-[12px] font-medium text-teal-700 hover:underline">
                          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                        </button>
                      }
                    >
                      <dl className="divide-y divide-slate-50">
                        {sec.rows.map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 px-3 py-1.5 text-[12.5px]">
                            <dt className="text-slate-500">{k}</dt>
                            <dd className="break-words text-slate-800">{v || "–"}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  ))}

                  <label className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] ${err.declaration ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                    <input type="checkbox" checked={f.declaration} onChange={(e) => set({ declaration: e.target.checked })} className="mt-0.5 h-4 w-4 accent-teal-700" />
                    <span>
                      Details were recorded as given by the {f.intimatedBy.toLowerCase()}, read back and confirmed. The caller was informed about the claim
                      process and documents required.
                      {err.declaration && <span className="block text-red-700">{err.declaration}</span>}
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* ---------- Footer nav ---------- */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={back}
                disabled={step === 0}
                className="flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
              <span className="text-[11.5px] text-slate-500">
                Step {step + 1} of {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next} className="flex h-9 items-center gap-1 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800">
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={submit} className="flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {duplicate ? "Submit (duplicate check)" : willBeNbnr ? "Submit as NBNR" : "Submit & register claim"}
                </button>
              )}
            </div>
          </Card>

          {/* ---------- Side panel: live registration checks ---------- */}
          <div className="flex flex-col gap-2">
            <Card title="Registration checks">
              <div className="px-3 py-2">
                {!f.policy && !f.noPolicy ? (
                  <p className="text-[12px] text-slate-500">Select a policy to run the checks.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    <Check3 ok={!!f.policy} label="Policy found" note={f.policy ? f.policy.policyNo : "Not found in PAS"} />
                    {f.policy && (
                      <>
                        <Check3 ok={f.policy.cover !== "TP"} label="Own Damage cover" note={f.policy.cover === "TP" ? "Liability only" : "Comprehensive"} />
                        <Check3 ok={f.policy.premiumRealised} label="Premium realised" note={f.policy.premiumRealised ? "Yes" : "Cheque not cleared"} />
                        <Check3
                          ok={!f.lossDate || !issues.some((i) => i.code === "OUTSIDE_PERIOD")}
                          label="Loss within policy period"
                          note={f.lossDate ? dt(f.lossDate) : "Enter loss date"}
                        />
                      </>
                    )}
                    {f.lossDate && <Check3 ok={!duplicate} label="Duplicate check" note={duplicate ? `Matches ${duplicate.claimNo}` : "No duplicate found"} />}
                    {f.lossDate && <Check3 ok={delay <= LATE_INTIMATION_DAYS} label={`Intimation within ${LATE_INTIMATION_DAYS} days`} note={`${delay} day(s) after loss`} />}
                  </ul>
                )}
              </div>
              {(f.policy || f.noPolicy) && (
                <div className={`border-t px-3 py-2 text-[12px] font-semibold ${duplicate ? "border-red-100 bg-red-50 text-red-800" : willBeNbnr ? "border-amber-100 bg-amber-50 text-amber-900" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
                  Expected outcome: {duplicate ? "Duplicate – not registered" : willBeNbnr ? "NBNR (parked with reason)" : "Claim will be registered"}
                </div>
              )}
            </Card>

            {f.policy && (
              <Card title="Selected vehicle">
                <div className="flex items-start gap-2 px-3 py-2 text-[12.5px]">
                  <Car className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
                  <span>
                    <span className="block font-mono font-semibold text-slate-800">{f.policy.regNo}</span>
                    <span className="block text-slate-600">{f.policy.vehicle}</span>
                    <span className="block text-[11.5px] text-slate-500">{f.policy.insured} · {maskMobile(f.policy.mobile)}</span>
                  </span>
                </div>
              </Card>
            )}

            {(f.catEvent || f.cause === "flood") && (
              <Card title="Catastrophe">
                <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-slate-600">
                  <CloudRain className="mt-0.5 h-4 w-4 flex-none text-sky-600" aria-hidden="true" />
                  {f.catEvent ? `Tagged to ${f.catEvent} for bulk handling and reporting.` : "Not tagged to a CAT event."}
                </p>
              </Card>
            )}

            {f.garage && f.garage !== "other" && (
              <Card title="Repair">
                <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-slate-600">
                  <Wrench className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
                  Network garage – cashless repair eligible.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}