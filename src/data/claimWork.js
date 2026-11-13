// src/data/claimWork.js
// Everyday work on an OD claim in Claim 360 (Phase 2B) – kept for this browser session (sessionStorage).
//   19  Reserve revision with reason – above the handler's ₹1 L authority an increase goes to the Claims Manager
//   94  Reserve vs estimate / assessment variance alert (above 20 %)
//   145 Query management – insured, garage, surveyor; due date, reminders, close with reply
//   153 Document upload with document type
//   154 Document verification – Verified / Rejected (reason) per document
//   173 Notes with visibility – claims team, manager only, or shared with external parties
// Replace with: POST /od/claims/:claimNo/{reserve|queries|documents|notes}

import { useState } from "react";
import { getClaimDetail } from "./odClaimDetail";

export const HANDLER_RESERVE_LIMIT = 100000; // ₹1 L – same as the approval authority used in Approvals
export const VARIANCE_PCT = 20;
export const HANDLER = "Karthik Subramanian";
export const MANAGER = "Priya Raghavan";
export const DATA_EVENT = "smartclaims:manager-data"; // header badges / bell listen to this

export const RESERVE_REASONS = [
  "Survey / assessment received",
  "Garage estimate revised",
  "Additional damage found",
  "Total loss suspected",
  "Salvage or recovery expected",
  "Other",
];
export const QUERY_SUBJECTS = [
  "Clarification on how the accident happened",
  "Additional photographs of the damage",
  "Revised / itemised estimate",
  "Survey report clarification",
  "Driver / licence details",
  "Other",
];
export const DOC_REJECT_REASONS = ["Not readable", "Wrong document", "Expired / not valid", "Name or vehicle does not match", "Incomplete – pages missing"];
export const NOTE_VISIBILITY = [
  { key: "team", label: "Claims team", hint: "Handlers, managers and approvers" },
  { key: "manager", label: "Manager only", hint: "You and the Claims Manager" },
  { key: "shared", label: "Shared", hint: "Also visible to the surveyor and garage" },
];
export const UPLOAD_MAX_MB = 5;

const KEY = "smartclaims-claim-work";
const DAY = 86400000;

export const isoToday = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, d) => new Date(new Date(iso + "T00:00:00Z").getTime() + d * DAY).toISOString().slice(0, 10);
export const daysFromToday = (iso) => Math.round((new Date(iso + "T00:00:00Z") - new Date(isoToday() + "T00:00:00Z")) / DAY);
export const nowStamp = () => {
  const d = new Date();
  return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
};
export const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

export function readWorkAll() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
export function writeWork(claimNo, rec) {
  const all = readWorkAll();
  all[claimNo] = rec;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DATA_EVENT));
}

export const EMPTY_WORK = { revisions: [], reserveRequest: null, queries: [], docs: {}, events: [] };

/** [record, update] – update(fn) receives the current record and returns the next one */
export function useClaimWork(claimNo) {
  const [rec, setRec] = useState(() => ({ ...EMPTY_WORK, ...(readWorkAll()[claimNo] || {}) }));
  function update(fn) {
    setRec((cur) => {
      const next = fn(cur);
      writeWork(claimNo, next);
      return next;
    });
  }
  return [rec, update];
}

/** Reserve vs assessed (or estimate) – null when there is nothing to compare */
export function reserveVariance(reserve, survey) {
  const basis = survey?.assessed ?? survey?.estimate;
  if (!basis || !reserve) return null;
  const pct = Math.round((Math.abs(reserve - basis) / basis) * 100);
  return { basis, basisLabel: survey.assessed != null ? "assessed loss" : "garage estimate", pct, over: reserve > basis, alert: pct > VARIANCE_PCT };
}

/* ---------- quick actions from My Work Queue (no need to open the claim) ---------- */
export const CALL_OUTCOMES = ["Spoke to the insured", "Not reachable", "Asked to call back", "Wrong number", "Spoke to the garage"];

/** change one claim's work record outside Claim 360 and add a timeline event */
export function logWorkFor(claimNo, event, detail, change = (w) => w, extra = {}) {
  const w = { ...EMPTY_WORK, ...(readWorkAll()[claimNo] || {}) };
  const next = { ...change(w), events: [{ ...nowStamp(), event, by: HANDLER, detail, ...extra }, ...w.events] };
  writeWork(claimNo, next);
}

/** documents still pending (or rejected) on a claim, including this session's changes */
export function pendingDocsFor(claimNo) {
  const c = getClaimDetail(claimNo);
  if (!c) return [];
  const docs = readWorkAll()[claimNo]?.docs || {};
  return c.documents.map((d) => ({ ...d, ...(docs[d.name] || {}) })).filter((d) => d.status === "Pending" || d.status === "Rejected");
}