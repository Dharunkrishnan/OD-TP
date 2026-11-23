// src/data/claimSearch.js
// Universal Claim Search (catalogue 178) – open and closed claims.
//   Basic    : claim number, policy number, vehicle number, mobile number
//   Advanced : customer name, garage name, surveyor type, surveyor name, status, loss type, registered dates
// Mock data today; in production this becomes the Claims search API (same criteria as query params).

import { openQueue, closedList } from "./claimLists";
import { getClaimDetail } from "./odClaimDetail";
import { SURVEYOR_PANEL } from "./claimSurvey";

const SURVEY_KEY = "smartclaims-claim-survey"; // surveyor appointed in this session (Claim 360)
const norm = (s) => String(s || "").toUpperCase().replace(/[\s\-/.]/g, "");

export const BASIC_FIELDS = [
  { key: "claim", label: "Claim number", placeholder: "Full or part of claim no", hint: "Full or part of the number" },
  { key: "policy", label: "Policy number", placeholder: "Full or part of policy no", hint: "Full or part of the number" },
  { key: "vehicle", label: "Vehicle number", placeholder: "Vehicle no, spaces optional", hint: "With or without spaces" },
  { key: "mobile", label: "Mobile number", placeholder: "Insured's mobile", hint: "Insured's registered mobile", inputMode: "numeric" },
];
export const ADVANCED_KEYS = ["name", "garage", "svType", "svName", "status", "loss", "from", "to"];
export const SEARCH_KEYS = [...BASIC_FIELDS.map((f) => f.key), ...ADVANCED_KEYS];

const SURVEYOR_TYPE = { panel: "Panel surveyor (IPS)", inhouse: "In-house surveyor", video: "Video survey" };

function readSurveys() {
  try {
    return JSON.parse(sessionStorage.getItem(SURVEY_KEY) || "{}");
  } catch {
    return {};
  }
}

/** One searchable row per claim, open and closed, with policy, mobile, garage and surveyor */
export function searchIndex() {
  const surveys = readSurveys();
  const rows = [...openQueue().map((r) => ({ ...r, status: "Open" })), ...closedList().map((r) => ({ ...r, status: "Closed" }))];
  return rows.map((r) => {
    const d = getClaimDetail(r.claimNo) || {};
    const session = surveys[r.claimNo]?.surveyor;
    const panel = session && SURVEYOR_PANEL.find((s) => s.id === session.id || s.name === session.name);
    const sv = d.survey?.surveyor;
    const svName = session?.name || sv?.name || "";
    const svType0 = panel ? SURVEYOR_TYPE[panel.kind] : sv ? sv.type || "In-house surveyor" : "";
    const svType = svName ? svType0 : "";
    return {
      ...r,
      policyNo: d.policy?.policyNo || "",
      mobile: d.contact?.mobile || "",
      mobileFull: d.contact?.mobileFull || "",
      garage: d.garage?.name || "",
      svName,
      svType,
      statusText: r.status === "Closed" ? `Closed – ${r.closureType}` : r.stage,
    };
  });
}

/** Options for the advanced-search drop-downs, from the data itself (no empty options) */
export function searchOptions(index) {
  const uniq = (fn) => [...new Set(index.map(fn).filter(Boolean))].sort();
  return {
    garage: uniq((r) => r.garage),
    svType: uniq((r) => r.svType),
    svName: uniq((r) => r.svName),
    loss: uniq((r) => r.lossType),
  };
}

export const hasCriteria = (c) => SEARCH_KEYS.some((k) => String(c[k] || "").trim());

/** Claims matching every filled criterion (number fields match full or part, ignoring spaces and symbols) */
export function runSearch(index, c) {
  const has = (k) => String(c[k] || "").trim();
  const contains = (value, q) => norm(value).includes(norm(q));
  return index
    .filter(
      (r) =>
        (!has("claim") || contains(r.claimNo, c.claim)) &&
        (!has("policy") || contains(r.policyNo, c.policy)) &&
        (!has("vehicle") || contains(r.regNo, c.vehicle)) &&
        (!has("mobile") || String(r.mobileFull).includes(String(c.mobile).replace(/\D/g, ""))) &&
        (!has("name") || r.insured.toLowerCase().includes(c.name.trim().toLowerCase())) &&
        (!has("garage") || r.garage === c.garage) &&
        (!has("svType") || r.svType === c.svType) &&
        (!has("svName") || r.svName === c.svName) &&
        (!has("status") || r.status === c.status) &&
        (!has("loss") || r.lossType === c.loss) &&
        (!has("from") || r.regDate >= c.from) &&
        (!has("to") || r.regDate <= c.to)
    )
    .sort((a, b) => (a.status === b.status ? (a.regDate < b.regDate ? 1 : -1) : a.status === "Open" ? -1 : 1));
}