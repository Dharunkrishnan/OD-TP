// src/data/searchIndex.js
// Search helpers used by the search-icon panels (header + My Work Queue).
// Mock data today; in production these become calls to the Claims search API.

import { WORK_QUEUE } from "./odHandlerMock";
import { searchPolicy } from "./odPolicyMock";

const norm = (s) => String(s || "").toUpperCase().replace(/[\s\-/]/g, "");

/** Claims matching claim no, vehicle no or insured name. Best matches first. */
export function searchClaims(q, limit = 6) {
  const t = norm(q);
  if (!t) return [];
  const words = String(q).toLowerCase().trim();
  return WORK_QUEUE.map((r) => {
    let score = 0;
    if (norm(r.claimNo) === t || norm(r.regNo) === t) score = 100;
    else if (norm(r.claimNo).includes(t) || norm(r.regNo).includes(t)) score = 60;
    else if (r.insured.toLowerCase().includes(words)) score = 50;
    else if (r.vehicle.toLowerCase().includes(words)) score = 30;
    return { r, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.ageDays - b.r.ageDays)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Claims to suggest before anything is typed: due today, breached first. */
export function dueTodayClaims(limit = 5) {
  const rank = { breach: 0, risk: 1, ok: 2 };
  return WORK_QUEUE.filter((r) => r.dueToday)
    .sort((a, b) => rank[a.sla.status] - rank[b.sla.status])
    .slice(0, limit);
}

/** Policies matching the text (reuses the Claim Intimation policy search). */
export function searchPolicies(q, limit = 4) {
  if (!String(q).trim()) return [];
  return searchPolicy(q).slice(0, limit).map((x) => x.policy);
}

export const slaTone = (s) => (s === "breach" ? "red" : s === "risk" ? "amber" : "teal");