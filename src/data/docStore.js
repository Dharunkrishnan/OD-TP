// src/data/docStore.js
// Keeps the files uploaded on Claim Intimation so they can be opened again (eye icon).
// In this demo the file stays in the browser: a blob URL for this page visit, plus a copy in
// sessionStorage (files up to ~1.5 MB) so it can still be viewed after a refresh. In production the
// file goes to the document management system (DMS) and is viewed from there.

const KEY = "smartclaims-intimation-docs";
const MAX_KEEP = 1.5 * 1024 * 1024; // bytes kept for after a refresh (sessionStorage is ~5 MB)
const live = new Map(); // name → { url, type }

function saved() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
function save(all) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* full or off – viewing still works until the page is refreshed */
  }
}

export function putDoc(name, file) {
  if (!file) return;
  const old = live.get(name);
  if (old?.url?.startsWith("blob:")) URL.revokeObjectURL(old.url);
  live.set(name, { url: URL.createObjectURL(file), type: file.type || "" });
  if (file.size <= MAX_KEEP && typeof FileReader !== "undefined") {
    const r = new FileReader();
    r.onload = () => save({ ...saved(), [name]: { url: r.result, type: file.type || "" } });
    r.readAsDataURL(file);
  }
}

/** { url, type } – or null when the file is no longer here (e.g. a large file after a refresh) */
export function getDoc(name) {
  return live.get(name) || saved()[name] || null;
}

export function removeDoc(name) {
  const old = live.get(name);
  if (old?.url?.startsWith("blob:")) URL.revokeObjectURL(old.url);
  live.delete(name);
  const all = saved();
  if (all[name]) {
    delete all[name];
    save(all);
  }
}

export function clearDocs() {
  for (const n of [...live.keys()]) removeDoc(n);
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage off */
  }
}