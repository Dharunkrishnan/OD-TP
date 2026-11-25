// src/data/docReader.js
// Reads an uploaded Driving licence / RC and pulls out the fields Claim Intimation needs.
//   1. extractText(file)  – a PDF with a text layer (e.g. DigiLocker) is read directly; a photo
//                           or scanned PDF goes through OCR (Tesseract, runs in the browser) twice:
//                           the photo as it is, and an enhanced copy (rotation fixed, enlarged,
//                           grayscale, contrast stretched). Each pass is parsed and the results are
//                           merged field by field (readDL / readRC).
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
let passLabel = "Reading text";

async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        logger: (m) => {
          if (!progressCb) return;
          if (m.status === "recognizing text") progressCb(`${passLabel}… ${Math.round(m.progress * 100)}%`);
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

/** Enhanced copy of a photo for OCR: EXIF rotation applied, longest side ~2000 px, grayscale,
 *  contrast stretched (2nd–98th percentile) – helps dim, washed-out or small phone photos. */
async function enhance(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(3, 2000 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = g;
    hist[g | 0]++;
  }
  const total = px.length / 4;
  const cut = total * 0.02;
  let lo = 0;
  let below = hist[0];
  while (lo < 254 && below < cut) below += hist[++lo];
  let hi = 255;
  let above = hist[255];
  while (hi > lo + 1 && above < cut) above += hist[--hi];
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / span));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** { passes: [{ text, confidence (0–100), label }], source } */
export async function extractText(file, onProgress) {
  progressCb = onProgress || null;
  try {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      const r = await pdfText(file, onProgress);
      return { passes: [{ text: r.text, confidence: r.confidence, label: r.source }], source: r.source };
    }
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(file.name)) {
      return { passes: [], source: "unsupported" };
    }
    onProgress?.("Preparing the reader…");
    passLabel = "Reading (1 of 2)";
    const a = await ocr(file);
    let b = null;
    try {
      passLabel = "Reading enhanced copy (2 of 2)";
      b = await ocr(await enhance(file));
    } catch {
      /* enhancement not supported in this browser – the first pass is enough */
    }
    return { passes: [{ ...a, label: "Photo" }, ...(b ? [{ ...b, label: "Enhanced copy" }] : [])], source: "OCR" };
  } finally {
    progressCb = null;
    passLabel = "Reading text";
  }
}

/** merge parsed passes field by field: a value found in both passes wins; otherwise the value from
 *  the more confident pass; a value found in only one pass is used as it is */
function mergePasses(parsed, passes, keys) {
  const out = {};
  for (const k of keys) {
    const cand = parsed.map((r, i) => ({ v: r[k], c: passes[i].confidence })).filter((x) => x.v);
    if (!cand.length) continue;
    const agreed = cand.find((x) => cand.filter((y) => compact(y.v) === compact(x.v)).length > 1);
    out[k] = (agreed || cand.sort((x, y) => y.c - x.c)[0]).v;
  }
  return out;
}
const rawOf = (passes) => (passes.length > 1 ? passes.map((p) => `--- ${p.label} (${p.confidence}%) ---\n${p.text.trim()}`).join("\n\n") : passes[0]?.text || "");

/** Driving licence: extract + parse + merge. → parseDL shape plus confidence and source */
export async function readDL(file, onProgress) {
  const ex = await extractText(file, onProgress);
  const parsed = ex.passes.map((p) => parseDL(p.text));
  const fields = mergePasses(parsed, ex.passes, DL_KEYS);
  return { ...finishDL(fields), raw: rawOf(ex.passes), confidence: Math.max(0, ...ex.passes.map((p) => p.confidence)), source: ex.source };
}

/** RC: extract + parse + merge, checked against the policy. */
export async function readRC(file, policy, onProgress) {
  const ex = await extractText(file, onProgress);
  const parsed = ex.passes.map((p) => parseRC(p.text, policy));
  const fields = mergePasses(parsed, ex.passes, RC_KEYS);
  return { ...finishRC(fields, policy), raw: rawOf(ex.passes), confidence: Math.max(0, ...ex.passes.map((p) => p.confidence)), source: ex.source };
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

  return { ...finishDL(out), raw };
}
const DL_FIELDS = { holder: "Name", dlNo: "DL no", dob: "Date of birth", validTill: "Valid till", dlClass: "Class of vehicle" };
const DL_KEYS = [...Object.keys(DL_FIELDS), "issueDate", "rto"];
function finishDL(out) {
  return {
    ...Object.fromEntries(Object.entries(out).filter(([, v]) => v)),
    found: Object.keys(DL_FIELDS).filter((k) => out[k]),
    missing: Object.keys(DL_FIELDS).filter((k) => !out[k]).map((k) => DL_FIELDS[k]),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Registration certificate                                         */
/* ------------------------------------------------------------------ */
// Reg no: TN 09 DX 4410, KA01AB1234, DL 3C AB 1234, 22 BH 1234 AA (BH series)
const REG_RE = /\b([A-Z]{2})[\s-]?(\d{1,2}[A-Z]?)[\s-]?([A-Z]{0,3})[\s-]?(\d{3,4})\b/;
const REG_SERIES_RE = /\b([A-Z]{2})[\s-]?(\d{1,2}[A-Z]?)[\s-]?([A-Z]{1,3})[\s-]?(\d{3,4})\b/;
const BH_RE = /\b(\d{2})[\s-]?BH[\s-]?(\d{4})[\s-]?([A-Z]{1,2})\b/;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;

export function parseRC(text, policy) {
  const raw = String(text || "");
  const ls = lines(raw);
  const up = raw.toUpperCase();
  const out = {};

  const regLine = valueAfter(ls, /\b(regn?\.?\s*(no|number)|registration\s*(no|number)|vehicle\s*(no|number))\b/i);
  // anywhere on the card only a full number with series letters counts – "TN 641023" in the
  // address is a pincode, not a registration number
  const reg = regLine.toUpperCase().match(REG_RE) || up.match(REG_SERIES_RE);
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
  // labels washed out (glare)? the date printed beside the registration number is the date of
  // registration; a date 10+ years after it is the registration validity
  const all = [...new Set(datesIn(raw))].sort();
  if (!out.regDate && out.regNo) {
    const line = ls.find((l) => compact(l).includes(compact(out.regNo)));
    out.regDate = (line && datesIn(line)[0]) || undefined;
  }
  if (!out.regDate && all.length) out.regDate = all[0];
  if (!out.validTill && out.regDate) out.validTill = all.find((d) => +d.slice(0, 4) >= +out.regDate.slice(0, 4) + 10);
  const fin = valueAfter(ls, /\b(financier|hypothecat\w*|hp\s*with|lease)\b/i);
  if (fin) out.hypothecation = fin.slice(0, 50);

  return { ...finishRC(out, policy), raw };
}
const RC_FIELDS = { regNo: "Registration no", owner: "Owner", vehicle: "Make / model", chassis: "Chassis no", engine: "Engine no", regDate: "Registration date" };
const RC_KEYS = [...Object.keys(RC_FIELDS), "fuel", "validTill", "hypothecation"];
function finishRC(out, policy) {
  const has = (k) => !!out[k];
  // one check per field: found → matches / does not match the policy; not found → can't check
  const check = (key, what, against, same) =>
    has(key)
      ? { label: same() ? `${what} matches ${against}` : `${what} does not match ${against}`, ok: same() }
      : { label: `${what} not found on RC`, ok: null };
  const prefixOf = (masked) => compact(masked).replace(/X+$/, "");
  // OCR mix-ups: 4/A, 0/O/D/Q, 1/I/L, 5/S, 8/B, 2/Z, 6/G – an ID that matches only after allowing
  // for these is "check", not a hard mismatch
  const fold = (x) => x.replace(/[A4]/g, "4").replace(/[0ODQ]/g, "0").replace(/[1IL]/g, "1").replace(/[5S]/g, "5").replace(/[8B]/g, "8").replace(/[2Z]/g, "2").replace(/[6G]/g, "6");
  const idCheck = (key, what) => {
    const want = prefixOf(policy[key] || "");
    if (!has(key)) return { label: `${what} not found on RC`, ok: null };
    const got = compact(out[key]);
    if (!want || got.startsWith(want)) return { label: `${what} matches policy`, ok: true };
    if (fold(got).startsWith(fold(want))) return { label: `${what} – check: matches policy except characters OCR often confuses`, ok: null };
    return { label: `${what} does not match policy`, ok: false };
  };
  const checks = policy
    ? [
        check("regNo", "Registration no", "policy", () => compact(out.regNo) === compact(policy.regNo)),
        idCheck("chassis", "Chassis no"),
        idCheck("engine", "Engine no"),
        check("owner", "RC owner", "insured", () => sameName(out.owner, policy.insured)),
      ]
    : [{ label: "No policy to compare – vehicle details taken from the RC", ok: null }];
  return {
    ...Object.fromEntries(Object.entries(out).filter(([, x]) => x)),
    checks,
    found: Object.keys(RC_FIELDS).filter((k) => out[k]),
    missing: Object.keys(RC_FIELDS).filter((k) => !out[k]).map((k) => RC_FIELDS[k]),
  };
}