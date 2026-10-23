// src/pages/od/ODClaim360.jsx
// P06 · Claim 360 – one place to see and work an OD claim.
// Route: /od/claims/:id   (id = claim no with "/" replaced by "-", e.g. OD-CHN-26-004512)
// Catalogue refs: Claim Summary 182–183, Policy & Coverage 22–32, Survey 37–51,
// Damage Assessment 52–59, Document Mgmt 152–157, Reserve 18–19, Audit Trail 171–175,
// Communication 144–151, Investigation & Fraud 66–69.

import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  FilePlus2,
  Upload,
  ShieldAlert,
  Send,
  StickyNote,
  Phone,
  Mail,
  Wrench,
  UserCheck,
  Car,
  X,
  CircleDot,
} from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { TAT_STAGES } from "../../data/odHandlerMock";
import { getClaimDetail, claimFromSlug, LIFECYCLE } from "../../data/odClaimDetail";

const inr = (n) => (n == null ? "–" : "₹" + Number(n).toLocaleString("en-IN"));
const dt = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";

const STAGE_TAT = {
  NBNR: "Intimation → Registration",
  Registered: "Registration → Surveyor appointed",
  "Survey pending": "Surveyor appointed → Survey done",
  Assessment: "Survey → Assessment report",
  "Documents pending": "Document collection",
  Approval: "Approval",
  "Repair / DO": "Final invoice → Delivery order",
  Payment: "Delivery order → Payment",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "policy", label: "Policy & vehicle" },
  { key: "loss", label: "Loss & survey" },
  { key: "docs", label: "Documents" },
  { key: "reserve", label: "Reserve & payments" },
  { key: "timeline", label: "Timeline" },
];

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */
function Card({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 px-3 py-0.5">
          <h2 className="text-[13px] font-semibold text-[#0B1F3A]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label / value grid used across tabs */
function Facts({ items, cols = "sm:grid-cols-2 xl:grid-cols-3" }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-2 px-3 py-2.5 ${cols}`}>
      {items
        .filter(Boolean)
        .map(([k, v, opts = {}]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className={`text-[12.5px] text-slate-800 ${opts.mono ? "font-mono" : ""} ${opts.strong ? "font-semibold" : ""}`}>
              {v ?? "–"}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** All header chips share one height and baseline. */
const CHIP = "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold leading-none";

function SlaChip({ sla }) {
  const map = {
    breach: { cls: "bg-red-50 text-red-800 ring-red-200", Icon: AlertTriangle },
    risk: { cls: "bg-amber-50 text-amber-900 ring-amber-200", Icon: Clock },
    ok: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  };
  const { cls, Icon } = map[sla.status];
  return (
    <span className={`${CHIP} ring-1 ring-inset ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      SLA · {sla.label}
    </span>
  );
}

function DocStatus({ status }) {
  const map = {
    Received: { cls: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
    Pending: { cls: "bg-amber-50 text-amber-900", Icon: Clock },
    "Not yet due": { cls: "bg-slate-100 text-slate-600", Icon: MinusCircle },
  };
  const { cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-semibold leading-5 ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </span>
  );
}

function ActionButton({ icon: Icon, children, onClick, primary, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition ${
        primary
          ? "bg-teal-700 text-white hover:bg-teal-800"
          : danger
          ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function ODClaim360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const claimNo = claimFromSlug(id);
  const base = useMemo(() => getClaimDetail(claimNo), [claimNo]);

  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState("");
  const [extraEvents, setExtraEvents] = useState([]);
  const [docState, setDocState] = useState({}); // name -> status overrides
  const [modal, setModal] = useState(null); // "note" | "docs"
  const [note, setNote] = useState("");
  const [docPick, setDocPick] = useState([]);

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setToast(""), 2600);
  }
  const notBuilt = (what) => flash(`${what} – this screen comes in a later build step.`);

  if (!base) {
    return (
      <ODShell active="queue" title="Claim not found" onNavigateMissing={notBuilt}>
        <Card className="mx-auto max-w-md p-6 text-center">
          <p className="text-sm text-slate-700">
            No claim <span className="font-mono">{claimNo}</span> in your queue.
          </p>
          <Link to="/od/worklist" className="mt-3 inline-block text-[13px] font-medium text-teal-700 hover:underline">
            Back to My Work Queue
          </Link>
        </Card>
      </ODShell>
    );
  }

  const c = base;
  const now = new Date();
  const stamp = () => ({
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  });
  const documents = c.documents.map((d) => ({ ...d, status: docState[d.name] ?? d.status }));
  const pendingDocs = documents.filter((d) => d.status === "Pending");
  const requestable = documents.filter((d) => d.status !== "Received" && d.status !== "Pending");
  const timeline = [...extraEvents, ...c.timeline];
  const tat = TAT_STAGES.find((s) => s.stage === STAGE_TAT[c.stage]);

  // 5-stage lifecycle shown in the left sidebar while this claim is open
  const lifecycleSteps = LIFECYCLE.map((st, i) => {
    const cur = c.lifecycle.step;
    const state = i < cur ? "done" : i === cur ? (c.lifecycle.hold ? "hold" : "active") : "todo";
    return { label: st.label, state, status: state === "done" ? "Completed" : state === "todo" ? "Pending" : c.lifecycle.note };
  });

  function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setExtraEvents((ev) => [{ ...stamp(), event: "Note added", by: "Karthik Subramanian", detail: note.trim() }, ...ev]);
    setNote("");
    setModal(null);
    flash("Note added to the claim timeline.");
  }

  function requestDocs(e) {
    e.preventDefault();
    if (docPick.length === 0) return;
    setDocState((s) => ({ ...s, ...Object.fromEntries(docPick.map((n) => [n, "Pending"])) }));
    setExtraEvents((ev) => [
      { ...stamp(), event: "Document requested", by: "Karthik Subramanian", detail: `${docPick.join(", ")} · SMS + email sent to insured` },
      ...ev,
    ]);
    setDocPick([]);
    setModal(null);
    flash(`${docPick.length} document(s) requested from the insured.`);
  }

  function markReceived(name) {
    setDocState((s) => ({ ...s, [name]: "Received" }));
    setExtraEvents((ev) => [{ ...stamp(), event: "Document received", by: "Karthik Subramanian", detail: name }, ...ev]);
  }

  return (
    <ODShell
      active="queue"
      title={c.claimNo}
      subtitle={`Claim 360 · ${c.insured} · ${c.regNo}`}
      onNavigateMissing={notBuilt}
      claimNav={{ claimNo: c.claimNo, backTo: "/od/worklist", backLabel: "Back to My Work Queue", steps: lifecycleSteps }}
    >
      <div className="flex flex-col gap-2">
        {/* ---------------- Back + actions ---------------- */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate("/od/worklist")}
            className="flex h-8 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-white hover:text-slate-900 lg:invisible"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to queue
          </button>
          <div className="flex flex-wrap gap-1.5">
            <ActionButton icon={StickyNote} onClick={() => setModal("note")}>
              Add note
            </ActionButton>
            <ActionButton icon={FilePlus2} onClick={() => setModal("docs")}>
              Request documents
            </ActionButton>
            <ActionButton icon={Upload} onClick={() => notBuilt("Upload document")}>
              Upload
            </ActionButton>
            {c.stage === "Registered" && (
              <ActionButton icon={UserCheck} onClick={() => notBuilt("Appoint surveyor")} primary>
                Appoint surveyor
              </ActionButton>
            )}
            {c.stage === "NBNR" && (
              <ActionButton icon={CheckCircle2} onClick={() => notBuilt("Convert NBNR to claim")} primary>
                Resolve NBNR
              </ActionButton>
            )}
            {(c.stage === "Assessment" || c.stage === "Documents pending") && (
              <ActionButton icon={Send} onClick={() => notBuilt("Send for approval")} primary>
                Send for approval
              </ActionButton>
            )}
            <ActionButton icon={ShieldAlert} onClick={() => notBuilt("Refer to SIU")} danger>
              Refer to SIU
            </ActionButton>
          </div>
        </div>

        {/* ---------------- Claim header ---------------- */}
        <Card>
          {/* Row 1: claim no + status chips (left) · policy status (right) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold leading-6 tracking-wide text-[#0B1F3A] tabular-nums">{c.claimNo}</span>
              <span className={`${CHIP} bg-[#0B1F3A] text-white`}>{c.stage}</span>
              <SlaChip sla={c.sla} />
              {c.dueToday && <span className={`${CHIP} bg-teal-50 text-teal-800`}>Due today</span>}
              {c.flags.map((f) => (
                <span key={f} className={`${CHIP} ${f === "Fraud flag" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {f}
                </span>
              ))}
              {c.loss.catEvent && <span className={`${CHIP} bg-sky-50 text-sky-800`}>CAT event</span>}
            </div>
            <span
              className={`${CHIP} ${c.policy.status === "In force" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
              title={c.policy.policyNo}
            >
              {c.policy.status === "In force" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
              Policy · {c.policy.status}
            </span>
          </div>

          {/* Row 2: key facts – one line each, same font, same baseline */}
          <dl className="flex flex-wrap justify-between gap-x-5 gap-y-3 px-4 py-2.5">
            {[
              ["Insured", c.insured],
              ["Vehicle no", c.regNo],
              ["Make / model", c.vehicle.makeModel],
              ["Loss type", c.lossType],
              ["Loss date", dt(c.lossDate)],
              ["Claim raised", dt(c.regDate)],
              ["Reserve", inr(c.reserve), true],
              ["Pending with", c.pendingWith],
              ["Age", `${c.ageDays} days`],
            ].map(([k, v, strong]) => (
              <div key={k} className="flex-none">
                <dt className="whitespace-nowrap text-[10.5px] font-medium uppercase leading-4 tracking-wide text-slate-500">{k}</dt>
                <dd
                  className={`mt-0.5 whitespace-nowrap text-[13px] leading-5 tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-800"}`}
                  title={String(v)}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          {/* Row 3: next action */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-amber-50/60 px-4 py-2 text-[12.5px] leading-5">
            <CircleDot className="h-4 w-4 flex-none text-amber-700" aria-hidden="true" />
            <span className="font-semibold text-slate-800">Next action:</span>
            <span className="truncate text-slate-700" title={c.nextAction}>
              {c.nextAction}
            </span>
          </div>
        </Card>

        {/* ---------------- Tabs + side panel ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_290px]">
          <Card>
            <div role="tablist" aria-label="Claim sections" className="flex flex-wrap gap-1 border-b border-slate-100 px-2 py-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-medium ${
                    tab === t.key ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                  {t.key === "docs" && pendingDocs.length > 0 && (
                    <span className={`rounded px-1.5 text-[10.5px] font-semibold ${tab === t.key ? "bg-white/15" : "bg-amber-100 text-amber-900"}`}>
                      {pendingDocs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ===== Overview ===== */}
            {tab === "overview" && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 p-2 xl:grid-cols-2">
                <Card title="Loss summary">
                  <Facts
                    cols="grid-cols-2"
                    items={[
                      ["Date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
                      ["Place", c.loss.place],
                      ["Cause", c.loss.cause],
                      ["Police", c.loss.policeReport],
                      ["Intimated via", c.loss.intimationChannel],
                      ["Intimation delay", `${c.loss.intimationDelayDays} day(s)`],
                    ]}
                  />
                </Card>
                <Card title="Assessment summary">
                  {c.survey.assessed == null ? (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">
                      {c.survey.estimate ? `Garage estimate ${inr(c.survey.estimate)} received. ` : ""}Assessment not done yet.
                    </p>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <tbody>
                        {[
                          ["Garage estimate", c.survey.estimate],
                          ["Assessed loss", c.survey.assessed],
                          [`Less depreciation${c.survey.zeroDep ? " (zero dep)" : ""}`, -c.survey.depreciation],
                          ["Less salvage", -c.survey.salvage],
                          ["Less deductible (compulsory + voluntary)", -c.survey.deductible],
                        ].map(([k, v]) => (
                          <tr key={k} className="border-b border-slate-50">
                            <td className="px-3 py-1 text-slate-600">{k}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-slate-800">{v == null ? "–" : v === 0 ? "Nil" : v < 0 ? `– ${inr(-v)}` : inr(v)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-1.5 text-slate-800">Net liability (approx.)</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-900">{inr(c.survey.netLiability)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </Card>
                <Card
                  title="Pending documents"
                  action={
                    <button type="button" onClick={() => setTab("docs")} className="text-[12px] font-medium text-teal-700 hover:underline">
                      All documents
                    </button>
                  }
                >
                  {pendingDocs.length === 0 ? (
                    <p className="flex items-center gap-1.5 px-3 py-3 text-[12.5px] text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Nothing pending right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {pendingDocs.map((d) => (
                        <li key={d.name} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]">
                          <span className="text-slate-800">{d.name}</span>
                          <span className="text-[11px] text-slate-500">
                            Requested {dt(d.requestedOn)} · {d.reminders} reminder(s)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card
                  title="Recent activity"
                  action={
                    <button type="button" onClick={() => setTab("timeline")} className="text-[12px] font-medium text-teal-700 hover:underline">
                      Full timeline
                    </button>
                  }
                >
                  <ul className="divide-y divide-slate-50">
                    {timeline.slice(0, 4).map((e, i) => (
                      <li key={i} className="px-3 py-1.5 text-[12px]">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-slate-800">{e.event}</span>
                          <span className="flex-none text-[11px] text-slate-500">
                            {dt(e.date)} {e.time}
                          </span>
                        </div>
                        <div className="truncate text-[11.5px] text-slate-600" title={e.detail}>
                          {e.detail}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            {/* ===== Policy & vehicle ===== */}
            {tab === "policy" && (
              <div className="flex flex-col gap-2 p-2">
                <Card title="Policy">
                  <Facts
                    items={[
                      ["Policy no", c.policy.policyNo, { mono: true }],
                      ["Product", c.policy.product],
                      ["Status", c.policy.status],
                      ["Period", `${dt(c.policy.periodFrom)} – ${dt(c.policy.periodTo)}`],
                      ["Premium realised", c.policy.premiumRealised],
                      ["Channel", c.policy.channel],
                      ["IDV", inr(c.policy.idv), { strong: true }],
                      ["NCB", c.policy.ncb],
                      ["Deductibles", `Compulsory ${inr(c.policy.compulsoryDeductible)} · Voluntary ${inr(c.policy.voluntaryDeductible)}`],
                      ["Add-on covers", c.policy.addOns.join(", ")],
                      ["Financier (hypothecation)", c.policy.financier ?? "None"],
                      ["Previous claims on vehicle", c.policy.previousClaims],
                    ]}
                  />
                </Card>
                <Card title="Vehicle">
                  <Facts
                    items={[
                      ["Registration no", c.vehicle.regNo, { mono: true }],
                      ["Make / model", c.vehicle.makeModel],
                      ["Year of manufacture", c.vehicle.yearOfMfg],
                      ["Fuel · cc", `${c.vehicle.fuel} · ${c.vehicle.cc} cc`],
                      ["Chassis no", c.vehicle.chassis, { mono: true }],
                      ["Engine no", c.vehicle.engine, { mono: true }],
                      ["Usage", c.vehicle.usage],
                      ["Odometer", `${c.vehicle.odometer.toLocaleString("en-IN")} km`],
                    ]}
                  />
                </Card>
                <Card title="Driver at time of loss">
                  {c.driver ? (
                    <Facts
                      items={[
                        ["Name", c.driver.name],
                        ["DL no", c.driver.dlNo, { mono: true }],
                        ["DL class", c.driver.dlClass],
                        ["Valid till", dt(c.driver.dlValidTill)],
                      ]}
                    />
                  ) : (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">Not applicable – vehicle was parked / not being driven.</p>
                  )}
                </Card>
              </div>
            )}

            {/* ===== Loss & survey ===== */}
            {tab === "loss" && (
              <div className="flex flex-col gap-2 p-2">
                <Card title="Loss details">
                  <Facts
                    items={[
                      ["Loss date / time", `${dt(c.loss.date)} · ${c.loss.time}`],
                      ["Place of loss", c.loss.place],
                      ["Loss type", c.lossType],
                      ["Cause / description", c.loss.cause],
                      ["Third party involved", c.loss.tpInvolved ? "Yes – TP claim intimation passed to TP system" : "No"],
                      ["Police", c.loss.policeReport],
                      ["Vehicle location", c.loss.vehicleLocation],
                      ["Intimated on / via", `${dt(c.loss.intimatedOn)} · ${c.loss.intimationChannel}`],
                      c.loss.catEvent && ["Catastrophe event", c.loss.catEvent],
                    ]}
                  />
                </Card>
                <Card title="Survey">
                  {c.survey.surveyor ? (
                    <Facts
                      items={[
                        ["Surveyor", `${c.survey.surveyor.name} · ${c.survey.surveyor.type}`],
                        ["Licence no", c.survey.surveyor.licence, { mono: true }],
                        ["Survey type", c.survey.surveyType],
                        ["Appointed on", dt(c.survey.appointedOn)],
                        ["Survey done on", c.survey.surveyDoneOn ? dt(c.survey.surveyDoneOn) : "Pending"],
                        ["Garage", c.garage ? `${c.garage.name} (${c.garage.type})` : "–"],
                      ]}
                    />
                  ) : (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">
                      {c.stage === "NBNR" ? "Survey starts after the claim is registered." : "Surveyor not appointed yet."}
                    </p>
                  )}
                </Card>
                {c.survey.assessed != null && (
                  <Card title="Assessment">
                    <Facts
                      items={[
                        ["Garage estimate", inr(c.survey.estimate)],
                        ["Assessed loss", inr(c.survey.assessed), { strong: true }],
                        ["Depreciation", c.survey.zeroDep ? "Nil – zero depreciation add-on" : inr(c.survey.depreciation)],
                        ["Salvage value", inr(c.survey.salvage)],
                        ["Deductible", inr(c.survey.deductible)],
                        ["Net liability (approx.)", inr(c.survey.netLiability), { strong: true }],
                      ]}
                    />
                  </Card>
                )}
              </div>
            )}

            {/* ===== Documents ===== */}
            {tab === "docs" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-1.5 font-semibold">Document</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Status</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Received / requested</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Source</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.name} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-1.5 text-slate-800">
                            <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {d.name}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <DocStatus status={d.status} />
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">
                          {d.status === "Received" && dt(d.receivedOn)}
                          {d.status === "Pending" && `Requested ${dt(d.requestedOn) !== "–" ? dt(d.requestedOn) : "today"} · ${d.reminders || 0} reminder(s)`}
                          {d.status === "Not yet due" && "–"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">{d.source ?? "–"}</td>
                        <td className="px-3 py-1.5 text-right">
                          {d.status === "Received" && (
                            <button type="button" onClick={() => notBuilt(`View ${d.name}`)} className="text-[12px] font-medium text-teal-700 hover:underline">
                              View
                            </button>
                          )}
                          {d.status === "Pending" && (
                            <button type="button" onClick={() => markReceived(d.name)} className="text-[12px] font-medium text-teal-700 hover:underline">
                              Mark received
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== Reserve & payments ===== */}
            {tab === "reserve" && (
              <div className="flex flex-col gap-2 p-2">
                <Card title="Reserve history" action={<span className="text-[12px] font-semibold text-slate-800">Current {inr(c.reserve)}</span>}>
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-wide text-slate-500">
                        <th scope="col" className="px-3 py-1.5 font-semibold">Date</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">Type</th>
                        <th scope="col" className="px-2 py-1.5 text-right font-semibold">Amount</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">By</th>
                        <th scope="col" className="px-3 py-1.5 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.reserveHistory.map((h, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-600">{dt(h.date)}</td>
                          <td className="px-2 py-1.5 text-slate-800">{h.type}</td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{inr(h.amount)}</td>
                          <td className="px-2 py-1.5 text-slate-600">{h.by}</td>
                          <td className="px-3 py-1.5 text-slate-600">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Card title="Payments">
                  {c.payments.length === 0 ? (
                    <p className="px-3 py-3 text-[12.5px] text-slate-500">No payments yet. Payment is raised after the delivery order is issued.</p>
                  ) : (
                    <table className="w-full text-left text-[12.5px]">
                      <tbody>
                        {c.payments.map((p, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 text-slate-600">{dt(p.date)}</td>
                            <td className="px-2 py-1.5 text-slate-800">{p.payee}</td>
                            <td className="px-2 py-1.5">{p.mode}</td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                            <td className="px-3 py-1.5">
                              <span className="rounded bg-amber-50 px-1.5 text-[11px] font-semibold leading-5 text-amber-900">{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}

            {/* ===== Timeline ===== */}
            {tab === "timeline" && (
              <ol className="relative px-4 py-3">
                {timeline.map((e, i) => (
                  <li key={i} className="relative border-l-2 border-slate-200 pb-3 pl-4 last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-700" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[12.5px] font-semibold text-slate-800">{e.event}</span>
                      <span className="text-[11px] tabular-nums text-slate-500">
                        {dt(e.date)} · {e.time}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-600">{e.detail}</div>
                    <div className="text-[11px] text-slate-500">by {e.by}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* ---------------- Side panel ---------------- */}
          <div className="flex flex-col gap-2">
            {tat && (
              <Card title="Current stage TAT">
                <div className="px-3 py-2 text-[12.5px]">
                  <div className="text-slate-600">{tat.stage}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <SlaChip sla={c.sla} />
                    <span className="text-[11px] text-slate-500">Target {tat.target} d · avg {tat.actual} d</span>
                  </div>
                  {c.pendingWith === "Insured" && (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Settlement SLA clock is paused while documents are with the insured. This stage&apos;s follow-up SLA still applies.
                    </p>
                  )}
                </div>
              </Card>
            )}

            <Card title="Checks">
              <ul className="flex flex-col px-3 py-1.5">
                {c.checks.map((k) => (
                  <li key={k.label} className="flex items-start gap-2 py-1 text-[12px]">
                    {k.ok === true && <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-none text-emerald-600" aria-label="Passed" />}
                    {k.ok === false && <XCircle className="mt-px h-3.5 w-3.5 flex-none text-red-600" aria-label="Failed" />}
                    {k.ok === null && <MinusCircle className="mt-px h-3.5 w-3.5 flex-none text-slate-400" aria-label="Not applicable" />}
                    {k.ok === "pending" && <Clock className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-label="Pending" />}
                    <span className="min-w-0">
                      <span className="block text-slate-800">{k.label}</span>
                      <span
                        className={`block text-[11px] ${k.ok === false ? "text-red-700" : k.ok === "pending" ? "text-amber-800" : "text-slate-500"}`}
                      >
                        {k.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Contacts">
              <ul className="flex flex-col divide-y divide-slate-50 text-[12px]">
                <li className="flex items-start gap-2 px-3 py-1.5">
                  <Car className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800">{c.insured}</span>
                    <span className="block text-[11px] text-slate-500">Insured</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{c.contact.mobile}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" aria-hidden="true" />{c.contact.email}</span>
                    </span>
                  </span>
                </li>
                {c.survey.surveyor && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.survey.surveyor.name}</span>
                      <span className="block text-[11px] text-slate-500">Surveyor · {c.survey.surveyor.licence}</span>
                    </span>
                  </li>
                )}
                {c.garage && (
                  <li className="flex items-start gap-2 px-3 py-1.5">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{c.garage.name}</span>
                      <span className="block text-[11px] text-slate-500">{c.garage.type}</span>
                    </span>
                  </li>
                )}
              </ul>
              <p className="border-t border-slate-100 px-3 py-1.5 text-[10.5px] text-slate-500">Mobile and email are masked for privacy.</p>
            </Card>
          </div>
        </div>
      </div>

      {/* ---------------- Modals ---------------- */}
      {modal === "note" && (
        <Modal title="Add note" onClose={() => setModal(null)}>
          <form onSubmit={addNote} className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1 text-[12.5px]">
              <span className="font-medium text-slate-700">Note (saved to the claim timeline)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15"
                placeholder="e.g. Spoke to insured, DL copy will be emailed by tomorrow"
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-8 rounded-md border border-slate-300 px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={!note.trim()} className="h-8 rounded-md bg-teal-700 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
                Save note
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "docs" && (
        <Modal title="Request documents from insured" onClose={() => setModal(null)}>
          <form onSubmit={requestDocs} className="flex flex-col gap-3 p-4">
            {requestable.length === 0 ? (
              <p className="text-[12.5px] text-slate-600">All required documents are already received or requested.</p>
            ) : (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-[12.5px] font-medium text-slate-700">Select documents to request</legend>
                {requestable.map((d) => (
                  <label key={d.name} className="flex items-center gap-2 text-[12.5px] text-slate-800">
                    <input
                      type="checkbox"
                      checked={docPick.includes(d.name)}
                      onChange={(e) =>
                        setDocPick((p) => (e.target.checked ? [...p, d.name] : p.filter((x) => x !== d.name)))
                      }
                      className="h-4 w-4 accent-teal-700"
                    />
                    {d.name}
                  </label>
                ))}
              </fieldset>
            )}
            <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11.5px] text-slate-600">
              The insured gets an SMS and email with the list. The request is logged on the claim timeline.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-8 rounded-md border border-slate-300 px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={docPick.length === 0} className="h-8 rounded-md bg-teal-700 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
                Send request
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}