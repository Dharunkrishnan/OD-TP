// src/data/claimStatus.js
// Claim status after a handler action in Claim 360 (Phase 2A) – kept for this browser session.
// Used by Claim 360 and ClaimStatusActions.jsx. Replace with the claim status from the claims API.

import { useState } from "react";

const KEY = "smartclaims-claim-status";

// Stages before assessment – withdrawal is allowed only here (catalogue 21)
export const BEFORE_ASSESSMENT = ["NBNR", "Registered", "Survey pending"];

function readAll() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/** status record of one claim: { state, stage?, reason, remarks, reviewDate?, at, events: [...] } */
export function useClaimStatus(claimNo) {
  const [rec, setRec] = useState(() => readAll()[claimNo] || null);
  function save(next) {
    const all = readAll();
    if (next) all[claimNo] = next;
    else delete all[claimNo];
    try {
      sessionStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
    setRec(next);
  }
  return [rec, save];
}


/** what the claim now is, for the header (stage chip) and which actions are open */
export function effectiveState(stage, rec) {
  const s = rec?.state || "OPEN";
  return {
    state: s,
    stage: s === "NBNR_CONVERTED" ? "Registered" : stage,
    closed: ["WITHDRAWN", "CLOSED", "NBNR_CLOSED"].includes(s),
    waiting: ["REPUDIATION_PENDING", "REOPEN_PENDING"].includes(s),
    hold: s === "HOLD",
  };
}