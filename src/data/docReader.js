// src/data/docReader.js
// Demo "document reading" (OCR / document intelligence) for Claim Intimation:
//   readDL – driving licence → holder, DL no, DOB, non-transport validity, class of vehicle, RTO
//   readRC – registration certificate → reg no, owner, make / model, chassis, engine, reg date,
//            validity, hypothecation – and checks it against the policy
// In production this calls an OCR / document-AI service (and Sarathi / VAHAN for verification);
// here the values are made up deterministically from the vehicle, so the same vehicle always reads
// the same way. All names and numbers are fictional.

function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pad = (n, l = 2) => String(n).padStart(l, "0");
const norm = (s) => String(s || "").replace(/[\s-]/g, "").toUpperCase();

function dlValidYear(h, issueYear) {
  const now = new Date().getFullYear();
  if ((h >>> 17) % 8 === 0) return now - 1; // lapsed
  const due = issueYear + 20;
  return due > now ? due : now + 1 + ((h >>> 15) % 8); // renewed
}

/** Driving licence. One vehicle in four was being driven by someone other than the insured. */
export function readDL({ policy, manualRegNo }) {
  const key = policy?.regNo || manualRegNo || "walk-in";
  const h = seedOf("dl|" + key);
  const other = h % 4 === 0;
  const holder = other ? ["S. Arun", "K. Ravi", "M. Latha", "P. Vignesh"][(h >>> 3) % 4] : policy?.insured || "R. Senthil";
  const issueYear = 2006 + (h % 14);
  const birthYear = 1968 + ((h >>> 5) % 30);
  const mm = pad(1 + ((h >>> 9) % 12));
  const dd = pad(1 + ((h >>> 13) % 28));
  return {
    holder,
    relation: other ? ["Son", "Driver (employed)", "Spouse", "Friend"][(h >>> 3) % 4] : "Self",
    dlNo: `TN${pad(1 + ((h >>> 2) % 22))} ${issueYear}${pad(h % 10000000, 7)}`,
    dob: `${birthYear}-${mm}-${dd}`,
    // non-transport licence: 20 years from issue, then renewed. Most demo licences are current;
    // about one in eight has lapsed, to show the "DL expired on the loss date" warning.
    validTill: `${dlValidYear(h, issueYear)}-${mm}-${dd}`,
    dlClass: "LMV, MCWG",
    rto: ["RTO Chennai (South)", "RTO Chennai (West)", "RTO Tambaram", "RTO Poonamallee"][(h >>> 7) % 4],
    confidence: 94 + ((h >>> 11) % 6),
  };
}

/** Registration certificate, checked against the policy (when there is one). */
export function readRC({ policy, manualRegNo, manualVehicle }) {
  const key = policy?.regNo || manualRegNo || "walk-in";
  const h = seedOf("rc|" + key);
  const digits = (n) => pad(h % 10 ** n, n);
  const regNo = policy?.regNo || (manualRegNo ? manualRegNo.toUpperCase() : `TN 09 AB ${digits(4)}`);
  const vehicle = policy?.vehicle || manualVehicle || ["Maruti Swift VXi", "Hyundai i20 Asta", "Tata Nexon XZ+", "Honda City ZX"][h % 4];
  const year = policy?.yearOfMfg || 2016 + (h % 8);
  const regDate = `${year}-${pad(1 + ((h >>> 4) % 12))}-${pad(1 + ((h >>> 8) % 28))}`;
  // policy chassis / engine are masked ("…XXXXX"); the RC shows them in full
  const fill = (masked, fallback) => (masked ? masked.replace(/X+$/, (m) => digits(m.length)) : fallback);
  const rc = {
    regNo,
    owner: policy?.insured || "R. Senthil",
    vehicle,
    fuel: /diesel/i.test(vehicle) ? "Diesel" : /cng/i.test(vehicle) ? "CNG" : "Petrol",
    chassis: fill(policy?.chassis, `MA3E${digits(13)}`),
    engine: fill(policy?.engine, `K12M${digits(6)}`),
    regDate,
    validTill: `${year + 15}-${regDate.slice(5)}`, // private car registration: 15 years
    hypothecation: policy?.financier || "None",
    confidence: 93 + ((h >>> 6) % 7),
  };
  const checks = policy
    ? [
        { label: "Registration no matches policy", ok: norm(rc.regNo) === norm(policy.regNo) },
        { label: "Chassis no matches policy", ok: !policy.chassis || rc.chassis.startsWith(policy.chassis.replace(/X+$/, "")) },
        { label: "Engine no matches policy", ok: !policy.engine || rc.engine.startsWith(policy.engine.replace(/X+$/, "")) },
        { label: "RC owner matches insured", ok: rc.owner === policy.insured },
      ]
    : [{ label: "No policy to compare – details taken from the RC", ok: null }];
  return { ...rc, checks };
}