// src/data/claimSurvey.js
// Surveyor appointment for an OD claim – catalogue 35 (manual appointment / override by the Claims Handler)
// and the timelines monitored under catalogue 168.
//
// Business rules used here (IRDAI Master Circular on Protection of Policyholders' Interests, 2024):
//   • Surveyor appointed within 24 hours of claim intimation.
//   • Survey report due within 15 days of appointment.
//   • Motor loss above ₹50,000 → survey by a licensed surveyor & loss assessor (Insurance Act s.64UM).
//     At or below ₹50,000 a licensed surveyor is not mandatory → video / app-based survey is allowed.
//
// Demo: the panel is static; the appointment is kept for this browser session (sessionStorage).
// Replace with: GET /surveyors?city=&dept=MOTOR · POST /od/claims/:claimNo/survey-appointment

import { useState } from "react";

export const LICENSED_LIMIT = 50000;
export const APPOINT_WITHIN_HOURS = 24;
export const REPORT_WITHIN_DAYS = 15;

/* ---------------- surveyor panel (Chennai, Motor department) ---------------- */
// kind: "panel" = external licensed surveyor · "inhouse" = licensed surveyor on the insurer's rolls · "video" = video survey desk
export const SURVEYOR_PANEL = [
  { id: "SV01", name: "Er. S. Balasubramanian", kind: "panel", licence: "IRDAI/SLA/14982", licenceTill: "2028-06-30", areas: ["Guindy", "Velachery", "Thoraipakkam", "OMR"], open: 6, capacity: 10, lastDays: 2, avgTat: 2.1, phone: "98401XXXXX" },
  { id: "SV02", name: "Er. M. Karpagam", kind: "panel", licence: "IRDAI/SLA/16247", licenceTill: "2027-09-30", areas: ["Anna Salai", "Guindy", "T. Nagar"], open: 4, capacity: 10, lastDays: 3, avgTat: 1.8, phone: "98843XXXXX" },
  { id: "SV03", name: "Er. R. Dinesh Kumar", kind: "panel", licence: "IRDAI/SLA/12730", licenceTill: "2027-03-31", areas: ["Ambattur", "Porur", "Anna Nagar"], open: 9, capacity: 10, lastDays: 1, avgTat: 2.6, phone: "94440XXXXX" },
  { id: "SV04", name: "Er. V. Lakshmi Narayanan", kind: "panel", licence: "IRDAI/SLA/18815", licenceTill: "2029-01-31", areas: ["Tambaram", "OMR", "Thoraipakkam", "Sholinganallur"], open: 3, capacity: 10, lastDays: 4, avgTat: 1.9, speciality: "EV & luxury cars", phone: "90030XXXXX" },
  { id: "SV05", name: "Er. A. Mohamed Rafiq", kind: "panel", licence: "IRDAI/SLA/11094", licenceTill: "2026-10-31", areas: ["Velachery", "OMR"], open: 2, capacity: 10, lastDays: 9, avgTat: 2.4, phone: "98410XXXXX" },
  { id: "SV06", name: "Er. K. Saravanan", kind: "panel", licence: "IRDAI/SLA/15563", licenceTill: "2028-02-29", areas: ["Porur", "Ambattur"], open: 5, capacity: 10, lastDays: 6, avgTat: 2.2, onLeaveTill: "2026-11-14", phone: "97910XXXXX" },
  { id: "SV07", name: "R. Senthil Kumar", kind: "inhouse", licence: "SLA-87654", licenceTill: "2028-12-31", areas: ["Guindy", "Anna Salai", "Velachery", "Ambattur", "Porur", "OMR"], open: 7, capacity: 12, lastDays: 1, avgTat: 1.6, phone: "Ext. 4412" },
  { id: "SV08", name: "M. Farook", kind: "inhouse", licence: "SLA-91230", licenceTill: "2027-12-31", areas: ["Tambaram", "Thoraipakkam", "OMR", "Velachery"], open: 5, capacity: 12, lastDays: 2, avgTat: 1.7, phone: "Ext. 4418" },
  { id: "SV09", name: "Video survey desk – Chennai", kind: "video", licence: null, licenceTill: null, areas: ["All"], open: 11, capacity: 30, lastDays: 0, avgTat: 0.5, phone: "Ext. 4400" },
];

export const KIND_LABEL = { panel: "Licensed surveyor (panel)", inhouse: "Licensed surveyor (in-house)", video: "Video survey" };

export const OVERRIDE_REASONS = [
  "Insured / garage asked for another surveyor",
  "Specialist needed (EV, luxury, heavy damage)",
  "Suggested surveyor cannot visit in time",
  "Conflict of interest",
  "Other",
];
export const CHANGE_REASONS = ["Surveyor did not visit on the agreed date", "Surveyor unavailable / on leave", "Insured complaint about the surveyor", "Conflict of interest", "Other"];

const DAY = 86400000;
export const isoToday = () => new Date().toISOString().slice(0, 10);
export const addDaysIso = (iso, d) => {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

/** Why a surveyor cannot take this claim (null = eligible) */
export function blockReason(s, { amount, mode, today = isoToday() }) {
  if (mode === "video") return s.kind === "video" ? null : "Physical surveyor";
  if (s.kind === "video") return "Video desk";
  if (s.licenceTill && s.licenceTill < today) return "Licence expired";
  if (s.onLeaveTill && s.onLeaveTill >= today) return `On leave till ${new Date(s.onLeaveTill + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  if (s.open >= s.capacity) return "No capacity";
  if (amount > LICENSED_LIMIT && !s.licence) return "Not licensed";
  return null;
}

/** Ranked list for a claim: area match → lowest workload → longest since last assignment (rotation) */
export function rankSurveyors({ location, amount, mode, excludeId }) {
  const today = isoToday();
  const area = (s) => s.areas.includes("All") || s.areas.some((a) => location?.includes(a));
  const rows = SURVEYOR_PANEL.filter((s) => (mode === "video" ? s.kind === "video" : s.kind !== "video")).map((s) => ({
    ...s,
    areaMatch: area(s),
    load: s.open / s.capacity,
    blocked: s.id === excludeId ? "Current surveyor" : blockReason(s, { amount, mode, today }),
  }));
  rows.sort((a, b) => (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) || (b.areaMatch ? 1 : 0) - (a.areaMatch ? 1 : 0) || a.load - b.load || b.lastDays - a.lastDays);
  return rows;
}

/** Plain-language reason for the suggested pick */
export function suggestionWhy(s, location) {
  if (s.kind === "video") return "Loss within ₹50,000 – video survey is the fastest route";
  const parts = [];
  if (s.areaMatch) parts.push(`covers ${s.areas.find((a) => location?.includes(a))}`);
  parts.push(`${s.open} of ${s.capacity} jobs open`);
  parts.push(`last assigned ${s.lastDays} d ago`);
  return parts.join(" · ");
}

/** Hours from intimation to appointment vs the 24-hour rule (intimation date only → counted from 09:00) */
export function appointmentTiming(intimatedOn, at = new Date()) {
  if (!intimatedOn) return null;
  const start = new Date(intimatedOn + "T09:00:00");
  const hours = Math.max(0, Math.round((at - start) / 3600000));
  return { hours, late: hours > APPOINT_WITHIN_HOURS };
}

/* ---------------- per-claim appointment (session) ---------------- */
const KEY = "smartclaims-claim-survey";
function readAll() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/** [record, save] – record: { surveyor, mode, visitDate, location, at, reportDue, overrideReason, events[] } */
export function useClaimSurvey(claimNo) {
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

/** Calendar days from today to the due date (0 = due today, negative = overdue) */
export const daysLeft = (iso) => Math.round((new Date(iso + "T00:00:00Z") - new Date(isoToday() + "T00:00:00Z")) / DAY);