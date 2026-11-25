// src/data/claimJourney.js
// The claim journey for the Claim 360 timeline: one step per key activity, in order, with the team
// that does it, what was done, the SLA, whether the SLA was met, and the regulatory basis.
// Built from the claim's own events (c.timeline plus status / survey events recorded in this
// session), so the SLA chips come from the claim's real dates.
//
// IRDAI timelines (Motor OD) – Master Circular on General Insurance Business, 11 Jun 2024:
//   • surveyor allocated within 24 hours of the claim report
//   • survey report within 15 days of allocation
//   • claim decided within 7 days of receiving the survey report
// Loss under ₹50,000 need not be surveyed by a licensed surveyor – Master Circular on Protection
// of Policyholders' Interests, 2024. Other steps have no regulatory mandate (internal standards).

import { todayIso } from "./handlerDashboard";

export const IRDAI_GI_2024 = "As per IRDAI — Master Circular on General Insurance Business, 11 Jun 2024";
const INTERNAL = "No regulatory mandate — internal standard";

const DAY = 86400000;
const at = (date, time = "00:00") => new Date(`${date}T${time}:00`).getTime();
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const days = (a, b) => Math.round((at(b) - at(a)) / DAY);

/** SLA chip: { kind: "met" | "breach" | "due" | "overdue" | "none", text } */
function slaDone(took, limit, unit) {
  return took <= limit
    ? { kind: "met", text: `Met · took ${took} ${unit}${took === 1 ? "" : "s"}` }
    : { kind: "breach", text: `Breached by ${took - limit} ${unit}${took - limit === 1 ? "" : "s"}` };
}
function slaPending(dueIso, today) {
  const left = days(today, dueIso);
  return left >= 0
    ? { kind: "due", text: left === 0 ? "Due today" : `Due by ${dueIso} · ${left} day${left === 1 ? "" : "s"} left` }
    : { kind: "overdue", text: `Overdue by ${-left} day${left === -1 ? "" : "s"}` };
}

/**
 * steps: [{ key, when: {date, time} | null, stage, lifecycle (0–4), team, act, sla, chip, irdai, reg,
 *           state: "done" | "current" | "todo", icon }]
 */
export function claimJourney(c, events, { closedEvent } = {}) {
  const today = todayIso();
  const find = (name) => events.find((e) => e.event.startsWith(name));
  const all = (name) => events.filter((e) => e.event.startsWith(name));
  const handler = "Karthik Subramanian";
  const sv = c.survey.surveyor;
  const ips = !!sv && /IPS|panel/i.test(sv.type || "");

  const intimated = find("Claim intimated");
  const nbnr = find("Parked as NBNR");
  const registered = find("Claim registered") || find("NBNR converted to claim");
  const assigned = find("Assigned to handler");
  const appointed = find("Surveyor appointed");
  const surveyed = find("Survey completed");
  const revised = find("Reserve revised");
  const sentApproval = find("Sent for approval");
  const decided = find("Repair authorised") || find("Approved") || find("Repudiated") || find("Claim repudiated");
  const payReq = find("Payment requested");
  const paid =
    find("Claim closed") || find("Payment made") || find("Closed without payment") || find("Claim withdrawn") || find("NBNR closed") || closedEvent || null;

  const steps = [];
  const add = (s) => steps.push({ chip: { kind: "none" }, irdai: false, reg: INTERNAL, ...s });

  add({
    key: "intake",
    when: intimated,
    stage: "Claim intake (FNOL)",
    lifecycle: 0,
    team: `${intimated?.by || "Insured"} → Claims desk`,
    act: intimated ? `Claim intimated · ${intimated.detail}` : "Claim intimated",
    sla: "Registered the same day",
    chip: intimated && registered ? (registered.date === intimated.date ? { kind: "met", text: "Met" } : slaDone(days(intimated.date, registered.date), 0, "day")) : { kind: "none" },
    icon: "file",
  });

  if (nbnr) {
    add({
      key: "nbnr",
      when: nbnr,
      stage: "Parked as NBNR",
      lifecycle: 0,
      team: "System (auto) → Claims handler",
      act: `Notified but not registered · ${nbnr.detail}`,
      sla: "Resolve within 7 days",
      chip: registered ? slaDone(days(nbnr.date, registered.date), 7, "day") : slaPending(addDays(nbnr.date, 7), today),
      icon: "pause",
    });
  }

  add({
    key: "register",
    when: registered,
    stage: "Registration",
    lifecycle: 0,
    team: "System (auto)",
    act: registered ? `Coverage, policy period & duplicate checks passed · ${registered.detail}` : "Registers once the NBNR reason is resolved",
    sla: "Real-time on intimation",
    chip: registered ? { kind: "met", text: "Met" } : { kind: "none" },
    reg: "No regulatory mandate — system step",
    icon: "id",
  });

  // allocation: in-house (claims handler is the surveyor) at assignment; IPS when appointed
  const alloc = ips ? appointed : assigned;
  const allocDue = registered ? { kind: "due" } : null;
  add({
    key: "allocate",
    when: alloc,
    stage: ips ? "Surveyor appointment (IPS)" : "Allocation for survey",
    lifecycle: 0,
    team: ips ? `Claims handler → ${sv ? sv.name : "external surveyor"}` : `System → Claims handler (in-house surveyor)`,
    act: alloc
      ? ips
        ? `External surveyor (IPS) appointed · ${appointed.detail}`
        : `Allocated to ${handler}, claims handler and licensed surveyor${sv?.licence ? ` (${sv.licence})` : ""}`
      : ips
        ? "Appoint an external surveyor (IPS) – CAT / theft / total loss"
        : "Allocated when the claim is registered",
    sla: "Within 24 hours of the claim report",
    chip:
      alloc && registered
        ? (() => {
            const h = Math.max(0, Math.round((at(alloc.date, alloc.time) - at(registered.date, registered.time)) / 3600000));
            return h <= 24 ? { kind: "met", text: `Met · ${h} h` } : { kind: "breach", text: `Breached · ${h} h` };
          })()
        : allocDue && registered
          ? slaPending(addDays(registered.date, 1), today)
          : { kind: "none" },
    irdai: true,
    reg: IRDAI_GI_2024,
    icon: "user",
  });

  const allocDate = alloc?.date || registered?.date;
  add({
    key: "survey",
    when: surveyed,
    stage: "Survey / inspection report",
    lifecycle: 1,
    team: ips ? `${sv?.name || "External surveyor"} (IPS)` : "Claims handler (in-house surveyor)",
    act: surveyed ? `Survey report submitted · ${surveyed.detail}` : `Inspect the vehicle${c.garage ? ` at ${c.garage.name.split(",")[0]}` : ""} and submit the survey report`,
    sla: "Survey report within 15 days of allocation",
    chip: surveyed && allocDate ? slaDone(days(allocDate, surveyed.date), 15, "day") : allocDate && registered ? slaPending(addDays(allocDate, 15), today) : { kind: "none" },
    irdai: true,
    reg: `${IRDAI_GI_2024}${(c.survey.estimate ?? c.reserve) < 50000 ? " · loss under ₹50,000: licensed surveyor not mandatory (Master Circular on Protection of Policyholders' Interests, 2024)" : ""}`,
    icon: "camera",
  });

  add({
    key: "assess",
    when: revised,
    stage: "Assessment & reserve",
    lifecycle: 2,
    team: "Claims handler",
    act: revised
      ? `Loss assessed · reserve revised to ${revised.detail}${c.survey.assessed != null ? ` · assessed ₹${c.survey.assessed.toLocaleString("en-IN")}` : ""}`
      : "Assess the loss (parts, labour, depreciation, salvage, deductible) and revise the reserve",
    sla: "2 working days after the survey report",
    icon: "calc",
  });

  if (sentApproval) {
    add({
      key: "approval",
      when: sentApproval,
      stage: "Approval",
      lifecycle: 3,
      team: "Claims handler → Claims manager (above authority limit)",
      act: `Sent for approval · ${sentApproval.detail}`,
      sla: "2 working days",
      icon: "shield",
    });
  }

  add({
    key: "decision",
    when: decided,
    stage: "Decision & repair authorisation",
    lifecycle: 3,
    team: sentApproval ? "Claims manager → Garage, insured" : "Claims handler (within authority limit)",
    act: decided ? `${decided.event} · ${decided.detail}` : "Approve (delivery order to the garage), partly approve or repudiate with reasons",
    sla: "Decision within 7 days of the survey report",
    chip: decided && surveyed ? slaDone(days(surveyed.date, decided.date), 7, "day") : surveyed ? slaPending(addDays(surveyed.date, 7), today) : { kind: "none" },
    irdai: true,
    reg: IRDAI_GI_2024,
    icon: "gavel",
  });

  add({
    key: "payment",
    when: payReq,
    stage: "Payment initiation",
    lifecycle: 4,
    team: "Claims handler → Finance",
    act: payReq ? `Payment requested · ${payReq.detail}` : "After repair: final invoice, delivery note and payee bank details, then the payment request",
    sla: "Same working day as the final invoice",
    reg: "No regulatory mandate — internal recommendation",
    icon: "send",
  });

  add({
    key: "closure",
    when: paid,
    stage: "Payment & closure",
    lifecycle: 4,
    team: "Finance",
    act: paid ? `${paid.event} · ${paid.detail}` : "Bank credit (UTR) confirmed – the claim closes automatically",
    sla: "T+1 business day after the payment request",
    chip: paid && payReq ? slaDone(days(payReq.date, paid.date), 1, "day") : payReq ? slaPending(addDays(payReq.date, 1), today) : { kind: "none" },
    reg: "No regulatory mandate — standard NEFT batch cycle",
    icon: "lock",
  });

  // red flags raised by the rules engine – shown where they happened
  all("Flag raised").forEach((f, i) =>
    steps.push({ key: `flag-${i}`, when: f, stage: f.event.replace("Flag raised: ", "Red flag – "), lifecycle: 1, team: "System (rules) → Claims handler", act: f.detail, sla: "Review before the decision", chip: { kind: "none" }, irdai: false, reg: INTERNAL, icon: "flag", flag: true })
  );

  // order: dated steps by date/time, undated (not reached yet) after them in process order
  const order = steps.map((s, i) => ({ s, i }));
  order.sort((a, b) => {
    if (a.s.when && b.s.when) return `${a.s.when.date} ${a.s.when.time}`.localeCompare(`${b.s.when.date} ${b.s.when.time}`) || a.i - b.i;
    if (a.s.when) return -1;
    if (b.s.when) return 1;
    return a.i - b.i;
  });
  const out = order.map((o) => o.s);
  const closed = !!paid;
  let currentGiven = false;
  return out.map((s) => {
    if (s.when) return { ...s, state: "done" };
    if (!closed && !currentGiven && !s.flag) {
      currentGiven = true;
      return { ...s, state: "current" };
    }
    return { ...s, state: "todo" };
  });
}