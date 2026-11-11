// src/components/AppointSurveyorDialog.jsx
// Appoint / change surveyor on an OD claim – Claims Handler, Claim 360 (catalogue 35, timelines under 168).
//   • System suggests a surveyor: area match → lowest workload → rotation (longest since last job)
//   • Handler may pick another eligible surveyor – a reason is mandatory for the override
//   • Loss above ₹50,000 → licensed surveyor only; within ₹50,000 → video survey allowed
//   • Late against the 24-hour appointment rule → delay reason recorded
//   • Change of surveyor allowed until the survey is done, with a reason

import { useEffect, useRef, useState } from "react";
import { X, Star, Video, UserCheck, MapPin, AlertTriangle, CalendarDays, ShieldCheck } from "lucide-react";
import {
  LICENSED_LIMIT,
  REPORT_WITHIN_DAYS,
  APPOINT_WITHIN_HOURS,
  KIND_LABEL,
  OVERRIDE_REASONS,
  CHANGE_REASONS,
  rankSurveyors,
  suggestionWhy,
  appointmentTiming,
  isoToday,
  addDaysIso,
} from "../data/claimSurvey";

const HANDLER = "Karthik Subramanian";
const DELAY_REASONS = ["Claim registered late (NBNR)", "Vehicle not available for survey", "Insured not reachable", "Surveyor not available", "Other"];
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const nowStamp = () => {
  const d = new Date();
  return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
};
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function Label({ children, req }) {
  return (
    <span className="mb-1 block text-[12px] font-medium text-slate-700">
      {children} {req && <span className="text-red-600">*</span>}
    </span>
  );
}
function Err({ msg }) {
  return msg ? <span className="mt-1 block text-[11.5px] text-red-700">{msg}</span> : null;
}

export default function AppointSurveyorDialog({ claim, current, wasNbnr, onCancel, onDone }) {
  const changing = !!current;
  const amount = claim.survey?.estimate ?? claim.reserve;
  const location = current?.location || claim.loss?.vehicleLocation || "";
  const videoAllowed = amount <= LICENSED_LIMIT;

  const [mode, setMode] = useState(changing ? current.mode : "physical");
  const [pickId, setPickId] = useState(null); // null = suggested
  const [overrideReason, setOverrideReason] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [delayReason, setDelayReason] = useState(wasNbnr ? DELAY_REASONS[0] : "");
  const [place, setPlace] = useState(location);
  const [[today, maxVisit]] = useState(() => [isoToday(), addDaysIso(isoToday(), 7)]);
  const [visitDate, setVisitDate] = useState(() => addDaysIso(isoToday(), 1));
  const [notify, setNotify] = useState({ surveyor: true, insured: true, garage: !!claim.garage });
  const [tried, setTried] = useState(false);
  const [timing] = useState(() => (changing ? null : appointmentTiming(claim.loss?.intimatedOn)));
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const ranked = rankSurveyors({ location: place, amount, mode, excludeId: current?.surveyor?.id });
  const suggested = ranked.find((s) => !s.blocked) || null;
  const chosen = ranked.find((s) => s.id === (pickId ?? suggested?.id)) || null;
  const overriding = mode === "physical" && chosen && suggested && chosen.id !== suggested.id;

  const errors = {};
  if (!chosen) errors.pick = "No eligible surveyor – escalate to your Claims Manager.";
  if (overriding && !overrideReason) errors.override = "Give the reason for not taking the suggested surveyor.";
  if (changing && !changeReason) errors.change = "Give the reason for changing the surveyor.";
  if (timing?.late && !delayReason) errors.delay = "Record why the appointment is beyond 24 hours.";
  if (!place.trim()) errors.place = "Enter where the vehicle can be inspected.";
  if (!visitDate || visitDate < today || visitDate > maxVisit) errors.visit = "Choose a date within the next 7 days.";
  const err = (k) => (tried ? errors[k] : null);

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    const stamp = nowStamp();
    const at = stamp.date;
    const who = `${chosen.name}${chosen.licence ? ` (${chosen.licence})` : ""}`;
    const sent = [notify.surveyor && "surveyor", notify.insured && "insured", notify.garage && "garage"].filter(Boolean);
    const detail = [
      mode === "video" ? "Video survey" : KIND_LABEL[chosen.kind],
      `visit ${fmt(visitDate)} at ${place.trim()}`,
      overriding && `override: ${overrideReason}`,
      changing && `reason: ${changeReason}`,
      timing?.late && `appointed ${timing.hours} h after intimation – ${delayReason}`,
      sent.length && `SMS/email to ${sent.join(", ")}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const event = changing
      ? { ...stamp, event: "Surveyor changed", by: HANDLER, detail: `${current.surveyor.name} → ${who} · ${detail}` }
      : { ...stamp, event: "Surveyor appointed", by: HANDLER, detail: `${who} · ${detail}` };
    const next = {
      surveyor: { id: chosen.id, name: chosen.name, licence: chosen.licence || "–", type: KIND_LABEL[chosen.kind], phone: chosen.phone },
      mode,
      visitDate,
      location: place.trim(),
      at,
      reportDue: addDaysIso(at, REPORT_WITHIN_DAYS),
      overrideReason: overriding ? overrideReason : "",
      delayReason: timing?.late ? delayReason : current?.delayReason || "",
      events: [event, ...(current?.events || [])],
    };
    onDone(next, changing ? `Surveyor changed to ${chosen.name}.` : `${chosen.name} appointed. Survey on ${fmt(visitDate)}; report due ${fmt(next.reportDue)}.`);
  }

  const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv-title"
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[580px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="sv-title" className="text-[15px] font-semibold text-[#0B1F3A]">
              {changing ? "Change surveyor" : "Appoint surveyor"}
            </h2>
            <p className="truncate text-[12px] text-slate-500">
              <span className="font-mono">{claim.claimNo}</span> · {claim.insured} · {claim.vehicle?.makeModel} · estimated loss {inr(amount)}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">
          {changing && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
              Current: <b className="font-semibold">{current.surveyor.name}</b> · appointed {fmt(current.at)} · visit {fmt(current.visitDate)}
            </p>
          )}

          {/* rule + mode */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`flex items-center gap-1.5 text-[12px] ${videoAllowed ? "text-slate-600" : "text-slate-800"}`}>
              <ShieldCheck className="h-3.5 w-3.5 flex-none text-teal-700" aria-hidden="true" />
              {videoAllowed ? "Loss within ₹50,000 – video survey allowed" : "Loss above ₹50,000 – licensed surveyor required (Insurance Act s.64UM)"}
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-[12px]" role="radiogroup" aria-label="Survey mode">
              {[
                ["physical", "Physical survey", UserCheck],
                ["video", "Video survey", Video],
              ].map(([k, l, Icon], i) => (
                <button
                  key={k}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  disabled={k === "video" && !videoAllowed}
                  title={k === "video" && !videoAllowed ? "Not allowed above ₹50,000" : undefined}
                  onClick={() => {
                    setMode(k);
                    setPickId(null);
                  }}
                  className={`flex h-7 items-center gap-1 rounded-md px-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${mode === k ? "bg-white text-[#0B1F3A] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* surveyor list – suggested first */}
          <fieldset>
            <legend className="mb-1 text-[12px] font-medium text-slate-700">
              Surveyor <span className="text-red-600">*</span>
            </legend>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {ranked
                .filter((s) => !s.blocked || s.blocked === "Current surveyor")
                .slice(0, mode === "video" ? 1 : 6)
                .map((s) => {
                const isSug = suggested && s.id === suggested.id;
                const isPick = chosen && s.id === chosen.id;
                return (
                  <li key={s.id}>
                    <label
                      className={`flex items-start gap-2.5 px-3 py-2 ${s.blocked ? "cursor-not-allowed bg-slate-50 opacity-60" : "cursor-pointer hover:bg-slate-50"} ${isPick ? "bg-teal-50/60" : ""}`}
                    >
                      <input
                        type="radio"
                        name="surveyor"
                        checked={!!isPick}
                        disabled={!!s.blocked}
                        onChange={() => setPickId(s.id)}
                        className="mt-1 h-4 w-4 accent-teal-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-slate-800">{s.name}</span>
                          {isSug && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-teal-700 px-1.5 py-px text-[10.5px] font-semibold text-white">
                              <Star className="h-3 w-3" aria-hidden="true" /> Suggested
                            </span>
                          )}
                          {s.speciality && <span className="rounded bg-sky-50 px-1.5 py-px text-[10.5px] font-medium text-sky-800">{s.speciality}</span>}
                          {s.blocked && <span className="rounded bg-slate-200 px-1.5 py-px text-[10.5px] font-medium text-slate-700">{s.blocked}</span>}
                        </span>
                        <span className="block text-[11.5px] text-slate-500">
                          {KIND_LABEL[s.kind]}
                          {s.licence && ` · ${s.licence}`}
                          {s.licenceTill && ` · valid till ${fmt(s.licenceTill)}`}
                        </span>
                        {isSug && <span className="block text-[11.5px] text-teal-800">{suggestionWhy(s, place)}</span>}
                      </span>
                      <span className="flex-none text-right text-[11.5px] text-slate-500">
                        <span className="block font-semibold tabular-nums text-slate-700">
                          {s.open}/{s.capacity} jobs
                        </span>
                        <span className="flex items-center justify-end gap-0.5">
                          {s.areaMatch && <MapPin className="h-3 w-3 text-teal-700" aria-label="Covers this area" />}
                          avg {s.avgTat} d
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {mode === "physical" && ranked.some((s) => s.blocked && s.blocked !== "Current surveyor") && (
              <p className="mt-1 text-[11.5px] text-slate-500">
                Not available:{" "}
                {ranked
                  .filter((s) => s.blocked && s.blocked !== "Current surveyor")
                  .map((s) => `${s.name} (${s.blocked.charAt(0).toLowerCase()}${s.blocked.slice(1)})`)
                  .join(" · ")}
              </p>
            )}
            <Err msg={err("pick")} />
          </fieldset>

          {overriding && (
            <label className="block">
              <Label req>Reason for not taking the suggested surveyor</Label>
              <select value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className={inputCls} aria-invalid={!!err("override")}>
                <option value="">Select</option>
                {OVERRIDE_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Err msg={err("override")} />
            </label>
          )}

          {changing && (
            <label className="block">
              <Label req>Reason for change</Label>
              <select value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className={inputCls} aria-invalid={!!err("change")}>
                <option value="">Select</option>
                {CHANGE_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Err msg={err("change")} />
            </label>
          )}

          {/* where & when */}
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <label className="block">
              <Label req>{mode === "video" ? "Vehicle location (for the video call)" : "Inspection location"}</Label>
              <input value={place} onChange={(e) => setPlace(e.target.value)} className={inputCls} aria-invalid={!!err("place")} />
              <Err msg={err("place")} />
            </label>
            <label className="block">
              <Label req>{mode === "video" ? "Video call date" : "Visit date"}</Label>
              <input type="date" value={visitDate} min={today} max={maxVisit} onChange={(e) => setVisitDate(e.target.value)} className={inputCls} aria-invalid={!!err("visit")} />
              <Err msg={err("visit")} />
            </label>
          </div>

          {timing?.late && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-start gap-1.5 text-[12px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                Intimated on {fmt(claim.loss.intimatedOn)} – about {timing.hours} h ago. The surveyor should be appointed within {APPOINT_WITHIN_HOURS} hours of intimation.
              </p>
              <label className="mt-1.5 block">
                <Label req>Reason for delay</Label>
                <select value={delayReason} onChange={(e) => setDelayReason(e.target.value)} className={inputCls} aria-invalid={!!err("delay")}>
                  <option value="">Select</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <Err msg={err("delay")} />
              </label>
            </div>
          )}

          {/* notifications */}
          <fieldset>
            <legend className="mb-1 text-[12px] font-medium text-slate-700">Send appointment details to</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-700">
              {[
                ["surveyor", "Surveyor (SMS & email)"],
                ["insured", `Insured (SMS) – ${claim.insured}`],
                claim.garage && ["garage", `Garage – ${claim.garage.name.split(",")[0]}`],
              ]
                .filter(Boolean)
                .map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={notify[k]} onChange={(e) => setNotify((n) => ({ ...n, [k]: e.target.checked }))} className="h-4 w-4 accent-teal-700" />
                    {l}
                  </label>
                ))}
            </div>
          </fieldset>

          <p className="flex items-start gap-1.5 text-[11.5px] text-slate-500">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
            Survey report due within {REPORT_WITHIN_DAYS} days of appointment ({fmt(addDaysIso(today, REPORT_WITHIN_DAYS))}). The claim moves to Survey pending.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="h-9 rounded-lg bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800">
            {changing ? "Change surveyor" : `Appoint${chosen ? ` ${chosen.kind === "video" ? "video desk" : chosen.name.replace(/^Er\. /, "")}` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}