// src/data/odApprovalsMock.js
// Approval details for the 8 claims waiting for the OD Claims Manager (Priya Raghavan · OD0150).
// The summary list (amount, waiting time, handler) is APPROVALS in odTeamMock.js – this file adds
// what the manager needs to decide: assessment, policy and cover, documents, red flags.
// Replace with:
//   GET  /od/approvals/:claimNo            -> getApproval(claimNo)
//   POST /od/approvals/:claimNo/decision   -> { decision, amount, reason, remarks }
//
// Assessment rules used (Indian Motor Tariff practice – confirm with business):
//   Depreciation on parts (no Zero Depreciation add-on):
//     rubber / plastic / nylon 50% · fibreglass 30% · glass nil · metal by vehicle age
//     (6 m–1 y 5% · 1–2 y 10% · 2–3 y 15% · 3–4 y 25% · 4–5 y 35%)
//     painting: 50% on paint material, taken as 25% of the paint bill → 12.5% of painting
//   Labour: no depreciation.
//   Compulsory deductible: ₹1,000 up to 1500 cc · ₹2,000 above 1500 cc (private car).
//   Total loss (CTL – Constructive Total Loss): repair cost above 75% of IDV.
//     Insurer takes salvage  → IDV − compulsory deductible (insured hands over RC, keys, transfer forms)
//     Net of salvage         → IDV − salvage value − compulsory deductible (insured keeps the wreck)

import { APPROVALS, MANAGER_AUTHORITY, APPROVAL_SLA_HOURS } from "./odTeamMock";
import { DEMO_SHIFT_DAYS } from "./odHandlerMock";

export { MANAGER_AUTHORITY, APPROVAL_SLA_HOURS };

// Above the manager's limit the claim goes to the Zonal Claims Head
export const ZONAL_HEAD = { name: "R. Venkatesh", role: "Zonal Claims Head", office: "South Zone, Chennai" };

// Dates are written as of 22 Oct 2026 and moved to today's calendar like the rest of the demo
function shift(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + DEMO_SHIFT_DAYS);
  return d.toISOString().slice(0, 10);
}

const DEP_RATE = { plastic: 0.5, fibre: 0.3, glass: 0, labour: 0, paint: 0.125 };
export const CAT_LABEL = { metal: "Metal", electrical: "Electrical", plastic: "Plastic / rubber", fibre: "Fibreglass", glass: "Glass", labour: "Labour", paint: "Painting" };

const DOCS_PARTIAL = ["Claim form", "Driving licence", "RC copy", "Policy copy", "Repair estimate", "Surveyor report", "Photos / video", "KYC & bank details"];
const DOCS_CTL = ["Claim form", "Driving licence", "Original RC", "All keys", "Surveyor report", "Photos / video", "KYC & bank details"];
const docs = (list, pending = []) => list.map((name) => ({ name, ok: !pending.includes(name) }));

const DETAIL = {
  "OD/CHN/26/004498": {
    regNo: "TN 22 CX 9083", vehicle: "Hyundai Creta SX", cc: 1497, vehicleAge: "2 y 3 m",
    policyNo: "MOT/CHN/2026/114498", policyFrom: "2026-06-12", policyTo: "2027-06-11", idv: 1120000, ncb: 25, addons: ["Roadside assistance"],
    lossDate: "2026-09-30", lossPlace: "OMR, Thoraipakkam, Chennai", cause: "Hit the median while avoiding a two-wheeler",
    surveyor: "Er. S. Balasubramanian", surveyDate: "2026-10-03", garage: "Hyundai – Kun Motors, Perungudi",
    basis: "partial", metalRate: 0.15, zeroDep: false, compulsoryDed: 1000, voluntaryDed: 0, salvage: 1500,
    lines: [
      ["Front bumper", "plastic", 18500, 17200],
      ["Bonnet", "metal", 32000, 30500],
      ["LH headlamp assembly", "plastic", 21000, 19800],
      ["Radiator & condenser", "metal", 28500, 27000],
      ["Windshield glass", "glass", 16500, 16500],
      ["LH front fender", "metal", 12800, 11900],
      ["Labour – removal, refitting, denting", "labour", 30000, 29510],
      ["Painting", "paint", 26000, 24000],
    ],
    reserve: 142000,
    docs: docs(DOCS_PARTIAL),
    flags: [],
    handlerNote: "Front-end damage. Surveyor allowed bonnet and radiator replacement, headlamp replaced (mounting broken). No Zero Dep cover, so 15% metal and 50% plastic depreciation applied. Customer has agreed the amount.",
  },
  "OD/CHN/26/004431": {
    regNo: "TN 07 EN 6516", vehicle: "Tata Nexon XZ+", cc: 1199, vehicleAge: "1 y 9 m",
    policyNo: "MOT/CHN/2026/114431", policyFrom: "2026-01-20", policyTo: "2027-01-19", idv: 980000, ncb: 20, addons: ["Zero Depreciation", "Consumables", "Roadside assistance"],
    lossDate: "2026-10-06", lossPlace: "GST Road, Chromepet, Chennai", cause: "Front collision with a stationary truck; both front airbags deployed",
    surveyor: "Er. M. Karpagam", surveyDate: "2026-10-08", garage: "Tata – Concorde Motors, Guindy",
    basis: "partial", metalRate: 0.1, zeroDep: true, compulsoryDed: 1000, voluntaryDed: 0, salvage: 2000,
    lines: [
      ["Front bumper & grille", "plastic", 24000, 23000],
      ["Bonnet", "metal", 26500, 25500],
      ["Headlamps – LED (pair)", "plastic", 48000, 46000],
      ["Radiator, condenser & fan", "metal", 34000, 32500],
      ["Airbags & SRS module", "electrical", 52000, 50000],
      ["Labour", "labour", 21000, 15500],
      ["Painting", "paint", 22000, 20500],
    ],
    reserve: 54100,
    docs: docs(DOCS_PARTIAL),
    flags: [{ tone: "amber", text: "Airbags deployed – check the SRS module is replaced, not repaired" }],
    handlerNote: "Airbag deployment confirmed in photos and the dealer's SRS report. Zero Dep cover, so no depreciation. Reserve was created at FNOL before the survey and is not yet revised.",
  },
  "OD/CHN/26/003981": {
    regNo: "TN 11 AB 4521", vehicle: "Maruti Baleno Zeta", cc: 1197, vehicleAge: "3 y 6 m",
    policyNo: "MOT/CHN/2026/103981", policyFrom: "2026-03-02", policyTo: "2027-03-01", idv: 545000, ncb: 0, addons: [],
    lossDate: "2026-09-21", lossPlace: "Velachery Main Road, Chennai", cause: "Rear-ended by a private bus at a signal",
    surveyor: "Er. R. Dinesh Kumar", surveyDate: "2026-09-24", garage: "Maruti – Sundaram Motors, Velachery",
    basis: "partial", metalRate: 0.25, zeroDep: false, compulsoryDed: 1000, voluntaryDed: 2500, salvage: 1000,
    lines: [
      ["Rear bumper", "plastic", 14500, 13800],
      ["Tailgate", "metal", 42000, 40000],
      ["Tail lamps (pair)", "plastic", 16800, 16000],
      ["Rear floor & boot panel", "metal", 38000, 35000],
      ["Rear windshield", "glass", 9500, 9500],
      ["Labour", "labour", 24000, 22663],
      ["Painting", "paint", 24000, 22500],
    ],
    reserve: 118500,
    docs: docs(DOCS_PARTIAL),
    flags: [{ tone: "amber", text: "2nd claim in this policy year" }, { tone: "slate", text: "Third party (bus) identified – recovery possible" }],
    handlerNote: "Bus registration and driver details are in the FIR. Recommend we pursue recovery from the bus operator's TP insurer after settlement. Voluntary deductible ₹2,500 as per policy.",
  },
  "OD/CHN/26/004102": {
    regNo: "TN 09 CQ 7712", vehicle: "Kia Seltos HTX", cc: 1497, vehicleAge: "0 y 8 m",
    policyNo: "MOT/CHN/2026/104102", policyFrom: "2026-02-14", policyTo: "2027-02-13", idv: 1450000, ncb: 0, addons: ["Zero Depreciation", "Engine Protect", "Consumables"],
    lossDate: "2026-10-15", lossPlace: "Pallikaranai, Chennai", cause: "Vehicle submerged in flood water while parked",
    surveyor: "Er. V. Lakshmi Narayanan", surveyDate: "2026-10-18", garage: "Kia – Rajasree Motors, Thoraipakkam",
    basis: "partial", metalRate: 0.05, zeroDep: true, compulsoryDed: 1000, voluntaryDed: 0, salvage: 0,
    lines: [
      ["Engine overhaul – water ingress", "metal", 185000, 172000],
      ["ECU & wiring harness", "electrical", 62000, 58000],
      ["Interior – seats, carpets, roof lining", "plastic", 48000, 44000],
      ["Infotainment & sensors", "electrical", 36000, 33000],
      ["Cleaning, drying & labour", "labour", 42000, 40000],
    ],
    reserve: 350000,
    docs: docs([...DOCS_PARTIAL, "Photos of water level"]),
    flags: [{ tone: "slate", text: "CAT event – Chennai floods, Oct 2026" }],
    covered: "Engine damage from water ingress is covered – Engine Protect add-on is on this policy",
    handlerNote: "Vehicle was parked, not driven into water – confirmed from society CCTV and photos of the water level, so no aggravated damage. Engine Protect add-on covers the engine overhaul.",
  },
  "OD/CHN/26/004215": {
    regNo: "TN 18 BH 3390", vehicle: "Mahindra XUV300 W8", cc: 1197, vehicleAge: "1 y 4 m",
    policyNo: "MOT/CHN/2026/104215", policyFrom: "2026-07-01", policyTo: "2027-06-30", idv: 1010000, ncb: 20, addons: ["Zero Depreciation"],
    lossDate: "2026-10-14", lossPlace: "Ambattur, Chennai", cause: "Fire in the engine bay while driving – short circuit",
    surveyor: "Er. S. Balasubramanian", surveyDate: "2026-10-16", garage: "Mahindra – Sree Vari Motors, Ambattur",
    basis: "partial", metalRate: 0.1, zeroDep: true, compulsoryDed: 1000, voluntaryDed: 0, salvage: 3500,
    lines: [
      ["Engine-bay wiring harness", "electrical", 58000, 55000],
      ["Bonnet & LH fender", "metal", 41000, 39000],
      ["Front bumper & grille", "plastic", 27000, 25500],
      ["Battery, fuse box & ECU", "electrical", 46000, 44000],
      ["Dashboard & AC unit", "plastic", 52000, 49000],
      ["Labour", "labour", 33000, 31500],
      ["Painting", "paint", 26000, 24500],
    ],
    reserve: 264000,
    docs: docs([...DOCS_PARTIAL, "Fire brigade report"]),
    flags: [{ tone: "slate", text: "Fire brigade report: electrical short circuit, no external cause" }],
    handlerNote: "Fire brigade report confirms short circuit. No after-market fittings found by the surveyor. Zero Dep cover, so no depreciation.",
  },
  "OD/CHN/26/004417": {
    regNo: "TN 15 CH 3758", vehicle: "Hyundai Creta SX", cc: 1497, vehicleAge: "3 y 1 m",
    policyNo: "MOT/CHN/2026/104417", policyFrom: "2026-05-05", policyTo: "2027-05-04", idv: 980000, ncb: 35, addons: ["Roadside assistance"],
    lossDate: "2026-10-10", lossPlace: "ECR, Mahabalipuram", cause: "Vehicle overturned after a tyre burst",
    surveyor: "Er. M. Karpagam", surveyDate: "2026-10-13", garage: "Hyundai – Kun Motors, Perungudi",
    basis: "ctl", repairEstimate: 810000, salvageValue: 494000, ctlBasis: "insured", compulsoryDed: 1000,
    reserve: 485000,
    docs: docs([...DOCS_CTL, "Financier NOC", "Consent for net-of-salvage settlement"], ["Financier NOC"]),
    flags: [{ tone: "amber", text: "Vehicle under loan – financier must be paid first (HDFC Bank)" }],
    handlerNote: "Repair estimate ₹8.10 L is 83% of IDV, so treated as total loss. Customer wants to keep the vehicle – settled net of salvage (best salvage bid ₹4.94 L). Financier NOC is awaited.",
  },
  "OD/CHN/26/004410": {
    regNo: "TN 08 BE 2379", vehicle: "Maruti Swift VXi", cc: 1197, vehicleAge: "1 y 11 m",
    policyNo: "MOT/CHN/2026/104410", policyFrom: "2026-09-18", policyTo: "2027-09-17", idv: 613000, ncb: 20, addons: ["Zero Depreciation", "Return to Invoice"],
    lossDate: "2026-10-12", lossPlace: "Chennai–Bengaluru Highway, Sriperumbudur", cause: "Hit from behind by a container lorry and pushed into a lorry ahead",
    surveyor: "Er. R. Dinesh Kumar", surveyDate: "2026-10-14", garage: "Maruti – Sundaram Motors, Sriperumbudur",
    basis: "ctl", repairEstimate: 505000, salvageValue: 110000, ctlBasis: "insurer", compulsoryDed: 1000,
    reserve: 612000,
    docs: docs([...DOCS_CTL, "Form 28 / 29 / 30 (transfer)", "Letter of subrogation"]),
    flags: [{ tone: "red", text: "Loss 24 days after policy start" }, { tone: "amber", text: "Return to Invoice add-on – invoice value claim may follow" }],
    handlerNote: "Repair estimate is 82% of IDV, so total loss. Insurer takes salvage (best bid ₹1.10 L). Early claim – policy started 24 days before loss; previous insurer's records show no open claim.",
  },
  "OD/CHN/26/004424": {
    regNo: "TN 22 DK 5137", vehicle: "Honda City ZX", cc: 1498, vehicleAge: "2 y 7 m",
    policyNo: "MOT/CHN/2026/104424", policyFrom: "2026-04-22", policyTo: "2027-04-21", idv: 735000, ncb: 25, addons: ["Roadside assistance"],
    lossDate: "2026-10-08", lossPlace: "Outer Ring Road, Vandalur", cause: "Skidded in rain and hit a tree",
    surveyor: "Er. V. Lakshmi Narayanan", surveyDate: "2026-10-10", garage: "Honda – Prithvi Honda, Guindy",
    basis: "ctl", repairEstimate: 610000, salvageValue: 145000, ctlBasis: "insurer", compulsoryDed: 1000,
    reserve: 734000,
    docs: docs([...DOCS_CTL, "Form 28 / 29 / 30 (transfer)", "Letter of subrogation"]),
    flags: [],
    handlerNote: "Repair estimate is 83% of IDV, so total loss. Insurer takes salvage – 3 salvage bids received, best ₹1.45 L. All transfer papers received.",
  },
};

/* ---------------- Assessment ---------------- */
function partialAssessment(d) {
  const rate = (cat) => (d.zeroDep ? 0 : cat === "metal" || cat === "electrical" ? d.metalRate : DEP_RATE[cat] ?? 0);
  const rows = d.lines.map(([item, cat, estimate, assessed]) => {
    const r = rate(cat);
    return { item, cat, estimate, assessed, depRate: r, dep: Math.round(assessed * r) };
  });
  const estimate = rows.reduce((t, r) => t + r.estimate, 0);
  const assessed = rows.reduce((t, r) => t + r.assessed, 0);
  const dep = rows.reduce((t, r) => t + r.dep, 0);
  const net = assessed - dep - d.compulsoryDed - d.voluntaryDed - d.salvage;
  return { rows, estimate, assessed, dep, net };
}

function ctlAssessment(d) {
  const salvage = d.ctlBasis === "insured" ? d.salvageValue : 0;
  return {
    repairPct: Math.round((d.repairEstimate / d.idv) * 100),
    salvage,
    net: d.idv - salvage - d.compulsoryDed,
  };
}

/** Everything the Approvals page needs for one claim. */
export function getApproval(claimNo) {
  const a = APPROVALS.find((x) => x.claimNo === claimNo);
  const d = DETAIL[claimNo];
  if (!a || !d) return null;
  const assessment = d.basis === "ctl" ? ctlAssessment(d) : partialAssessment(d);
  if (import.meta.env?.DEV && assessment.net !== a.amount) {
    console.warn(`[approvals] ${claimNo}: assessment ${assessment.net} ≠ recommended ${a.amount}`);
  }
  const docsPending = d.docs.filter((x) => !x.ok).map((x) => x.name);
  return {
    ...a,
    ...d,
    lossDate: shift(d.lossDate),
    policyFrom: shift(d.policyFrom),
    policyTo: shift(d.policyTo),
    surveyDate: shift(d.surveyDate),
    assessment,
    docsPending,
    aboveLimit: a.amount > MANAGER_AUTHORITY,
    overSla: a.waitingHours > APPROVAL_SLA_HOURS,
    reserveShort: d.reserve < a.amount,
  };
}

export const APPROVAL_LIST = APPROVALS.map((a) => getApproval(a.claimNo)).filter(Boolean);

/* ---------------- Decision options ---------------- */
export const CHANGE_REASONS = ["Labour rates revised", "Parts price revised", "Depreciation applied", "Item not related to this accident", "Betterment deducted", "Other"];
export const QUERY_TYPES = ["Additional documents", "Re-inspection by surveyor", "Clarification on assessment", "Revise reserve", "Other"];
export const REPUDIATION_REASONS = [
  "Driver did not hold a valid driving licence",
  "Driving under the influence of alcohol / drugs",
  "Vehicle used for hire or reward (private car policy)",
  "Loss outside the policy period",
  "Consequential / mechanical damage – not an accident",
  "Misrepresentation or false information",
  "Delay in intimation affected the assessment",
  "Other policy exclusion",
];
export const REFER_RECOMMENDATIONS = ["Recommend approval", "Recommend approval with change", "Recommend repudiation", "No recommendation – for your decision"];