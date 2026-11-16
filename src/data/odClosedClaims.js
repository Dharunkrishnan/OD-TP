// src/data/odClosedClaims.js
// Claims Karthik closed earlier (demo) – shown in My Work Queue → Closed and openable in Claim 360.
// `stage` is the stage the claim was in when it closed (drives the Claim 360 build); `closure` holds how it closed.
// Closure types follow the catalogue: 130 closure after payment, 131 closure without payment
// (withdrawal, repudiation, no-claim, documents not submitted), 16 NBNR closed.
// Dates are written against 21 Oct 2026 and moved to today like the open queue.

import { DEMO_SHIFT_DAYS } from "./odHandlerMock";

const shift = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + DEMO_SHIFT_DAYS);
  return d.toISOString().slice(0, 10);
};

// type: Paid · Withdrawn · Repudiated · Closed without payment · NBNR closed
const RAW_CLOSED = [
  { claimNo: "OD/CHN/26/004318", regNo: "TN 09 AB 1122", vehicle: "Maruti Swift VXi", insured: "R. Prakash", lossType: "Accident – partial", lossDate: "2026-09-02", regDate: "2026-09-03", stage: "Payment", reserve: 24800, closure: { type: "Paid", closedOn: "2026-10-18", paid: 24800, payee: "Sundaram Motors (Maruti), Anna Salai", reason: "Full and final settlement – cashless", utr: "N26101814522" } },
  { claimNo: "OD/CHN/26/004325", regNo: "TN 22 CD 4471", vehicle: "Hyundai Creta SX", insured: "M. Divya", lossType: "Accident – partial", lossDate: "2026-08-28", regDate: "2026-08-29", stage: "Payment", reserve: 61200, closure: { type: "Paid", closedOn: "2026-10-15", paid: 58900, payee: "Hyundai Kun Motors, Guindy", reason: "Full and final settlement – cashless", utr: "N26101509871" } },
  { claimNo: "OD/CHN/26/004332", regNo: "TN 07 EF 9013", vehicle: "Tata Nexon XZ+", insured: "S. Karthik", lossType: "Flood – CAT", lossDate: "2026-08-19", regDate: "2026-08-20", stage: "Payment", reserve: 142000, closure: { type: "Paid", closedOn: "2026-10-09", paid: 138500, payee: "Concorde Motors (Tata), Ambattur", reason: "Full and final settlement – cashless (CAT)", utr: "N26100903311" } },
  { claimNo: "OD/CHN/26/004339", regNo: "TN 14 GH 2356", vehicle: "Honda Amaze VX", insured: "P. Jayanthi", lossType: "Accident – partial", lossDate: "2026-08-11", regDate: "2026-08-12", stage: "Payment", reserve: 18900, closure: { type: "Paid", closedOn: "2026-09-30", paid: 18900, payee: "P. Jayanthi (insured)", reason: "Reimbursement – repaired at non-network garage", utr: "N26093011208" } },
  { claimNo: "OD/CHN/26/004346", regNo: "TN 05 IJ 7780", vehicle: "Kia Seltos HTX", insured: "A. Ramya", lossType: "Accident – partial", lossDate: "2026-07-30", regDate: "2026-07-31", stage: "Payment", reserve: 84300, closure: { type: "Paid", closedOn: "2026-09-21", paid: 81750, payee: "Kia Lakshmi Motors, OMR", reason: "Full and final settlement – cashless", utr: "N26092107764" } },
  { claimNo: "OD/CHN/26/004353", regNo: "TN 18 KL 3304", vehicle: "Maruti Baleno Alpha", insured: "G. Mohan", lossType: "Total loss / CTL", lossDate: "2026-07-14", regDate: "2026-07-15", stage: "Payment", reserve: 612000, closure: { type: "Paid", closedOn: "2026-09-12", paid: 598000, payee: "HDFC Bank (financier) & G. Mohan", reason: "Total loss settled on IDV less salvage; financier NOC obtained", utr: "N26091200457" } },
  { claimNo: "OD/CHN/26/004360", regNo: "TN 11 MN 6619", vehicle: "Hyundai i20 Asta", insured: "T. Saranya", lossType: "Accident – partial", lossDate: "2026-09-26", regDate: "2026-09-27", stage: "Registered", reserve: 22400, closure: { type: "Withdrawn", closedOn: "2026-10-04", paid: 0, reason: "Insured repaired at own cost – NCB retention", by: "Email from insured" } },
  { claimNo: "OD/CHN/26/004367", regNo: "TN 03 OP 8825", vehicle: "Toyota Glanza G", insured: "V. Balaji", lossType: "Accident – partial", lossDate: "2026-09-14", regDate: "2026-09-15", stage: "Survey pending", reserve: 15600, closure: { type: "Withdrawn", closedOn: "2026-09-25", paid: 0, reason: "Settled with the third party directly", by: "Letter at branch" } },
  { claimNo: "OD/CHN/26/004374", regNo: "TN 20 QR 1148", vehicle: "Mahindra Scorpio-N Z8", insured: "K. Senthil", lossType: "Accident – partial", lossDate: "2026-08-22", regDate: "2026-08-23", stage: "Assessment", reserve: 96500, closure: { type: "Repudiated", closedOn: "2026-10-02", paid: 0, reason: "Driver did not hold a valid licence at the time of loss", approvedBy: "Priya Raghavan" } },
  { claimNo: "OD/CHN/26/004381", regNo: "TN 16 ST 5537", vehicle: "MG Hector Sharp", insured: "N. Farhan", lossType: "Accident – partial", lossDate: "2026-08-05", regDate: "2026-08-06", stage: "Assessment", reserve: 128000, closure: { type: "Repudiated", closedOn: "2026-09-18", paid: 0, reason: "Vehicle used for hire and reward – not covered under private car policy", approvedBy: "Priya Raghavan" } },
  { claimNo: "OD/CHN/26/004388", regNo: "TN 02 UV 9061", vehicle: "Renault Kwid RXT", insured: "J. Kalaiselvi", lossType: "Accident – partial", lossDate: "2026-07-21", regDate: "2026-07-22", stage: "Documents pending", reserve: 12300, closure: { type: "Closed without payment", closedOn: "2026-09-27", paid: 0, reason: "Documents not submitted after 3 reminders" } },
  { claimNo: "OD/CHN/26/004395", regNo: "TN 13 WX 2290", vehicle: "Maruti Dzire ZXi", insured: "S. Vimal", lossType: "Accident – partial", lossDate: "2026-09-08", regDate: "2026-09-09", stage: "Assessment", reserve: 9800, closure: { type: "Closed without payment", closedOn: "2026-10-11", paid: 0, reason: "No claim – assessed loss below the deductible" } },
  { claimNo: "NB/CHN/26/000162", regNo: "TN 10 YZ 4573", vehicle: "Tata Tiago XZ", insured: "R. Hemalatha", lossType: "Accident – partial", lossDate: "2026-10-05", regDate: "2026-10-06", stage: "NBNR", reserve: 0, closure: { type: "NBNR closed", closedOn: "2026-10-12", paid: 0, reason: "Policy not in force on the loss date – premium cheque dishonoured" } },
  { claimNo: "NB/CHN/26/000171", regNo: "TN 21 BA 6618", vehicle: "Honda City ZX", insured: "D. Arun", lossType: "Accident – partial", lossDate: "2026-10-09", regDate: "2026-10-10", stage: "NBNR", reserve: 0, closure: { type: "NBNR closed", closedOn: "2026-10-14", paid: 0, reason: "TP-only policy – no Own Damage cover" } },
  { claimNo: "OD/CHN/26/004311", regNo: "TN 06 CE 3381", vehicle: "Skoda Slavia Style", insured: "L. Nandhini", lossType: "Partial theft", lossDate: "2026-08-17", regDate: "2026-08-18", stage: "Payment", reserve: 34200, closure: { type: "Paid", closedOn: "2026-10-20", paid: 31600, payee: "L. Nandhini (insured)", reason: "Partial theft – stereo and wheels; settled on invoice less depreciation", utr: "N26102016630" } },
];

export const CLOSED_CLAIMS = RAW_CLOSED.map((r) => ({
  ...r,
  pendingWith: "–",
  // days from registration to closure – places the timeline events before the closing date
  ageDays: Math.max(1, Math.round((new Date(r.closure.closedOn) - new Date(r.regDate)) / 86400000)),
  sla: { status: "ok", label: "Closed" },
  nextAction: "Closed",
  dueToday: false,
  flags: [],
  lossDate: shift(r.lossDate),
  regDate: shift(r.regDate),
  closure: { ...r.closure, closedOn: shift(r.closure.closedOn) },
}));