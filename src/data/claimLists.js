// src/data/claimLists.js
// Open vs closed claims for the Claims Handler, combining the demo data with what happened in this session:
//   • a queue claim closed in Claim 360 (withdrawn, settled, repudiated, closed without payment, NBNR closed)
//     leaves the open queue and shows under Closed
//   • a closed claim reopened with the manager's approval goes back to the open queue
// Used by My Work Queue (Open / Closed), the handler dashboard and the manager's team counts.

import { WORK_QUEUE, summariseQueue } from "./odHandlerMock";
import { CLOSED_CLAIMS } from "./odClosedClaims";
import { readStatusAll } from "./claimStatus";
import { readWorkAll } from "./claimWork";

export const CLOSURE_TYPES = ["Paid", "Withdrawn", "Repudiated", "Closed without payment", "NBNR closed"];

// claim status state ↔ closure type
const STATE_TO_TYPE = { SETTLED: "Paid", WITHDRAWN: "Withdrawn", REPUDIATED: "Repudiated", CLOSED: "Closed without payment", NBNR_CLOSED: "NBNR closed" };
export const TYPE_TO_STATE = Object.fromEntries(Object.entries(STATE_TO_TYPE).map(([k, v]) => [v, k]));
const CLOSED_STATES = Object.keys(STATE_TO_TYPE);

export const isClosedState = (s) => CLOSED_STATES.includes(s);

/** claim no → session status record (closed, reopened, pending…) */
const statusOf = (all, no) => all[no] || null;

/** a claim counts as closed when its session state is closed, or it is a demo closed claim not reopened */
function closedNow(row, rec) {
  if (rec) {
    if (isClosedState(rec.state)) return true;
    if (rec.state === "REOPEN_PENDING") return true; // still closed until the manager approves
    if (row.closure) return false; // reopened (OPEN) or other open state
    return false;
  }
  return !!row.closure;
}

/** open claims assigned to Karthik, in the queue's order */
export function openQueue() {
  const all = readStatusAll();
  return [...WORK_QUEUE, ...CLOSED_CLAIMS].filter((r) => !closedNow(r, statusOf(all, r.claimNo)));
}

/** closed claims, most recently closed first */
export function closedList() {
  const all = readStatusAll();
  const work = readWorkAll();
  return [...WORK_QUEUE, ...CLOSED_CLAIMS]
    .filter((r) => closedNow(r, statusOf(all, r.claimNo)))
    .map((r) => {
      const rec = statusOf(all, r.claimNo);
      const state = rec?.state === "REOPEN_PENDING" ? rec.prevState : rec?.state;
      if (rec && isClosedState(state)) {
        const pay = work[r.claimNo]?.settlement?.payment;
        return {
          ...r,
          closureType: STATE_TO_TYPE[state],
          closedOn: rec.state === "REOPEN_PENDING" ? rec.prevAt || r.closure?.closedOn || rec.at : rec.at,
          paid: state === "SETTLED" ? pay?.amount ?? 0 : 0,
          closeReason: rec.prevReason && rec.state === "REOPEN_PENDING" ? rec.prevReason : rec.reason,
          reopenPending: rec.state === "REOPEN_PENDING",
          session: true,
        };
      }
      return {
        ...r,
        closureType: r.closure.type,
        closedOn: r.closure.closedOn,
        paid: r.closure.paid,
        closeReason: r.closure.reason,
        reopenPending: rec?.state === "REOPEN_PENDING",
      };
    })
    .sort((a, b) => (a.closedOn < b.closedOn ? 1 : -1));
}

/** claim nos closed in this session – the manager's team counts leave these out */
export function closedInSession() {
  const all = readStatusAll();
  return new Set(Object.entries(all).filter(([, r]) => isClosedState(r.state) || r.state === "REOPEN_PENDING").map(([no]) => no));
}

/** live dashboard / badge counts: open-claim figures plus closed and all-claims totals */
export function handlerSummary() {
  const closed = closedList();
  const open = summariseQueue(openQueue());
  return {
    ...open,
    closed: closed.length,
    closedPaid: closed.reduce((t, r) => t + (r.paid || 0), 0),
    closedByType: CLOSURE_TYPES.map((type) => ({ type, count: closed.filter((r) => r.closureType === type).length })),
    all: open.open + closed.length,
  };
}