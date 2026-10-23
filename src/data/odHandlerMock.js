// src/data/odHandlerMock.js
// Demo data for the OD Claims Handler dashboard (Karthik Subramanian · OD0123 · Chennai).
// All names, claim numbers and vehicles are fictional. Replace with API calls later:
//   GET /od/handler/summary   -> HANDLER_KPIS, STAGE_COUNTS, AGEING_BUCKETS
//   GET /od/handler/queue     -> WORK_QUEUE
//   GET /od/handler/diary     -> DIARY
//   GET /od/handler/alerts    -> ALERTS

// KPI definitions (agree these with business before backend build)
//  open        : claims assigned to me, status not Closed / Withdrawn / Repudiated-final
//  dueToday    : claims whose next action (diary or SLA step) falls due today
//  slaBreached : claims where the current stage TAT has crossed its SLA
//                (clock pauses while status = Documents pending from insured)
//  nbnr        : intimations parked as NBNR (Notified But Not Registered) assigned to me
//  docsPending : claims waiting for documents (RC, DL, FIR, estimate, KYC etc.)
//  closedMtd   : claims I closed this calendar month (settled + closed without payment)
export const HANDLER_KPIS = {
  open: 46,
  dueToday: 9,
  slaBreached: 4,
  nbnr: 3,
  docsPending: 11,
  closedMtd: 28,
};

// Sums to HANDLER_KPIS.open (46)
export const STAGE_COUNTS = [
  { stage: "NBNR", short: "NBNR", count: 3 },
  { stage: "Registered", short: "Registered", count: 4 },
  { stage: "Survey pending", short: "Survey", count: 7 },
  { stage: "Assessment", short: "Assessment", count: 8 },
  { stage: "Documents pending", short: "Docs", count: 11 },
  { stage: "Approval", short: "Approval", count: 5 },
  { stage: "Repair / DO", short: "Repair / DO", count: 5 },
  { stage: "Payment", short: "Payment", count: 3 },
];

// Ageing from claim registration date (intimation date for NBNR). Sums to 46.
export const AGEING_BUCKETS = [
  { bucket: "0–7 d", count: 14 },
  { bucket: "8–15 d", count: 12 },
  { bucket: "16–30 d", count: 10 },
  { bucket: "31–60 d", count: 7 },
  { bucket: "60+ d", count: 3 },
];

// My Work Queue – all 46 open claims assigned to Karthik (OD0123).
// Counts match the dashboard: stage, pending with, SLA status, loss type, ageing,
// due today (9), docs pending (11), NBNR (3).
//   sla.status : "breach" | "risk" | "ok"
//   ageDays    : days since registration (intimation for NBNR)
//   reserve    : current outstanding reserve in ₹
export const WORK_QUEUE = [
  {claimNo: "OD/CHN/26/004512", regNo: "TN 09 BK 4471", vehicle: "Maruti Swift VXi", insured: "S. Revathi", lossType: "Accident – partial", lossDate: "2026-09-17", regDate: "2026-09-18", stage: "Documents pending", pendingWith: "Insured", ageDays: 34, sla: {status: "breach", label: "Breached 2 d"}, nextAction: "Follow up DL copy & claim form", dueToday: true, flags: [], reserve: 18500},
  {claimNo: "OD/CHN/26/004498", regNo: "TN 22 CX 9083", vehicle: "Hyundai Creta SX", insured: "M. Ashok Kumar", lossType: "Accident – partial", lossDate: "2026-09-30", regDate: "2026-10-01", stage: "Approval", pendingWith: "Claims approver", ageDays: 21, sla: {status: "breach", label: "Breached 1 d"}, nextAction: "Escalate approval – ₹1.42 L", dueToday: true, flags: ["Major loss"], reserve: 142000},
  {claimNo: "OD/CHN/26/004533", regNo: "TN 10 AZ 2218", vehicle: "Honda City ZX", insured: "P. Gayathri", lossType: "Theft", lossDate: "2026-10-09", regDate: "2026-10-10", stage: "Survey pending", pendingWith: "SIU / investigator", ageDays: 12, sla: {status: "risk", label: "6 h left"}, nextAction: "Chase investigator prelim report", dueToday: true, flags: ["Fraud flag"], reserve: 845000},
  {claimNo: "OD/CHN/26/004561", regNo: "TN 07 DM 5520", vehicle: "Tata Nexon XZ+", insured: "R. Balaji", lossType: "Flood – CAT", lossDate: "2026-10-18", regDate: "2026-10-19", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 3, sla: {status: "risk", label: "1 d left"}, nextAction: "Confirm survey slot at dealer", dueToday: true, flags: ["CAT event"], reserve: 96500},
  {claimNo: "NB/CHN/26/000187", regNo: "TN 11 BR 6604", vehicle: "Mahindra XUV700", insured: "K. Vignesh", lossType: "Accident – partial", lossDate: "2026-10-19", regDate: "2026-10-20", stage: "NBNR", pendingWith: "Me (handler)", ageDays: 2, sla: {status: "risk", label: "1 d left"}, nextAction: "Verify premium realisation with PAS", dueToday: true, flags: [], reserve: 27800},
  {claimNo: "OD/CHN/26/004470", regNo: "TN 09 CF 1179", vehicle: "Toyota Innova Crysta", insured: "J. Thomas", lossType: "Accident – partial", lossDate: "2026-09-24", regDate: "2026-09-25", stage: "Documents pending", pendingWith: "Garage / dealer", ageDays: 27, sla: {status: "breach", label: "Breached 4 h"}, nextAction: "Obtain final invoice from dealer", dueToday: false, flags: [], reserve: 65200},
  {claimNo: "OD/CHN/26/004547", regNo: "TN 14 AH 3390", vehicle: "Kia Seltos HTX", insured: "N. Divya", lossType: "Accident – partial", lossDate: "2026-10-13", regDate: "2026-10-14", stage: "Assessment", pendingWith: "Surveyor", ageDays: 8, sla: {status: "ok", label: "3 d left"}, nextAction: "Review part-wise assessment", dueToday: false, flags: [], reserve: 31900},
  {claimNo: "NB/CHN/26/000191", regNo: "TN 02 BQ 7712", vehicle: "Renault Kwid RXT", insured: "A. Fathima", lossType: "Accident – partial", lossDate: "2026-10-12", regDate: "2026-10-21", stage: "NBNR", pendingWith: "Me (handler)", ageDays: 1, sla: {status: "ok", label: "2 d left"}, nextAction: "Loss date vs policy period check", dueToday: false, flags: ["Late intimation"], reserve: 88400},
  {claimNo: "OD/CHN/26/004402", regNo: "TN 05 BZ 8841", vehicle: "Maruti Baleno Alpha", insured: "V. Senthamarai", lossType: "Accident – partial", lossDate: "2026-09-10", regDate: "2026-09-11", stage: "Payment", pendingWith: "Finance", ageDays: 41, sla: {status: "breach", label: "Breached 1 d"}, nextAction: "Check NEFT status with Finance", dueToday: true, flags: [], reserve: 23600},
  {claimNo: "OD/CHN/26/004555", regNo: "TN 18 AT 0927", vehicle: "Hyundai i20 Asta", insured: "S. Prakash", lossType: "Fire", lossDate: "2026-10-15", regDate: "2026-10-16", stage: "Documents pending", pendingWith: "Insured", ageDays: 6, sla: {status: "ok", label: "4 d left"}, nextAction: "Request fire brigade report", dueToday: false, flags: [], reserve: 156000},
  {claimNo: "OD/CHN/26/004410", regNo: "TN 08 BE 2379", vehicle: "Maruti Swift VXi", insured: "T. Muthukumar", lossType: "Total loss / CTL", lossDate: "2026-10-12", regDate: "2026-10-13", stage: "Approval", pendingWith: "Claims approver", ageDays: 9, sla: {status: "ok", label: "2 d left"}, nextAction: "Escalate approval – ₹1.42 L", dueToday: false, flags: ["Total loss"], reserve: 612000},
  {claimNo: "OD/CHN/26/004417", regNo: "TN 15 CH 3758", vehicle: "Hyundai Creta SX", insured: "L. Priyadharshini", lossType: "Total loss / CTL", lossDate: "2026-10-10", regDate: "2026-10-11", stage: "Approval", pendingWith: "Claims approver", ageDays: 11, sla: {status: "ok", label: "3 d left"}, nextAction: "Await approver decision", dueToday: false, flags: ["Total loss"], reserve: 485000},
  {claimNo: "OD/CHN/26/004424", regNo: "TN 22 DK 5137", vehicle: "Honda City ZX", insured: "G. Saravanan", lossType: "Total loss / CTL", lossDate: "2026-10-08", regDate: "2026-10-09", stage: "Approval", pendingWith: "Claims approver", ageDays: 13, sla: {status: "ok", label: "4 d left"}, nextAction: "Await approver decision", dueToday: false, flags: ["Total loss"], reserve: 734000},
  {claimNo: "OD/CHN/26/004431", regNo: "TN 07 EN 6516", vehicle: "Tata Nexon XZ+", insured: "H. Abdul Rahman", lossType: "Accident – partial", lossDate: "2026-10-06", regDate: "2026-10-07", stage: "Approval", pendingWith: "Claims approver", ageDays: 15, sla: {status: "risk", label: "10 h left"}, nextAction: "Escalate approval – ₹2.10 L", dueToday: true, flags: [], reserve: 54100},
  {claimNo: "OD/CHN/26/004438", regNo: "TN 14 FQ 7895", vehicle: "Mahindra XUV700", insured: "D. Keerthana", lossType: "Accident – partial", lossDate: "2026-10-12", regDate: "2026-10-13", stage: "Assessment", pendingWith: "PAS / underwriting", ageDays: 9, sla: {status: "ok", label: "5 d left"}, nextAction: "Verify IDV & add-ons with PAS", dueToday: false, flags: [], reserve: 12900},
  {claimNo: "OD/CHN/26/004445", regNo: "TN 21 GT 9274", vehicle: "Toyota Innova Crysta", insured: "B. Karthikeyan", lossType: "Theft", lossDate: "2026-10-10", regDate: "2026-10-11", stage: "Assessment", pendingWith: "SIU / investigator", ageDays: 11, sla: {status: "ok", label: "2 d left"}, nextAction: "Await theft investigation report", dueToday: false, flags: ["Fraud flag"], reserve: 690000},
  {claimNo: "OD/CHN/26/004452", regNo: "TN 06 HW 1653", vehicle: "Kia Seltos HTX", insured: "C. Janani", lossType: "Partial theft", lossDate: "2026-10-08", regDate: "2026-10-09", stage: "Assessment", pendingWith: "Surveyor", ageDays: 13, sla: {status: "ok", label: "6 d left"}, nextAction: "Review part-wise assessment", dueToday: false, flags: [], reserve: 21500},
  {claimNo: "OD/CHN/26/004459", regNo: "TN 13 IB 3032", vehicle: "Renault Kwid RXT", insured: "E. Sathish", lossType: "Partial theft", lossDate: "2026-10-07", regDate: "2026-10-08", stage: "Assessment", pendingWith: "Surveyor", ageDays: 14, sla: {status: "ok", label: "3 d left"}, nextAction: "Follow up final survey report", dueToday: false, flags: [], reserve: 14800},
  {claimNo: "OD/CHN/26/004466", regNo: "TN 20 JE 4411", vehicle: "Maruti Baleno Alpha", insured: "F. Nirmala", lossType: "Accident – partial", lossDate: "2026-10-14", regDate: "2026-10-15", stage: "Assessment", pendingWith: "Surveyor", ageDays: 7, sla: {status: "ok", label: "2 d left"}, nextAction: "Review part-wise assessment", dueToday: false, flags: [], reserve: 73500},
  {claimNo: "OD/CHN/26/004473", regNo: "TN 05 KH 5790", vehicle: "Hyundai i20 Asta", insured: "I. Raghavan", lossType: "Accident – partial", lossDate: "2026-10-05", regDate: "2026-10-06", stage: "Assessment", pendingWith: "Surveyor", ageDays: 16, sla: {status: "ok", label: "3 d left"}, nextAction: "Check depreciation on parts", dueToday: false, flags: [], reserve: 18500},
  {claimNo: "OD/CHN/26/004480", regNo: "TN 12 LK 7169", vehicle: "Maruti Dzire ZXi", insured: "K. Sangeetha", lossType: "Accident – partial", lossDate: "2026-10-03", regDate: "2026-10-04", stage: "Assessment", pendingWith: "Surveyor", ageDays: 18, sla: {status: "ok", label: "4 d left"}, nextAction: "Follow up final survey report", dueToday: false, flags: [], reserve: 42300},
  {claimNo: "OD/CHN/26/004487", regNo: "TN 19 MN 8548", vehicle: "Tata Punch Accomplished", insured: "M. Pandian", lossType: "Flood – CAT", lossDate: "2026-10-02", regDate: "2026-10-03", stage: "Documents pending", pendingWith: "Garage / dealer", ageDays: 19, sla: {status: "ok", label: "5 d left"}, nextAction: "Obtain final invoice from dealer", dueToday: false, flags: [], reserve: 124000},
  {claimNo: "OD/CHN/26/004494", regNo: "TN 04 NQ 9927", vehicle: "Mahindra Scorpio-N Z8", insured: "N. Ramesh", lossType: "Flood – CAT", lossDate: "2026-09-27", regDate: "2026-09-28", stage: "Documents pending", pendingWith: "Insured", ageDays: 24, sla: {status: "ok", label: "2 d left"}, nextAction: "Follow up DL copy & claim form", dueToday: false, flags: [], reserve: 78300},
  {claimNo: "OD/CHN/26/004501", regNo: "TN 11 OT 2306", vehicle: "Hyundai Venue SX", insured: "O. Yamuna", lossType: "Accident – partial", lossDate: "2026-09-22", regDate: "2026-09-23", stage: "Documents pending", pendingWith: "Insured", ageDays: 29, sla: {status: "risk", label: "1 d left"}, nextAction: "Request RC copy", dueToday: true, flags: [], reserve: 27800},
  {claimNo: "OD/CHN/26/004508", regNo: "TN 18 PW 3685", vehicle: "Maruti Ertiga ZXi", insured: "P. Sudhakar", lossType: "Accident – partial", lossDate: "2026-08-20", regDate: "2026-08-21", stage: "Documents pending", pendingWith: "Insured", ageDays: 62, sla: {status: "risk", label: "16 h left"}, nextAction: "Request KYC & cancelled cheque", dueToday: true, flags: [], reserve: 65200},
  {claimNo: "OD/CHN/26/004515", regNo: "TN 03 QB 5064", vehicle: "Honda Amaze VX", insured: "R. Kavitha", lossType: "Accident – partial", lossDate: "2026-08-14", regDate: "2026-08-15", stage: "Documents pending", pendingWith: "Insured", ageDays: 68, sla: {status: "risk", label: "1 d left"}, nextAction: "Request FIR copy", dueToday: false, flags: [], reserve: 31900},
  {claimNo: "OD/CHN/26/004522", regNo: "TN 10 RE 6443", vehicle: "Toyota Glanza G", insured: "S. Elango", lossType: "Accident – partial", lossDate: "2026-09-06", regDate: "2026-09-07", stage: "Documents pending", pendingWith: "Insured", ageDays: 45, sla: {status: "risk", label: "5 h left"}, nextAction: "Request fire brigade report", dueToday: false, flags: [], reserve: 88400},
  {claimNo: "OD/CHN/26/004529", regNo: "TN 17 SH 7822", vehicle: "Kia Sonet HTK+", insured: "T. Bhuvana", lossType: "Accident – partial", lossDate: "2026-08-30", regDate: "2026-08-31", stage: "Documents pending", pendingWith: "Insured", ageDays: 52, sla: {status: "risk", label: "12 h left"}, nextAction: "Follow up DL copy", dueToday: false, flags: [], reserve: 23600},
  {claimNo: "OD/CHN/26/004536", regNo: "TN 02 TK 9201", vehicle: "Maruti Brezza ZXi", insured: "U. Manikandan", lossType: "Accident – partial", lossDate: "2026-08-18", regDate: "2026-08-19", stage: "Documents pending", pendingWith: "Insured", ageDays: 64, sla: {status: "risk", label: "8 h left"}, nextAction: "Request RC & insured ID", dueToday: false, flags: [], reserve: 54100},
  {claimNo: "NB/CHN/26/000180", regNo: "TN 09 UN 1580", vehicle: "Tata Tiago XZ", insured: "V. Deepika", lossType: "Accident – partial", lossDate: "2026-10-19", regDate: "2026-10-20", stage: "NBNR", pendingWith: "Me (handler)", ageDays: 2, sla: {status: "ok", label: "6 d left"}, nextAction: "Verify premium realisation with PAS", dueToday: false, flags: [], reserve: 12900},
  {claimNo: "OD/CHN/26/004543", regNo: "TN 16 VQ 2959", vehicle: "MG Hector Sharp", insured: "W. Joseph", lossType: "Accident – partial", lossDate: "2026-09-21", regDate: "2026-09-22", stage: "Payment", pendingWith: "Finance", ageDays: 30, sla: {status: "ok", label: "3 d left"}, nextAction: "Check NEFT status with Finance", dueToday: false, flags: [], reserve: 73500},
  {claimNo: "OD/CHN/26/004550", regNo: "TN 01 WT 4338", vehicle: "Skoda Slavia Style", insured: "Y. Lakshmanan", lossType: "Accident – partial", lossDate: "2026-08-27", regDate: "2026-08-28", stage: "Payment", pendingWith: "Finance", ageDays: 55, sla: {status: "ok", label: "2 d left"}, nextAction: "Release payment to dealer", dueToday: false, flags: [], reserve: 18500},
  {claimNo: "OD/CHN/26/004557", regNo: "TN 08 XW 5717", vehicle: "Volkswagen Virtus GT", insured: "A. Sowmya", lossType: "Accident – partial", lossDate: "2026-10-20", regDate: "2026-10-21", stage: "Registered", pendingWith: "Me (handler)", ageDays: 1, sla: {status: "ok", label: "3 d left"}, nextAction: "Appoint surveyor", dueToday: false, flags: [], reserve: 42300},
  {claimNo: "OD/CHN/26/004564", regNo: "TN 15 YB 7096", vehicle: "Maruti WagonR VXi", insured: "B. Rajkumar", lossType: "Accident – partial", lossDate: "2026-10-18", regDate: "2026-10-19", stage: "Registered", pendingWith: "Me (handler)", ageDays: 3, sla: {status: "ok", label: "4 d left"}, nextAction: "Review intimation & loss details", dueToday: false, flags: [], reserve: 27800},
  {claimNo: "OD/CHN/26/004571", regNo: "TN 22 ZE 8475", vehicle: "Hyundai Verna SX", insured: "C. Harini", lossType: "Accident – partial", lossDate: "2026-10-17", regDate: "2026-10-18", stage: "Registered", pendingWith: "Me (handler)", ageDays: 4, sla: {status: "ok", label: "5 d left"}, nextAction: "Appoint surveyor – spot survey", dueToday: false, flags: [], reserve: 65200},
  {claimNo: "OD/CHN/26/004578", regNo: "TN 07 AH 9854", vehicle: "Mahindra Thar LX", insured: "D. Venkatesh", lossType: "Accident – partial", lossDate: "2026-10-16", regDate: "2026-10-17", stage: "Registered", pendingWith: "PAS / underwriting", ageDays: 5, sla: {status: "ok", label: "2 d left"}, nextAction: "Endorsement check – ownership transfer", dueToday: false, flags: [], reserve: 31900},
  {claimNo: "OD/CHN/26/004585", regNo: "TN 14 BK 2233", vehicle: "Tata Harrier XZ", insured: "E. Anitha", lossType: "Flood – CAT", lossDate: "2026-10-07", regDate: "2026-10-08", stage: "Repair / DO", pendingWith: "Garage / dealer", ageDays: 14, sla: {status: "ok", label: "6 d left"}, nextAction: "Track repair progress", dueToday: false, flags: [], reserve: 58200},
  {claimNo: "OD/CHN/26/004592", regNo: "TN 21 CN 3612", vehicle: "Maruti Alto K10 VXi", insured: "F. Sivakumar", lossType: "Accident – partial", lossDate: "2026-10-01", regDate: "2026-10-02", stage: "Repair / DO", pendingWith: "Garage / dealer", ageDays: 20, sla: {status: "ok", label: "3 d left"}, nextAction: "Issue delivery order", dueToday: false, flags: [], reserve: 88400},
  {claimNo: "OD/CHN/26/004599", regNo: "TN 06 DQ 4991", vehicle: "Hyundai Exter SX", insured: "G. Malathi", lossType: "Accident – partial", lossDate: "2026-09-23", regDate: "2026-09-24", stage: "Repair / DO", pendingWith: "Garage / dealer", ageDays: 28, sla: {status: "ok", label: "2 d left"}, nextAction: "Re-inspection after repair", dueToday: false, flags: [], reserve: 23600},
  {claimNo: "OD/CHN/26/004606", regNo: "TN 13 ET 6370", vehicle: "Toyota Urban Cruiser Hyryder", insured: "H. Gopinath", lossType: "Accident – partial", lossDate: "2026-09-11", regDate: "2026-09-12", stage: "Repair / DO", pendingWith: "Garage / dealer", ageDays: 40, sla: {status: "risk", label: "20 h left"}, nextAction: "Track repair progress", dueToday: false, flags: [], reserve: 54100},
  {claimNo: "OD/CHN/26/004613", regNo: "TN 20 FW 7749", vehicle: "Maruti Swift VXi", insured: "I. Shalini", lossType: "Accident – partial", lossDate: "2026-09-04", regDate: "2026-09-05", stage: "Repair / DO", pendingWith: "Garage / dealer", ageDays: 47, sla: {status: "risk", label: "1 d left"}, nextAction: "Collect replaced parts (salvage)", dueToday: false, flags: [], reserve: 12900},
  {claimNo: "OD/CHN/26/004620", regNo: "TN 05 GB 9128", vehicle: "Hyundai Creta SX", insured: "J. Arulmozhi", lossType: "Accident – partial", lossDate: "2026-10-19", regDate: "2026-10-20", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 2, sla: {status: "ok", label: "3 d left"}, nextAction: "Confirm survey slot at garage", dueToday: false, flags: [], reserve: 73500},
  {claimNo: "OD/CHN/26/004627", regNo: "TN 12 HE 1507", vehicle: "Honda City ZX", insured: "K. Dinesh", lossType: "Accident – partial", lossDate: "2026-10-17", regDate: "2026-10-18", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 4, sla: {status: "ok", label: "4 d left"}, nextAction: "Chase surveyor visit", dueToday: false, flags: [], reserve: 18500},
  {claimNo: "OD/CHN/26/004634", regNo: "TN 19 IH 2886", vehicle: "Tata Nexon XZ+", insured: "L. Meenakshi", lossType: "Accident – partial", lossDate: "2026-10-16", regDate: "2026-10-17", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 5, sla: {status: "ok", label: "5 d left"}, nextAction: "Confirm survey slot at dealer", dueToday: false, flags: [], reserve: 42300},
  {claimNo: "OD/CHN/26/004641", regNo: "TN 04 JK 4265", vehicle: "Mahindra XUV700", insured: "M. Bharath", lossType: "Accident – partial", lossDate: "2026-10-15", regDate: "2026-10-16", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 6, sla: {status: "ok", label: "2 d left"}, nextAction: "Chase surveyor visit", dueToday: false, flags: [], reserve: 27800},
  {claimNo: "OD/CHN/26/004648", regNo: "TN 11 KN 5644", vehicle: "Toyota Innova Crysta", insured: "N. Pavithra", lossType: "Accident – partial", lossDate: "2026-10-12", regDate: "2026-10-13", stage: "Survey pending", pendingWith: "Surveyor", ageDays: 9, sla: {status: "ok", label: "6 d left"}, nextAction: "Share garage address with surveyor", dueToday: false, flags: [], reserve: 65200},
];

// Today's follow-ups (diary)
export const DIARY = [
  { time: "10:00", claimNo: "OD/CHN/26/004512", text: "Call insured – DL copy pending", done: true },
  { time: "11:30", claimNo: "OD/CHN/26/004533", text: "SIU – prelim theft report", done: false },
  { time: "12:30", claimNo: "NB/CHN/26/000187", text: "PAS – premium realisation status", done: false },
  { time: "15:00", claimNo: "OD/CHN/26/004561", text: "Surveyor visit at Lakshmi Tata, Guindy", done: false },
  { time: "16:30", claimNo: "OD/CHN/26/004402", text: "Finance – NEFT UTR confirmation", done: false },
];

// severity: "critical" | "warning" | "info"
export const ALERTS = [
  {
    severity: "critical",
    title: "Fraud red flag",
    text: "OD/CHN/26/004533 – theft within 30 days of policy inception",
    time: "09:12",
  },
  {
    severity: "warning",
    title: "Major loss alert",
    text: "OD/CHN/26/004498 – estimate ₹1.42 L crossed ₹1 L threshold",
    time: "Yesterday",
  },
  {
    severity: "warning",
    title: "Delay in intimation",
    text: "NB/CHN/26/000191 – intimated 9 days after loss",
    time: "Yesterday",
  },
  {
    severity: "info",
    title: "Survey report received",
    text: "OD/CHN/26/004547 – final survey report uploaded",
    time: "08:40",
  },
];

// SLA position of my open claims. Sums to HANDLER_KPIS.open (46).
export const SLA_SUMMARY = [
  { key: "ok", label: "On track", count: 30 },
  { key: "risk", label: "At risk (≤ 24 h)", count: 12 },
  { key: "breach", label: "Breached", count: 4 },
];

// Open claims by loss type. Sums to 46.
export const LOSS_TYPES = [
  { type: "Accident – partial loss", count: 34 },
  { type: "Flood / CAT event", count: 4 },
  { type: "Total loss / CTL", count: 3 },
  { type: "Theft", count: 2 },
  { type: "Partial theft", count: 2 },
  { type: "Fire", count: 1 },
];

// Claims I closed per month (Oct = month to date)
export const CLOSED_TREND = [
  { month: "May", count: 22 },
  { month: "Jun", count: 25 },
  { month: "Jul", count: 31 },
  { month: "Aug", count: 27 },
  { month: "Sep", count: 30 },
  { month: "Oct", count: 28, mtd: true },
];

/* ------------------------------------------------------------------ */
/* SLA / TAT performance (dashboard)                                   */
/* TAT = turnaround time. Targets are INTERNAL SLAs (configurable in   */
/* the SLA master). Confirm against current IRDAI timelines before go-live. */
/* ------------------------------------------------------------------ */
export const SLA_KPIS = {
  slaCompliance: 91, // % of claims closed this month within overall SLA
  slaTarget: 90,
  avgSettlementTat: 18.4, // days, intimation → settlement, claims closed this month
  settlementTarget: 21,
  atRisk: 12,
};

// Average days per stage (last 90 days) vs internal target.
// breachedOpen = open claims currently breaching this stage SLA (sums to 4).
export const TAT_STAGES = [
  { stage: "Intimation → Registration", target: 1, actual: 0.6, breachedOpen: 0 },
  { stage: "Registration → Surveyor appointed", target: 1, actual: 0.9, breachedOpen: 0 },
  { stage: "Surveyor appointed → Survey done", target: 2, actual: 2.3, breachedOpen: 1 },
  { stage: "Survey → Assessment report", target: 5, actual: 4.1, breachedOpen: 0 },
  { stage: "Document collection", target: 7, actual: 8.6, breachedOpen: 2 },
  { stage: "Approval", target: 2, actual: 1.6, breachedOpen: 1 },
  { stage: "Final invoice → Delivery order", target: 3, actual: 2.7, breachedOpen: 0 },
  { stage: "Delivery order → Payment", target: 2, actual: 1.8, breachedOpen: 0 },
];

// % of claims closed within SLA, per month (Oct = month to date)
export const SLA_TREND = [
  { month: "May", value: 84 },
  { month: "Jun", value: 86 },
  { month: "Jul", value: 88 },
  { month: "Aug", value: 87 },
  { month: "Sep", value: 90 },
  { month: "Oct", value: 91, mtd: true },
];

// Average intimation → settlement TAT in days, per month
export const TAT_TREND = [
  { month: "May", value: 22.1 },
  { month: "Jun", value: 20.6 },
  { month: "Jul", value: 19.8 },
  { month: "Aug", value: 19.2 },
  { month: "Sep", value: 18.9 },
  { month: "Oct", value: 18.4, mtd: true },
];

// Who each open claim is currently waiting on. Sums to HANDLER_KPIS.open (46).
export const PENDING_WITH = [
  { party: "Surveyor", count: 12 },
  { party: "Insured", count: 9 },
  { party: "Garage / dealer", count: 7 },
  { party: "Me (handler)", count: 6 },
  { party: "Claims approver", count: 5 },
  { party: "Finance", count: 3 },
  { party: "SIU / investigator", count: 2 },
  { party: "PAS / underwriting", count: 2 },
];