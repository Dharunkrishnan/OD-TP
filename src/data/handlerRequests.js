// src/data/handlerRequests.js
// Requests a Claims Handler sends from Claim 360 that wait for the Claims Manager (Priya) in Approvals:
//   REPUDIATION – Close without payment → repudiation (catalogue 131)
//   REOPEN      – Reopen a closed claim (catalogue 134)
//   RESERVE     – Reserve increase above the handler's ₹1 L authority (catalogue 19)
// Built from the claim status and claim work stores (sessionStorage) – no copy is kept.
// Replace with: GET /od/manager/handler-requests · POST /od/manager/handler-requests/:id/decision

import { getClaimDetail } from "./odClaimDetail";
import { readStatusAll, writeStatus } from "./claimStatus";
import { readWorkAll, writeWork, EMPTY_WORK, nowStamp, MANAGER, HANDLER } from "./claimWork";

const BY = `${MANAGER} (Claims Manager)`;

export const REQUEST_KIND = {
  REPUDIATION: { label: "Repudiation", tone: "bg-red-50 text-red-800 ring-red-200" },
  REOPEN: { label: "Reopen", tone: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  RESERVE: { label: "Reserve increase", tone: "bg-amber-50 text-amber-900 ring-amber-200" },
};

const CLOSED_LABEL = { WITHDRAWN: "Withdrawn", CLOSED: "Closed without payment", NBNR_CLOSED: "NBNR closed", REPUDIATED: "Repudiated" };

/** pending requests, oldest first */
export function listHandlerRequests() {
  const out = [];
  const status = readStatusAll();
  Object.entries(status).forEach(([claimNo, r]) => {
    if (r.state !== "REPUDIATION_PENDING" && r.state !== "REOPEN_PENDING") return;
    const c = getClaimDetail(claimNo);
    if (!c) return;
    const kind = r.state === "REPUDIATION_PENDING" ? "REPUDIATION" : "REOPEN";
    out.push({
      id: `${kind}-${claimNo}`,
      kind,
      claimNo,
      insured: c.insured,
      regNo: c.regNo,
      vehicle: c.vehicle.makeModel,
      lossType: c.lossType,
      reserve: c.reserve,
      handler: HANDLER,
      reason: r.reason,
      remarks: r.remarks,
      raisedOn: r.at,
      closedAs: kind === "REOPEN" ? CLOSED_LABEL[r.prevState] || "Closed" : null,
      estimate: c.survey?.estimate ?? null,
      assessed: c.survey?.assessed ?? null,
    });
  });
  const work = readWorkAll();
  Object.entries(work).forEach(([claimNo, w]) => {
    const q = w.reserveRequest;
    if (!q || q.status !== "PENDING") return;
    const c = getClaimDetail(claimNo);
    if (!c) return;
    out.push({
      id: q.id,
      kind: "RESERVE",
      claimNo,
      insured: c.insured,
      regNo: c.regNo,
      vehicle: c.vehicle.makeModel,
      lossType: c.lossType,
      reserve: q.from,
      to: q.to,
      handler: HANDLER,
      reason: q.reason,
      remarks: q.remarks,
      raisedOn: q.at,
      estimate: c.survey?.estimate ?? null,
      assessed: c.survey?.assessed ?? null,
    });
  });
  return out.sort((a, b) => (a.raisedOn > b.raisedOn ? 1 : -1));
}

export const pendingRequestCount = () => listHandlerRequests().length;

/** Claims Manager approves or rejects; the claim in Claim 360 shows the outcome */
export function decideHandlerRequest(req, approve, remarks) {
  const stamp = nowStamp();
  const ev = (event, detail) => ({ ...stamp, event, by: BY, detail });
  if (req.kind === "RESERVE") {
    const w = { ...EMPTY_WORK, ...(readWorkAll()[req.claimNo] || {}) };
    const q = w.reserveRequest;
    const decided = { ...q, status: approve ? "APPROVED" : "REJECTED", decidedAt: stamp.date, decisionRemarks: remarks };
    const next = {
      ...w,
      reserveRequest: decided,
      revisions: approve
        ? [...w.revisions, { date: stamp.date, type: "Revised", amount: q.to, by: `${HANDLER} · approved by ${MANAGER}`, reason: q.reason }]
        : w.revisions,
      events: [
        ev(approve ? "Reserve increase approved" : "Reserve increase not approved", `₹${q.from.toLocaleString("en-IN")} → ₹${q.to.toLocaleString("en-IN")}${remarks ? ` – ${remarks}` : ""}`),
        ...w.events,
      ],
    };
    writeWork(req.claimNo, next);
    return;
  }
  const r = readStatusAll()[req.claimNo];
  if (!r) return;
  let next;
  if (req.kind === "REPUDIATION") {
    next = approve
      ? { ...r, state: "REPUDIATED", decidedBy: MANAGER, at: stamp.date, events: [ev("Repudiation approved", `${r.reason}${remarks ? ` – ${remarks}` : ""}. Handler to issue the repudiation letter quoting the policy clause.`), ...r.events] }
      : { state: r.prevState && r.prevState !== "REPUDIATION_PENDING" ? r.prevState : "OPEN", at: stamp.date, notice: { title: `Repudiation not approved by ${MANAGER}`, text: remarks || "Continue processing the claim." }, events: [ev("Repudiation not approved", remarks || "Claim back with the handler."), ...r.events] };
  } else {
    next = approve
      ? { state: "OPEN", at: stamp.date, notice: { title: `Reopen approved by ${MANAGER}`, text: `${r.reason} – reserve re-created; claim back in your queue.` }, events: [ev("Claim reopened", `${r.reason}${remarks ? ` – ${remarks}` : ""}. Reserve re-created.`), ...r.events] }
      : { state: r.prevState || "CLOSED", reason: r.prevReason || r.reason, remarks: remarks || "", at: stamp.date, events: [ev("Reopen not approved", remarks || "Claim stays closed."), ...r.events] };
  }
  writeStatus(req.claimNo, next);
}