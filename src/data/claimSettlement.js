// src/data/claimSettlement.js
// Settlement rules for an OD claim (Claim 360 → Settlement panel).
//   • Final invoice may exceed the approved amount by up to 5 %; above that the surveyor re-checks
//     and the payable amount stays at the approved amount (excess collected by the garage from the insured).
//   • Payment needs: invoice OK + payee with verified bank account + signed discharge voucher.
// The handler's entries are saved in the claim work record (claimWork.js → settlement).

export const INVOICE_TOLERANCE_PCT = 5;

/** settlement state of a claim = claim data defaults + what the handler recorded this session */
export function settlementState(c, saved = {}) {
  const approved = c.survey?.netLiability ?? c.reserve;
  const cashless = !!c.garage;
  const approvedOn = c.timeline.find((e) => /approv/i.test(e.event))?.date || c.regDate;
  const base = {
    approved,
    cashless,
    do: cashless ? { no: `DO/${c.claimNo.replace(/\//g, "").slice(-8)}`, date: approvedOn } : null,
  };
  if (c.stage === "Payment") {
    const p = c.payments?.[0];
    Object.assign(base, {
      invoice: { no: `INV-${c.claimNo.slice(-4)}`, date: approvedOn, amount: approved, receivedOn: approvedOn, file: "final-invoice.pdf" },
      payee: { type: cashless ? "Garage" : "Insured", name: p?.payee || c.insured, acct: "XXXXXX4821", ifsc: "HDFC0001234", validatedOn: approvedOn },
      discharge: { receivedOn: approvedOn },
      payment: { status: "REQUESTED", amount: p?.amount ?? approved, requestedOn: p?.date || approvedOn, mode: "NEFT" },
    });
  }
  const s = { ...base, ...saved };
  const inv = s.invoice;
  const overPct = inv ? Math.round(((inv.amount - approved) / approved) * 100) : 0;
  const overTolerance = inv ? inv.amount > approved * (1 + INVOICE_TOLERANCE_PCT / 100) : false;
  const payable = inv ? Math.min(inv.amount, approved) : approved;
  return { ...s, overPct, overTolerance, invoiceOk: !!inv && (!overTolerance || !!inv.surveyorOk), payable };
}