// src/data/docReader.js
// Reads an uploaded Driving licence / RC and pulls out the fields Claim Intimation needs.
//   1. extractText(file)  – a PDF with a text layer (e.g. DigiLocker) is read directly; a photo
//                           or scanned PDF goes through OCR (Tesseract, runs in the browser).
//   2. parseDL(text)      – holder, DL no, DOB, validity (non-transport), class of vehicle, issue date
//      parseRC(text, pol) – reg no, owner, maker / model, fuel, chassis, engine, reg date, validity,
//                           financier – and checks them against the policy
// Only what is actually found on the document is returned; anything else is listed as missing.
// The OCR engine and the English language data (~3 MB, cached by the browser) load from the
// jsDelivr CDN the first time a document is read. In production this is replaced by a document-AI
// service plus Sarathi (DL) / VAHAN (RC) verification.

/* ------------------------------------------------------------------ */
/* 1. Text extraction                                                  */
/* ------------------------------------------------------------------ */
let workerPromise = null;
let progressCb = null;

async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        logger: (m) => {
          if (!progressCb) return;
          if (m.status === "recognizing text") progressCb(`Reading text… ${Math.round(m.progress * 100)}%`);
          else if (/loading|initializ/.test(m.status)) progressCb("Preparing the reader (first time only)…");
        },
      })
    );
    workerPromise.catch(() => (workerPromise = null)); // let a later upload retry
  }
  return workerPromise;
}

async function ocr(image) {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(image);
  return { text: data.text || "", confidence: Math.round(data.confidence || 0) };
}

async function pdfText(file, onProgress) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  // text layer first (DigiLocker / e-RC PDFs have one) – exact, no OCR needed
  let text = "";
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let lastY = null;
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      text += lastY !== null && Math.abs(y - lastY) > 2 ? "\n" : " ";
      text += it.str;
      lastY = y;
    }
    text += "\n";
  }
  if (text.replace(/\s/g, "").length > 40) return { text, confidence: 100, source: "PDF text" };
  // scanned PDF → render page 1 and OCR it
  onProgress?.("Scanned PDF – converting to image…");
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return { ...(await ocr(canvas)), source: "OCR (scanned PDF)" };
}

/** { text, confidence (0–100), source } */
export async function extractText(file, onProgress) {
  progressCb = onProgress || null;
  try {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) return await pdfText(file, onProgress);
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(file.name)) {
      return { text: "", confidence: 0, source: "unsupported" };
    }
    onProgress?.("Preparing the reader…");
    return { ...(await ocr(file)), source: "OCR" };
  } finally {
    progressCb = null;
  }
}

/* ------------------------------------------------------------------ */
/* 2. Parsing helpers                                                  */
/* ------------------------------------------------------------------ */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const DATE_RE = /(\d{1,2})[-/.\s](\d{1,2}|[A-Za-z]{3,4})[-/.\s](\d{4})/g;

/** every date in a string, as ISO yyyy-mm-dd (dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy, 19-Oct-1995) */
function datesIn(s) {
  const out = [];
  for (const m of String(s).matchAll(DATE_RE)) {
    const d = +m[1];
    const mo = /\d/.test(m[2]) ? +m[2] : MONTHS[m[2].toLowerCase()];
    const y = +m[3];
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y > 1930 && y < 2100) out.push(`${y}-${pad(mo)}-${pad(d)}`);
  }
  return out;
}
const lines = (text) =>
  String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~`]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

// a line that is only labels ("Engine No. Owner Sr. No.", "Maker's Name Model Name") – two-column cards
// put the labels side by side with the values on the line below
const LABELISH = /^(?:[A-Za-z'./()]+\s*){1,5}$/;
const LABEL_WORD = /\b(no|number|name|date|valid|till|validity|of|used|sr|owner|reg|regn|fuel|model|maker|class|issue|birth)\b/i;
const isLabel = (s) => !!s && !/\d/.test(s) && LABELISH.test(s) && LABEL_WORD.test(s);

/** value on the line of a label (after ":" / "-"), or on the next line when the label stands alone
 *  or shares its line only with other labels */
function valueAfter(ls, labelRe, { skip } = {}) {
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(labelRe);
    if (!m || (skip && skip.test(ls[i]))) continue;
    const rest = ls[i].slice(m.index + m[0].length).replace(/^[\s:.\-–=]+/, "").trim();
    if (rest && !isLabel(rest)) return rest;
    if (ls[i + 1]) return ls[i + 1];
  }
  return "";
}
/** a date for a label; on a two-column row the right-hand label takes the right-hand date below */
function dateAfter(ls, labelRe) {
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(labelRe);
    if (!m) continue;
    const same = datesIn(ls[i].slice(m.index));
    if (same.length) return same[0];
    const below = datesIn(ls[i + 1] || "");
    if (!below.length) continue;
    const rightColumn = m.index > ls[i].length * 0.35;
    return rightColumn ? below[below.length - 1] : below[0];
  }
  return "";
}
const cleanName = (s) =>
  String(s)
    .replace(/[^A-Za-z .]/g, " ") // OCR noise: apostrophes, digits, symbols
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([A-Za-z])\b(?!\.)/g, "$1.") // "R ARUN" → "R. ARUN"
    .replace(/\.\./g, ".")
    .toUpperCase();
/** the name in an OCR line: the longest run of capitalised words ("Zo. THIYAGARAJAN MANI =" → "THIYAGARAJAN MANI") */
function pickName(s) {
  const runs = String(s).match(/\b[A-Z][A-Z.']*(?:\s+[A-Z][A-Z.']*)*/g) || [];
  const best = runs.map((r) => r.trim()).filter((r) => r.replace(/[^A-Z]/g, "").length >= 3).sort((a, b) => b.length - a.length)[0];
  return best || s;
}
/** an ID in an OCR line (engine / chassis no): a letters-and-digits word of the right length */
function pickId(s, min, max, prefer) {
  const words = String(s).toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= min && w.length <= max && /\d/.test(w) && /[A-Z]/.test(w));
  return (prefer && words.find((w) => w.length === prefer)) || words.sort((a, b) => b.length - a.length)[0] || "";
}
const tokens = (s) => String(s).toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((t) => t.length > 1);
/** same person? – every word or initial of each name matches the other, in any order:
 *  "R. Arun Kumar" = "ARUN KUMAR R", "T. Mani" = "THIYAGARAJAN MANI", but "S. Arun" ≠ "R. Arun Kumar" */
export function sameName(a, b) {
  const words = (s) => String(s).toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean);
  const fits = (w, list) => list.some((v) => v === w || (w.length === 1 && v[0] === w) || (v.length === 1 && w[0] === v));
  const [x, y] = [words(a), words(b)];
  return x.some((w) => w.length > 1) && x.every((w) => fits(w, y)) && y.every((w) => fits(w, x));
}
const compact = (s) => String(s || "").replace(/[\s-]/g, "").toUpperCase();

/* ------------------------------------------------------------------ */
/* 3. Driving licence                                                  */
/* ------------------------------------------------------------------ */
// DL no: state (2 letters) + RTO (2 digits) + year (4) + 7 digits, e.g. TN09 20150012345 / KA-01-2014-0012345
const DL_NO_RE = /\b([A-Z]{2})[\s-]?(\d{2})[\s-]?((?:19|20)\d{2})[\s-]?(\d{7})\b/;
const COV_RE = /\b(LMV(?:-NT|-TR)?|MCWG|MCWOG|MCW|LMV-TR|HMV|HGMV|HPMV|TRANS|TRCTOR|E-RIKSHAW|INVCRG|LDRXCV|ADPVEH)\b/g;

export function parseDL(text) {
  const raw = String(text || "");
  const ls = lines(raw);
  const up = raw.toUpperCase();
  const out = {};

  const dl = up.replace(/[O](?=\d)/g, "0").match(DL_NO_RE);
  if (dl) out.dlNo = `${dl[1]}${dl[2]} ${dl[3]}${dl[4]}`;

  const name = valueAfter(ls, /\b(holder'?s?\s+name|name)\b/i, { skip: /father|husband|s\/o|d\/o|w\/o|son of|daughter|wife|s\/d\/w/i });
  if (name && tokens(name).length) out.holder = cleanName(pickName(name.split(/\s{2,}|\b(?:s\/o|d\/o|w\/o|dob|date)\b/i)[0]));

  out.dob = dateAfter(ls, /\b(d\.?\s?o\.?\s?b|date of birth|birth)\b/i) || undefined;
  out.issueDate = dateAfter(ls, /\b(d\.?\s?o\.?\s?i|date of issue|issue date|issued on|doi)\b/i) || undefined;
  // non-transport validity first; "Valid Till" / "Validity" otherwise
  out.validTill =
    dateAfter(ls, /\b(non[\s-]?transport|validity\s*\(?\s*nt|\bnt\b)/i) ||
    dateAfter(ls, /\b(valid\s*(till|upto|up to)|validity)\b/i) ||
    undefined;

  // no labels read (poor photo)? fall back to the dates themselves: oldest = DOB, latest = validity
  const all = [...new Set(datesIn(raw))].sort();
  if (!out.dob && all.length >= 2 && +all[0].slice(0, 4) < new Date().getFullYear() - 16) out.dob = all[0];
  if (!out.validTill && all.length >= 2 && all[all.length - 1] !== out.dob) out.validTill = all[all.length - 1];

  const cov = [...new Set((up.match(COV_RE) || []).map((c) => c.replace("LMV-NT", "LMV")))];
  if (cov.length) out.dlClass = cov.join(", ");

  const rto = valueAfter(ls, /\b(issuing authority|licensing authority)\b/i) || valueAfter(ls, /\b(rto|issued by)\b/i);
  if (rto) out.rto = rto.slice(0, 40);

  const FIELDS = { holder: "Name", dlNo: "DL no", dob: "Date of birth", validTill: "Valid till", dlClass: "Class of vehicle" };
  return {
    ...Object.fromEntries(Object.entries(out).filter(([, v]) => v)),
    found: Object.keys(FIELDS).filter((k) => out[k]),
    missing: Object.keys(FIELDS).filter((k) => !out[k]).map((k) => FIELDS[k]),
    raw,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Registration certificate                                         */
/* ------------------------------------------------------------------ */
// Reg no: TN 09 DX 4410, KA01AB1234, DL 3C AB 1234, 22 BH 1234 AA (BH series)
const REG_RE = /\b([A-Z]{2})[\s-]?(\d{1,2}[A-Z]?)[\s-]?([A-Z]{0,3})[\s-]?(\d{3,4})\b/;
const BH_RE = /\b(\d{2})[\s-]?BH[\s-]?(\d{4})[\s-]?([A-Z]{1,2})\b/;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;

export function parseRC(text, policy) {
  const raw = String(text || "");
  const ls = lines(raw);
  const up = raw.toUpperCase();
  const out = {};

  const regLine = valueAfter(ls, /\b(regn?\.?\s*(no|number)|registration\s*(no|number)|vehicle\s*(no|number))\b/i);
  const reg = (regLine.toUpperCase().match(REG_RE) || up.match(REG_RE));
  const bh = up.match(BH_RE);
  if (bh) out.regNo = `${bh[1]} BH ${bh[2]} ${bh[3]}`;
  else if (reg) out.regNo = [reg[1], reg[2], reg[3], reg[4]].filter(Boolean).join(" ");

  const owner = valueAfter(ls, /\b(owner'?s?\s*name|name of (the )?owner|registered owner)\b/i, { skip: /serial|sr\.?\s*no|no\.\s*of|number of/i });
  if (owner && tokens(owner).length) out.owner = cleanName(pickName(owner.split(/\b(?:s\/o|d\/o|w\/o|son|address)\b/i)[0]));

  const chassisLine = valueAfter(ls, /\b(chassis|ch\.?\s*no|vin)\b/i);
  const vin = pickId(chassisLine, 10, 17, 17) || (up.match(VIN_RE) || [])[0];
  if (vin) out.chassis = vin;
  const engineLine = valueAfter(ls, /\b(engine|eng\.?|motor)\s*(no|number)?\b/i, { skip: /capacity|cubic|\bcc\b|type/i });
  const eng = pickId(engineLine, 6, 15);
  if (eng && eng !== out.chassis) out.engine = eng;

  const maker = valueAfter(ls, /\b(maker'?s?\s*name|manufacturer|maker|make)\b/i);
  const model = valueAfter(ls, /\b(model\s*name|model)\b/i, { skip: /maker/i });
  const v = [maker, model].map((s) => s.replace(/\b(ltd|limited|pvt|private|india|co\.?)\b/gi, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (v.length)
    out.vehicle = [...new Set(v)]
      .join(" ")
      .replace(/\bMOTORS?\b/gi, "")
      .replace(/\(0\)/g, "(O)") // OCR reads the letter O in "(O)" as zero
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

  const fuel = up.match(/\b(PETROL\s*\/?\s*CNG|PETROL|DIESEL|CNG|LPG|ELECTRIC|EV|HYBRID)\b/);
  if (fuel) out.fuel = fuel[1].replace(/\s+/g, "").replace("PETROL/CNG", "Petrol / CNG").replace(/^(\w)(\w*)$/, (_, a, b) => a + b.toLowerCase());

  out.regDate = dateAfter(ls, /\b(date of regn|date of reg\b|regn\.?\s*date|registration date|date of registration|reg\.?\s*date)/i) || undefined;
  out.validTill = dateAfter(ls, /\b(regn\.?\s*validity|reg\.?\s*valid|valid\s*(till|upto|up to)|validity|fitness\s*(upto|valid))\b/i) || undefined;
  const fin = valueAfter(ls, /\b(financier|hypothecat\w*|hp\s*with|lease)\b/i);
  if (fin) out.hypothecation = fin.slice(0, 50);

  const has = (k) => !!out[k];
  // one check per field: found → matches / does not match the policy; not found → can't check
  const check = (key, what, against, same) =>
    has(key)
      ? { label: same() ? `${what} matches ${against}` : `${what} does not match ${against}`, ok: same() }
      : { label: `${what} not found on RC`, ok: null };
  const prefixOf = (masked) => compact(masked).replace(/X+$/, "");
  const checks = policy
    ? [
        check("regNo", "Registration no", "policy", () => compact(out.regNo) === compact(policy.regNo)),
        check("chassis", "Chassis no", "policy", () => !policy.chassis || compact(out.chassis).startsWith(prefixOf(policy.chassis))),
        check("engine", "Engine no", "policy", () => !policy.engine || compact(out.engine).startsWith(prefixOf(policy.engine))),
        check("owner", "RC owner", "insured", () => sameName(out.owner, policy.insured)),
      ]
    : [{ label: "No policy to compare – vehicle details taken from the RC", ok: null }];

  const FIELDS = { regNo: "Registration no", owner: "Owner", vehicle: "Make / model", chassis: "Chassis no", engine: "Engine no", regDate: "Registration date" };
  return {
    ...Object.fromEntries(Object.entries(out).filter(([, x]) => x)),
    checks,
    found: Object.keys(FIELDS).filter((k) => out[k]),
    missing: Object.keys(FIELDS).filter((k) => !out[k]).map((k) => FIELDS[k]),
    raw,
  };
}