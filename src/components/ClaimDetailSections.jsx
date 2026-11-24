// src/components/ClaimDetailSections.jsx
// Claim 360 → "Claim details": the whole claim on one page, section by section (Policy, Insured,
// Vehicle, Loss, Driver, Third party, Survey, Assessment, Repairer). Each section is a three-column
// label / value grid (middle column tinted) with "View more" for the less-used fields and, in edit
// mode, "Edit". Alerts that need attention before settlement show as strips at the top.
// Catalogue: 6 (policy & coverage), 8 (vehicle), 9–10 (loss & driver), 33–48 (survey),
// 57–62 (repairer), 160 (single claim view).

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Pencil } from "lucide-react";

const dt = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";
const tm = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dtm = (iso, hhmm) => (iso ? `${dt(iso)}${hhmm ? `, ${tm(hhmm)}` : ""}` : "–");
const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));

const TONE = { red: "text-red-700", amber: "text-amber-800", green: "text-emerald-700" };

/** One section: header (title + links) and a 3-column label / value grid. */
function Section({ title, items, more = [], links = [], onEdit, empty }) {
  const [open, setOpen] = useState(false);
  const shown = (open ? [...items, ...more] : items).filter(Boolean);
  // row-major across three columns (1 2 3 / 4 5 6 …) – the middle column is tinted
  const cols = [[], [], []];
  shown.forEach((it, i) => cols[i % 3].push(it));
  const id = `cd-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-[13px] font-semibold text-[#0B1F3A]">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium">
          {links.map((l) => (
            <button key={l.label} type="button" onClick={l.onClick} title={l.title} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
              {l.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Edit
            </button>
          )}
          {more.filter(Boolean).length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={`${id}-grid`}
              className="inline-flex items-center gap-0.5 text-teal-700 hover:underline"
            >
              {open ? "View less" : "View more"}
              {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
      <div id={`${id}-grid`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {empty ? (
          <p className="px-3 py-3 text-[12.5px] text-slate-500">{empty}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {cols.map((col, ci) => (
              <dl key={ci} className={`flex flex-col px-3 py-1.5 ${ci === 1 ? "bg-teal-50/60" : ""} ${ci > 0 ? "border-t border-slate-100 lg:border-l lg:border-t-0" : ""}`}>
                {col.map(([k, v, opt = {}]) => (
                  <div key={k} className="flex min-h-9 items-start justify-between gap-3 py-1.5">
                    <dt className="pt-px text-[12px] leading-4 text-slate-500">{k}</dt>
                    <dd
                      className={`max-w-[62%] text-right text-[12.5px] font-semibold leading-4 ${opt.tone ? TONE[opt.tone] : "text-slate-900"} ${opt.mono ? "font-mono text-[12px]" : ""}`}
                    >
                      {v ?? "–"}
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ClaimDetailSections({ c, editMode, onSoon }) {
  const p = c.profile;
  const edit = (what) => (editMode ? () => onSoon(`Edit ${what}`) : undefined);
  const sv = c.survey.surveyor;
  const ips = sv && /IPS|panel/i.test(sv.type || "");

  // things to sort out before the claim can be settled
  const alerts = [
    p.policy.uwDocsMissing && "Underwriting documents not available – break-in policy, vehicle inspection report (VIR) not on file",
    c.stage === "NBNR" && "Policy under verification – premium realisation (Section 64VB) not yet confirmed by PAS",
    p.insured.kyc !== "Verified" && "KYC not verified – complete before any payment is released",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((a) => (
        <p key={a} role="note" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
          {a}
        </p>
      ))}

      <Section
        title="Policy details"
        links={[
          ...(p.policy.vir ? [{ label: "View VIR", title: "Vehicle inspection report (break-in)", onClick: () => onSoon("Vehicle inspection report") }] : []),
          { label: "IIB", title: "Claim history from Insurance Information Bureau", onClick: () => onSoon("IIB claim history") },
        ]}
        items={[
          ["Policy number", c.policy.policyNo, { mono: true }],
          ["Policy period", `${dtm(c.policy.periodFrom, p.policy.startTime)} to ${dtm(c.policy.periodTo, p.policy.endTime)}`],
          ["IDV", inr(c.policy.idv)],
          ["NCB status", p.policy.ncbStatus],
          ["NCB %", c.policy.ncb],
          ["64VB status", p.policy.sec64VB, { tone: p.policy.sec64VB === "Confirmed" ? "green" : "amber" }],
          ["Roll over policy", p.policy.rollover],
          ["Break in insurance", p.policy.breakIn, { tone: p.policy.breakIn === "Yes" ? "amber" : undefined }],
          ["Policy type & product", c.policy.product],
        ]}
        more={[
          ["Policy status", c.policy.status],
          ["Premium realised", c.policy.premiumRealised],
          ["Business channel", c.policy.channel],
          ["Deductibles", `Compulsory ${inr(c.policy.compulsoryDeductible)} · Voluntary ${inr(c.policy.voluntaryDeductible)}`],
          ["Add-on covers", c.policy.addOns.join(", ")],
          ["Financier (hypothecation)", c.policy.financier ?? "None"],
          ["Previous claims on vehicle", c.policy.previousClaims],
        ]}
      />

      <Section
        title="Insured details"
        onEdit={edit("insured details")}
        items={[
          ["Insured name (as per policy)", c.insured],
          ["Insured name (as per KYC document)", p.insured.nameAsPerDoc],
          ["Mobile number", c.contact.mobile],
          ["Email ID", c.contact.email],
          ["City", p.insured.city],
          ["KYC status", p.insured.kyc, { tone: p.insured.kyc === "Verified" ? "green" : "red" }],
        ]}
      />

      <Section
        title="Vehicle details"
        onEdit={edit("vehicle details")}
        items={[
          ["Vehicle number", c.vehicle.regNo, { mono: true }],
          ["Engine number", c.vehicle.engine, { mono: true }],
          ["Chassis number", c.vehicle.chassis, { mono: true }],
          ["Make", p.vehicle.make],
          ["Model", p.vehicle.model],
          ["Registration date", dt(p.vehicle.regDate)],
          ["No. of owners", p.vehicle.owners],
        ]}
        more={[
          ["Year of manufacture", c.vehicle.yearOfMfg],
          ["Fuel · cc", `${c.vehicle.fuel} · ${c.vehicle.cc} cc`],
          ["Usage", c.vehicle.usage],
          ["Odometer", `${c.vehicle.odometer.toLocaleString("en-IN")} km`],
        ]}
      />

      <Section
        title="Loss details"
        onEdit={edit("loss details")}
        items={[
          ["Date of loss", dtm(c.loss.date, c.loss.time)],
          ["Intimation date", dtm(c.loss.intimatedOn, p.loss.intimationTime)],
          ["Loss location", c.loss.place],
          ["Loss type", c.lossType],
          ["Nature of loss", c.loss.cause],
          ["Is vehicle parked", p.loss.parked],
        ]}
        more={[
          ["Intimated via", c.loss.intimationChannel],
          ["Intimation delay", `${c.loss.intimationDelayDays} day(s)`, { tone: c.loss.intimationDelayDays > 7 ? "amber" : undefined }],
          ["Vehicle now at", c.loss.vehicleLocation],
          c.loss.catEvent && ["Catastrophe (CAT) event", c.loss.catEvent],
        ]}
      />

      <Section
        title="Driver details"
        onEdit={c.driver ? edit("driver details") : undefined}
        empty={!c.driver && "Not applicable – vehicle was parked / not being driven at the time of loss."}
        items={
          c.driver
            ? [
                ["Driver name", c.driver.name],
                ["Driver date of birth", dt(p.driver.dob)],
                ["Driving licence number", c.driver.dlNo, { mono: true }],
                ["Class of vehicle", c.driver.dlClass],
                ["Non-transport valid to", dt(c.driver.dlValidTill), { tone: c.driver.dlValidTill < c.loss.date ? "red" : undefined }],
              ]
            : []
        }
      />

      <Section
        title="Third party details"
        onEdit={edit("third party details")}
        items={[
          ["Third party involved", c.loss.tpInvolved ? "Yes – passed to TP claims" : "No"],
          ["Police complaint mode", p.tp.policeMode],
          ["FIR / GD available", p.tp.firAvailable],
          ["Subrogation opportunity", p.tp.subrogation, { tone: p.tp.subrogation.startsWith("Yes") ? "green" : undefined }],
        ]}
      />

      <Section
        title="Survey details"
        empty={
          !sv &&
          (c.stage === "NBNR"
            ? "Survey starts after the claim is registered."
            : "External surveyor (IPS) not appointed yet – CAT / theft / total loss claims need one.")
        }
        items={
          sv
            ? [
                ["Type of survey", p.survey.type],
                ["Surveyor name", sv.name],
                ["Classification", ips ? "External surveyor (IPS)" : "In-house – claims handler"],
                ["Allotted date & time", dtm(c.survey.appointedOn || c.regDate, p.survey.allottedTime)],
                ["Survey date & time", c.survey.surveyDoneOn ? dtm(c.survey.surveyDoneOn, p.survey.surveyTime) : "Pending"],
                ["Report submitted on", p.survey.reportOn ? dtm(p.survey.reportOn, p.survey.reportTime) : "Pending"],
              ]
            : []
        }
        more={
          sv
            ? [
                ["IRDAI licence no", sv.licence, { mono: true }],
                ["Survey mode", c.survey.surveyType],
                ["Garage estimate", inr(c.survey.estimate)],
              ]
            : []
        }
      />

      {c.survey.assessed != null && (
        <Section
          title="Assessment details"
          items={[
            ["Garage estimate", inr(c.survey.estimate)],
            ["Assessed loss", inr(c.survey.assessed)],
            ["Depreciation", c.survey.zeroDep ? "Nil – zero depreciation" : inr(c.survey.depreciation)],
            ["Salvage value", inr(c.survey.salvage)],
            ["Deductible", inr(c.survey.deductible)],
            ["Net liability (approx.)", inr(c.survey.netLiability), { tone: "green" }],
          ]}
        />
      )}

      <Section
        title="Repairer details"
        onEdit={c.garage ? edit("repairer details") : undefined}
        empty={!c.garage && "No repairer – theft claim (vehicle not traced)."}
        items={
          c.garage
            ? [
                ["Repairer name", c.garage.name.split(",")[0]],
                ["City / State", `${c.garage.city} / ${p.repairer.state}`],
                ["Repairer type", p.repairer.type],
                ["Repairer code", p.repairer.code, { mono: true }],
                ["Party type", "Repairer"],
                ["Address", `${c.garage.name.split(",")[1]?.trim() || ""}, ${c.garage.city}`],
                ["E-invoice", p.repairer.eInvoice],
                ["Network", p.repairer.network],
                ["GSTIN", p.repairer.gstin, { mono: true }],
              ]
            : []
        }
      />
    </div>
  );
}