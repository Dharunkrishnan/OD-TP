// src/data/odManagerData.js
// Shared, live data for the OD Claims Manager screens (Priya Raghavan · OD0150).
// One place for: the team's open claims, escalations, and this session's manager actions
// (approval decisions, reallocations, escalation updates) – so the Team Dashboard, menu badges,
// notifications, Team Work Queue, Approvals and Escalations always show the same numbers.
//
// Demo: actions are kept in sessionStorage for this browser session.
// Replace with: GET /od/manager/team-queue · /od/manager/escalations · /od/manager/approvals

import { AlertTriangle, CalendarClock, ClipboardCheck, Gavel, Landmark, MessageSquareWarning, Plane, Scale, Timer } from "lucide-react";
import { WORK_QUEUE } from "./odHandlerMock";
import { TEAM, APPROVALS, WATCHLIST, MANAGER_AUTHORITY, APPROVAL_SLA_HOURS, HANDLER_CAPACITY } from "./odTeamMock";
import { listHandlerRequests, REQUEST_KIND } from "./handlerRequests";

/* ================================================================== */
/* Session storage – this session's manager actions                    */
/* ================================================================== */
export const KEYS = {
  moves: "smartclaims-team-moves", // reallocations: { claimNo: { to, from, at, reason } }
  decisions: "smartclaims-approval-decisions", // approvals: { claimNo: { outcome, amount, at, … } }
  escalations: "smartclaims-escalation-updates", // escalations: { id: { status, outcome, history } }
};
export function readStore(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
export function saveStore(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
  // tell the header (badges, bell) on the same page to refresh
  window.dispatchEvent(new Event("smartclaims:manager-data"));
}

/* ================================================================== */
/* Team's open claims                                                  */
/* Karthik's 51 are his real queue; the others are generated to match  */
/* their figures in odTeamMock.js. Dashboard claims keep their details. */
/* ================================================================== */
export const STAGE_ORDER = ["NBNR", "Registered", "Survey pending", "Assessment", "Documents pending", "Approval", "Repair / DO", "Payment"];
const STAGE_WEIGHT = [2, 5, 7, 7, 10, 5, 5, 4];
const PENDING_BY_STAGE = {
  NBNR: ["Handler", "PAS / underwriting"],
  Registered: ["Handler"],
  "Survey pending": ["Surveyor", "Surveyor", "Surveyor", "SIU / investigator"],
  Assessment: ["Surveyor", "Handler"],
  "Documents pending": ["Insured", "Insured", "Garage / dealer"],
  Approval: ["Claims approver"],
  "Repair / DO": ["Garage / dealer"],
  Payment: ["Finance"],
};
const NEXT_BY_STAGE = {
  NBNR: "Verify premium realisation with PAS",
  Registered: "Appoint surveyor",
  "Survey pending": "Chase survey report",
  Assessment: "Review assessment report",
  "Documents pending": "Follow up pending documents",
  Approval: "Await approval decision",
  "Repair / DO": "Issue delivery order",
  Payment: "Check NEFT status",
};
const NAMES = ["A. Senthil", "B. Kavya", "C. Murali", "D. Nandhini", "E. Ramesh", "F. Shabana", "G. Hari", "H. Deepa", "I. Prakash", "J. Swathi", "K. Arun", "L. Malathi", "M. Gokul", "N. Anitha", "P. Suresh", "R. Janani", "S. Vinoth", "T. Keerthana", "U. Dinesh", "V. Sangeetha", "K. Rajesh", "M. Divya", "S. Karthika", "R. Mohan", "P. Lavanya", "G. Sathish", "N. Revathi", "A. Imran", "J. Priya", "V. Ashwin"];
const VEHICLES = ["Maruti Swift VXi", "Hyundai i20 Asta", "Tata Nexon XZ+", "Honda City ZX", "Maruti Baleno Zeta", "Kia Seltos HTX", "Hyundai Creta SX", "Mahindra XUV300 W8", "Toyota Glanza G", "Maruti Brezza ZXi", "Renault Kiger RXZ", "Tata Punch Creative", "Hyundai Venue SX", "Maruti Dzire ZXi", "Toyota Innova Crysta"];
const LOSS = ["Accident – partial", "Accident – partial", "Accident – partial", "Accident – partial", "Accident – partial", "Flood – CAT", "Theft", "Fire", "Total loss / CTL"];
const RESERVE_RANGE = { "Accident – partial": [12000, 140000], "Flood – CAT": [60000, 320000], Theft: [300000, 900000], Fire: [80000, 300000], "Total loss / CTL": [420000, 950000] };

// small seeded random so the demo team is the same every time
function seeded(seed) {
  let s = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pickW = (rand, items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
};

// claims already shown on the dashboard keep their handler, loss and amount
const FIXED = {
  OD0134: [
    { claimNo: "OD/CHN/26/004077", insured: "V. Narayanan", lossType: "Total loss / CTL", stage: "Assessment", reserve: 910000, flags: ["Major loss"] },
    { claimNo: "OD/CHN/26/003981", insured: "S. Prabhu", lossType: "Accident – partial", stage: "Approval", reserve: 118500, flags: [] },
  ],
  OD0137: [{ claimNo: "OD/CHN/26/004102", insured: "R. Lalitha", lossType: "Flood – CAT", stage: "Approval", reserve: 346000, flags: ["CAT event"] }],
  OD0131: [{ claimNo: "OD/CHN/26/004215", insured: "K. Mohan", lossType: "Fire", stage: "Approval", reserve: 264000, flags: [] }],
  OD0142: [{ claimNo: "OD/CHN/26/003955", insured: "J. Kavitha", lossType: "Accident – partial", stage: "Documents pending", reserve: 221000, flags: ["Repeat claim"] }],
};

function generateFor(h, index) {
  const rand = seeded(h.userId);
  const fixed = FIXED[h.userId] || [];
  const rows = [];
  for (let i = 0; i < h.open; i++) {
    const f = fixed[i];
    const lossType = f?.lossType || LOSS[Math.floor(rand() * LOSS.length)];
    const stage = f?.stage || pickW(rand, STAGE_ORDER, STAGE_WEIGHT);
    const pend = PENDING_BY_STAGE[stage];
    const [lo, hi] = RESERVE_RANGE[lossType];
    const status = i < h.breached ? "breach" : i < h.breached + h.atRisk ? "risk" : "ok";
    const ageDays = status === "breach" ? 18 + Math.floor(rand() * 50) : status === "risk" ? 6 + Math.floor(rand() * 40) : 1 + Math.floor(rand() * 35);
    const n = 1 + Math.floor(rand() * 4);
    const regNo = `TN ${String(1 + Math.floor(rand() * 22)).padStart(2, "0")} ${String.fromCharCode(65 + Math.floor(rand() * 26))}${String.fromCharCode(65 + Math.floor(rand() * 26))} ${1000 + Math.floor(rand() * 9000)}`;
    rows.push({
      claimNo: f?.claimNo || `${stage === "NBNR" ? "NB" : "OD"}/CHN/26/${stage === "NBNR" ? "000" : "00"}${stage === "NBNR" ? 300 + index * 40 + i : 3000 + index * 200 + i}`,
      regNo,
      vehicle: VEHICLES[Math.floor(rand() * VEHICLES.length)],
      insured: f?.insured || NAMES[Math.floor(rand() * NAMES.length)],
      lossType,
      stage,
      pendingWith: pend[Math.floor(rand() * pend.length)],
      ageDays,
      sla: { status, label: status === "breach" ? `Breached ${n} d` : status === "risk" ? `${4 + Math.floor(rand() * 18)} h left` : `${n + 1} d left` },
      nextAction: NEXT_BY_STAGE[stage],
      dueToday: false,
      flags: f?.flags || (lossType === "Theft" && rand() < 0.4 ? ["Fraud flag"] : []),
      reserve: f?.reserve || Math.round((lo + rand() * (hi - lo)) / 100) * 100,
      handlerId: h.userId,
    });
  }
  // due today: breached first, then at risk, then on track – as many as the handler's figure
  rows.slice(0, h.dueToday).forEach((r) => (r.dueToday = true));
  return rows;
}

const KARTHIK = TEAM.find((h) => h.userId === "OD0123");
const BASE_CLAIMS = [
  ...WORK_QUEUE.map((r) => ({ ...r, pendingWith: r.pendingWith === "Me (handler)" ? "Handler" : r.pendingWith, handlerId: KARTHIK.userId, real: true })),
  ...TEAM.filter((h) => h.userId !== KARTHIK.userId).flatMap((h, i) => generateFor(h, i)),
];
// approvals keep their recommended amount as the reserve
APPROVALS.forEach((a) => {
  const c = BASE_CLAIMS.find((x) => x.claimNo === a.claimNo);
  if (c) c.reserve = Math.max(c.reserve, a.amount);
});
WATCHLIST.forEach((w) => {
  const c = BASE_CLAIMS.find((x) => x.claimNo === w.claimNo);
  if (c) c.reserve = w.reserve;
});


export const TEAM_CLAIMS = BASE_CLAIMS;

/* ================================================================== */
/* Escalations                                                         */
/* Response rules – confirm with Compliance before go-live.            */
/* IRDAI Master Circular on Protection of Policyholders' Interests 2024 */
/* ================================================================== */
export const RESPONSE_RULES = {
  IGMS: { label: "IGMS / Bima Bharosa", days: 14, basis: "IRDAI: resolve with a final letter within 14 days", Icon: Landmark, tone: "bg-indigo-50 text-indigo-800 ring-indigo-200", external: true },
  CUSTOMER: { label: "Customer complaint", days: 14, basis: "IRDAI: every complaint is a grievance – 14 days", Icon: MessageSquareWarning, tone: "bg-sky-50 text-sky-800 ring-sky-200", external: true },
  OMBUDSMAN: { label: "Ombudsman award", days: 30, basis: "Comply with the award within 30 days of receipt", Icon: Scale, tone: "bg-purple-50 text-purple-800 ring-purple-200", external: true },
  LEGAL: { label: "Legal notice", days: 15, basis: "Internal: reply through the Legal team within 15 days", Icon: Gavel, tone: "bg-slate-100 text-slate-800 ring-slate-300", external: true },
  SLA: { label: "SLA escalation", days: 2, basis: "Internal: claim breached > 3 days – manager action within 2 days", Icon: Timer, tone: "bg-red-50 text-red-700 ring-red-200", external: false },
};

export const CLOSE_OUTCOMES = {
  external: ["Accepted – claim settled / will be settled", "Partly accepted – reasons given", "Not accepted – reasons given in final letter", "Withdrawn by complainant", "Duplicate of another complaint"],
  internal: ["Action taken – claim moved forward", "Claim reallocated", "Waiting on external party – documented", "Claim closed"],
};

export const ESC_STATUS = {
  NEW: { label: "New", tone: "bg-red-50 text-red-700 ring-red-200" },
  ACK: { label: "Acknowledged", tone: "bg-amber-50 text-amber-900 ring-amber-200" },
  FOLLOWUP: { label: "With handler", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  CLOSED: { label: "Closed", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
};


const Q = Object.fromEntries(WORK_QUEUE.map((r) => [r.claimNo, r]));
const fromQueue = (no) => {
  const r = Q[no];
  return r ? { insured: r.insured, vehicle: r.vehicle, regNo: r.regNo, stage: r.stage, pendingWith: r.pendingWith === "Me (handler)" ? "Handler" : r.pendingWith, sla: r.sla, reserve: r.reserve, ageDays: r.ageDays, real: true } : {};
};

const SAMPLE = [
  {
    id: "ESC-26-0412", source: "IGMS", raisedDaysAgo: 13, status: "ACK", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004529", ...fromQueue("OD/CHN/26/004529"),
    ref: "IGMS token 2026-TN-118734", raisedBy: "T. Bhuvana (insured) via Bima Bharosa", channel: "Bima Bharosa portal",
    complaint: "Claim pending for over 50 days. Garage has finished the repair but says the insurer has not cleared it. I have already given all documents.",
    history: [{ d: 13, text: "Grievance received from IGMS / Bima Bharosa" }, { d: 13, text: "Acknowledged to complainant" }],
  },
  {
    id: "ESC-26-0398", source: "IGMS", raisedDaysAgo: 15, status: "FOLLOWUP", handler: "Arvind Kumar",
    claimNo: "OD/CHN/26/003290", insured: "S. Karthika", vehicle: "Maruti Brezza ZXi", regNo: "TN 09 BK 4410", stage: "Survey pending", pendingWith: "Surveyor", sla: { status: "breach", label: "Breached 6 d" }, reserve: 48500, ageDays: 66,
    ref: "IGMS token 2026-TN-117902", raisedBy: "S. Karthika (insured) via IGMS", channel: "IGMS portal",
    complaint: "Surveyor has not inspected my car for 3 weeks. Car is lying at the garage and I am paying for a taxi daily.",
    history: [{ d: 15, text: "Grievance received from IGMS" }, { d: 15, text: "Acknowledged to complainant" }, { d: 12, text: "Follow-up assigned to Arvind: get survey done, update customer" }],
  },
  {
    id: "ESC-26-0421", source: "CUSTOMER", raisedDaysAgo: 0, status: "NEW", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004498", ...fromQueue("OD/CHN/26/004498"),
    ref: "Email · CRM case 55821", raisedBy: "M. Ashok Kumar (insured)", channel: "Email to claims@",
    complaint: "Why is my claim stuck in approval? The garage says they cannot start work without approval. Please escalate.",
    history: [{ d: 0, text: "Complaint received by email – CRM case created" }],
  },
  {
    id: "ESC-26-0417", source: "CUSTOMER", raisedDaysAgo: 4, status: "ACK", handler: "Meena Sundaram",
    claimNo: "OD/CHN/26/003490", insured: "P. Lavanya", vehicle: "Hyundai Venue SX", regNo: "TN 14 DR 7720", stage: "Payment", pendingWith: "Finance", sla: { status: "ok", label: "2 d left" }, reserve: 76400, ageDays: 29,
    ref: "Call centre ticket CC-889120", raisedBy: "P. Lavanya (insured)", channel: "Call centre",
    complaint: "Depreciation deducted on plastic parts is too high. I want a breakup of the settlement before I accept.",
    history: [{ d: 4, text: "Complaint logged by call centre" }, { d: 4, text: "Acknowledged to complainant (SMS + email)" }],
  },
  {
    id: "ESC-26-0377", source: "OMBUDSMAN", raisedDaysAgo: 21, status: "FOLLOWUP", handler: "Rahul Menon",
    claimNo: "OD/CHN/26/003955", insured: "J. Kavitha", vehicle: "Tata Punch Creative", regNo: "TN 05 CP 3381", stage: "Documents pending", pendingWith: "Insured", sla: { status: "risk", label: "10 h left" }, reserve: 221000, ageDays: 58,
    ref: "Ombudsman Chennai · Award CHN-G-044-2627-0193", raisedBy: "Insurance Ombudsman, Chennai", channel: "Award letter",
    complaint: "Award in favour of the insured: pay ₹1,86,000 towards repair cost with interest as per Rule 17 of the Insurance Ombudsman Rules, 2017.",
    history: [{ d: 21, text: "Award received from the Ombudsman" }, { d: 20, text: "Legal reviewed – no appeal" }, { d: 18, text: "Follow-up assigned to Rahul: process payment as per award" }],
  },
  {
    id: "ESC-26-0405", source: "LEGAL", raisedDaysAgo: 6, status: "ACK", handler: "Karthik Subramanian",
    claimNo: "OD/CHN/26/004445", ...fromQueue("OD/CHN/26/004445"),
    ref: "Advocate notice · Regd. post RN 7741 2290", raisedBy: "Adv. R. Selvam for B. Karthikeyan", channel: "Registered post",
    complaint: "Legal notice demanding settlement of the theft claim for the full IDV within 15 days, failing which a consumer complaint will be filed.",
    history: [{ d: 6, text: "Legal notice received" }, { d: 6, text: "Forwarded to Legal team" }],
  },
  {
    id: "ESC-26-0419", source: "SLA", raisedDaysAgo: 1, status: "NEW", handler: "Arvind Kumar",
    claimNo: "OD/CHN/26/003291", insured: "N. Revathi", vehicle: "Kia Seltos HTX", regNo: "TN 12 KM 5512", stage: "Documents pending", pendingWith: "Insured", sla: { status: "breach", label: "Breached 4 d" }, reserve: 314300, ageDays: 65,
    ref: "Auto-escalated by system", raisedBy: "SLA rule – breached > 3 days", channel: "System",
    complaint: "Claim breached the settlement SLA by 4 days. Documents pending with the insured for 19 days; 2 reminders sent.",
    history: [{ d: 1, text: "Auto-escalated: SLA breached by more than 3 days" }],
  },
  {
    id: "ESC-26-0420", source: "SLA", raisedDaysAgo: 0, status: "NEW", handler: "Fathima Begum",
    claimNo: "OD/CHN/26/003890", insured: "V. Ashwin", vehicle: "Toyota Glanza G", regNo: "TN 19 AF 2205", stage: "Survey pending", pendingWith: "Surveyor", sla: { status: "breach", label: "Breached 4 d" }, reserve: 64200, ageDays: 41,
    ref: "Auto-escalated by system", raisedBy: "SLA rule – breached > 3 days", channel: "System",
    complaint: "Claim breached the survey SLA by 4 days. Handler is on leave.",
    history: [{ d: 0, text: "Auto-escalated: SLA breached by more than 3 days" }],
  },
  {
    id: "ESC-26-0363", source: "CUSTOMER", raisedDaysAgo: 9, status: "CLOSED", handler: "Divya Ramesh",
    claimNo: "OD/CHN/26/003090", insured: "G. Sathish", vehicle: "Maruti Swift VXi", regNo: "TN 07 CJ 1180", stage: "Repair / DO", pendingWith: "Garage / dealer", sla: { status: "ok", label: "3 d left" }, reserve: 41800, ageDays: 22,
    ref: "Branch letter BR-CHN-2210", raisedBy: "G. Sathish (insured)", channel: "Branch",
    complaint: "Delivery order not issued even after the final invoice was submitted.",
    history: [{ d: 9, text: "Complaint received at branch" }, { d: 9, text: "Acknowledged to complainant" }, { d: 7, text: "Follow-up assigned to Divya: issue DO today" }, { d: 6, text: "Closed – Accepted – claim settled / will be settled: DO issued, customer informed" }],
    outcome: "Accepted – claim settled / will be settled",
  },
];


export const ESCALATIONS = SAMPLE;

export const DAY = 86400000;
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** due position of an escalation: left = days left (negative = overdue) */
export function dueInfo(e, today) {
  const raised = today - e.raisedDaysAgo * DAY;
  const due = raised + RESPONSE_RULES[e.source].days * DAY;
  return { raised, due, left: Math.round((due - today) / DAY) };
}

/* ================================================================== */
/* Live views                                                          */
/* ================================================================== */
/** team claims with their current handler after reallocations */
export function liveClaims(moves = readStore(KEYS.moves)) {
  return TEAM_CLAIMS.map((c) => ({ ...c, effHandler: moves[c.claimNo]?.to || c.handlerId }));
}

/** TEAM with open / breached / at risk / due today recounted from the live claims */
export function liveTeam(claims = liveClaims()) {
  return TEAM.map((h) => {
    const mine = claims.filter((c) => c.effHandler === h.userId);
    return {
      ...h,
      open: mine.length,
      breached: mine.filter((c) => c.sla.status === "breach").length,
      atRisk: mine.filter((c) => c.sla.status === "risk").length,
      dueToday: mine.filter((c) => c.dueToday).length,
    };
  });
}

/** approvals still waiting for the manager (decided ones removed) */
export function liveApprovals(decisions = readStore(KEYS.decisions)) {
  return APPROVALS.filter((a) => !decisions[a.claimNo]);
}

/** escalations with this session's updates applied */
export function liveEscalations(updates = readStore(KEYS.escalations)) {
  return ESCALATIONS.map((e) => {
    const u = updates[e.id];
    return u ? { ...e, status: u.status, outcome: u.outcome || e.outcome, history: [...e.history, ...u.history] } : e;
  });
}

/** totals for the dashboard KPI row */
export function liveKpis(team, approvals) {
  const sum = (k) => team.reduce((t, h) => t + h[k], 0);
  const closed = sum("closed30");
  return {
    open: sum("open"),
    breached: sum("breached"),
    atRisk: sum("atRisk"),
    dueToday: sum("dueToday"),
    closed30: closed,
    slaMet: Math.round(team.reduce((t, h) => t + h.slaMet * h.closed30, 0) / closed),
    avgTat: Math.round((team.reduce((t, h) => t + h.avgTat * h.closed30, 0) / closed) * 10) / 10,
    approvals: approvals.length,
    approvalsValue: approvals.reduce((t, a) => t + a.amount, 0),
    approvalsOverSla: approvals.filter((a) => a.waitingHours > APPROVAL_SLA_HOURS).length,
    aboveAuthority: approvals.filter((a) => a.amount > MANAGER_AUTHORITY).length,
  };
}

/** counts for the manager's left-menu badges */
export function managerBadges() {
  const today = startOfToday();
  const esc = liveEscalations().filter((e) => e.status !== "CLOSED");
  return {
    approvals: liveApprovals().length + listHandlerRequests().length,
    teamqueue: liveTeam().reduce((t, h) => t + h.breached, 0),
    escalations: esc.length,
    escalationsOverdue: esc.filter((e) => dueInfo(e, today).left < 0).length,
  };
}

/** bell notifications for the manager – built from live data, newest / most urgent first */
export function managerNotifications() {
  const today = startOfToday();
  const team = liveTeam();
  const approvals = liveApprovals();
  const esc = liveEscalations().filter((e) => e.status !== "CLOSED");
  const list = [];
  // requests sent by handlers from Claim 360 (repudiation · reopen · reserve increase)
  listHandlerRequests().forEach((r) =>
    list.push({ id: `req-${r.id}`, kind: "major", Icon: ClipboardCheck, title: `${REQUEST_KIND[r.kind].label} for approval`, text: `${r.insured} · ${r.reason} · ${r.handler.split(" ")[0]}`, ref: r.claimNo, to: `/od/approvals?tab=requests&req=${r.id}`, time: "New", unread: true })
  );
  esc
    .filter((e) => dueInfo(e, today).left < 0)
    .forEach((e) => list.push({ id: `esc-over-${e.id}`, kind: "sla", Icon: AlertTriangle, title: "Escalation overdue", text: `${RESPONSE_RULES[e.source].label} · response was due ${-dueInfo(e, today).left} d ago · ${e.handler.split(" ")[0]}`, ref: e.id, to: `/od/escalations?esc=${e.id}`, time: "Now", unread: true }));
  esc
    .filter((e) => e.status === "NEW")
    .forEach((e) => list.push({ id: `esc-new-${e.id}`, kind: e.source === "SLA" ? "delay" : "fraud", Icon: e.source === "SLA" ? Timer : MessageSquareWarning, title: e.source === "SLA" ? "SLA escalation" : "New complaint", text: `${e.insured} · ${e.claimNo}`, ref: e.id, to: `/od/escalations?esc=${e.id}`, time: e.raisedDaysAgo ? `${e.raisedDaysAgo} d ago` : "Today", unread: true }));
  approvals
    .filter((a) => a.waitingHours > APPROVAL_SLA_HOURS)
    .forEach((a) => list.push({ id: `appr-sla-${a.claimNo}`, kind: "major", Icon: ClipboardCheck, title: "Approval over SLA", text: `₹${a.amount.toLocaleString("en-IN")} · waiting ${Math.floor(a.waitingHours / 24)} d · ${a.handler.split(" ")[0]}`, ref: a.claimNo, to: `/od/approvals?claim=${a.claimNo.replaceAll("/", "-")}`, time: "Now", unread: true }));
  team
    .filter((h) => h.status === "leave" && h.dueToday > 0)
    .forEach((h) => list.push({ id: `leave-${h.userId}-${h.dueToday}`, kind: "delay", Icon: Plane, title: `${h.name.split(" ")[0]} on leave`, text: `${h.dueToday} claims due today need cover`, ref: `${h.open} open claims`, to: `/od/team-queue?handler=${h.userId}`, time: "Today", unread: true }));
  team
    .filter((h) => h.status !== "leave" && h.open > HANDLER_CAPACITY)
    .forEach((h) => list.push({ id: `cap-${h.userId}-${h.open}`, kind: "major", Icon: AlertTriangle, title: "Over capacity", text: `${h.name} has ${h.open} open claims (capacity ${HANDLER_CAPACITY})`, ref: `${h.breached} breached`, to: `/od/team-queue?handler=${h.userId}`, time: "Today", unread: false }));
  approvals
    .filter((a) => a.waitingHours <= APPROVAL_SLA_HOURS)
    .forEach((a) => list.push({ id: `appr-${a.claimNo}`, kind: "survey", Icon: CalendarClock, title: "Approval received", text: `₹${a.amount.toLocaleString("en-IN")} · ${a.lossType} · ${a.handler.split(" ")[0]}`, ref: a.claimNo, to: `/od/approvals?claim=${a.claimNo.replaceAll("/", "-")}`, time: `${a.waitingHours} h ago`, unread: false }));
  return list;
}