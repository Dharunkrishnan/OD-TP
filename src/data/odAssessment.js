// src/data/odAssessment.js
// Assessment working for a claim – the same numbers feed the Survey stage (damaged parts), the
// Assessment stage (part-wise table, depreciation, deductibles, summary) and the Claim 360 summary.
// Catalogue: 52–55 estimate & part-wise assessment · 56 add-on validation · 57 depreciation ·
// 58 deductibles & salvage · 59 assessment summary · 88 GST type · 95–101 total loss / CTL · 104–108 theft.
//
// Rules (Indian Motor Tariff practice, same as odApprovalsMock.js – confirm with business):
//   Depreciation (no Zero Depreciation add-on): rubber / plastic / nylon / battery 50% · fibreglass 30% ·
//   glass nil · metal & electrical by vehicle age (< 6 m nil · 6 m–1 y 5% · 1–2 y 10% · 2–3 y 15% ·
//   3–4 y 25% · 4–5 y 35% · 5–10 y 40% · over 10 y 50%) · painting 12.5% (50% on paint material,
//   taken as 25% of the paint bill) · labour and consumables nil.
//   Compulsory deductible (private car): ₹1,000 up to 1500 cc · ₹2,000 above 1500 cc.
//   Total loss / CTL: repair cost above 75% of IDV.
// Replace with: GET /od/claims/:claimNo/assessment

export const CTL_THRESHOLD = 0.75;
export const DEP_TEXT = { metal: "Metal", electrical: "Electrical", plastic: "Plastic / rubber", battery: "Battery", fibre: "Fibreglass", glass: "Glass", labour: "Labour", paint: "Painting", consumable: "Consumables" };

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const r10 = (n) => Math.round(n / 10) * 10;
const r100 = (n) => Math.round(n / 100) * 100;

export function compulsoryDeductible(cc) {
  return cc > 1500 ? 2000 : 1000;
}

// Point of impact from the stated cause (demo – a real claim takes it from the survey)
export function impactOf(cause = "", lossType = "") {
  const c = cause.toLowerCase();
  if (lossType === "Partial theft") return "Parts stolen";
  if (/flood|water/.test(c) || lossType === "Flood – CAT") return "Under-body & cabin (water ingress)";
  if (/fire/.test(c) || lossType === "Fire") return "Engine bay (fire)";
  if (/behind|rear|revers/.test(c)) return "Rear";
  if (/side|scrap|swipe|turn/.test(c)) return "Left side";
  return "Front";
}

// [item, type, action, weight, flag]
const PARTS = {
  Front: [["Front bumper", "plastic", "Replace", 3], ["Headlamp assembly (R)", "plastic", "Replace", 3], ["Grille", "plastic", "Replace", 1], ["Bonnet", "metal", "Repair", 2], ["Radiator support", "metal", "Replace", 2]],
  Rear: [["Rear bumper", "plastic", "Replace", 3], ["Tail lamp (L)", "plastic", "Replace", 2], ["Boot lid", "metal", "Repair", 2], ["Rear panel", "metal", "Repair", 2]],
  "Left side": [["Left front door", "metal", "Replace", 4], ["Left rear door", "metal", "Repair", 2], ["ORVM (L)", "plastic", "Replace", 2], ["Side skirt", "plastic", "Replace", 1]],
  "Under-body & cabin (water ingress)": [["Engine – hydrostatic lock repair", "metal", "Repair", 4, "engine"], ["Wiring harness", "electrical", "Replace", 2], ["Seats & carpet", "plastic", "Replace", 2], ["ECU", "electrical", "Replace", 3]],
  "Engine bay (fire)": [["Wiring harness", "electrical", "Replace", 3], ["Engine components", "metal", "Replace", 3], ["Bonnet", "metal", "Replace", 2], ["Battery", "battery", "Replace", 1]],
  "Parts stolen": [["Infotainment / music system", "electrical", "Replace", 3], ["Alloy wheels (2)", "metal", "Replace", 3], ["Tyres (2)", "plastic", "Replace", 2]],
};
export const damagedParts = (impact) => (PARTS[impact] || PARTS.Front).map((p) => p[0]).join(", ");

export function vehicleAge(yom, lossDate) {
  const [y, m] = lossDate.split("-").map(Number);
  const months = Math.max(0, (y - yom) * 12 + (m - 7)); // year of manufacture only → taken as mid-year
  return { months, label: `${Math.floor(months / 12)} y ${months % 12} m` };
}
export function metalRate(months) {
  if (months < 6) return 0;
  if (months < 12) return 0.05;
  if (months < 24) return 0.1;
  if (months < 36) return 0.15;
  if (months < 48) return 0.25;
  if (months < 60) return 0.35;
  if (months < 120) return 0.4;
  return 0.5;
}

// put the rounding difference on the biggest line so the column adds up exactly
function fit(lines, key, total) {
  const diff = total - lines.reduce((s, l) => s + l[key], 0);
  if (!diff) return;
  const big = lines.filter((l) => l[key] > 0).sort((a, b) => b[key] - a[key])[0];
  if (big) big[key] += diff;
}

/* Partial loss (accident, flood, fire, partial theft): part-wise lines that add up to the garage
   estimate and the assessed loss, with depreciation from the schedule. */
export function partialAssessment({ estimate, assessed, zeroDep, yom, lossDate, cause, lossType, addOns, salvage, deductibles }) {
  const impact = impactOf(cause, lossType);
  const parts = PARTS[impact] || PARTS.Front;
  const age = vehicleAge(yom, lossDate);
  const mRate = metalRate(age.months);
  const noPaint = /water|stolen/.test(impact);
  const share = noPaint ? { parts: 0.7, labour: 0.27, paint: 0, cons: 0.03 } : { parts: 0.57, labour: 0.25, paint: 0.15, cons: 0.03 };
  const wSum = parts.reduce((s, p) => s + p[3], 0);
  const lines = parts.map(([item, type, action, w, flag]) => ({ item, type, action, flag, estimate: r10((estimate * share.parts * w) / wSum) }));
  if (impact === "Parts stolen") lines.push({ item: "Labour – fitting", type: "labour", action: "Labour", estimate: r10(estimate * share.labour) });
  else {
    lines.push({ item: /water|fire/.test(impact) ? "Labour – cleaning, removal & refitting" : "Labour – removal & refitting", type: "labour", action: "Labour", estimate: r10(estimate * share.labour * 0.45) });
    lines.push({ item: /water|fire/.test(impact) ? "Labour – electrical & engine work" : "Labour – denting", type: "labour", action: "Labour", estimate: r10(estimate * share.labour * 0.55) });
  }
  if (share.paint) lines.push({ item: "Painting", type: "paint", action: "Labour + material", estimate: r10(estimate * share.paint) });
  lines.push({ item: "Consumables (oil, coolant, clips)", type: "consumable", action: "Replace", estimate: r10(estimate * share.cons) });
  fit(lines, "estimate", estimate);

  const has = (a) => addOns.includes(a);
  const disallow = (l) => (l.type === "consumable" && !has("Consumables")) || (l.flag === "engine" && !has("Engine protect"));
  let allowed = lines.filter((l) => !disallow(l));
  let base = allowed.reduce((s, l) => s + l.estimate, 0);
  if (base < assessed) {
    // engine claim pursued on survey findings even without Engine protect (keeps the assessed loss reachable)
    allowed = lines.filter((l) => !(l.type === "consumable" && !has("Consumables")));
    base = allowed.reduce((s, l) => s + l.estimate, 0);
  }
  const f = Math.min(1, assessed / base);
  lines.forEach((l) => {
    const ok = allowed.includes(l);
    l.assessed = ok ? r10(l.estimate * f) : 0;
    l.remark = !ok
      ? l.type === "consumable"
        ? "Disallowed – Consumables add-on not opted"
        : "Disallowed – consequential engine damage, Engine protect not opted"
      : l.type === "consumable"
        ? "Allowed – Consumables add-on"
        : f >= 0.999
          ? "Allowed as estimated"
          : l.type === "labour" || l.type === "paint"
            ? "Allowed at agreed labour / paint rate"
            : "Allowed at parts price list";
  });
  fit(lines.filter((l) => l.assessed > 0), "assessed", assessed);

  const rateOf = (t) => (zeroDep ? 0 : t === "metal" || t === "electrical" ? mRate : { plastic: 0.5, battery: 0.5, fibre: 0.3, paint: 0.125 }[t] ?? 0);
  lines.forEach((l) => {
    l.depRate = rateOf(l.type);
    l.dep = Math.round(l.assessed * l.depRate);
  });
  const dep = lines.reduce((s, l) => s + l.dep, 0);
  const disallowed = lines.filter((l) => l.assessed === 0).reduce((s, l) => s + l.estimate, 0);
  const net = Math.max(0, assessed - dep - (salvage || 0) - deductibles);
  const sum = (t) => lines.filter((l) => t.includes(l.type)).reduce((s, l) => s + l.estimate, 0);
  return {
    basis: "partial",
    impact,
    lines,
    age,
    metalRate: mRate,
    zeroDep,
    estimate,
    assessed,
    disallowed,
    rateCut: estimate - assessed - disallowed,
    dep,
    net,
    split: { parts: sum(["metal", "electrical", "plastic", "battery", "fibre", "glass"]), labour: sum(["labour"]), paint: sum(["paint"]), consumables: sum(["consumable"]) },
  };
}

/* Total loss / CTL: wreck quotes from the online auction (catalogue 97), CBA (98) and the two
   settlement bases (101). */
export function ctlAssessment({ claimNo, idv, estimate, deductible }) {
  const h = hash(claimNo + "|wreck");
  const best = r100(idv * (0.2 + (h % 7) / 100));
  const bidders = ["Sri Balaji Auto Salvage, Chennai", "Copart India (online)", "MSTC e-auction bidder"];
  const quotes = bidders
    .map((b, i) => ({ bidder: b, amount: i === h % 3 ? best : r100(best * (0.86 + ((h >> (i * 3)) % 9) / 100)) }))
    .sort((a, b) => b.amount - a.amount);
  const netOfSalvage = idv - deductible - best;
  const withSalvage = idv - deductible;
  return {
    basis: "ctl",
    pctIdv: Math.round((estimate / idv) * 100),
    quotes,
    best,
    repairCost: estimate,
    netOfSalvage,
    withSalvage,
    // CBA: the cheaper of repair and total loss net of salvage
    recommended: estimate > netOfSalvage ? "Total loss – net of salvage" : "Repair",
  };
}

/* Theft: settled on IDV less compulsory deductible; financier (hypothecation) paid first (catalogue 107, 108). */
export function theftAssessment({ idv, deductible, financier }) {
  return { basis: "theft", idv, deductible, net: idv - deductible, financier: financier || null };
}