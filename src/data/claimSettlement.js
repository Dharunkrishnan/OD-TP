// src/data/claimSettlement.js
// Settlement rules for an OD claim (Claim 360 → Settlement panel).
//   • Final invoice may exceed the approved amount by up to 5 %; above that the surveyor re-checks
//     and the payable amount stays at the approved amount (excess collected by the garage from the insured).
//   • Payment needs: invoice OK + payee with verified bank account + settlement consent (121)
//     + for cashless, delivery & satisfaction confirmed BEFORE payment (77).
//   • Claim closes automatically once the payment succeeds, reserve released to nil (130).
// The handler's entries are saved in the claim work record (claimWork.js → settlement).

export const INVOICE_TOLERANCE_PCT = 5;
export const INVOICE_TYPES = ["Parts", "Labour", "Combined (parts + labour)"];
export const CONSENT_MODES = ["OTP to insured's mobile", "e-Sign (Aadhaar)", "Signed discharge voucher (physical)"];
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** settlement state of a claim = claim data defaults + what the handler recorded this session */
export function settlementState(c, saved = {}) {
  const approved = c.survey?.netLiability ?? c.reserve;
  const cashless = !!c.garage;
  const approvedOn = c.timeline.find((e) => /approv/i.test(e.event))?.date || c.regDate;
  const base = {
    approved,
    cashless,
    do: cashless ? { no: `DO/${c.claimNo.replace(/\//g, "").slice(-8)}`, date: approvedOn, sentTo: ["Repairer", "Insured", "Agent"] } : null,
    // liability working sheet sent with the DO (catalogue 91)
    sheet: {
      estimate: c.survey?.estimate,
      assessed: c.survey?.assessed ?? approved,
      depreciation: c.survey?.depreciation ?? 0,
      salvage: c.survey?.salvage ?? 0,
      compulsory: c.policy?.compulsoryDeductible ?? 0,
      voluntary: c.policy?.voluntaryDeductible ?? 0,
      zeroDep: !!c.survey?.zeroDep,
      net: approved,
    },
  };
  if (c.stage === "Payment") {
    const p = c.payments?.[0];
    Object.assign(base, {
      invoice: { no: `INV-${c.claimNo.slice(-4)}`, date: approvedOn, amount: approved, type: "Combined (parts + labour)", gstin: "33AABCS1429B1ZB", favour: "Insurer", receivedOn: approvedOn, file: "final-invoice.pdf" },
      payee: { type: cashless ? "Garage" : "Insured", name: p?.payee || c.insured, acct: "XXXXXX4821", ifsc: "HDFC0001234", validatedOn: approvedOn },
      consent: { mode: "Signed discharge voucher (physical)", receivedOn: approvedOn },
      ...(cashless ? { delivery: { on: approvedOn } } : {}),
      payment: { status: "REQUESTED", amount: p?.amount ?? approved, requestedOn: p?.date || approvedOn, mode: "NEFT" },
    });
  }
  const s = { ...base, ...saved };
  const inv = s.invoice;
  const overPct = inv ? Math.round(((inv.amount - approved) / approved) * 100) : 0;
  const overTolerance = inv ? inv.amount > approved * (1 + INVOICE_TOLERANCE_PCT / 100) : false;
  const payable = inv ? Math.min(inv.amount, approved) : approved;
  const readyToPay = !!inv && (!overTolerance || !!inv.surveyorOk) && !!s.payee && !!s.consent && (!cashless || !!s.delivery);
  return { ...s, overPct, overTolerance, invoiceOk: !!inv && (!overTolerance || !!inv.surveyorOk), payable, readyToPay };
}