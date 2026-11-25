// src/pages/od/ODIntimation.jsx
// P02 · Claim Intimation (FNOL – First Notice of Loss) for Motor OD.
// One combined activity: intimation + registration. On submit the system runs the
// registration jobs (duplicate check, policy & coverage validation, dates, reserve,
// assignment). Result = Claim registered, NBNR (Notified But Not Registered) or Duplicate.
// Catalogue refs: FNOL 1–12, Claim Registration 13–17, Reserve 18, Policy & Coverage 22–29.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
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
  Lightbulb,
  PhoneCall,
  Inbox,
  Copy,
  CloudRain,
  Wrench,
  Lock,
  History,
  ClipboardList,
  IdCard,
  Eye,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { PanelButtons, PinnedPanels } from "../../components/CardPanels";
import { formatINR } from "../../auth";
import LocationPicker from "../../components/LocationPicker";
import DocAutoFill from "../../components/DocAutoFill";
import DocViewer from "../../components/DocViewer";
import { putDoc, removeDoc, clearDocs } from "../../data/docStore";
import { extractText, parseDL, parseRC, sameName } from "../../data/docReader";
import { claimSlug } from "../../data/odClaimDetail";
import { WORK_QUEUE, TAT_STAGES } from "../../data/odHandlerMock";
import {
  TODAY_ISO,
  nowHHMM,
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
  claimHistory,
  documentsFor,
} from "../../data/odPolicyMock";

const STEPS = ["Policy Information", "Incident Details", "Review & Submit"];
// Each wizard step shows these form sections:
// 0 Policy & vehicle · 1 Customer · 2 Incident (incl. driver) · 3 Additional information · 4 Review
const STEP_SECTIONS = [[0, 1], [2, 3], [4]];

const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));
const dt = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";
const titleCase = (s) => String(s || "").toLowerCase().replace(/(^|[\s.'])([a-z])/g, (_, a, b) => a + b.toUpperCase());
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
  pincode: "",
  lossLat: null,
  lossLng: null,
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
  altEmail: "",
  intimatedBy: "Insured",
  channel: "Call centre",
  callerName: "",
  driverSameAsInsured: true,
  driverName: "",
  dlNo: "",
  dlValidTill: "",
  driverDob: "",
  dlClass: "",
  // documents read on Incident Details (DL / RC) and which fields they filled
  dlRead: null,
  rcRead: null,
  autoFill: {},
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

// A new intimation starts with the loss date and time set to now – the handler changes them to when
// the loss happened. Neither can be moved into the future (see onLossDate / onLossTime in the page).
const freshForm = () => ({ ...EMPTY, lossDate: TODAY_ISO, lossTime: nowHHMM() });

// Draft kept in sessionStorage so a refresh resumes the same step (attachments keep their names only)
const DRAFT_KEY = "smartclaims-intimation-draft";
const isStarted = (x) => !!(x && (x.policy || x.noPolicy || x.search.trim()));
function readDraft() {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return d && d.f ? d : null;
  } catch {
    return null;
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage off */
  }
}

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


// Label for the demo quick-pick chips – tells the tester what each vehicle will show
function scenarioTag(p) {
  if (p.status !== "In force") return { label: "Expired", cls: "bg-red-50 text-red-700" };
  if (p.cover === "TP") return { label: "TP only", cls: "bg-red-50 text-red-700" };
  if (!p.premiumRealised) return { label: "Premium pending", cls: "bg-amber-50 text-amber-800" };
  if (WORK_QUEUE.some((r) => r.regNo === p.regNo)) return { label: "Open claim", cls: "bg-amber-50 text-amber-800" };
  return { label: "Valid", cls: "bg-emerald-50 text-emerald-800" };
}

// Read-only value pulled from the policy (Policy Administration System)
function LockedInput({ value }) {
  return (
    <span className="relative">
      <input value={value} readOnly tabIndex={-1} aria-readonly="true" className={`${inputCls()} cursor-not-allowed bg-slate-50 pr-8 text-slate-600`} />
      <Lock className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    </span>
  );
}

// Sub-heading inside a combined wizard step
function SectionHead({ n, title, divider }) {
  return (
    <div className={`flex items-center gap-2 ${divider ? "mt-1 border-t border-slate-100 pt-3" : ""}`}>
      <span className="grid h-5 w-5 place-items-center rounded bg-teal-50 text-[12px] font-bold text-teal-800">{n}</span>
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

function Field({ label, required, error, hint, children, className = "", auto }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
        <span>
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
        {/* filled from an uploaded document (DL / RC) – goes away once the user edits the field */}
        {auto && <span className="rounded bg-teal-50 px-1 text-[10.5px] font-semibold leading-4 text-teal-800 ring-1 ring-teal-200">From {auto}</span>}
      </span>
      {children}
      {error ? (
        <span data-field-error className="text-[12px] text-red-700">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls = (err) =>
  `h-9 w-full rounded-md border bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500 ${
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
        {note && <span className={`block text-[12px] ${ok ? "text-slate-500" : "text-red-700"}`}>{note}</span>}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Validation per step                                                 */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate every section shown on a wizard step
function validate(step, f) {
  return Object.assign({}, ...STEP_SECTIONS[step].map((sec) => validateSection(sec, f)));
}

function validateSection(step, f) {
  const e = {};
  if (step === 0) {
    if (!f.policy && !f.noPolicy) e.policy = "Search and select the policy, or continue without a policy.";
    if (f.noPolicy && !f.manualRegNo.trim()) e.manualRegNo = "Enter the vehicle registration number.";
  }
  if (step === 1) {
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
    if (f.altMobile && !/^[6-9]\d{9}$/.test(f.altMobile)) e.altMobile = "Enter a valid 10-digit number or leave blank.";
    else if (f.altMobile && f.altMobile === f.mobile) e.altMobile = "Same as the registered mobile – enter a different number or leave blank.";
    if (f.email && !EMAIL_RE.test(f.email)) e.email = "Enter a valid email or leave blank.";
    if (f.altEmail && !EMAIL_RE.test(f.altEmail)) e.altEmail = "Enter a valid email or leave blank.";
    else if (f.altEmail && f.altEmail.toLowerCase() === (f.email || "").toLowerCase()) e.altEmail = "Same as the registered email – enter a different one or leave blank.";
    if (f.intimatedBy !== "Insured" && !f.callerName.trim()) e.callerName = "Enter the name of the person intimating.";
  }
  if (step === 2) {
    if (!f.lossDate) e.lossDate = "Enter the date of loss.";
    else if (f.lossDate > TODAY_ISO) e.lossDate = "Loss date cannot be in the future.";
    if (!f.lossTime) e.lossTime = "Enter the approximate time of loss.";
    else if (f.lossDate === TODAY_ISO && f.lossTime > nowHHMM()) e.lossTime = "Loss time cannot be later than the current time.";
    if (!f.cause) e.cause = "Select the cause of loss.";
    if (!f.place.trim()) e.place = "Pin the location on the map or enter where the loss happened.";
    if (f.pincode && !/^[1-9]\d{5}$/.test(f.pincode)) e.pincode = "Pincode must be 6 digits.";
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
  // Opened from the header search with ?q=<vehicle no> → search is pre-run
  const [params] = useSearchParams();
  const initQ = params.get("q") || "";
  const initHits = initQ ? searchPolicy(initQ) : null;
  const initPolicy = initHits?.length === 1 ? initHits[0].policy : null;
  // Work in progress survives a page refresh: the draft is kept for the browser session and
  // restored on load (unless a new search was opened from the header with ?q=)
  const [draft] = useState(() => (initQ ? null : readDraft()));
  const [f, setF] = useState(() =>
    draft
      ? // a draft saved before the date / time were filled (or before they defaulted to now) gets now
        {
          ...freshForm(),
          ...draft.f,
          lossDate: draft.f.lossDate || TODAY_ISO,
          lossTime: draft.f.lossTime || nowHHMM(),
          // results saved by the earlier demo reader (no found / missing lists) are dropped
          dlRead: draft.f.dlRead?.found ? draft.f.dlRead : null,
          rcRead: draft.f.rcRead?.found ? draft.f.rcRead : null,
        }
      : initQ
        ? { ...freshForm(), search: initQ, policy: initPolicy, mobile: initPolicy?.mobile || "", email: initPolicy?.email || "" }
        : freshForm()
  );
  const [step, setStep] = useState(draft?.step || 0);
  const [maxStep, setMaxStep] = useState(draft?.maxStep || 0);
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState(draft ? draft.results : initHits); // null = not searched
  const [result, setResult] = useState(draft?.result || null); // outcome after submit
  const [viewDoc, setViewDoc] = useState(null); // { name, title, details } – document open in the viewer
  const closeViewer = useCallback(() => setViewDoc(null), []);
  const [toast, setToast] = useState(draft && !draft.result && isStarted(draft.f) ? "Your intimation in progress was restored." : "");
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);
  // save after every change; nothing worth keeping (blank form) → no draft
  useEffect(() => {
    try {
      if (!result && !isStarted(f)) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ f, step, maxStep, results, result }));
    } catch {
      /* storage off or full – the form still works, it just won't survive a refresh */
    }
  }, [f, step, maxStep, results, result]);
  // side panels pinned from the card header (peek on hover, pin on click) – kept for the session
  const [pins, setPins] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("smartclaims-intimation-pins")) || []; } catch { return []; }
  });
  const togglePin = useCallback((key) => {
    setPins((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      try { sessionStorage.setItem("smartclaims-intimation-pins", JSON.stringify(next)); } catch { /* storage off */ }
      return next;
    });
  }, []);
  // Sample vehicles stay hidden until asked for (kept for demos and testing)
  const [showSamples, setShowSamples] = useState(() => {
    try { return sessionStorage.getItem("smartclaims-show-samples") === "1"; } catch { return false; }
  });
  const toggleSamples = () => {
    const next = !showSamples;
    setShowSamples(next);
    try { sessionStorage.setItem("smartclaims-show-samples", next ? "1" : "0"); } catch { /* storage unavailable */ }
  };

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const fRef = useRef(f);
  fRef.current = f;

  // Each step opens at the top of the page
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [step]);
  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(""), 2600);
  }
  // Loss date / time: no future values. The pickers stop them (max); a typed future value is
  // pulled back to now with a message.
  function onLossDate(v) {
    if (v && v > TODAY_ISO) {
      flash("Loss date cannot be in the future – set to today.");
      v = TODAY_ISO;
    }
    const now = nowHHMM();
    const patch = { lossDate: v, catEvent: null };
    if (v === TODAY_ISO && f.lossTime > now) patch.lossTime = now; // today + later time → now
    set(patch);
  }
  function onLossTime(v) {
    const now = nowHHMM();
    if (v && f.lossDate === TODAY_ISO && v > now) {
      flash("Loss time cannot be later than now – set to the current time.");
      v = now;
    }
    set({ lossTime: v });
  }
  // a field typed by the user is no longer "from DL / RC"
  function setTyped(key, value) {
    setF((x) => {
      const autoFill = { ...x.autoFill };
      delete autoFill[key];
      return { ...x, [key]: value, autoFill };
    });
  }
  // DL / RC uploaded on Incident Details → text extracted (OCR / PDF text) → the fields found on the
  // document fill the form; nothing is made up – what could not be read stays for the handler to type
  async function onDocRead(kind, file, onProgress) {
    const tag = kind === "dl" ? "DL" : "RC";
    const name = `${tag} – ${file.name}`;
    let res;
    try {
      res = await extractText(file, onProgress);
    } catch {
      res = { text: "", confidence: 0, source: "failed" };
    }
    const cur = fRef.current; // the form as it is now (the user may have typed while it was reading)
    cur.files.filter((n) => n.startsWith(`${tag} – `) && n !== name).forEach(removeDoc); // replaced document
    putDoc(name, file);
    const files = [...cur.files.filter((n) => !n.startsWith(`${tag} – `)), name];
    const meta = { fileName: file.name, confidence: res.confidence, source: res.source };
    const autoFill = { ...cur.autoFill };
    const patch = { files, autoFill };

    if (kind === "dl") {
      const d = parseDL(res.text);
      patch.dlRead = { ...d, ...meta };
      for (const [from, to] of [["dlNo", "dlNo"], ["validTill", "dlValidTill"], ["dob", "driverDob"], ["dlClass", "dlClass"]]) {
        if (d[from]) {
          patch[to] = d[from];
          autoFill[to] = "DL";
        }
      }
      if (d.holder) {
        const self = !!cur.policy && sameName(d.holder, cur.policy.insured);
        patch.driverSameAsInsured = self;
        if (self) delete autoFill.driverName;
        else {
          patch.driverName = titleCase(d.holder);
          autoFill.driverName = "DL";
        }
      }
      setF((x) => ({ ...x, ...patch }));
      if (!d.found.length) flash(res.source === "failed" ? "Could not read the licence – check the internet connection, or type the details." : "Nothing readable on this licence – try a clearer, straight photo, or type the details.");
      else flash(`Licence read – ${d.found.length} of 5 details filled${d.missing.length ? `; not found: ${d.missing.join(", ").toLowerCase()}` : ""}.`);
    } else {
      const r = parseRC(res.text, cur.policy);
      patch.rcRead = { ...r, ...meta };
      // no policy found → the RC gives the vehicle details asked for on step 1
      if (cur.noPolicy) {
        if (r.regNo && !cur.manualRegNo) {
          patch.manualRegNo = r.regNo;
          autoFill.manualRegNo = "RC";
        }
        if (r.vehicle && !cur.manualVehicle) {
          patch.manualVehicle = r.vehicle;
          autoFill.manualVehicle = "RC";
        }
      }
      setF((x) => ({ ...x, ...patch }));
      if (!r.found.length) flash(res.source === "failed" ? "Could not read the RC – check the internet connection." : "Nothing readable on this RC – try a clearer, straight photo.");
      else flash(r.checks.some((c) => c.ok === false) ? "RC read – some details do not match the policy." : `RC read – ${r.found.length} of 6 details found.`);
    }
  }
  // eye icon: open an uploaded file; a DL / RC opens with the details read from it alongside
  function openDoc(name) {
    const dl = f.dlRead && name === `DL – ${f.dlRead.fileName}` ? f.dlRead : null;
    const rc = f.rcRead && name === `RC – ${f.rcRead.fileName}` ? f.rcRead : null;
    const nf = (v) => v || "Not found";
    const how = (r) => (r.source === "PDF text" ? "read from PDF text" : `${r.source} · ${r.confidence}% confidence`);
    setViewDoc({
      name,
      title: dl ? "Driving licence" : rc ? "Registration certificate (RC)" : "Attachment",
      details: dl
        ? {
            title: `Read from DL · ${how(dl)}`,
            rows: [["Holder", nf(dl.holder && titleCase(dl.holder))], ["DL no", nf(dl.dlNo)], ["Date of birth", dl.dob ? dt(dl.dob) : "Not found"], ["Valid till (non-transport)", dl.validTill ? dt(dl.validTill) : "Not found"], ["Class of vehicle", nf(dl.dlClass)], ...(dl.rto ? [["Issued by", dl.rto]] : [])],
            note: "Check these against the licence on the left. Edit the driver fields if anything was read wrongly.",
            raw: dl.raw,
          }
        : rc
          ? {
              title: `Read from RC · ${how(rc)}`,
              rows: [["Registration no", nf(rc.regNo)], ["Owner", nf(rc.owner && titleCase(rc.owner))], ["Make / model", nf(rc.vehicle)], ["Fuel", nf(rc.fuel)], ["Chassis no", nf(rc.chassis)], ["Engine no", nf(rc.engine)], ["Registered on", rc.regDate ? dt(rc.regDate) : "Not found"], ["Valid till", rc.validTill ? dt(rc.validTill) : "Not found"], ["Hypothecation", nf(rc.hypothecation)]],
              note: rc.checks.map((c) => `${c.ok === false ? "✗" : c.ok ? "✓" : "•"} ${c.label}`).join("  ·  "),
              raw: rc.raw,
            }
          : null,
    });
  }
  const notBuilt = (what) => flash(`${what} – this page comes in a later build step.`);

  // Live checks (immediate validation)
  const issues = useMemo(() => (f.policy || f.noPolicy ? registrationIssues(f.policy, f.lossDate) : []), [f.policy, f.noPolicy, f.lossDate]);
  const duplicate = useMemo(() => findDuplicate(f.policy?.regNo || f.manualRegNo, f.lossDate), [f.policy, f.manualRegNo, f.lossDate]);
  const suggestedCat = useMemo(() => (f.cause && f.lossDate ? catEventFor(f.cause, f.lossDate) : null), [f.cause, f.lossDate]);
  const delay = f.lossDate ? daysBetween(f.lossDate, TODAY_ISO) : 0;
  const brand = (f.policy?.vehicle || f.manualVehicle || "").split(" ")[0];
  const recommended = NETWORK_GARAGES.filter((g) => g.brands.includes(brand));
  const history = useMemo(() => claimHistory(f.policy?.regNo || (f.noPolicy ? f.manualRegNo : "")), [f.policy, f.noPolicy, f.manualRegNo]);
  // all intimations of the last 7 days (same set as the "Intimated" count), newest first
  const recentIntimations = useMemo(() => WORK_QUEUE.filter((r) => daysBetween(r.regDate, TODAY_ISO) <= 7).sort((a, b) => (a.regDate < b.regDate ? 1 : -1)), []);
  // "By cause of loss" card on the empty step – last 7 days
  const week = useMemo(() => {
    const rows = WORK_QUEUE.filter((r) => daysBetween(r.regDate, TODAY_ISO) <= 7);
    const nbnr = rows.filter((r) => r.stage === "NBNR").length;
    return {
      total: rows.length,
      registered: rows.length - nbnr,
      nbnr,
      late: rows.filter((r) => daysBetween(r.lossDate, r.regDate) > LATE_INTIMATION_DAYS).length,
      tat: TAT_STAGES[0],
      byCause: Object.entries(rows.reduce((m, r) => ({ ...m, [r.lossType]: (m[r.lossType] || 0) + 1 }), {})).sort((x, y) => y[1] - x[1]),
    };
  }, []);
  const nbnrOpen = useMemo(() => WORK_QUEUE.filter((r) => r.stage === "NBNR"), []);
  const policyDaysLeft = f.policy ? daysBetween(TODAY_ISO, f.policy.periodTo) : 0;
  const docs = documentsFor(f.cause, {
    driverNeeded: driverNeeded(f),
    injury: f.injury,
    financier: f.policy?.financier,
    garage: f.vehicleLocation === "garage",
  });

  function doSearch(e, term = f.search) {
    e?.preventDefault();
    if (term !== f.search) set({ search: term });
    const r = searchPolicy(term);
    setResults(r);
    if (r.length === 1) choosePolicy(r[0].policy);
    else set({ policy: null, noPolicy: false });
  }

  function choosePolicy(p) {
    // Registered contact always comes from the policy (read-only); alternates are kept
    set({ policy: p, noPolicy: false, mobile: p.mobile || "", email: p.email || "" });
    setErrors({});
  }

  function next() {
    const e = validate(step, f);
    setErrors(e);
    if (Object.keys(e).length) {
      // Sections are long now – bring the first error into view
      window.setTimeout(() => document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
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
  // Leaving mid-way loses the typed details – confirm first
  function exitIntimation() {
    if (!isStarted(f) || window.confirm("Leave this intimation? The details entered will be lost.")) {
      clearDraft();
      clearDocs();
      navigate("/od/worklist");
    }
  }
  function submit() {
    const e = validate(STEPS.length - 1, f);
    setErrors(e);
    if (Object.keys(e).length) return;
    setResult(submitIntimation(f));
  }
  function reset() {
    clearDraft();
    clearDocs();
    setF(freshForm());
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
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {result.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-6 py-3">
                  {result.flags.map((fl) => (
                    <span key={fl} className="rounded bg-amber-50 px-2 text-[12px] font-semibold leading-6 text-amber-900">
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
                <p className="mt-3 text-[12px] text-slate-500">
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
                  <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
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
          <p className="text-center text-[12px] text-slate-500">Demo: new claims are not added to the demo work queue.</p>
        </div>
      </ODShell>
    );
  }

  /* ================= Wizard ================= */
  // After the user tries to move on, errors re-check live as fields are corrected
  const err = Object.keys(errors).length ? validate(step, f) : {};
  const willBeNbnr = issues.some((i) => i.nbnr);
  const show = (sec) => STEP_SECTIONS[step].includes(sec);

  // Side panels: buttons in the card header, the chosen panel opens inside the card on the right
  const tools = [
    {
      key: "checks",
      label: "Checks",
      title: "Registration checks",
      icon: ShieldCheck,
      // the outcome so far – a dot on the rail icon, spelled out on hover / for screen readers
      status:
        !f.policy && !f.noPolicy
          ? null
          : duplicate
            ? { tone: "red", text: "Duplicate" }
            : willBeNbnr
              ? { tone: "amber", text: "NBNR" }
              : !f.lossDate
                ? { tone: "slate", text: "Needs loss date" }
                : { tone: "green", text: "Will register" },
      content: (
        <>
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
                <div
                  className={`border-t px-3 py-2 text-[12px] font-semibold ${
                    duplicate ? "border-red-100 bg-red-50 text-red-800" : willBeNbnr ? "border-amber-100 bg-amber-50 text-amber-900" : !f.lossDate ? "border-slate-100 bg-slate-50 text-slate-700" : "border-emerald-100 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  Expected outcome:{" "}
                  {duplicate ? "Duplicate – not registered" : willBeNbnr ? "NBNR (parked with reason)" : !f.lossDate ? "decided once the loss date is entered (policy period check)" : "Claim will be registered"}
                </div>
              )}
          {(f.catEvent || f.cause === "flood") && (
            <div className="border-t border-slate-100">
                <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-slate-600">
                  <CloudRain className="mt-0.5 h-4 w-4 flex-none text-sky-600" aria-hidden="true" />
                  {f.catEvent ? `Tagged to ${f.catEvent} for bulk handling and reporting.` : "Not tagged to a CAT event."}
                </p>
            </div>
          )}
          {f.garage && f.garage !== "other" && (
            <div className="border-t border-slate-100">
                <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-slate-600">
                  <Wrench className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
                  Network garage – cashless repair eligible.
                </p>
            </div>
          )}
        </>
      ),
    },
    ...(!f.policy && !f.noPolicy
      ? [
          { key: "howto", label: "Search tips", title: "How to search", icon: Lightbulb, content: (<>
                <ul className="flex list-disc flex-col gap-1 px-3 py-2 pl-7 text-[12px] text-slate-600">
                  <li>Vehicle number, policy number, insured name or mobile.</li>
                  <li>Partial values work – e.g. last 4 digits of the vehicle no.</li>
                  <li>If the policy is not found, record it anyway – it is parked as NBNR (Notified But Not Registered).</li>
                </ul>
          </>) },
          { key: "call", label: "Call guide", title: "Keep ready on the call", icon: PhoneCall, content: (<>
                <ul className="flex flex-col gap-1.5 px-3 py-2 text-[12px] text-slate-700">
                  {[
                    ["Verify the caller", "Name + registered mobile or policy no before sharing details"],
                    ["Date, time & place of loss", "Pin the place on the map in step 2"],
                    ["How it happened", "Cause, damage seen, third party / injury"],
                    ["Driver at the time", "Name and driving licence no (if being driven)"],
                    ["Police / FIR", "Mandatory for theft, fire and injury"],
                    ["Where the vehicle is now", "Garage, spot or residence – decides the survey"],
                  ].map(([t, d], i) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-px grid h-4 w-4 flex-none place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{i + 1}</span>
                      <span>
                        <span className="block font-medium text-slate-800">{t}</span>
                        <span className="block text-[12px] text-slate-500">{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
          </>) },
        ]
      : []),
    ...(f.policy
      ? [{ key: "vehicle", label: "Vehicle", title: "Vehicle & cover", icon: Car, content: (<>
                <div className="flex flex-col gap-2 px-3 py-2 text-[12.5px]">
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-mono font-semibold text-slate-800">{f.policy.regNo}</span>
                      <span className="block text-slate-600">{f.policy.vehicle}</span>
                      <span className="block text-[12px] text-slate-500">
                        {f.policy.insured} · {maskMobile(f.policy.mobile)}
                      </span>
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
                    {[
                      ["IDV", f.policy.idv ? formatINR(f.policy.idv) : "–"],
                      ["NCB", f.policy.ncb],
                      ["Policy ends", policyDaysLeft >= 0 ? `${policyDaysLeft} d` : "Expired"],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                        <dd className={`truncate font-semibold tabular-nums ${k === "Policy ends" && policyDaysLeft < 0 ? "text-red-700" : "text-slate-800"}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {f.policy.addOns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.policy.addOns.map((a) => (
                        <span
                          key={a}
                          className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${a === "Zero depreciation" ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200" : "bg-slate-100 text-slate-700"}`}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {f.policy.financier && <p className="text-[12px] text-slate-600">Hypothecated to {f.policy.financier}</p>}
                </div>
          </>) }]
      : []),
    ...(f.policy || f.noPolicy
      ? [
          { key: "history", label: "History", title: "Claim history (this vehicle)", icon: History, status: history.length ? { tone: history.some((h) => h.open) ? "amber" : "slate", text: String(history.length) } : null, content: (<>
                <div className="px-3 py-2 text-[12px]">
                  {history.length === 0 ? (
                    <p className="flex items-start gap-2 text-slate-600">
                      <History className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
                      No previous claims on this vehicle.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-slate-100">
                      {history.map((h) => (
                        <li key={h.claimNo} className="flex items-start justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                          <span className="min-w-0">
                            {h.open ? (
                              <button type="button" onClick={() => navigate(`/od/claims/${claimSlug(h.claimNo)}`)} className="font-mono text-[12px] font-semibold text-teal-700 hover:underline">
                                {h.claimNo}
                              </button>
                            ) : (
                              <span className="block font-mono text-[12px] font-semibold text-slate-800">{h.claimNo}</span>
                            )}
                            <span className="block text-[12px] text-slate-500">
                              {dt(h.lossDate)} · {h.lossType}
                            </span>
                          </span>
                          <span className="flex-none text-right">
                            <span className={`block text-[12px] font-medium ${h.open ? "text-amber-700" : "text-slate-600"}`}>{h.open ? "Open" : h.status}</span>
                            <span className="block text-[12px] tabular-nums text-slate-700">{formatINR(h.amount)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {f.policy && f.policy.ncb && f.policy.ncb !== "0%" && f.policy.ncb !== "–" && (
                    <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
                      NCB (No Claim Bonus) {f.policy.ncb} will be lost at renewal if this claim is paid – tell the customer.
                    </p>
                  )}
                </div>
          </>) },
          { key: "docs", label: "Docs", title: "Documents to collect", icon: ClipboardList, status: { tone: "slate", text: String(docs.filter((d) => !d.advice).length) }, content: (<>
                <ul className="flex flex-col gap-1 px-3 py-2 text-[12px]">
                  {docs.map((d) => (
                    <li key={d.name} className="flex items-start gap-2">
                      {d.advice ? (
                        <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-600" aria-hidden="true" />
                      ) : (
                        <ClipboardList className={`mt-0.5 h-3.5 w-3.5 flex-none ${d.auto ? "text-teal-600" : "text-slate-500"}`} aria-hidden="true" />
                      )}
                      <span className={d.advice ? "text-sky-800" : "text-slate-700"}>
                        {d.name}
                        {d.later && <span className="text-slate-500"> · at settlement</span>}
                        {d.mandatory && !d.auto && !d.later && <span className="text-red-600"> *</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-slate-100 px-3 py-1.5 text-[12px] text-slate-500">
                  {f.cause ? "List is based on the cause of loss." : "Select the cause of loss to refine this list."} Request all documents in one go.
                </p>
          </>) },
        ]
      : []),
  ];
  // a pinned panel that no longer applies (e.g. "Search tips" once a policy is picked) is not shown
  const pinnedTools = pins.map((k) => tools.find((t) => t.key === k)).filter(Boolean);
  // "NBNR to resolve" card (step 1)
  const nbnrCard = (
    <div className="flex max-h-96 min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-amber-200 xl:max-h-none">
      <div className="flex flex-none items-center justify-between border-b border-amber-100 bg-amber-50 px-3 py-1.5">
        <p className="text-[12.5px] font-semibold text-amber-900">NBNR to resolve</p>
        <span className="rounded bg-white px-1.5 text-[12px] font-semibold text-amber-800">{nbnrOpen.length}</span>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {nbnrOpen.map((r) => (
          <li key={r.claimNo}>
            <button type="button" onClick={() => navigate(`/od/claims/${claimSlug(r.claimNo)}`)} className="flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-50">
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12px] font-semibold text-slate-800">
                  {r.claimNo} · {r.regNo}
                </span>
                <span className="block truncate text-[12px] text-slate-600">{r.nextAction}</span>
              </span>
              <span className={`flex-none rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.sla.status === "breach" ? "bg-red-50 text-red-700" : r.sla.status === "risk" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                {r.sla.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <ODShell
      active="intimation"
      title="Claim Intimation"
      subtitle="Motor Own Damage · FNOL – intimation and registration in one step"
      onNavigateMissing={notBuilt}
      claimNav={{
        headLabel: "New intimation",
        claimNo: f.policy?.regNo || (f.noPolicy && f.manualRegNo) || "Vehicle not selected",
        stepsTitle: "Intimation steps",
        backLabel: "Exit to My Work Queue",
        onBack: exitIntimation,
        steps: STEPS.map((label, i) => {
          const done = i < maxStep && i !== step;
          return {
            label,
            state: i === step ? "active" : done ? "done" : "todo",
            status: i === step ? "In progress" : done ? "Completed" : "Pending",
            onClick: () => goTo(i),
            disabled: i > maxStep || i === step,
          };
        }),
      }}
    >
      <div className="flex flex-col gap-2">
        {/* phones: the top-bar panels show here instead */}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2">
          {/* ---------- Step body (fills the screen height; Back / Next stay at the bottom) ---------- */}
          <Card className="flex flex-col lg:min-h-[calc(100vh-4.25rem)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
              <p className="text-[14px] font-semibold text-slate-900">{STEPS[step]}</p>
              <div className="flex flex-wrap items-center gap-3">
                {/* side panels – hover to peek, click to pin over the form */}
                <PanelButtons tools={tools} pinned={pinnedTools.map((t) => t.key)} onTogglePin={togglePin} />
                <span className="text-[12px] font-medium text-slate-500">
                  Step {step + 1} of {STEPS.length}
                </span>
              </div>
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col gap-3 p-3">
              {/* Pinned panels – float over the form (top right), stacked, kept in view while scrolling */}
              {pinnedTools.length > 0 && (
                <div className="z-20 lg:pointer-events-none lg:absolute lg:inset-y-3 lg:right-3 lg:w-[320px]">
                  <div className="lg:pointer-events-auto lg:sticky lg:top-3">
                    <PinnedPanels tools={pinnedTools} onUnpin={togglePin} />
                  </div>
                </div>
              )}
              {/* ===== Step 1 · Policy Information – A. Policy & vehicle ===== */}
              {show(0) && <SectionHead n="A" title="Policy & vehicle details" />}
              {show(0) && (
                <>
                  <form onSubmit={doSearch} className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-700">
                      Search policy <span className="text-red-600">*</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="relative w-full max-w-[420px] sm:w-auto sm:flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                        <input
                          value={f.search}
                          onChange={(e) => set({ search: e.target.value })}
                          placeholder="Vehicle no, policy no, name or mobile"
                          aria-label="Search policy"
                          className={`${inputCls(err.policy)} pl-8`}
                        />
                      </span>
                      <button type="submit" className="h-9 rounded-md bg-teal-700 px-4 text-[13px] font-semibold text-white hover:bg-teal-800">
                        Search
                      </button>
                      {/* Sample vehicles – hidden behind a link so users don't see demo controls by default */}
                      {!showSamples ? (
                        <button type="button" onClick={toggleSamples} className="inline-flex h-7 items-center px-1 text-[12px] font-medium text-teal-700 underline-offset-2 hover:underline sm:ml-auto">
                          Sample vehicles
                        </button>
                      ) : (
                      <div className="flex min-w-0 items-center gap-1.5 sm:ml-auto">
                        <button type="button" onClick={toggleSamples} className="whitespace-nowrap text-[12px] font-medium text-slate-500 hover:text-slate-700" title="Hide sample vehicles">
                          Sample vehicles ✕
                        </button>
                        <select
                          value=""
                          onChange={(e) => e.target.value && doSearch(null, e.target.value)}
                          aria-label="Quick pick a demo vehicle"
                          className="h-9 w-[230px] max-w-full rounded-md border border-slate-300 bg-white px-2 text-[12.5px] text-slate-700 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15"
                        >
                          <option value="">Select a demo vehicle…</option>
                          {DEMO_POLICIES.map((p) => (
                            <option key={p.regNo} value={p.regNo}>
                              {p.regNo} – {scenarioTag(p).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      )}
                    </div>
                    {err.policy && <span data-field-error className="text-[12px] text-red-700">{err.policy}</span>}
                  </form>

                  {/* Before any search: latest work so the page is useful at the start of a call */}
                  {results === null && !f.policy && !f.noPolicy && (
                    <>
                    {/* Compact one-line summary – last 7 days */}
                    <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your intimations · last 7 days</p>
                        <div className="flex flex-wrap items-center gap-1 text-[12px]">
                          <span className="font-medium text-slate-500">By cause of loss:</span>
                          {week.byCause.map(([cause, n]) => (
                            <span key={cause} className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-px text-slate-700">
                              {cause} <b className="tabular-nums text-slate-900">{n}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                        {[
                          ["Intimated", week.total, "text-slate-900", "All channels"],
                          ["Registered", week.registered, "text-emerald-700", `${week.total ? Math.round((week.registered / week.total) * 100) : 0}% registered without NBNR`],
                          ["NBNR", week.nbnr, "text-amber-700", "Parked with reason"],
                          ["Late", week.late, week.late ? "text-red-700" : "text-slate-900", `Intimated more than ${LATE_INTIMATION_DAYS} days after loss`],
                          ["Avg to register", `${week.tat.actual} d`, week.tat.actual <= week.tat.target ? "text-emerald-700" : "text-red-700", `Target ${week.tat.target} d`],
                        ].map(([k, v, cls, note]) => (
                          <div key={k} title={note} className="flex min-w-0 items-baseline gap-1.5 rounded-md border border-slate-200 px-2.5 py-1">
                            <dd className={`text-[15px] font-semibold tabular-nums ${cls}`}>{v}</dd>
                            <dt className="truncate text-[12px] text-slate-600">{k}</dt>
                          </div>
                        ))}
                      </dl>
                    </div>
                    {/* both lists fill the rest of the card and scroll inside – no empty space below */}
                    <div className="grid grid-cols-1 gap-3 xl:min-h-[240px] xl:flex-1 xl:basis-0 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                      <div className="flex max-h-96 min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 xl:max-h-none">
                        <div className="flex flex-none items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                          <p className="text-[12.5px] font-semibold text-slate-800">
                            Recent intimations <span className="font-normal text-slate-500">· last 7 days · {recentIntimations.length}</span>
                          </p>
                          <button type="button" onClick={() => navigate("/od/worklist")} className="text-[12px] font-medium text-teal-700 hover:underline">
                            My Work Queue
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                        <table className="w-full table-fixed text-left text-[12px]">
                          <thead className="sticky top-0 bg-white shadow-[0_1px_0_#f1f5f9]">
                            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                              <th className="w-[44%] px-3 py-1 font-semibold">Claim / vehicle</th>
                              <th className="px-2 py-1 font-semibold">Insured</th>
                              <th className="w-[19%] px-2 py-1 font-semibold">Intimated</th>
                              <th className="w-[17%] px-3 py-1 text-right font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {recentIntimations.map((r) => (
                              <tr key={r.claimNo} onClick={() => navigate(`/od/claims/${claimSlug(r.claimNo)}`)} className="cursor-pointer hover:bg-slate-50">
                                <td className="truncate px-3 py-1">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/od/claims/${claimSlug(r.claimNo)}`); }} className="font-mono text-[12px] font-semibold text-teal-800 hover:underline">
                                    {r.claimNo}
                                  </button>
                                  <span className="text-[12px] text-slate-500"> · {r.regNo}</span>
                                </td>
                                <td className="truncate px-2 py-1 text-slate-700">{r.insured}</td>
                                <td className="px-2 py-1 tabular-nums text-slate-600">{dt(r.regDate)}</td>
                                <td className="px-3 py-1 text-right">
                                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.stage === "NBNR" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                                    {r.stage === "NBNR" ? "NBNR" : "Registered"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-col gap-3">
                      {nbnrCard}

                      </div>
                    </div>
                    </>
                  )}

                  {results && results.length === 0 && !f.noPolicy && (
                    <Banner kind="warn" title="No policy found">
                      Check the number and search again. If the policy still can't be found, you can record the intimation – it will be parked as
                      NBNR (policy not found).
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => set({ noPolicy: true, policy: null, mobile: "", email: "", manualRegNo: f.search.toUpperCase() })}
                          className="rounded border border-amber-400 bg-white px-2 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Continue without policy (NBNR)
                        </button>
                      </div>
                    </Banner>
                  )}

                  {results && results.length > 1 && (
                    <Card title={`${results.length} policies found – select one`}>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-[12.5px]">
                          <thead>
                            <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                              <th scope="col" className="px-3 py-1.5 font-semibold">Insured</th>
                              <th scope="col" className="px-2 py-1.5 font-semibold">Vehicle no</th>
                              <th scope="col" className="px-2 py-1.5 font-semibold">Make / model</th>
                              <th scope="col" className="px-2 py-1.5 font-semibold">Policy no</th>
                              <th scope="col" className="px-2 py-1.5 font-semibold">Status</th>
                              <th scope="col" className="px-3 py-1.5 font-semibold">Matched on</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map(({ policy: p, matchedOn }) => {
                              const on = f.policy?.policyNo === p.policyNo;
                              return (
                                <tr
                                  key={p.policyNo}
                                  onClick={() => choosePolicy(p)}
                                  aria-selected={on}
                                  className={`cursor-pointer border-t border-slate-100 ${on ? "bg-teal-50" : "hover:bg-slate-50"}`}
                                >
                                  <td className="px-3 py-1.5 font-medium text-slate-800">
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={`grid h-4 w-4 flex-none place-items-center rounded-full border ${on ? "border-teal-700 bg-teal-700" : "border-slate-400"}`}
                                        aria-hidden="true"
                                      >
                                        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                      </span>
                                      {p.insured}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-800">{p.regNo}</td>
                                  <td className="px-2 py-1.5 text-slate-700">{p.vehicle}</td>
                                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700">{p.policyNo}</td>
                                  <td className="px-2 py-1.5">
                                    <span
                                      className={`inline-flex h-5 items-center rounded px-1.5 text-[12px] font-semibold ${
                                        p.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-[12px] text-slate-500">{matchedOn}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {f.noPolicy && (
                    <Card title="Vehicle (policy not found)" action={<button type="button" onClick={() => set({ noPolicy: false })} className="text-[12px] font-medium text-teal-700 hover:underline">Search again</button>}>
                      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                        <Field label="Vehicle registration no" required error={err.manualRegNo} auto={f.autoFill.manualRegNo}>
                          <input value={f.manualRegNo} onChange={(e) => setTyped("manualRegNo", e.target.value.toUpperCase())} className={inputCls(err.manualRegNo)} placeholder="TN 09 AB 1234" />
                        </Field>
                        <Field label="Make / model" auto={f.autoFill.manualVehicle}>
                          <input value={f.manualVehicle} onChange={(e) => setTyped("manualVehicle", e.target.value)} className={inputCls()} placeholder="e.g. Maruti Swift VXi" />
                        </Field>
                      </div>
                    </Card>
                  )}

                  {f.policy && (
                    <>
                      <Card title="Policy" action={<span className={`rounded px-1.5 text-[12px] font-semibold leading-5 ${f.policy.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{f.policy.status}</span>}>
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
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                              <dd className={`text-slate-800 tabular-nums ${k === "Policy no" ? "whitespace-nowrap" : ""}`}>{v}</dd>
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
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
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

              {/* ===== Step 1 · Policy Information – B. Customer (shown once a policy is chosen) ===== */}
              {show(1) && (f.policy || f.noPolicy) && <SectionHead n="B" title="Customer details" divider />}
              {show(1) && (f.policy || f.noPolicy) && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Insured name">
                      <LockedInput value={f.policy?.insured || "(policy not found)"} />
                    </Field>
                    {f.policy ? (
                      <>
                        <Field label="Registered mobile" hint="From policy – changed only by endorsement">
                          <LockedInput value={f.mobile || "Not on policy"} />
                        </Field>
                        <Field label="Registered email" hint="From policy – changed only by endorsement">
                          <LockedInput value={f.email || "Not on policy"} />
                        </Field>
                      </>
                    ) : (
                      <>
                        {/* Policy not found – nothing to pull, so the handler records the contact */}
                        <Field label="Contact mobile" required error={err.mobile} hint="Claim acknowledgement is sent by SMS">
                          <input inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, "") })} className={inputCls(err.mobile)} placeholder="10-digit mobile" />
                        </Field>
                        <Field label="Contact email" error={err.email}>
                          <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value.trim() })} className={inputCls(err.email)} />
                        </Field>
                      </>
                    )}
                    <Field label="Alternate contact number" error={err.altMobile} hint="Optional – e.g. family member or driver">
                      <input inputMode="numeric" maxLength={10} value={f.altMobile} onChange={(e) => set({ altMobile: e.target.value.replace(/\D/g, "") })} className={inputCls(err.altMobile)} placeholder="10-digit mobile" />
                    </Field>
                    <Field label="Alternate email" error={err.altEmail} hint="Optional">
                      <input type="email" value={f.altEmail} onChange={(e) => set({ altEmail: e.target.value.trim() })} className={inputCls(err.altEmail)} placeholder="name@example.com" />
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

              {/* ===== Step 2 · Incident Details – A. Incident (incl. driver) ===== */}
              {show(2) && <SectionHead n="A" title="Incident details" />}
              {show(2) && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Date of loss" required error={err.lossDate} hint={f.lossDate === TODAY_ISO ? "Today – change if the loss was earlier" : undefined}>
                      <input type="date" max={TODAY_ISO} value={f.lossDate} onChange={(e) => onLossDate(e.target.value)} className={inputCls(err.lossDate)} />
                    </Field>
                    <Field label="Time of loss (approx.)" required error={err.lossTime} hint={f.lossDate === TODAY_ISO ? "No later than now" : undefined}>
                      <input type="time" max={f.lossDate === TODAY_ISO ? nowHHMM() : undefined} value={f.lossTime} onChange={(e) => onLossTime(e.target.value)} className={inputCls(err.lossTime)} />
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

                  {/* Map (left) + address & description (right) – side by side to save height */}
                  <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-[12px] font-medium text-slate-700">
                        Pin the place of loss <span className="font-normal text-slate-500">– fields fill automatically</span>
                      </span>
                      <LocationPicker
                        height={188}
                        value={f.lossLat ? { lat: f.lossLat, lng: f.lossLng } : null}
                        onChange={(loc) =>
                          set({
                            lossLat: loc.lat,
                            lossLng: loc.lng,
                            ...(loc.place ? { place: loc.place } : {}),
                            ...(loc.city ? { city: loc.city } : {}),
                            ...(loc.pincode ? { pincode: loc.pincode } : {}),
                          })
                        }
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2.5">
                      <Field label="Place of loss" required error={err.place}>
                        <input value={f.place} onChange={(e) => set({ place: e.target.value })} className={inputCls(err.place)} placeholder="Road / landmark / area" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="City">
                          <input value={f.city} onChange={(e) => set({ city: e.target.value })} className={inputCls()} />
                        </Field>
                        <Field label="Pincode" error={err.pincode}>
                          <input inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, "") })} className={inputCls(err.pincode)} placeholder="6 digits" />
                        </Field>
                      </div>
                      <Field label="What happened?" required error={err.description} hint={`${f.description.trim().length} characters (min 20)`}>
                        <textarea rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} className={`${inputCls(err.description)} h-auto resize-none py-1.5`} placeholder="Brief description of how the loss occurred and damage seen" />
                      </Field>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 lg:grid-cols-4">
                    {!["theft", "flood", "partialTheft"].includes(f.cause) && (
                      <Field label="Was the vehicle being driven?">
                        <Segmented name="Being driven" value={f.beingDriven} onChange={(v) => set({ beingDriven: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (parked)" }]} />
                      </Field>
                    )}
                    <Field label="Third party involved?">
                      {/* no third party → no injury question; switching back to No clears the injury answer */}
                      <Segmented name="Third party" value={f.tpInvolved} onChange={(v) => set(v === "yes" ? { tpInvolved: v } : { tpInvolved: v, injury: "no" })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                    </Field>
                    {f.tpInvolved === "yes" && (
                      <Field label="Anyone injured?">
                        <Segmented name="Injury" value={f.injury} onChange={(v) => set({ injury: v })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                      </Field>
                    )}
                    <Field label="Reported to police?">
                      <Segmented name="Police" value={f.policeReported} onChange={(v) => set({ policeReported: v })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
                    </Field>
                  </div>

                  {(f.tpInvolved === "yes" || f.policeReported === "yes" || f.cause === "theft" || f.cause === "fire" || f.injury === "yes") && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {f.tpInvolved === "yes" && (
                        <Field label="Third-party vehicle no" required error={err.tpVehicleNo} hint="Passed to the TP claims system" className="lg:col-span-2">
                          <input value={f.tpVehicleNo} onChange={(e) => set({ tpVehicleNo: e.target.value.toUpperCase() })} className={inputCls(err.tpVehicleNo)} placeholder="TN 01 XY 1234 or Unknown" />
                        </Field>
                      )}
                      {(f.policeReported === "yes" || f.cause === "theft" || f.cause === "fire" || f.injury === "yes") && (
                        <>
                          <Field label="FIR / police report no" required error={err.firNo}>
                            <input value={f.firNo} onChange={(e) => set({ firNo: e.target.value })} className={inputCls(err.firNo)} placeholder="e.g. 1234/2026" />
                          </Field>
                          <Field label="Police station">
                            <input value={f.policeStation} onChange={(e) => set({ policeStation: e.target.value })} className={inputCls()} placeholder="e.g. J-3 Guindy" />
                          </Field>
                        </>
                      )}
                    </div>
                  )}
                  {/* Upload DL / RC → read (OCR) → fills the driver details and checks the vehicle against the policy */}
                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-[12.5px] font-semibold text-[#0B1F3A]">
                        Upload to auto-fill <span className="font-normal text-slate-500">– optional, fields below fill from the document</span>
                      </p>
                      <span className="text-[11.5px] text-slate-500">Photo or PDF · read details can still be edited</span>
                    </div>
                    <DocAutoFill
                      onRead={onDocRead}
                      onView={(k) => openDoc(k === "dl" ? `DL – ${f.dlRead.fileName}` : `RC – ${f.rcRead.fileName}`)}
                      items={[
                        ...(driverNeeded(f)
                          ? [{
                              key: "dl",
                              title: "Driving licence",
                              icon: IdCard,
                              hint: "Fills driver name, DL no, validity, date of birth and class",
                              done: f.dlRead && {
                                fileName: f.dlRead.fileName,
                                warn: f.dlRead.missing.length > 0,
                                summary: f.dlRead.found.length
                                  ? [f.dlRead.holder && titleCase(f.dlRead.holder), f.dlRead.dlNo, f.dlRead.validTill && `valid till ${dt(f.dlRead.validTill)}`].filter(Boolean).join(" · ") +
                                    (f.dlRead.missing.length ? ` · not found: ${f.dlRead.missing.join(", ").toLowerCase()}` : "")
                                  : "Nothing readable – type the details below or upload a clearer photo",
                              },
                            }]
                          : []),
                        {
                          key: "rc",
                          title: "RC",
                          icon: FileText,
                          hint: f.noPolicy ? "Fills vehicle no and make / model, reads chassis and engine no" : "Checks reg no, chassis, engine and owner against the policy",
                          done: f.rcRead && {
                            fileName: f.rcRead.fileName,
                            warn: f.rcRead.missing.length > 0,
                            summary: f.rcRead.found.length
                              ? [f.rcRead.regNo, f.rcRead.vehicle, f.rcRead.owner && `owner ${titleCase(f.rcRead.owner)}`].filter(Boolean).join(" · ") +
                                (f.rcRead.missing.length ? ` · not found: ${f.rcRead.missing.join(", ").toLowerCase()}` : "")
                              : "Nothing readable – upload a clearer photo",
                          },
                        },
                      ]}
                    />
                    {f.rcRead && (
                      <div className="rounded-md border border-slate-200">
                        <p className="border-b border-slate-100 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                          Read from RC <span className="font-normal text-slate-500">· {f.rcRead.source === "PDF text" ? "from PDF text" : `${f.rcRead.source} · ${f.rcRead.confidence}% confidence`}</span>
                        </p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2 text-[12px] sm:grid-cols-4">
                          {[
                            ["Registration no", f.rcRead.regNo],
                            ["Owner", f.rcRead.owner && titleCase(f.rcRead.owner)],
                            ["Make / model", f.rcRead.vehicle],
                            ["Fuel", f.rcRead.fuel],
                            ["Chassis no", f.rcRead.chassis],
                            ["Engine no", f.rcRead.engine],
                            ["Registered on", f.rcRead.regDate && dt(f.rcRead.regDate)],
                            ["Hypothecation", f.rcRead.hypothecation],
                          ].map(([k, v]) => (
                            <div key={k} className="min-w-0">
                              <dt className="text-[11px] text-slate-500">{k}</dt>
                              <dd className={`truncate font-medium ${v ? "text-slate-800" : "italic text-slate-500"}`} title={v || "Not found on the RC"}>
                                {v || "Not found"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-1.5 text-[12px]">
                          {f.rcRead.checks.map((c) => (
                            <li key={c.label} className={`flex items-center gap-1 ${c.ok === false ? "text-red-700" : c.ok ? "text-emerald-700" : "text-slate-600"}`}>
                              {c.ok === false ? <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> : c.ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Info className="h-3.5 w-3.5" aria-hidden="true" />}
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {driverNeeded(f) ? (
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-semibold text-[#0B1F3A]">Driver at the time of loss</p>
                        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                          <input type="checkbox" checked={f.driverSameAsInsured} onChange={(e) => setF((x) => ({ ...x, driverSameAsInsured: e.target.checked, autoFill: { ...x.autoFill, driverName: undefined } }))} className="h-4 w-4 accent-teal-700" />
                          Driver is the insured
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Driver name" required={!f.driverSameAsInsured} error={err.driverName} auto={!f.driverSameAsInsured && f.autoFill.driverName}>
                          <input value={f.driverSameAsInsured ? f.policy?.insured || "" : f.driverName} disabled={f.driverSameAsInsured} onChange={(e) => setTyped("driverName", e.target.value)} className={inputCls(err.driverName)} />
                        </Field>
                        <Field label="Driving licence no" required error={err.dlNo} auto={f.autoFill.dlNo}>
                          <input value={f.dlNo} onChange={(e) => setTyped("dlNo", e.target.value.toUpperCase())} className={inputCls(err.dlNo)} placeholder="TN09 20150012345" />
                        </Field>
                        <Field label="DL valid till (non-transport)" required error={err.dlValidTill} auto={f.autoFill.dlValidTill}>
                          <input type="date" value={f.dlValidTill} onChange={(e) => setTyped("dlValidTill", e.target.value)} className={inputCls(err.dlValidTill)} />
                        </Field>
                        <Field label="Driver date of birth" error={err.driverDob} auto={f.autoFill.driverDob}>
                          <input type="date" max={TODAY_ISO} value={f.driverDob} onChange={(e) => setTyped("driverDob", e.target.value)} className={inputCls(err.driverDob)} />
                        </Field>
                        <Field label="Class of vehicle (on DL)" auto={f.autoFill.dlClass} hint="A car needs LMV">
                          <input value={f.dlClass} onChange={(e) => setTyped("dlClass", e.target.value.toUpperCase())} className={inputCls()} placeholder="e.g. LMV, MCWG" />
                        </Field>
                      </div>
                      {f.dlRead?.holder && !f.driverSameAsInsured && titleCase(f.dlRead.holder) === f.driverName && (
                        <Banner kind="info" title={`Licence is in the name of ${f.driverName}, not the insured`}>
                          Taken from the uploaded licence. Untick only if this is wrong – a driver other than the insured is allowed if they hold a valid licence.
                        </Banner>
                      )}
                      {f.dlClass && !/\bLMV\b/.test(f.dlClass) && (
                        <Banner kind="warn" title="Licence class does not cover a private car (LMV)">
                          The claim can be intimated, but it will be flagged for admissibility review.
                        </Banner>
                      )}
                      {f.dlValidTill && f.lossDate && f.dlValidTill < f.lossDate && (
                        <Banner kind="warn" title="Driving licence had expired on the loss date">
                          The claim can be intimated, but it will be flagged for admissibility review (invalid DL is a policy exclusion).
                        </Banner>
                      )}
                    </div>
                  ) : (
                    <p className="border-t border-slate-100 pt-2.5 text-[12px] text-slate-500">Driver details not required – vehicle was not being driven at the time of loss.</p>
                  )}
                </>
              )}

              {/* ===== Step 2 · Incident Details – B. Additional information ===== */}
              {show(3) && <SectionHead n="B" title="Additional information" divider />}
              {show(3) && (
                <>
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
                    <Field label="Where is the vehicle now?">
                      <Segmented
                        name="Vehicle location"
                        value={f.cause === "theft" ? "nottraced" : f.vehicleLocation}
                        onChange={(v) => set({ vehicleLocation: v })}
                        options={
                          f.cause === "theft"
                            ? [{ value: "nottraced", label: "Not traced" }]
                            : [
                                { value: "garage", label: "Garage" },
                                { value: "spot", label: "Accident spot" },
                                { value: "home", label: "Residence" },
                              ]
                        }
                      />
                    </Field>
                    {f.cause !== "theft" && (
                      <Field label="Survey type">
                        <Segmented name="Survey type" value={f.surveyType} onChange={(v) => set({ surveyType: v })} options={[{ value: "garage", label: "Garage" }, { value: "spot", label: "Spot" }]} />
                      </Field>
                    )}
                    {f.cause !== "theft" && f.vehicleLocation === "garage" && (
                      <Field
                        label="Garage"
                        required
                        error={err.garage}
                        hint={recommended.length ? `Recommended: ${recommended.map((g) => g.name).join(", ")} – ${brand} dealer, cashless` : "Network garages offer cashless repair"}
                        className="sm:col-span-2 lg:col-span-1"
                      >
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
                    )}
                  </div>
                  {f.cause !== "theft" && f.vehicleLocation === "garage" && f.garage === "other" && (
                    <Field label="Garage name & address" required error={err.otherGarage}>
                      <input value={f.otherGarage} onChange={(e) => set({ otherGarage: e.target.value })} className={inputCls(err.otherGarage)} />
                    </Field>
                  )}

                  {/* Upload (left) + remarks (right) */}
                  <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                  <Field label="Photos / documents (optional)" hint="Photos, RC, DL, FIR – can also be added later from Claim 360">
                    <label className="relative flex h-[58px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-3 text-[12.5px] text-slate-600 hover:border-teal-600 hover:bg-teal-50/40">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Choose files to attach
                      <input
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || []).filter((x) => !f.files.includes(x.name));
                          picked.forEach((x) => putDoc(x.name, x));
                          e.target.value = "";
                          set({ files: [...f.files, ...picked.map((x) => x.name)] });
                        }}
                      />
                    </label>
                  </Field>
                  {f.files.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {f.files.map((n, i) => (
                        <li key={n + i} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[12px] text-slate-700">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          {n}
                          <button type="button" aria-label={`View ${n}`} title="View" onClick={() => openDoc(n)} className="ml-1 text-teal-700 hover:text-teal-900">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${n}`}
                            onClick={() => {
                              removeDoc(n);
                              // removing the DL / RC also drops what was read from it (the typed fields stay)
                              set({
                                files: f.files.filter((_, j) => j !== i),
                                ...(f.dlRead && n === `DL – ${f.dlRead.fileName}` ? { dlRead: null } : {}),
                                ...(f.rcRead && n === `RC – ${f.rcRead.fileName}` ? { rcRead: null } : {}),
                              });
                            }}
                            className="ml-0.5 text-slate-500 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  </div>
                  <Field label="Remarks for the claims team">
                    <textarea value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} className={`${inputCls()} h-[58px] resize-none py-1.5`} placeholder="Optional" />
                  </Field>
                  </div>
                </>
              )}

              {/* ===== Step 3: Review ===== */}
              {show(4) && (
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
                      to: 0,
                      rows: [
                        ["Registered contact", `${f.mobile}${f.email ? ` · ${f.email}` : ""}`],
                        (f.altMobile || f.altEmail) && ["Alternate contact", [f.altMobile, f.altEmail].filter(Boolean).join(" · ")],
                        ["Intimated via", `${f.channel} · by ${f.intimatedBy}${f.callerName ? ` (${f.callerName})` : ""}`],
                      ].filter(Boolean),
                    },
                    {
                      title: "Incident",
                      to: 1,
                      rows: [
                        ["Loss", `${dt(f.lossDate)} · ${f.lossTime}`],
                        ["Cause", LOSS_CAUSES.find((c) => c.key === f.cause)?.label],
                        ["Place", `${f.place}, ${f.city}${f.pincode ? ` – ${f.pincode}` : ""}`],
                        ["GPS location", f.lossLat ? `${f.lossLat.toFixed(5)}, ${f.lossLng.toFixed(5)} (pinned on map)` : "Not pinned – typed manually"],
                        ["Description", f.description],
                        ["Third party / injury / police", `${f.tpInvolved === "yes" ? `TP ${f.tpVehicleNo} · ${f.injury === "yes" ? "Injury" : "No injury"}` : "No TP"} · ${f.firNo ? `FIR ${f.firNo}` : "No FIR"}`],
                        driverNeeded(f) && ["Driver", `${f.driverSameAsInsured ? f.policy?.insured : f.driverName} · DL ${f.dlNo} valid till ${dt(f.dlValidTill)}${f.dlClass ? ` · ${f.dlClass}` : ""}${f.driverDob ? ` · born ${dt(f.driverDob)}` : ""}`],
                        (f.dlRead || f.rcRead) && ["Documents read", [f.dlRead && "Driving licence", f.rcRead && `RC${f.rcRead.checks.some((c) => c.ok === false) ? " (mismatch with policy)" : f.policy ? " (matches policy)" : ""}`].filter(Boolean).join(" · ")],
                        f.catEvent && ["CAT event", f.catEvent],
                        f.lateReason && ["Late intimation reason", f.lateReason],
                      ].filter(Boolean),
                    },
                    {
                      title: "Additional information",
                      to: 1,
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
                      {err.declaration && <span data-field-error className="block text-red-700">{err.declaration}</span>}
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
              <span className="text-[12px] text-slate-500">
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
        </div>
      </div>

      {viewDoc && <DocViewer key={viewDoc.name} name={viewDoc.name} title={viewDoc.title} details={viewDoc.details} onClose={closeViewer} />}
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}