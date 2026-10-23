// src/data/odClaimDetail.js
// Demo detail for the Claim 360 page. Every claim in WORK_QUEUE gets a full,
// consistent record (policy, vehicle, loss, survey, documents, reserve, timeline)
// generated from its queue row – same claim always gives the same data.
// Replace with:  GET /od/claims/{claimNo}
//
// All people, policy numbers and amounts are fictional.

import { WORK_QUEUE } from "./odHandlerMock";

/* ---------------- URL helpers: claim no has "/" so use "-" in URLs ---------------- */
export const claimSlug = (claimNo) => claimNo.replaceAll("/", "-");
export const claimFromSlug = (slug) => String(slug || "").replaceAll("-", "/");

/* ---------------- Lifecycle used by the stepper (5 business stages) ----------------
   Intake                – intimation, policy/coverage validation, registration (or NBNR)
   Survey / Investigation – surveyor appointment & inspection; SIU investigation for theft / fraud
   Assessment            – estimate, part-wise assessment, documents, liability
   Decision              – admissibility & approval / repudiation by authority
   Settlement            – repair authorisation, delivery order, payment, closure
------------------------------------------------------------------------------------ */
export const LIFECYCLE = [
  { key: "intake", label: "Intake" },
  { key: "survey", label: "Survey / Investigation" },
  { key: "assessment", label: "Assessment" },
  { key: "decision", label: "Decision" },
  { key: "settlement", label: "Settlement" },
];

// Work-queue stage → lifecycle step (0-based) + what "in progress" means there
export const STAGE_TO_STEP = {
  NBNR: { step: 0, note: "On hold · NBNR", hold: true },
  Registered: { step: 1, note: "Surveyor to be appointed" },
  "Survey pending": { step: 1, note: "In progress" },
  Assessment: { step: 2, note: "In progress" },
  "Documents pending": { step: 2, note: "Documents pending" },
  Approval: { step: 3, note: "Awaiting approval" },
  "Repair / DO": { step: 4, note: "Repair in progress" },
  Payment: { step: 4, note: "Payment in process" },
  Closed: { step: 5, note: "Closed" },
};

// Detailed stage index used internally for dates, documents and timeline
const STAGE_STEP = {
  NBNR: 0,
  Registered: 1,
  "Survey pending": 2,
  Assessment: 3,
  "Documents pending": 4,
  Approval: 5,
  "Repair / DO": 6,
  Payment: 7,
};

/* ---------------- deterministic pseudo-random ---------------- */
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const round = (n, to = 100) => Math.round(n / to) * to;

const TODAY = new Date("2026-10-22T00:00:00");
const addDays = (iso, d) => {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

const SURVEYORS = [
  { name: "R. Senthil Kumar", licence: "SLA-87654", type: "In-house surveyor" },
  { name: "M. Farook", licence: "SLA-91230", type: "In-house surveyor" },
  { name: "K. Ilango", licence: "SLA-77821", type: "In-house surveyor" },
  { name: "P. Jayaraman", licence: "SLA-80345", type: "In-house surveyor" },
];
const GARAGES = [
  { name: "Lakshmi Tata Motors, Guindy", type: "Dealer · network", city: "Chennai" },
  { name: "Sundaram Motors (Maruti), Anna Salai", type: "Dealer · network", city: "Chennai" },
  { name: "Hyundai Motor Plaza, Ambattur", type: "Dealer · network", city: "Chennai" },
  { name: "Sri Murugan Car Care, Velachery", type: "Multi-brand · network", city: "Chennai" },
  { name: "Kun Honda, Porur", type: "Dealer · network", city: "Chennai" },
];
const FINANCIERS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Bajaj Finance", null, null];
const PLACES = [
  "OMR, Thoraipakkam, Chennai",
  "GST Road, Tambaram, Chennai",
  "Poonamallee High Road, Koyambedu, Chennai",
  "ECR, Neelankarai, Chennai",
  "Inner Ring Road, Ashok Nagar, Chennai",
  "100 Feet Road, Velachery, Chennai",
];
const CAUSES = {
  "Accident – partial": [
    "Hit from behind by another vehicle at a signal",
    "Skidded and hit the median while braking in rain",
    "Collided with a two-wheeler while taking a right turn",
    "Hit a pole while reversing in a parking lot",
  ],
  "Flood – CAT": ["Vehicle submerged in flood water at residence parking"],
  "Total loss / CTL": ["Head-on collision with a lorry on the highway"],
  Theft: ["Vehicle stolen from outside residence overnight"],
  "Partial theft": ["Battery and alloy wheels stolen while parked"],
  Fire: ["Fire in engine compartment due to suspected short circuit"],
};
const CHANNELS = ["Call centre", "Customer portal", "Network garage", "Agent / intermediary", "Branch walk-in"];

function maskMobile(r) {
  const tail = String(1000 + Math.floor(r() * 9000));
  return `98XXXXX${tail.slice(0, 3)}`;
}

/* ---------------- main builder ---------------- */
export function getClaimDetail(claimNo) {
  const row = WORK_QUEUE.find((r) => r.claimNo === claimNo);
  if (!row) return null;
  const r = rng(seedOf(claimNo));
  const step = STAGE_STEP[row.stage] ?? 0;
  const isNbnr = row.stage === "NBNR";
  const lossIsTheft = row.lossType === "Theft";
  const year = 2018 + Math.floor(r() * 7);
  const idv = round(row.lossType === "Total loss / CTL" || lossIsTheft ? row.reserve * 1.05 : 350000 + r() * 900000, 1000);

  /* ---- policy ---- */
  const policyStart = addDays(row.regDate, -Math.floor(40 + r() * 300));
  const policy = {
    policyNo: `OG-26-1801-${1000 + Math.floor(r() * 8999)}-${String(Math.floor(r() * 99999999)).padStart(8, "0")}`,
    product: "Private Car Package Policy (Comprehensive)",
    status: isNbnr ? "Under verification" : "In force",
    periodFrom: policyStart,
    periodTo: addDays(policyStart, 364),
    premiumRealised: isNbnr ? "Pending confirmation from PAS" : "Yes",
    idv,
    ncb: pick(r, ["0%", "20%", "25%", "35%", "45%", "50%"]),
    compulsoryDeductible: 1000,
    voluntaryDeductible: pick(r, [0, 0, 2500, 5000]),
    addOns: [
      ...(r() > 0.35 ? ["Zero depreciation"] : []),
      ...(r() > 0.5 ? ["Engine protect"] : []),
      ...(r() > 0.4 ? ["Consumables"] : []),
      ...(r() > 0.6 ? ["Return to invoice"] : []),
      "Roadside assistance",
    ],
    financier: pick(r, FINANCIERS),
    previousClaims: Math.floor(r() * 3),
    channel: pick(r, ["Direct", "Agent", "Broker", "OEM dealer"]),
  };
  const zeroDep = policy.addOns.includes("Zero depreciation");

  /* ---- vehicle & driver ---- */
  const vehicle = {
    regNo: row.regNo,
    makeModel: row.vehicle,
    yearOfMfg: year,
    fuel: pick(r, ["Petrol", "Petrol", "Diesel", "CNG"]),
    cc: pick(r, [998, 1197, 1199, 1462, 1497, 1498, 2184]),
    chassis: `MA3XXXXXXXX${String(Math.floor(r() * 900000) + 100000)}`,
    engine: `K12NXXXX${String(Math.floor(r() * 9000) + 1000)}`,
    usage: "Private",
    odometer: Math.floor(8000 + r() * 70000),
  };
  const driver = lossIsTheft || row.lossType === "Flood – CAT" || row.lossType === "Partial theft"
    ? null
    : {
        name: r() > 0.3 ? row.insured : pick(r, ["S. Arun (son)", "K. Ravi (driver)", "M. Latha (spouse)"]),
        dlNo: `TN09 20${10 + Math.floor(r() * 12)}XXXX${String(Math.floor(r() * 900) + 100)}`,
        dlValidTill: addDays(row.regDate, 400 + Math.floor(r() * 3000)),
        dlClass: "LMV",
      };

  /* ---- loss ---- */
  const lossTime = `${String(6 + Math.floor(r() * 16)).padStart(2, "0")}:${pick(r, ["05", "20", "35", "50"])}`;
  const loss = {
    date: row.lossDate,
    time: lossTime,
    place: pick(r, PLACES),
    cause: pick(r, CAUSES[row.lossType] || CAUSES["Accident – partial"]),
    tpInvolved: row.lossType === "Accident – partial" && r() > 0.6,
    policeReport: lossIsTheft || row.lossType === "Total loss / CTL" || row.lossType === "Fire" ? "FIR registered" : r() > 0.7 ? "Not required" : "Not reported",
    vehicleLocation: lossIsTheft ? "Not traced" : pick(r, GARAGES).name,
    intimationChannel: pick(r, CHANNELS),
    intimatedOn: row.regDate,
    intimationDelayDays: daysBetween(row.lossDate, row.regDate),
    catEvent: row.lossType === "Flood – CAT" ? "CAT-2026-TN-04 · NE monsoon floods, Chennai" : null,
  };
  const garage = lossIsTheft ? null : GARAGES.find((g) => g.name === loss.vehicleLocation) || pick(r, GARAGES);

  /* ---- survey & assessment ---- */
  const surveyor = step >= 2 ? pick(r, SURVEYORS) : null;
  const estimate = round(row.reserve * (1.12 + r() * 0.2));
  const assessed = step >= 3 && step !== 4 ? row.reserve : step >= 4 ? row.reserve : null;
  const depreciation = assessed == null ? null : zeroDep ? 0 : round(assessed * (0.06 + r() * 0.08));
  const salvage = assessed == null ? null : round(assessed * 0.015);
  const deductible = policy.compulsoryDeductible + policy.voluntaryDeductible;
  const netLiability = assessed == null ? null : Math.max(0, assessed - depreciation - salvage - deductible);
  const survey = {
    surveyor,
    appointedOn: step >= 2 ? addDays(row.regDate, 1) : null,
    surveyDoneOn: step >= 3 ? addDays(row.regDate, 3) : null,
    surveyType: lossIsTheft ? "Investigation (SIU)" : row.lossType === "Flood – CAT" ? "Spot / CAT survey" : "Garage survey",
    estimate: lossIsTheft || step < 2 ? null : estimate, // garage estimate arrives after registration
    assessed,
    depreciation,
    salvage,
    deductible,
    netLiability,
    zeroDep,
  };

  /* ---- documents ---- */
  const docDefs = [
    { name: "Claim form (signed)", need: true },
    { name: "Policy copy", need: true },
    { name: "RC copy", need: true },
    { name: "Driving licence", need: !!driver },
    { name: "KYC – PAN / Aadhaar", need: true },
    { name: "Cancelled cheque / bank details", need: true },
    { name: "Garage estimate", need: !lossIsTheft },
    { name: "Vehicle photos", need: !lossIsTheft },
    { name: "FIR / police report", need: loss.policeReport === "FIR registered" },
    { name: "Fire brigade report", need: row.lossType === "Fire" },
    { name: "Survey report", need: !lossIsTheft },
    { name: "Final invoice", need: !lossIsTheft },
    { name: "Satisfaction note / delivery", need: !lossIsTheft },
    { name: "Non-traceable report (police)", need: lossIsTheft },
    { name: "Original keys & Form 28/29/30", need: lossIsTheft },
  ].filter((d) => d.need);
  // which docs are still pending, by stage
  const pendingSet = new Set();
  if (row.stage === "Documents pending" && row.pendingWith === "Insured") {
    const na = row.nextAction.toLowerCase();
    if (na.includes("dl")) pendingSet.add("Driving licence");
    if (na.includes("claim form")) pendingSet.add("Claim form (signed)");
    if (na.includes("rc")) pendingSet.add("RC copy");
    if (na.includes("kyc")) pendingSet.add("KYC – PAN / Aadhaar");
    if (na.includes("cheque") || na.includes("bank")) pendingSet.add("Cancelled cheque / bank details");
    if (na.includes("fir") || na.includes("police")) pendingSet.add("FIR / police report");
    if (na.includes("fire")) pendingSet.add("Fire brigade report");
    if (pendingSet.size === 0) pendingSet.add("Driving licence");
  }
  if (row.stage === "Documents pending" && row.pendingWith === "Garage / dealer") {
    pendingSet.add(row.nextAction.toLowerCase().includes("pre-invoice") ? "Garage estimate" : "Final invoice");
  }
  const laterDocs = {
    "Survey report": 3,
    "Final invoice": 6,
    "Satisfaction note / delivery": 6,
    "Non-traceable report (police)": 7,
    "Original keys & Form 28/29/30": 7,
  };
  const documents = docDefs.map((d, i) => {
    let status;
    if (pendingSet.has(d.name)) status = "Pending";
    else if (laterDocs[d.name] != null && step < laterDocs[d.name]) status = "Not yet due";
    else if (isNbnr && i > 1) status = "Not yet due";
    else status = "Received";
    const receivedOn = status === "Received" ? addDays(row.regDate, Math.min(row.ageDays, Math.floor(r() * 6))) : null;
    return {
      name: d.name,
      status,
      receivedOn,
      requestedOn: status === "Pending" ? addDays(row.regDate, Math.max(1, row.ageDays - 9)) : null,
      reminders: status === "Pending" ? 1 + Math.floor(r() * 3) : 0,
      source: status === "Received" ? pick(r, ["Insured (email)", "Garage upload", "Branch scan", "Surveyor upload"]) : null,
    };
  });

  /* ---- reserve history ---- */
  const initialReserve = round(row.reserve * (0.6 + r() * 0.3), 500);
  const reserveHistory = [
    { date: row.regDate, type: "Initial reserve", amount: initialReserve, by: "System (auto)", reason: "Standard reserve by product & loss type" },
  ];
  if (step >= 3) {
    reserveHistory.push({
      date: addDays(row.regDate, 3),
      type: "Revision",
      amount: row.reserve,
      by: surveyor ? surveyor.name : "Claims handler",
      reason: "Revised to assessed loss after survey",
    });
  }
  const payments =
    row.stage === "Payment"
      ? [{ date: addDays(TODAY.toISOString().slice(0, 10), -1), payee: garage?.name || row.insured, mode: "NEFT", amount: netLiability ?? row.reserve, status: "Sent to Finance" }]
      : [];

  /* ---- timeline / audit ---- */
  const t = [];
  const push = (dayOffset, time, event, by, detail) =>
    t.push({ date: addDays(row.regDate, dayOffset), time, event, by, detail });
  push(0, lossTime < "20:00" ? "21:10" : "09:40", "Claim intimated", loss.intimationChannel, `Loss on ${row.lossDate} · ${loss.place}`);
  if (isNbnr) {
    push(0, "21:11", "Parked as NBNR", "System (auto)", row.nextAction);
  } else {
    push(0, "21:11", "Policy & coverage validated", "System (auto)", "Policy in force · OD cover available");
    push(0, "21:11", "Claim registered", "System (auto)", `Claim no ${row.claimNo} · initial reserve ₹${initialReserve.toLocaleString("en-IN")}`);
    push(0, "21:12", "Assigned to handler", "System (auto)", "Karthik Subramanian · Chennai");
  }
  if (step >= 2 && surveyor) push(1, "10:05", "Surveyor appointed", "Karthik Subramanian", `${surveyor.name} (${surveyor.licence})`);
  if (step >= 3 && surveyor) push(3, "15:30", "Survey completed", surveyor.name, `Estimate ₹${estimate.toLocaleString("en-IN")} · photos uploaded`);
  if (step >= 3) push(3, "16:10", "Reserve revised", surveyor ? surveyor.name : "Karthik Subramanian", `₹${row.reserve.toLocaleString("en-IN")}`);
  documents
    .filter((d) => d.status === "Pending")
    .forEach((d) => push(Math.max(1, row.ageDays - 9), "11:20", "Document requested", "Karthik Subramanian", `${d.name} · ${d.reminders} reminder(s) sent`));
  if (step >= 5) push(Math.max(4, row.ageDays - 6), "12:45", "Sent for approval", "Karthik Subramanian", `Net liability ₹${(netLiability ?? 0).toLocaleString("en-IN")}`);
  if (step >= 6) push(Math.max(5, row.ageDays - 4), "17:00", "Repair authorised", "Claims approver", "Delivery order issued to garage");
  if (step >= 7) push(Math.max(6, row.ageDays - 1), "11:00", "Payment requested", "Karthik Subramanian", `NEFT to ${garage?.name || row.insured}`);
  row.flags.forEach((f) => push(1, "09:00", `Flag raised: ${f}`, "System (rules)", f === "Fraud flag" ? "Theft within 30 days of policy inception" : f));
  t.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  /* ---- red flags / checks ---- */
  const checks = [
    { label: "Policy in force on loss date", ok: isNbnr ? "pending" : true, note: isNbnr ? "Awaiting PAS confirmation" : "Yes" },
    { label: "Own Damage cover available", ok: true, note: "Comprehensive" },
    { label: "Duplicate claim check", ok: true, note: "No duplicate found" },
    {
      label: "Intimation within 7 days",
      ok: loss.intimationDelayDays <= 7,
      note: `${loss.intimationDelayDays} day(s) after loss`,
    },
    { label: "Driving licence valid", ok: driver ? true : null, note: driver ? `Valid till ${driver.dlValidTill}` : "Not applicable" },
    // ok: true = passed · false = failed · "pending" = waiting for confirmation · null = not applicable
    { label: "Fraud rules", ok: !row.flags.includes("Fraud flag"), note: row.flags.includes("Fraud flag") ? "Red flag – referred to SIU" : "No red flags" },
  ];

  return {
    ...row,
    step, // detailed internal step
    lifecycle: STAGE_TO_STEP[row.stage] ?? { step: 0, note: "" }, // 5-stage stepper position
    contact: { mobile: maskMobile(r), email: `${row.insured.split(" ").pop().toLowerCase()}.***@gmail.com` },
    policy,
    vehicle,
    driver,
    loss,
    garage,
    survey,
    documents,
    reserveHistory,
    payments,
    timeline: t,
    checks,
  };
}