// src/data/odTeamMock.js
// Demo data for the OD Claims Manager (Priya Raghavan · OD0150 · Chennai).
// Karthik Subramanian's figures come from his real demo queue (odHandlerMock.js),
// so the manager and handler dashboards always agree. The other five handlers are demo figures.
// Replace with:
//   GET /od/manager/team            -> TEAM
//   GET /od/manager/approvals       -> APPROVALS
//   GET /od/manager/watchlist       -> WATCHLIST
//   GET /od/manager/team-tat        -> TEAM_TAT
//
// Demo assumptions (confirm with business):
//   - Claims handler approval authority: up to ₹1,00,000 → above that the claim comes to the manager
//   - Claims manager authority: up to ₹5,00,000 → above that, refer to the Zonal Claims Head
//   - Approval SLA: 2 days (48 hours) from "Sent for approval"
//   - Handler capacity: 45 open claims
//   - SLA met % and average TAT: claims closed in the last 30 days

import { HANDLER_KPIS, SLA_KPIS, WORK_QUEUE, TAT_STAGES } from "./odHandlerMock";

export const HANDLER_AUTHORITY = 100000;
export const MANAGER_AUTHORITY = 500000;
export const APPROVAL_SLA_HOURS = 48;
export const HANDLER_CAPACITY = 45;

const countDue = WORK_QUEUE.filter((r) => r.dueToday).length;

/* ---------------- Team (6 handlers, Chennai OD) ---------------- */
export const TEAM = [
  {
    userId: "OD0123",
    name: "Karthik Subramanian",
    open: HANDLER_KPIS.open,
    breached: HANDLER_KPIS.slaBreached,
    atRisk: SLA_KPIS.atRisk,
    dueToday: countDue,
    closed30: 28,
    slaMet: SLA_KPIS.slaCompliance,
    avgTat: SLA_KPIS.avgSettlementTat,
    status: "active",
  },
  { userId: "OD0131", name: "Divya Ramesh", open: 38, breached: 2, atRisk: 7, dueToday: 8, closed30: 31, slaMet: 94, avgTat: 16.9, status: "active" },
  { userId: "OD0134", name: "Arvind Kumar", open: 57, breached: 9, atRisk: 15, dueToday: 14, closed30: 19, slaMet: 82, avgTat: 22.6, status: "active" },
  { userId: "OD0137", name: "Meena Sundaram", open: 42, breached: 3, atRisk: 9, dueToday: 10, closed30: 26, slaMet: 89, avgTat: 19.1, status: "active" },
  { userId: "OD0142", name: "Rahul Menon", open: 29, breached: 1, atRisk: 4, dueToday: 6, closed30: 33, slaMet: 96, avgTat: 15.2, status: "active" },
  { userId: "OD0145", name: "Fathima Begum", open: 34, breached: 4, atRisk: 6, dueToday: 7, closed30: 22, slaMet: 88, avgTat: 20.4, status: "leave", leaveNote: "On leave · back in 2 days" },
];

/* ---------------- Waiting for my approval ---------------- */
// waitingHours = time since the handler sent the claim for approval
export const APPROVALS = [
  { claimNo: "OD/CHN/26/004498", handler: "Karthik Subramanian", insured: "M. Ashok Kumar", lossType: "Accident – partial", amount: 142000, waitingHours: 72 },
  { claimNo: "OD/CHN/26/004431", handler: "Karthik Subramanian", insured: "H. Abdul Rahman", lossType: "Accident – partial", amount: 210000, waitingHours: 38 },
  { claimNo: "OD/CHN/26/003981", handler: "Arvind Kumar", insured: "S. Prabhu", lossType: "Accident – partial", amount: 118500, waitingHours: 54 },
  { claimNo: "OD/CHN/26/004102", handler: "Meena Sundaram", insured: "R. Lalitha", lossType: "Flood – CAT", amount: 346000, waitingHours: 20 },
  { claimNo: "OD/CHN/26/004417", handler: "Karthik Subramanian", insured: "L. Priyadharshini", lossType: "Total loss / CTL", amount: 485000, waitingHours: 30 },
  { claimNo: "OD/CHN/26/004215", handler: "Divya Ramesh", insured: "K. Mohan", lossType: "Fire", amount: 264000, waitingHours: 9 },
  { claimNo: "OD/CHN/26/004410", handler: "Karthik Subramanian", insured: "T. Muthukumar", lossType: "Total loss / CTL", amount: 612000, waitingHours: 26 },
  { claimNo: "OD/CHN/26/004424", handler: "Karthik Subramanian", insured: "G. Saravanan", lossType: "Total loss / CTL", amount: 734000, waitingHours: 14 },
].sort((a, b) => b.waitingHours - a.waitingHours);

/* ---------------- Watch list: high value and red flags ---------------- */
export const WATCHLIST = [
  { claimNo: "OD/CHN/26/004077", handler: "Arvind Kumar", insured: "V. Narayanan", reserve: 910000, reason: "Total loss above ₹5 L", kind: "value" },
  { claimNo: "OD/CHN/26/004533", handler: "Karthik Subramanian", insured: "P. Gayathri", reserve: 845000, reason: "Theft within 30 days of policy start", kind: "fraud" },
  { claimNo: "OD/CHN/26/004424", handler: "Karthik Subramanian", insured: "G. Saravanan", reserve: 734000, reason: "Total loss above ₹5 L", kind: "value" },
  { claimNo: "OD/CHN/26/004445", handler: "Karthik Subramanian", insured: "B. Karthikeyan", reserve: 690000, reason: "Theft · with SIU", kind: "fraud" },
  { claimNo: "OD/CHN/26/003955", handler: "Rahul Menon", insured: "J. Kavitha", reserve: 221000, reason: "Repeat claim within 6 months", kind: "fraud" },
  { claimNo: "NB/CHN/26/000191", handler: "Karthik Subramanian", insured: "A. Fathima", reserve: 88400, reason: "Late intimation (9 days)", kind: "late" },
];

/* ---------------- Team stage-wise TAT (handler stages only) ---------------- */
// Karthik's breached claims per stage come from TAT_STAGES; the others' are added on top.
const OTHERS = {
  "Registration → Surveyor appointed": { actual: 1.1, breached: 2 },
  "Surveyor appointed → Survey done": { actual: 2.6, breached: 4 },
  "Survey → Assessment report": { actual: 4.4, breached: 1 },
  "Document collection": { actual: 7.9, breached: 7 },
  Approval: { actual: 2.3, breached: 2 },
  "Final invoice → Delivery order": { actual: 2.9, breached: 1 },
  "Delivery order → Payment": { actual: 1.9, breached: 2 },
};
export const TEAM_TAT = TAT_STAGES.filter((s) => OTHERS[s.stage]).map((s) => ({
  stage: s.stage,
  target: s.target,
  // team average: Karthik is 1 of 6 handlers
  actual: Math.round(((s.actual + OTHERS[s.stage].actual * 5) / 6) * 10) / 10,
  breached: s.breachedOpen + OTHERS[s.stage].breached,
}));

/* ---------------- Team totals ---------------- */
const sum = (k) => TEAM.reduce((t, h) => t + h[k], 0);
const closed = sum("closed30");
export const TEAM_KPIS = {
  open: sum("open"),
  breached: sum("breached"),
  atRisk: sum("atRisk"),
  dueToday: sum("dueToday"),
  closed30: closed,
  // weighted by claims closed
  slaMet: Math.round(TEAM.reduce((t, h) => t + h.slaMet * h.closed30, 0) / closed),
  avgTat: Math.round((TEAM.reduce((t, h) => t + h.avgTat * h.closed30, 0) / closed) * 10) / 10,
  slaTarget: SLA_KPIS.slaTarget,
  tatTarget: SLA_KPIS.settlementTarget,
  approvals: APPROVALS.length,
  approvalsValue: APPROVALS.reduce((t, a) => t + a.amount, 0),
  approvalsOverSla: APPROVALS.filter((a) => a.waitingHours > APPROVAL_SLA_HOURS).length,
  aboveAuthority: APPROVALS.filter((a) => a.amount > MANAGER_AUTHORITY).length,
};