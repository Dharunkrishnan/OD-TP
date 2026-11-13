// src/components/SettlementPanel.jsx
// Settlement on Claim 360 (Claims Handler) – the handler drives the steps other teams complete:
//   1 Delivery order (DO) to the garage after approval          – catalogue 91 (System)
//   2 Final invoice vs approved amount, 5 % tolerance            – 79–83 (Garage / Surveyor)
//   3 Payee & bank account validation                            – 120, 122
//   4 Discharge voucher / satisfaction from the insured          – 121, 77
//   5 Payment request to Finance → paid (UTR)                    – 125, 126 (Finance)
//   6 Close claim after payment, reserve to ₹0                   – 130
// Steps done by the garage, surveyor or Finance are recorded here by the handler until those
// personas have their own screens (demo).

import { useEffect, useRef, useState } from "react";
import { INVOICE_TOLERANCE_PCT } from "../data/claimSettlement";
import { X, Check, FileCheck2, Landmark, ReceiptText, Send, BadgeCheck, Lock, Truck, AlertTriangle } from "lucide-react";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–");
const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

function Frame({ id, title, sub, onCancel, onSubmit, submitLabel, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("input, select, textarea")?.focus();
    const esc = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form ref={ref} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={id} className="flex max-h-[calc(100vh-32px)] w-full max-w-[480px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(11,31,58,0.3)]">
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
  const [tried, setTried] = useState(false);
  const n = Number(String(amount).replace(/[^\d]/g, ""));
  const over = n ? Math.round(((n - s.approved) / s.approved) * 100) : 0;
  const errors = {};
  if (no.trim().length < 3) errors.no = "Enter the invoice number.";
  if (!date) errors.date = "Enter the invoice date.";
  if (!n) errors.amount = "Enter the invoice amount (incl. GST).";
  if (!file) errors.file = "Attach the invoice (PDF, JPG or PNG).";
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
        if (!Object.keys(errors).length) onDone({ no: no.trim(), date, amount: n, file: file.name, receivedOn: new Date().toISOString().slice(0, 10) });
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

/* ---------- 6 · Close after payment ---------- */
export function CloseSettledDialog({ c, s, onCancel, onDone }) {
  const [sat, setSat] = useState(false);
  const [tried, setTried] = useState(false);
  return (
    <Frame
      id="cl-title"
      title="Close claim"
      sub={`${c.claimNo} · paid ${inr(s.payment?.amount)} · UTR ${s.payment?.utr}`}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (sat) onDone();
      }}
      submitLabel="Close claim"
    >
      <p className="text-[12.5px] text-slate-700">The outstanding reserve is released to ₹0 and the claim moves to Closed. It can be reopened later with the manager's approval (e.g. supplementary claim).</p>
      <label className="flex items-start gap-2 text-[12.5px] text-slate-800">
        <input type="checkbox" checked={sat} onChange={(e) => setSat(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
        {s.cashless ? "Vehicle delivered and the insured's satisfaction note is received" : "Insured confirms receipt of the payment"}
      </label>
      <Err msg={tried && !sat ? "Confirm before closing." : null} />
    </Frame>
  );
}

/* ---------- the panel ---------- */
export default function SettlementPanel({ s, canAct, closed, onInvoice, onSurveyorOk, onPayee, onDischarge, onRequestPayment, onMarkPaid, onClose }) {
  const paid = s.payment?.status === "PAID";
  const steps = [
    {
      key: "do",
      Icon: Truck,
      title: "Delivery order",
      done: !s.cashless || !!s.do,
      text: s.cashless ? `${s.do.no} · ${fmt(s.do.date)} · approved ${inr(s.approved)}` : "Not applicable – reimbursement claim",
    },
    {
      key: "invoice",
      Icon: ReceiptText,
      title: "Final invoice",
      done: s.invoiceOk,
      warn: s.invoice && s.overTolerance && !s.invoice.surveyorOk,
      text: s.invoice
        ? `${s.invoice.no} · ${inr(s.invoice.amount)} · ${s.overPct > 0 ? `${s.overPct}% above approved` : "within approved"}${s.invoice.surveyorOk ? ` · surveyor confirmed – payable ${inr(s.payable)}` : s.overTolerance ? ` – above ${INVOICE_TOLERANCE_PCT}%, surveyor to re-check` : ""}`
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
      key: "discharge",
      Icon: FileCheck2,
      title: "Discharge voucher",
      done: !!s.discharge,
      text: s.discharge ? `Signed voucher received ${fmt(s.discharge.receivedOn)}` : "Signed by the insured, agreeing to the settlement amount",
      action: !s.discharge ? ["Mark received", onDischarge] : null,
    },
    {
      key: "payment",
      Icon: Send,
      title: "Payment",
      done: paid,
      text: !s.payment
        ? `${inr(s.payable)} by NEFT – needs invoice, payee and discharge`
        : paid
          ? `Paid ${inr(s.payment.amount)} · UTR ${s.payment.utr} · ${fmt(s.payment.paidOn)}`
          : `${inr(s.payment.amount)} sent to Finance ${fmt(s.payment.requestedOn)} – awaiting UTR`,
      action: !s.payment
        ? ["Raise payment request", onRequestPayment, !(s.invoiceOk && s.payee && s.discharge)]
        : !paid
          ? ["Mark paid (Finance)", onMarkPaid]
          : null,
    },
    {
      key: "close",
      Icon: Lock,
      title: "Close claim",
      done: closed,
      text: closed ? "Claim settled and closed – reserve ₹0" : "After payment and delivery",
      action: paid && !closed ? ["Close claim", onClose] : null,
    },
  ];
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
              {canAct && st.action && (
                <button
                  type="button"
                  onClick={st.action[1]}
                  disabled={!!st.action[2]}
                  title={st.action[2] ? "Complete the invoice, payee and discharge steps first" : undefined}
                  className={`h-7 flex-none rounded-md px-2.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                    isNext || st.warn ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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