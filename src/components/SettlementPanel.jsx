// src/components/SettlementPanel.jsx
// Settlement on Claim 360 (Claims Handler) – the handler drives the steps other teams complete:
//   1 Delivery order (DO) + liability working sheet to repairer / insured / agent – catalogue 91
//   2 Final invoice: type, GSTIN, in favour of; vs approved amount, 5 % tolerance – 79–83
//   3 Payee & bank account validation (name match)                               – 120, 122
//   4 Settlement consent: OTP / e-sign / signed voucher                          – 121
//   5 Delivery & satisfaction – cashless, BEFORE payment                         – 77
//   6 Payment request to Finance → paid (UTR)                                    – 125, 126
//   7 Auto-close after full settlement, reserve to nil                           – 130
// Steps done by the garage, surveyor or Finance are recorded here by the handler until those
// personas have their own screens (demo).

import { useEffect, useRef, useState } from "react";
import { INVOICE_TOLERANCE_PCT, INVOICE_TYPES, CONSENT_MODES, GSTIN_RE } from "../data/claimSettlement";
import { X, Check, FileCheck2, Landmark, ReceiptText, Send, BadgeCheck, Lock, Truck, AlertTriangle, CarFront } from "lucide-react";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–");
const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function Frame({ id, title, sub, onCancel, onSubmit, submitLabel, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("input, select, textarea")?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form ref={ref} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={id} className={`flex max-h-[calc(100vh-32px)] w-full ${wide ? "max-w-[560px]" : "max-w-[480px]"} flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]`}>
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
            {submitLabel ? "Cancel" : "Close"}
          </button>
          {submitLabel && (
            <button type="submit" className="h-9 rounded-lg bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800">
              {submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
const Label = ({ children, req }) => (
  <span className="mb-1 block text-[12px] font-medium text-slate-700">
    {children} {req && <span className="text-red-600">*</span>}
  </span>
);
const Err = ({ msg }) => (msg ? <span className="mt-1 block text-[11.5px] text-red-700">{msg}</span> : null);

/* ---------- 2 · Final invoice ---------- */
export function InvoiceDialog({ c, s, onCancel, onDone }) {
  const [no, setNo] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  const [type, setType] = useState("");
  const [gstin, setGstin] = useState("");
  const [favour, setFavour] = useState(s.cashless ? "Insurer" : "Insured");
  const [tried, setTried] = useState(false);
  const n = Number(String(amount).replace(/[^\d]/g, ""));
  const over = n ? Math.round(((n - s.approved) / s.approved) * 100) : 0;
  const errors = {};
  if (no.trim().length < 3) errors.no = "Enter the invoice number.";
  if (!date) errors.date = "Enter the invoice date.";
  if (!n) errors.amount = "Enter the invoice amount (incl. GST).";
  if (!file) errors.file = "Attach the invoice (PDF, JPG or PNG).";
  if (!type) errors.type = "Select the invoice type.";
  if (!GSTIN_RE.test(gstin.trim().toUpperCase())) errors.gstin = "Enter a valid 15-character GSTIN (e.g. 33AABCS1429B1ZB).";
  const err = (k) => (tried ? errors[k] : null);
  return (
    <Frame
      id="inv-title"
      title="Record final invoice"
      sub={`${c.claimNo} · ${c.garage?.name || c.insured}`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!Object.keys(errors).length) onDone({ no: no.trim(), date, amount: n, type, gstin: gstin.trim().toUpperCase(), favour, file: file.name, receivedOn: new Date().toISOString().slice(0, 10) });
      }}
      submitLabel="Save invoice"
    >
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        Approved amount <b className="text-slate-900">{inr(s.approved)}</b> · tolerance {INVOICE_TOLERANCE_PCT}% (up to {inr(Math.round(s.approved * (1 + INVOICE_TOLERANCE_PCT / 100)))})
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <Label req>Invoice no.</Label>
          <input value={no} onChange={(e) => setNo(e.target.value)} className={inputCls} aria-invalid={!!err("no")} />
          <Err msg={err("no")} />
        </label>
        <label className="block">
          <Label req>Invoice date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-invalid={!!err("date")} />
          <Err msg={err("date")} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <Label req>Invoice type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} aria-invalid={!!err("type")}>
            <option value="">Select</option>
            {INVOICE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Err msg={err("type")} />
        </label>
        <label className="block">
          <Label req>In favour of</Label>
          <select value={favour} onChange={(e) => setFavour(e.target.value)} className={inputCls}>
            <option>Insurer</option>
            <option>Insured</option>
          </select>
        </label>
      </div>
      <label className="block">
        <Label req>Garage GSTIN</Label>
        <input value={gstin} onChange={(e) => setGstin(e.target.value)} maxLength={15} className={`${inputCls} font-mono uppercase`} aria-invalid={!!err("gstin")} />
        <Err msg={err("gstin")} />
      </label>
      <label className="block">
        <Label req>Invoice amount incl. GST (₹)</Label>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} aria-invalid={!!err("amount")} />
        {n > 0 && (
          <span className={`mt-1 block text-[11.5px] ${over > INVOICE_TOLERANCE_PCT ? "text-red-700" : "text-emerald-700"}`}>
            {over > INVOICE_TOLERANCE_PCT
              ? `${over}% above the approved amount – goes to the surveyor for re-check`
              : over > 0
                ? `${over}% above approved – within tolerance`
                : "Within the approved amount"}
          </span>
        )}
        <Err msg={err("amount")} />
      </label>
      <label className="block">
        <Label req>Invoice file</Label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-[12px] file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" aria-label="Invoice file" />
        <Err msg={err("file")} />
      </label>
    </Frame>
  );
}

/* ---------- 3 · Payee & bank ---------- */
export function PayeeDialog({ c, s, onCancel, onDone }) {
  const options = [
    c.garage && { type: "Garage", name: c.garage.name, acct: "XXXXXX4821", ifsc: "HDFC0001234", hint: "Cashless – repair paid to the garage" },
    { type: "Insured", name: c.insured, acct: "XXXXXX7310", ifsc: "SBIN0004567", hint: "Reimbursement to the insured" },
    c.policy.financier && c.policy.financier !== "None" && { type: "Financier", name: c.policy.financier, acct: "XXXXXX0098", ifsc: "ICIC0000011", hint: "Hypothecated vehicle – needs the financier's NOC" },
  ].filter(Boolean);
  const [type, setType] = useState(s.payee?.type || options[0].type);
  const [validated, setValidated] = useState(false);
  const [tried, setTried] = useState(false);
  const o = options.find((x) => x.type === type);
  return (
    <Frame
      id="py-title"
      title="Payee & bank account"
      sub={`${c.claimNo} · payable ${inr(s.payable)}`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (validated) onDone({ type: o.type, name: o.name, acct: o.acct, ifsc: o.ifsc, validatedOn: new Date().toISOString().slice(0, 10) });
      }}
      submitLabel="Save payee"
    >
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[12px] font-medium text-slate-700">
          Pay to <span className="text-red-600">*</span>
        </legend>
        {options.map((x) => (
          <label key={x.type} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${type === x.type ? "border-teal-600 bg-teal-50/60" : "border-slate-200"}`}>
            <input
              type="radio"
              name="payee"
              checked={type === x.type}
              onChange={() => {
                setType(x.type);
                setValidated(false);
              }}
              className="mt-1 h-4 w-4 accent-teal-700"
            />
            <span className="min-w-0 text-[12.5px]">
              <b className="font-semibold text-slate-800">{x.type}</b> · {x.name}
              <span className="block text-[11.5px] text-slate-500">
                {x.hint} · A/c {x.acct} · IFSC {x.ifsc}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-[12px] text-slate-700">{validated ? `Account verified – name matches “${o.name}”` : "Verify the bank account (₹1 penny-drop check) before payment."}</span>
        {validated ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <button type="button" onClick={() => setValidated(true)} className="h-7 flex-none rounded-md border border-teal-700 px-2.5 text-[12px] font-semibold text-teal-800 hover:bg-teal-50">
            Verify account
          </button>
        )}
      </div>
      <Err msg={tried && !validated ? "Verify the bank account first." : null} />
    </Frame>
  );
}

/* ---------- 1 · Liability working sheet (sent with the DO) ---------- */
export function WorkingSheetDialog({ c, s, onCancel }) {
  const w = s.sheet;
  const rows = [
    ["Garage estimate", w.estimate, ""],
    ["Assessed loss (surveyor)", w.assessed, ""],
    ["Less: depreciation on parts", -w.depreciation, w.zeroDep ? "Nil – Zero depreciation add-on" : "As per IRDAI depreciation schedule"],
    ["Less: salvage value", -w.salvage, "Retained by the insured"],
    ["Less: compulsory deductible", -w.compulsory, ""],
    ["Less: voluntary deductible", -w.voluntary, ""],
  ].filter((r) => r[1] != null && r[1] !== 0);
  return (
    <Frame id="ws-title" title="Liability working sheet" sub={`${s.do?.no || c.claimNo} · ${c.insured} · ${c.vehicle.makeModel}`} onCancel={onCancel} onSubmit={(e) => { e.preventDefault(); onCancel(); }} wide>
      <table className="w-full text-[12.5px]">
        <tbody>
          {rows.map(([l, v, note]) => (
            <tr key={l} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-700">
                {l}
                {note && <span className="block text-[11px] text-slate-500">{note}</span>}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${v < 0 ? "text-red-700" : "text-slate-900"}`}>{v < 0 ? `– ${inr(-v)}` : inr(v)}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 font-semibold text-slate-900">Net liability (approved)</td>
            <td className="pt-2 text-right text-[14px] font-semibold tabular-nums text-slate-900">{inr(w.net)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[11.5px] text-slate-500">
        {s.do ? `Sent with the delivery order to: ${s.do.sentTo.join(", ")} (email & SMS link) on ${fmt(s.do.date)}.` : "Reimbursement – sent to the insured with the settlement letter."}
      </p>
    </Frame>
  );
}

/* ---------- 4 · Settlement consent ---------- */
export function ConsentDialog({ c, s, onCancel, onDone }) {
  const [mode, setMode] = useState(CONSENT_MODES[0]);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [signed, setSigned] = useState(false);
  const [file, setFile] = useState(null);
  const [tried, setTried] = useState(false);
  let error = null;
  if (mode === CONSENT_MODES[0] && !/^\d{6}$/.test(otp)) error = otpSent ? "Enter the 6-digit OTP the insured received." : "Send the OTP to the insured first.";
  if (mode === CONSENT_MODES[1] && !signed) error = "Wait for the insured to complete the e-sign.";
  if (mode === CONSENT_MODES[2] && !file) error = "Attach the signed discharge voucher.";
  return (
    <Frame
      id="cs-title"
      title="Settlement consent"
      sub={`${c.insured} agrees to ${inr(s.payable)} in full and final settlement`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!error) onDone({ mode, receivedOn: new Date().toISOString().slice(0, 10), ref: mode === CONSENT_MODES[2] ? file.name : mode === CONSENT_MODES[0] ? "OTP verified" : "e-Sign completed" });
      }}
      submitLabel="Record consent"
    >
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[12px] font-medium text-slate-700">How the insured consents</legend>
        {CONSENT_MODES.map((m) => (
          <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${mode === m ? "border-teal-600 bg-teal-50/60" : "border-slate-200"}`}>
            <input type="radio" name="consent" checked={mode === m} onChange={() => setMode(m)} className="h-4 w-4 accent-teal-700" />
            {m}
          </label>
        ))}
      </fieldset>
      {mode === CONSENT_MODES[0] && (
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <Label req>OTP</Label>
            <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={!otpSent} className={`${inputCls} font-mono tracking-widest`} />
          </label>
          <button type="button" onClick={() => setOtpSent(true)} className="h-9 rounded-lg border border-teal-700 px-3 text-[12.5px] font-semibold text-teal-800 hover:bg-teal-50">
            {otpSent ? "Resend OTP" : `Send OTP to ${c.contact.mobile}`}
          </button>
        </div>
      )}
      {mode === CONSENT_MODES[1] && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
          <span>{signed ? "e-Sign completed by the insured" : "e-Sign link sent to the insured's mobile and email"}</span>
          {!signed && (
            <button type="button" onClick={() => setSigned(true)} className="h-7 rounded-md border border-teal-700 px-2.5 text-[12px] font-semibold text-teal-800 hover:bg-teal-50">
              Mark signed
            </button>
          )}
        </div>
      )}
      {mode === CONSENT_MODES[2] && (
        <label className="block">
          <Label req>Signed voucher</Label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-[12px] file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" aria-label="Signed voucher" />
        </label>
      )}
      <Err msg={tried ? error : null} />
    </Frame>
  );
}

/* ---------- 5 · Delivery & satisfaction (cashless, before payment) ---------- */
export function DeliveryDialog({ c, onCancel, onDone }) {
  const [[today]] = useState(() => [new Date().toISOString().slice(0, 10)]);
  const [on, setOn] = useState(today);
  const [sat, setSat] = useState(false);
  const [tried, setTried] = useState(false);
  return (
    <Frame
      id="dl-title"
      title="Delivery & satisfaction"
      sub={`${c.vehicle.regNo} · ${c.garage?.name}`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (sat && on) onDone({ on });
      }}
      submitLabel="Confirm delivery"
    >
      <p className="text-[12.5px] text-slate-700">For cashless claims the garage is paid only after the insured takes delivery and confirms satisfaction with the repair.</p>
      <label className="block max-w-[200px]">
        <Label req>Delivered on</Label>
        <input type="date" value={on} max={today} onChange={(e) => setOn(e.target.value)} className={inputCls} />
      </label>
      <label className="flex items-start gap-2 text-[12.5px] text-slate-800">
        <input type="checkbox" checked={sat} onChange={(e) => setSat(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
        Insured has taken delivery and signed the satisfaction note
      </label>
      <Err msg={tried && !sat ? "Confirm the delivery and satisfaction note." : null} />
    </Frame>
  );
}

/* ---------- the panel ---------- */
export default function SettlementPanel({ s, canAct, closed, onViewSheet, onInvoice, onSurveyorOk, onPayee, onConsent, onDelivery, onRequestPayment, onMarkPaid }) {
  const paid = s.payment?.status === "PAID";
  const steps = [
    {
      key: "do",
      Icon: Truck,
      title: "Delivery order",
      done: true,
      text: s.cashless ? `${s.do.no} · ${fmt(s.do.date)} · approved ${inr(s.approved)} · sent to ${s.do.sentTo.join(", ").toLowerCase()}` : `Reimbursement – approved ${inr(s.approved)}`,
      action: ["Working sheet", onViewSheet, false, true],
    },
    {
      key: "invoice",
      Icon: ReceiptText,
      title: "Final invoice",
      done: s.invoiceOk,
      warn: s.invoice && s.overTolerance && !s.invoice.surveyorOk,
      text: s.invoice
        ? `${s.invoice.no} · ${s.invoice.type || "–"} · GSTIN ${s.invoice.gstin || "–"} · in favour of ${s.invoice.favour || "–"} · ${inr(s.invoice.amount)} · ${s.overPct > 0 ? `${s.overPct}% above approved` : "within approved"}${s.invoice.surveyorOk ? ` · surveyor confirmed – payable ${inr(s.payable)}` : s.overTolerance ? ` – above ${INVOICE_TOLERANCE_PCT}%, surveyor to re-check` : ""}`
        : `${s.cashless ? "From the garage" : "Repair bills from the insured"} – compared with ${inr(s.approved)}`,
      action: !s.invoice ? ["Record invoice", onInvoice] : s.overTolerance && !s.invoice.surveyorOk ? ["Surveyor confirmed", onSurveyorOk] : null,
    },
    {
      key: "payee",
      Icon: Landmark,
      title: "Payee & bank",
      done: !!s.payee,
      text: s.payee ? `${s.payee.type} · ${s.payee.name} · A/c ${s.payee.acct} · verified ${fmt(s.payee.validatedOn)}` : "Choose who is paid and verify the bank account",
      action: !s.payee && !s.payment ? ["Set payee", onPayee] : null,
    },
    {
      key: "consent",
      Icon: FileCheck2,
      title: "Settlement consent",
      done: !!s.consent,
      text: s.consent ? `${s.consent.mode} · ${fmt(s.consent.receivedOn)}` : `Insured agrees to ${inr(s.payable)} – OTP, e-sign or signed voucher`,
      action: !s.consent ? ["Record consent", onConsent] : null,
    },
    s.cashless && {
      key: "delivery",
      Icon: CarFront,
      title: "Delivery & satisfaction",
      done: !!s.delivery,
      text: s.delivery ? `Vehicle delivered ${fmt(s.delivery.on)} · satisfaction note signed` : "Before the garage is paid – insured takes delivery and confirms satisfaction",
      action: !s.delivery ? ["Confirm delivery", onDelivery] : null,
    },
    {
      key: "payment",
      Icon: Send,
      title: "Payment",
      done: paid,
      text: !s.payment
        ? `${inr(s.payable)} by NEFT – needs invoice, payee, consent${s.cashless ? " and delivery" : ""}`
        : paid
          ? `Paid ${inr(s.payment.amount)} · UTR ${s.payment.utr} · ${fmt(s.payment.paidOn)}`
          : `${inr(s.payment.amount)} sent to Finance ${fmt(s.payment.requestedOn)} – awaiting UTR`,
      action: !s.payment ? ["Raise payment request", onRequestPayment, !s.readyToPay] : !paid ? ["Mark paid (Finance)", onMarkPaid] : null,
    },
    {
      key: "close",
      Icon: Lock,
      title: "Claim closed",
      done: closed,
      text: closed ? "Closed automatically after full settlement – reserve ₹0" : "Closes automatically when the payment succeeds",
    },
  ].filter(Boolean);
  const doneCount = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);

  return (
    <section className="rounded-lg border border-slate-200 bg-white" aria-label="Settlement">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
          <BadgeCheck className="h-4 w-4 text-teal-700" aria-hidden="true" /> Settlement
          <span className="rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
            {doneCount} of {steps.length} done
          </span>
        </h3>
        <span className="text-[12px] text-slate-600">
          Approved <b className="text-slate-900">{inr(s.approved)}</b> · payable <b className="text-slate-900">{inr(s.payable)}</b>
        </span>
      </div>
      <ol className="divide-y divide-slate-100">
        {steps.map((st, i) => {
          const isNext = next?.key === st.key;
          return (
            <li key={st.key} className={`flex items-start gap-3 px-3 py-2 ${isNext ? "bg-teal-50/50" : ""}`}>
              <span
                className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold ${
                  st.done ? "bg-teal-600 text-white" : st.warn ? "bg-amber-100 text-amber-800" : isNext ? "bg-[#0B1F3A] text-white" : "border border-slate-300 text-slate-500"
                }`}
              >
                {st.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : st.warn ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                  <st.Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> {st.title}
                </span>
                <span className={`block text-[12px] ${st.warn ? "text-amber-800" : "text-slate-600"}`}>{st.text}</span>
              </span>
              {(canAct || st.action?.[3]) && st.action && (
                <button
                  type="button"
                  onClick={st.action[1]}
                  disabled={!!st.action[2]}
                  title={st.action[2] ? "Complete the earlier steps first" : undefined}
                  className={`h-7 flex-none rounded-md px-2.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                    (isNext || st.warn) && !st.action[3] ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {st.action[0]}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}