// src/components/HandlerStageDialogs.jsx
// Claims Handler work on the current stage (Claim 360 → work view). The handler is also the in-house
// surveyor, so the survey, the report and the assessment are all done here.
//   ScheduleInspectionDialog – date, time, place and mode of the inspection          – catalogue 37, 43
//   SurveyReportDialog       – inspection findings, remarks, recommendation            – 44, 45, 46
//   AssessmentDialog         – part-wise assessment with live depreciation, deductibles,
//                              salvage and net liability; authority shown              – 53, 55–59, 114
//   ReferSiuDialog           – referral to investigation with reason                   – 66, 68

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { DEP_TEXT } from "../data/odAssessment";

const inr = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
const isoToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function Frame({ id, title, sub, onCancel, onSubmit, submitLabel, children, width = "max-w-[520px]" }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("input, select, textarea")?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form ref={ref} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={id} className={`flex max-h-[calc(100vh-32px)] w-full ${width} flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id={id} className="text-[15px] font-semibold text-[#0B1F3A]">
              {title}
            </h2>
            {sub && <p className="truncate text-[12px] text-slate-500">{sub}</p>}
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="h-9 rounded-lg bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
const Label = ({ children, req, htmlFor }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-slate-700">
    {children} {req && <span className="text-red-600">*</span>}
  </label>
);
const Err = ({ msg }) => (msg ? <span className="mt-1 block text-[12px] text-red-700">{msg}</span> : null);

/* ---------- Schedule inspection (in-house – the handler is the surveyor) ---------- */
export function ScheduleInspectionDialog({ claim, surveyor, onCancel, onDone }) {
  const today = isoToday();
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState("11:00");
  const [mode, setMode] = useState("physical");
  const [location, setLocation] = useState(claim.loss.vehicleLocation || "");
  const [tried, setTried] = useState(false);
  const errors = {};
  if (!date || date < today) errors.date = "Pick today or a later date.";
  if (!time) errors.time = "Enter the time.";
  if (mode !== "video" && location.trim().length < 3) errors.location = "Enter where the vehicle will be inspected.";
  const err = (k) => (tried ? errors[k] : null);
  return (
    <Frame
      id="si-title"
      title="Schedule inspection"
      sub={`${claim.claimNo} · ${claim.vehicle.regNo} · you are the surveyor (${surveyor.licence})`}
      onCancel={onCancel}
      submitLabel="Schedule"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (Object.keys(errors).length) return;
        onDone({
          surveyor,
          mode,
          at: today,
          visitDate: date,
          time,
          location: mode === "video" ? "Video call with the insured" : location.trim(),
          // IRDAI: survey report within 15 days of the surveyor's allocation
          reportDue: addDays(today, 15),
          events: [],
        });
      }}
    >
      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-slate-700">Inspection at</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["physical", "Garage"],
            ["spot", "Spot (accident place)"],
            ["video", "Video survey"],
          ].map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] ${mode === k ? "border-teal-600 bg-teal-50/60" : "border-slate-200"}`}>
              <input type="radio" name="si-mode" checked={mode === k} onChange={() => setMode(k)} className="h-4 w-4 accent-teal-700" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label req htmlFor="si-date">
            Date
          </Label>
          <input id="si-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-invalid={!!err("date")} />
          <Err msg={err("date")} />
        </div>
        <div>
          <Label req htmlFor="si-time">
            Time
          </Label>
          <input id="si-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-invalid={!!err("time")} />
          <Err msg={err("time")} />
        </div>
      </div>
      {mode !== "video" && (
        <div>
          <Label req htmlFor="si-loc">
            Location
          </Label>
          <input id="si-loc" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} aria-invalid={!!err("location")} />
          <Err msg={err("location")} />
        </div>
      )}
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">The insured and the garage get the date and time by SMS and email. IRDAI: survey report due within 15 days.</p>
    </Frame>
  );
}

/* ---------- Survey report ---------- */
export function SurveyReportDialog({ claim, onCancel, onDone }) {
  const today = isoToday();
  const [on, setOn] = useState(today);
  const [odo, setOdo] = useState(claim.vehicle.odometer ? String(claim.vehicle.odometer) : "");
  const [identity, setIdentity] = useState(true);
  const [consistent, setConsistent] = useState("yes");
  const [photos, setPhotos] = useState(true);
  const [followUp, setFollowUp] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [recommend, setRecommend] = useState("Repair");
  const [tried, setTried] = useState(false);
  const errors = {};
  if (!on || on > today) errors.on = "Inspection date cannot be in the future.";
  if (!/^\d{1,7}$/.test(odo)) errors.odo = "Enter the odometer reading in km.";
  if (remarks.trim().length < 10) errors.remarks = "Write your observations (at least 10 characters).";
  if (!photos) errors.photos = "Upload the inspection photos before submitting the report.";
  const err = (k) => (tried ? errors[k] : null);
  return (
    <Frame
      id="sr-title"
      title="Submit survey report"
      sub={`${claim.claimNo} · ${claim.vehicle.regNo} · ${claim.vehicle.makeModel}`}
      onCancel={onCancel}
      submitLabel="Submit report"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (Object.keys(errors).length) return;
        onDone({ on, odometer: Number(odo), identity, consistent: consistent === "yes", photos, followUp, remarks: remarks.trim(), recommend: consistent === "no" ? "Refer to SIU" : recommend });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label req htmlFor="sr-on">
            Inspected on
          </Label>
          <input id="sr-on" type="date" max={today} value={on} onChange={(e) => setOn(e.target.value)} className={inputCls} aria-invalid={!!err("on")} />
          <Err msg={err("on")} />
        </div>
        <div>
          <Label req htmlFor="sr-odo">
            Odometer (km)
          </Label>
          <input id="sr-odo" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value.replace(/\D/g, ""))} className={inputCls} aria-invalid={!!err("odo")} />
          <Err msg={err("odo")} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-[12.5px] text-slate-800">
        <input type="checkbox" checked={identity} onChange={(e) => setIdentity(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
        Registration, chassis and engine numbers match the RC and the policy
      </label>
      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-slate-700">Damage consistent with the stated cause?</legend>
        <div className="flex gap-2">
          {[
            ["yes", "Yes"],
            ["no", "No – doubtful"],
          ].map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] ${consistent === k ? "border-teal-600 bg-teal-50/60" : "border-slate-200"}`}>
              <input type="radio" name="sr-cons" checked={consistent === k} onChange={() => setConsistent(k)} className="h-4 w-4 accent-teal-700" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-[12.5px] text-slate-800">
        <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
        Inspection photos uploaded (with date, time and location)
      </label>
      <Err msg={err("photos")} />
      <label className="flex items-start gap-2 text-[12.5px] text-slate-800">
        <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
        Follow-up inspection needed after dismantling (hidden damage)
      </label>
      <div>
        <Label req htmlFor="sr-rem">
          Surveyor remarks
        </Label>
        <textarea id="sr-rem" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} h-auto py-2`} aria-invalid={!!err("remarks")} />
        <Err msg={err("remarks")} />
      </div>
      {consistent === "yes" ? (
        <div>
          <Label htmlFor="sr-rec">Recommendation</Label>
          <select id="sr-rec" value={recommend} onChange={(e) => setRecommend(e.target.value)} className={inputCls}>
            <option>Repair</option>
            <option>Total loss / CTL – cost benefit analysis</option>
          </select>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Doubtful damage – the claim will be flagged for referral to SIU.</p>
      )}
    </Frame>
  );
}

/* ---------- Part-wise assessment ---------- */
const REMARKS_OK = ["Allowed as estimated", "Allowed at parts price list", "Allowed at agreed labour / paint rate", "Repair allowed instead of replace"];
const REMARKS_NO = ["Disallowed – not related to this accident", "Disallowed – wear & tear", "Disallowed – Consumables add-on not opted", "Disallowed – not covered by the policy"];

export function AssessmentDialog({ claim, base, handlerLimit, onCancel, onDone }) {
  const { lines: start, zeroDep, metalRate } = base;
  const deductible = claim.policy.compulsoryDeductible + claim.policy.voluntaryDeductible;
  const [rows, setRows] = useState(() =>
    start.map((l) => ({ ...l, allowed: l.assessed > 0, value: String(l.assessed > 0 ? l.assessed : l.estimate), remark: l.remark || REMARKS_OK[0] }))
  );
  const [salvage, setSalvage] = useState(String(base.salvage ?? 0));
  const [tried, setTried] = useState(false);
  const rateOf = (t) => (zeroDep ? 0 : t === "metal" || t === "electrical" ? metalRate : { plastic: 0.5, battery: 0.5, fibre: 0.3, paint: 0.125 }[t] ?? 0);
  const calc = useMemo(() => {
    const ls = rows.map((r) => {
      const assessed = r.allowed ? Number(r.value || 0) : 0;
      const depRate = rateOf(r.type);
      return { ...r, assessed, depRate, dep: Math.round(assessed * depRate) };
    });
    const assessed = ls.reduce((s, l) => s + l.assessed, 0);
    const dep = ls.reduce((s, l) => s + l.dep, 0);
    const sal = Number(salvage || 0);
    return { ls, assessed, dep, sal, net: Math.max(0, assessed - dep - sal - deductible), estimate: ls.reduce((s, l) => s + l.estimate, 0) };
  }, [rows, salvage]);
  const set = (i, patch) =>
    setRows((rs) =>
      rs.map((r, k) => {
        if (k !== i) return r;
        const next = { ...r, ...patch };
        if ("allowed" in patch) next.remark = patch.allowed ? REMARKS_OK[0] : r.type === "consumable" ? REMARKS_NO[2] : REMARKS_NO[0];
        return next;
      })
    );
  const rowErr = (r) => (r.allowed && (!(Number(r.value) > 0) || Number(r.value) > r.estimate) ? `Enter ₹1 – ${inr(r.estimate)}` : null);
  const errors = rows.some(rowErr) ? "Fix the highlighted amounts – assessed cannot exceed the estimate." : !rows.some((r) => r.allowed) ? "Allow at least one item, or close the claim without payment." : null;
  const within = calc.net <= handlerLimit;
  return (
    <Frame
      id="as-title"
      title="Assess the loss"
      sub={`${claim.claimNo} · garage estimate ${inr(calc.estimate)} · vehicle age ${base.age?.label || "–"} · ${zeroDep ? "Zero depreciation add-on" : `metal ${Math.round(metalRate * 100)}% · plastic 50% · paint 12.5%`}`}
      onCancel={onCancel}
      submitLabel="Save assessment"
      width="max-w-[980px]"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (errors) return;
        onDone({ ...calc, deductible });
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-1.5 pr-2 font-semibold">Item</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold">Type</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Estimate</th>
              <th scope="col" className="py-1.5 pr-2 text-center font-semibold">Allow</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Assessed (₹)</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Dep.</th>
              <th scope="col" className="py-1.5 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {calc.ls.map((r, i) => {
              const bad = tried && rowErr(rows[i]);
              return (
                <tr key={r.item} className={r.allowed ? "" : "bg-rose-50/40"}>
                  <td className="py-1 pr-2 font-medium text-slate-800">{r.item}</td>
                  <td className="py-1 pr-2 text-slate-500">{DEP_TEXT[r.type]}</td>
                  <td className="py-1 pr-2 text-right text-slate-500">{inr(r.estimate)}</td>
                  <td className="py-1 pr-2 text-center">
                    <input type="checkbox" aria-label={`Allow ${r.item}`} checked={rows[i].allowed} onChange={(e) => set(i, { allowed: e.target.checked })} className="h-4 w-4 accent-teal-700" />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <input
                      aria-label={`Assessed amount for ${r.item}`}
                      inputMode="numeric"
                      disabled={!rows[i].allowed}
                      value={rows[i].allowed ? rows[i].value : ""}
                      onChange={(e) => set(i, { value: e.target.value.replace(/\D/g, "") })}
                      className={`h-8 w-28 rounded-md border px-2 text-right text-[12.5px] outline-none focus:border-teal-600 disabled:bg-slate-100 ${bad ? "border-red-500" : "border-slate-300"}`}
                      aria-invalid={!!bad}
                    />
                  </td>
                  <td className="py-1 pr-2 text-right text-slate-600">{r.dep ? `${inr(r.dep)} · ${Math.round(r.depRate * 1000) / 10}%` : "–"}</td>
                  <td className="py-1">
                    <select aria-label={`Remark for ${r.item}`} value={rows[i].remark} onChange={(e) => set(i, { remark: e.target.value })} className="h-8 w-full min-w-[220px] rounded-md border border-slate-300 bg-white px-1.5 text-[12px]">
                      {(rows[i].allowed ? REMARKS_OK : REMARKS_NO).map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
          <span className="text-slate-600">Assessed loss</span>
          <span className="text-right font-semibold">{inr(calc.assessed)}</span>
          <span className="text-slate-600">Less depreciation</span>
          <span className="text-right">– {inr(calc.dep)}</span>
          <span className="text-slate-600">Less salvage</span>
          <span className="text-right">– {inr(calc.sal)}</span>
          <span className="text-slate-600">Less deductibles (compulsory + voluntary)</span>
          <span className="text-right">– {inr(deductible)}</span>
          <span className="border-t border-slate-200 pt-1 font-semibold text-slate-900">Net liability</span>
          <span className="border-t border-slate-200 pt-1 text-right text-[14px] font-semibold text-slate-900">{inr(calc.net)}</span>
        </div>
        <div className="space-y-2">
          <div>
            <Label htmlFor="as-sal">Salvage of replaced parts (₹)</Label>
            <input id="as-sal" inputMode="numeric" value={salvage} onChange={(e) => setSalvage(e.target.value.replace(/\D/g, ""))} className={inputCls} />
          </div>
          <p className={`rounded-lg px-3 py-2 text-[12px] ${within ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            {within ? `Within your authority (up to ${inr(handlerLimit)}) – you can approve it.` : `Above your authority of ${inr(handlerLimit)} – goes to the Claims Manager.`} The reserve is revised to the net liability.
          </p>
        </div>
      </div>
      <Err msg={tried ? errors : null} />
    </Frame>
  );
}

/* ---------- Refer to SIU ---------- */
export const SIU_REASONS = [
  "Claim soon after policy inception / break-in",
  "Late intimation without a good reason",
  "Repeat claims on the vehicle or insured",
  "Night-time accident with no witness",
  "Photos do not match the damage or the cause",
  "Watch-listed garage, insured or vehicle",
  "Theft claim (mandatory referral)",
  "Other",
];
export function ReferSiuDialog({ claim, onCancel, onDone }) {
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tried, setTried] = useState(false);
  const errors = {};
  if (!reason) errors.reason = "Select the reason for referral.";
  if (remarks.trim().length < 10) errors.remarks = "Describe what you found (at least 10 characters).";
  const err = (k) => (tried ? errors[k] : null);
  return (
    <Frame
      id="siu-title"
      title="Refer to SIU"
      sub={`${claim.claimNo} · ${claim.insured} · ${claim.vehicle.regNo}`}
      onCancel={onCancel}
      submitLabel="Refer to SIU"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!Object.keys(errors).length) onDone({ reason, remarks: remarks.trim() });
      }}
    >
      <div>
        <Label req htmlFor="siu-reason">
          Reason
        </Label>
        <select id="siu-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} aria-invalid={!!err("reason")}>
          <option value="">Select</option>
          {SIU_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Err msg={err("reason")} />
      </div>
      <div>
        <Label req htmlFor="siu-rem">
          What you found
        </Label>
        <textarea id="siu-rem" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} h-auto py-2`} aria-invalid={!!err("remarks")} />
        <Err msg={err("remarks")} />
      </div>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">The claim stays with you, but it cannot be approved until SIU sends its findings. SIU appoints the investigator.</p>
    </Frame>
  );
}