// src/data/claimSettlement.js
// Settlement rules for an OD claim (Claim 360 → Settlement panel), in the order the work happens:
//   1 Repair authorisation (Decision stage)                                   – catalogue 73
//   2 Final invoice from the garage, compared with the assessed loss (5 % tolerance);
//     estimate → assessed → bill variance                                      – 78, 80–83
//   3 Re-inspection after repair: repairs done, replaced parts seen, salvage    – 47
//   4 Delivery order (DO) + liability working sheet to repairer / insured / agent – 84–91
//   5 Payee & bank account validation (name match)                             – 120, 122
//   6 Settlement consent: OTP / e-sign / signed voucher                        – 121
//   7 Delivery & satisfaction – cashless, BEFORE payment                       – 77
//   8 Payment request to Finance → paid (UTR)                                  – 125, 126
//   9 Auto-close after full settlement, reserve released to nil                – 130
//   • The garage bills the repair at the assessed loss. Up to 5 % above it is accepted; above that the
//     surveyor re-checks. The insurer pays the net liability; depreciation, deductibles, disallowed items
//     and any bill above the assessment are collected by the garage from the insured.
//   • A bill below the assessed loss reduces the insurer's share by the same amount.
// The handler's entries are saved in the claim work record (claimWork.js → settlement).

export const INVOICE_TOLERANCE_PCT = 5;
export const INVOICE_TYPES = ["Parts", "Labour", "Combined (parts + labour)"];
export const CONSENT_MODES = ["OTP to insured's mobile", "e-Sign (Aadhaar)", "Signed discharge voucher (physical)"];
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const DAY = 86400000;
const toMs = (iso) => new Date(iso + "T00:00:00").getTime();
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);
// a date k of the way from a to b (0 = a, 1 = b) – keeps the steps in order whatever the gap
const between = (a, b, k) => toIso(toMs(a) + Math.round(((toMs(b) - toMs(a)) / DAY) * k) * DAY);

/** settlement state of a claim = claim data defaults + what the handler recorded this session */
export function settlementState(c, saved = {}) {
  const approved = c.survey?.netLiability ?? c.reserve;
  const assessed = c.survey?.assessed ?? approved;
  const cashless = !!c.garage;
  const decided = c.timeline.find((e) => /^(Repair authorised|Approved)/.test(e.event));
  const authorisedOn = decided?.date || c.timeline.find((e) => /^Survey completed/.test(e.event))?.date || c.regDate;
  const surveyor = c.survey?.surveyor?.name || "Karthik Subramanian";
  const doNo = `DO/${c.claimNo.replace(/\//g, "").slice(-8)}`;
  const base = {
    approved,
    assessed,
    estimate: c.survey?.estimate ?? null,
    cashless,
    authorisation: { date: authorisedOn, by: decided?.by || "–" },
    // liability working sheet sent with the DO (catalogue 91)
    sheet: {
      estimate: c.survey?.estimate,
      assessed,
      depreciation: c.survey?.depreciation ?? 0,
      salvage: c.survey?.salvage ?? 0,
      compulsory: c.policy?.compulsoryDeductible ?? 0,
      voluntary: c.policy?.voluntaryDeductible ?? 0,
      zeroDep: !!c.survey?.zeroDep,
      net: approved,
    },
  };
  // demo bill: the garage bills slightly above the assessment (within tolerance) – the excess is the insured's
  const billOf = () => assessed + Math.round((assessed * 0.012) / 10) * 10;
  const invoiceOn = (date) => ({ no: `INV-${c.claimNo.slice(-4)}`, date, amount: billOf(), type: "Combined (parts + labour)", gstin: "33AABCS1429B1ZB", favour: cashless ? "Insurer" : "Insured", receivedOn: date, file: "final-invoice.pdf" });
  const reinspOn = (date, salvageCollected = true) => ({ on: date, by: surveyor, partsVerified: true, salvageCollected });
  const doOn = (date) => ({ no: doNo, date, sentTo: ["Repairer", "Insured", "Agent"] });

  const na = (c.nextAction || "").toLowerCase();
  const today = toIso(Date.now() - (Date.now() % DAY));
  if (c.stage === "Repair / DO") {
    // where the repair stands, from the claim's next action
    const lastWeek = between(authorisedOn, today, 0.8);
    if (/re-inspection/.test(na)) Object.assign(base, { invoice: invoiceOn(lastWeek) });
    else if (/salvage/.test(na)) Object.assign(base, { invoice: invoiceOn(lastWeek), reinspection: reinspOn(between(authorisedOn, today, 0.9), false) });
    else if (/delivery order/.test(na)) Object.assign(base, { invoice: invoiceOn(lastWeek), reinspection: reinspOn(between(authorisedOn, today, 0.9)) });
    // "Track repair progress": repair under way, nothing billed yet
  }
  if (c.stage === "Payment") {
    const p = c.payments?.[0];
    const payOn = p?.date || today;
    const d = (k) => between(authorisedOn, payOn, k);
    Object.assign(base, {
      invoice: invoiceOn(d(0.45)),
      reinspection: reinspOn(d(0.5)),
      do: cashless ? doOn(d(0.55)) : null,
      payee: { type: cashless ? "Garage" : "Insured", name: p?.payee || c.insured, acct: "XXXXXX4821", ifsc: "HDFC0001234", validatedOn: d(0.6) },
      consent: { mode: "Signed discharge voucher (physical)", receivedOn: d(0.7) },
      ...(cashless ? { delivery: { on: d(0.8) } } : {}),
      payment: { status: "REQUESTED", amount: p?.amount ?? approved, requestedOn: payOn, mode: "NEFT" },
    });
  }
  // a claim closed earlier after payment: every step is complete
  if (c.closure?.type === "Paid") {
    const cl = c.closure;
    const d = (k) => between(authorisedOn, cl.closedOn, k);
    Object.assign(base, {
      invoice: base.invoice || invoiceOn(d(0.45)),
      reinspection: base.reinspection || reinspOn(d(0.5)),
      do: cashless ? base.do || doOn(d(0.55)) : null,
      consent: base.consent || { mode: "Signed discharge voucher (physical)", receivedOn: d(0.7) },
      payment: { status: "PAID", amount: cl.paid, requestedOn: d(0.9), paidOn: cl.closedOn, utr: cl.utr, mode: "NEFT" },
      payee: { type: cashless ? "Garage" : "Insured", name: cl.payee, acct: base.payee?.acct || "XXXXXX4821", ifsc: base.payee?.ifsc || "HDFC0001234", validatedOn: d(0.6) },
    });
    if (cashless) base.delivery = { on: d(0.8) };
  }
  const s = { ...base, ...saved };
  const inv = s.invoice;
  // final bill vs assessed loss (catalogue 78)
  const overPct = inv ? Math.round(((inv.amount - assessed) / assessed) * 1000) / 10 : 0;
  const overTolerance = inv ? inv.amount > assessed * (1 + INVOICE_TOLERANCE_PCT / 100) : false;
  const payable = inv ? Math.max(0, approved - Math.max(0, assessed - inv.amount)) : approved;
  const invoiceOk = !!inv && (!overTolerance || !!inv.surveyorOk);
  const reinspected = !!s.reinspection;
  const doIssued = !cashless || !!s.do;
  const readyToPay = invoiceOk && reinspected && doIssued && !!s.payee && !!s.consent && (!cashless || !!s.delivery);
  return { ...s, overPct, overTolerance, invoiceOk, payable, insuredShare: inv ? Math.max(0, inv.amount - payable) : null, reinspected, doIssued, readyToPay };
}