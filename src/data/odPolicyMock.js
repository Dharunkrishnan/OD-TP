// src/data/odPolicyMock.js
// Demo data + business rules for OD Claim Intimation (FNOL).
// Replace with:  GET /pas/policies?search=…   (Policy Administration System)
//                POST /od/intimations         (runs the registration jobs server-side)
//
// Demo policies – each one exercises a different registration outcome:
//   TN 09 DX 4410  → valid comprehensive policy        → Claim registered
//   TN 14 EE 7788  → valid, financier on RC            → Claim registered
//   TN 12 AR 3301  → valid (2nd "Arun" – name search shows a pick list)
//   TN 07 CB 2231  → policy expired 30 Sep 2026        → NBNR (loss outside policy period)
//   TN 22 AK 9087  → liability-only (TP) policy        → NBNR (no OD cover)
//   TN 10 BZ 5566  → premium cheque not realised       → NBNR (premium not realised)
//   TN 09 BK 4471  → already has claim for 17 Sep 2026 → Duplicate (not registered)
// All names and numbers are fictional.

import { WORK_QUEUE } from "./odHandlerMock";

// Today's date from the user's computer (local time, not UTC – so it is right in India after midnight)
const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const TODAY_ISO = localISO();
/** Current time as "HH:MM" (local) – used to stop a loss time in the future when the loss date is today. */
export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const DEMO_POLICIES = [
  {
    policyNo: "OG-26-1801-4521-00098765",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "In force",
    periodFrom: "2026-03-15",
    periodTo: "2027-03-14",
    premiumRealised: true,
    insured: "R. Arun Kumar",
    mobile: "9876543210",
    email: "arun.kumar@example.com",
    regNo: "TN 09 DX 4410",
    vehicle: "Hyundai Creta SX (O) 1.5 Petrol",
    yearOfMfg: 2023,
    chassis: "MALC381CLPM0XXXXX",
    engine: "G4FLPXXXXX",
    idv: 1240000,
    ncb: "25%",
    addOns: ["Zero depreciation", "Engine protect", "Consumables", "Roadside assistance"],
    financier: null,
    channel: "Agent",
    branch: "Chennai",
  },
  {
    policyNo: "OG-26-1801-5134-00109872",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "In force",
    periodFrom: "2026-05-02",
    periodTo: "2027-05-01",
    premiumRealised: true,
    insured: "K. Arun Raj",
    mobile: "9790123456",
    email: "arunraj.k@example.com",
    regNo: "TN 12 AR 3301",
    vehicle: "Maruti Baleno Alpha",
    yearOfMfg: 2022,
    chassis: "MA3EWDE1SN0XXXXX",
    engine: "K12NXXXXXX",
    idv: 610000,
    ncb: "20%",
    addOns: ["Consumables", "Roadside assistance"],
    financier: "State Bank of India",
    channel: "Agent",
    branch: "Chennai",
  },
  {
    policyNo: "OG-26-1801-6610-00114230",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "In force",
    periodFrom: "2026-06-01",
    periodTo: "2027-05-31",
    premiumRealised: true,
    insured: "S. Meenakshi",
    mobile: "9840012345",
    email: "meenakshi.s@example.com",
    regNo: "TN 14 EE 7788",
    vehicle: "Kia Seltos HTX 1.5 Diesel",
    yearOfMfg: 2022,
    chassis: "MZBEN813LNN0XXXXX",
    engine: "D4FBNXXXXX",
    idv: 1080000,
    ncb: "35%",
    addOns: ["Zero depreciation", "Return to invoice", "Roadside assistance"],
    financier: "HDFC Bank",
    channel: "OEM dealer",
    branch: "Chennai",
  },
  {
    policyNo: "OG-25-1801-3307-00076512",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "Expired",
    periodFrom: "2025-10-01",
    periodTo: "2026-09-30",
    premiumRealised: true,
    insured: "K. Selvaraj",
    mobile: "9789056789",
    email: "selvaraj.k@example.com",
    regNo: "TN 07 CB 2231",
    vehicle: "Maruti Swift VXi",
    yearOfMfg: 2020,
    chassis: "MA3FJEB1SL0XXXXX",
    engine: "K12MNXXXXX",
    idv: 455000,
    ncb: "20%",
    addOns: ["Roadside assistance"],
    financier: null,
    channel: "Direct",
    branch: "Chennai",
  },
  {
    policyNo: "OG-26-1802-1188-00102244",
    product: "Private Car Liability Only Policy",
    cover: "TP",
    status: "In force",
    periodFrom: "2026-01-10",
    periodTo: "2027-01-09",
    premiumRealised: true,
    insured: "M. Prakash",
    mobile: "9003311223",
    email: "prakash.m@example.com",
    regNo: "TN 22 AK 9087",
    vehicle: "Tata Nexon XZ+",
    yearOfMfg: 2019,
    chassis: "MAT627128KLXXXXX",
    engine: "REVO12XXXXX",
    idv: null,
    ncb: "–",
    addOns: [],
    financier: null,
    channel: "Broker",
    branch: "Chennai",
  },
  {
    policyNo: "OG-26-1801-7742-00120981",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "In force",
    periodFrom: "2026-10-05",
    periodTo: "2027-10-04",
    premiumRealised: false, // cheque not yet cleared
    insured: "D. Kavitha",
    mobile: "9444078901",
    email: "kavitha.d@example.com",
    regNo: "TN 10 BZ 5566",
    vehicle: "Honda City ZX CVT",
    yearOfMfg: 2024,
    chassis: "MAKGN786PRN0XXXXX",
    engine: "L15ZFXXXXX",
    idv: 1390000,
    ncb: "0%",
    addOns: ["Zero depreciation", "Consumables"],
    financier: "ICICI Bank",
    channel: "Branch",
    branch: "Chennai",
  },
  {
    policyNo: "OG-26-1801-2290-00087710",
    product: "Private Car Package Policy (Comprehensive)",
    cover: "OD+TP",
    status: "In force",
    periodFrom: "2026-02-20",
    periodTo: "2027-02-19",
    premiumRealised: true,
    insured: "S. Revathi",
    mobile: "9962045678",
    email: "revathi.s@example.com",
    regNo: "TN 09 BK 4471",
    vehicle: "Maruti Swift VXi",
    yearOfMfg: 2021,
    chassis: "MA3FJEB1SM0XXXXX",
    engine: "K12MNXXXXX",
    idv: 520000,
    ncb: "25%",
    addOns: ["Zero depreciation", "Roadside assistance"],
    financier: null,
    channel: "Agent",
    branch: "Chennai",
  },
];

/* ---------------- Masters used by the form ---------------- */
export const LOSS_CAUSES = [
  { key: "accident", label: "Accident – collision / skid / overturn", lossType: "Accident – partial" },
  { key: "flood", label: "Flood / cyclone / natural calamity", lossType: "Flood – CAT" },
  { key: "fire", label: "Fire / self-ignition", lossType: "Fire" },
  { key: "theft", label: "Theft of vehicle", lossType: "Theft" },
  { key: "partialTheft", label: "Theft of parts / accessories", lossType: "Partial theft" },
  { key: "malicious", label: "Malicious damage / riot", lossType: "Accident – partial" },
  { key: "other", label: "Other (describe)", lossType: "Accident – partial" },
];

export const CHANNELS = ["Call centre", "Branch walk-in", "Customer portal / app", "Agent / broker", "Network garage", "Email", "OEM dealer"];
export const INTIMATED_BY = ["Insured", "Driver", "Agent / broker", "Garage / dealer", "Relative of insured"];

export const NETWORK_GARAGES = [
  { name: "Lakshmi Tata Motors, Guindy", type: "Dealer", network: true, brands: ["Tata"] },
  { name: "Sundaram Motors (Maruti), Anna Salai", type: "Dealer", network: true, brands: ["Maruti"] },
  { name: "Hyundai Motor Plaza, Ambattur", type: "Dealer", network: true, brands: ["Hyundai"] },
  { name: "Kun Honda, Porur", type: "Dealer", network: true, brands: ["Honda"] },
  { name: "Kia Chennai West, Vanagaram", type: "Dealer", network: true, brands: ["Kia"] },
  { name: "Sri Murugan Car Care, Velachery", type: "Multi-brand", network: true, brands: [] },
  { name: "Speed Auto Works, Tambaram", type: "Multi-brand", network: true, brands: [] },
];

// Declared catastrophe events (CAT) – auto-suggested when cause + date match
export const CAT_EVENTS = [
  { code: "CAT-2026-TN-04", name: "NE monsoon floods, Chennai", from: "2026-10-14", to: "2026-10-31", causes: ["flood"] },
];

// Standard initial reserve by loss type (configurable in reserve master)
export const STANDARD_RESERVE = {
  "Accident – partial": 25000,
  "Flood – CAT": 60000,
  Fire: 80000,
  "Partial theft": 15000,
  Theft: null, // = IDV
};

export const LATE_INTIMATION_DAYS = 7;

/* ---------------- Helpers ---------------- */
const norm = (s) => String(s || "").toUpperCase().replace(/[\s-]/g, "");

/** Search by policy no, vehicle registration no or mobile. */
/**
 * Search by vehicle no, policy no, insured name or mobile.
 * Exact matches first; partial matches allowed (vehicle/policy ≥ 4 characters, name ≥ 3 letters).
 * Returns an array of { policy, matchedOn } sorted best match first.
 */
export function searchPolicy(term) {
  const raw = String(term || "").trim();
  const t = norm(raw);
  if (!t) return [];
  const mobile = t.replace(/^\+?91/, "");
  const nameQ = raw.toLowerCase().replace(/[.\s]+/g, " ").trim();
  const out = [];
  for (const p of DEMO_POLICIES) {
    const reg = norm(p.regNo);
    const pol = norm(p.policyNo);
    const name = p.insured.toLowerCase().replace(/[.\s]+/g, " ").trim();
    let rank = 0;
    let matchedOn = "";
    if (reg === t) [rank, matchedOn] = [100, "Vehicle no"];
    else if (pol === t) [rank, matchedOn] = [100, "Policy no"];
    else if (/^\d{10}$/.test(mobile) && p.mobile === mobile) [rank, matchedOn] = [100, "Mobile"];
    else if (t.length >= 4 && reg.includes(t)) [rank, matchedOn] = [60, "Vehicle no"];
    else if (t.length >= 4 && pol.includes(t)) [rank, matchedOn] = [60, "Policy no"];
    else if (nameQ.length >= 3 && /[a-z]/.test(nameQ) && name.includes(nameQ)) [rank, matchedOn] = [name === nameQ ? 90 : 50, "Insured name"];
    if (rank) out.push({ policy: p, matchedOn, rank });
  }
  return out.sort((a, b) => b.rank - a.rank).map(({ policy, matchedOn }) => ({ policy, matchedOn }));
}

/** Past (closed) claims per vehicle – shown in Claim Intimation as claim history.
 *  Open claims come from WORK_QUEUE. NCB on each demo policy is consistent with this history. */
export const PAST_CLAIMS = {
  "TN 12 AR 3301": [{ claimNo: "OD/CHN/23/006214", lossDate: "2023-08-19", lossType: "Accident – partial", status: "Settled", amount: 23400 }],
  "TN 07 CB 2231": [{ claimNo: "OD/CHN/25/003120", lossDate: "2025-06-14", lossType: "Flood", status: "Settled", amount: 61200 }],
  "TN 10 BZ 5566": [{ claimNo: "OD/CHN/26/002045", lossDate: "2026-02-11", lossType: "Accident – partial", status: "Settled", amount: 38900 }],
};

/** Open + past claims on a vehicle, newest first. */
export function claimHistory(regNo) {
  if (!regNo) return [];
  const open = WORK_QUEUE.filter((r) => norm(r.regNo) === norm(regNo)).map((r) => ({
    claimNo: r.claimNo,
    lossDate: r.lossDate,
    lossType: r.lossType,
    status: `Open · ${r.stage}`,
    amount: r.reserve,
    open: true,
  }));
  const past = Object.entries(PAST_CLAIMS).find(([k]) => norm(k) === norm(regNo))?.[1] || [];
  return [...open, ...past].sort((x, y) => (x.lossDate < y.lossDate ? 1 : -1));
}

/** Documents to collect at FNOL, by cause of loss (IRDAI: insurer must ask for all documents in one go). */
export function documentsFor(cause, { driverNeeded, injury, financier, garage } = {}) {
  const docs = [
    { name: "Claim form (e-claim form – auto generated)", mandatory: true, auto: true },
    { name: "RC copy (registration certificate)", mandatory: true },
    { name: "Insured KYC – PAN / Aadhaar (for payment)", mandatory: true },
  ];
  if (driverNeeded) docs.push({ name: "Driving licence of the driver", mandatory: true });
  if (cause === "theft") {
    docs.push(
      { name: "FIR copy", mandatory: true },
      { name: "All original keys", mandatory: true },
      { name: "Original RC & RTO theft intimation letter", mandatory: true },
      { name: "Police non-traceable (final) report", mandatory: true, later: true },
      { name: "Form 28, 29, 30 & 35 + subrogation letter", mandatory: true, later: true }
    );
  } else {
    docs.push({ name: "Photos / video of the damage", mandatory: true });
    if (garage) docs.push({ name: "Repair estimate from garage", mandatory: true });
    if (cause === "fire") docs.push({ name: "FIR / fire brigade report", mandatory: true });
    if (cause === "partialTheft") docs.push({ name: "FIR / police acknowledgement", mandatory: true });
    if (cause === "flood") docs.push({ name: "Do not crank the engine – tow to garage (advise customer)", mandatory: false, advice: true });
  }
  if (injury === "yes" && !docs.some((d) => d.name.includes("FIR"))) docs.push({ name: "FIR copy (injury involved)", mandatory: true });
  if (financier) docs.push({ name: `NOC from financier (${financier})`, mandatory: false, later: true });
  return docs;
}

export const daysBetween = (a, b) =>
  Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

export function catEventFor(cause, lossDate) {
  return CAT_EVENTS.find((e) => e.causes.includes(cause) && lossDate >= e.from && lossDate <= e.to) || null;
}

/** Existing claim / intimation on the same vehicle within ±1 day of the loss date. */
export function findDuplicate(regNo, lossDate) {
  if (!regNo || !lossDate) return null;
  return (
    WORK_QUEUE.find((r) => norm(r.regNo) === norm(regNo) && Math.abs(daysBetween(r.lossDate, lossDate)) <= 1) || null
  );
}

/** Issues the registration jobs would raise – used live in the form and again on submit. */
export function registrationIssues(policy, lossDate) {
  const issues = [];
  if (!policy) {
    issues.push({ code: "POLICY_NOT_FOUND", nbnr: true, text: "Policy not found in PAS" });
    return issues;
  }
  if (policy.cover === "TP") issues.push({ code: "NO_OD_COVER", nbnr: true, text: "Liability-only (TP) policy – no Own Damage cover" });
  if (lossDate && (lossDate < policy.periodFrom || lossDate > policy.periodTo))
    issues.push({ code: "OUTSIDE_PERIOD", nbnr: true, text: `Loss date is outside the policy period (${policy.periodFrom} to ${policy.periodTo})` });
  if (!policy.premiumRealised) issues.push({ code: "PREMIUM_NOT_REALISED", nbnr: true, text: "Premium not realised (cheque not cleared)" });
  return issues;
}

let seq = 4700;
let nbSeq = 200;
/**
 * Runs the registration jobs on submit:
 *  duplicate check → policy & coverage validation → claim no / NBNR ref → initial reserve → assignment.
 */
export function submitIntimation(form) {
  const dup = findDuplicate(form.policy?.regNo || form.manualRegNo, form.lossDate);
  if (dup) {
    return { outcome: "duplicate", existing: dup };
  }
  const issues = registrationIssues(form.policy, form.lossDate);
  const cause = LOSS_CAUSES.find((c) => c.key === form.cause);
  const lossType = cause?.lossType ?? "Accident – partial";
  if (issues.some((i) => i.nbnr)) {
    nbSeq += 1;
    return {
      outcome: "nbnr",
      ref: `NB/CHN/26/${String(nbSeq).padStart(6, "0")}`,
      reasons: issues.filter((i) => i.nbnr),
      lossType,
    };
  }
  seq += 1;
  const reserve = lossType === "Theft" ? form.policy.idv : STANDARD_RESERVE[lossType] ?? 25000;
  return {
    outcome: "registered",
    claimNo: `OD/CHN/26/${String(seq).padStart(6, "0")}`,
    lossType,
    reserve,
    assignedTo: "Karthik Subramanian (Claims Handler, Chennai)",
    surveyRoute: lossType === "Theft" ? "Referred to SIU for investigation" : form.surveyType === "spot" ? "Spot survey requested" : "Surveyor appointment by rules (location, garage, value band)",
    flags: [
      ...(daysBetween(form.lossDate, TODAY_ISO) > LATE_INTIMATION_DAYS ? ["Late intimation"] : []),
      ...(form.catEvent ? ["CAT event"] : []),
      ...(form.tpInvolved === "yes" ? ["TP involved – passed to TP system"] : []),
      ...(lossType === "Theft" ? ["Theft – SIU"] : []),
    ],
  };
}