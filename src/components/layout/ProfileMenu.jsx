// src/components/layout/ProfileMenu.jsx
// Profile button in the header + its menu.
//   Status       – Online / Away / In a meeting / Offline (decides auto-allocation of new claims)
//   Select role  – the user stays the same person and changes only the ACTIVE role
//                  (Claims Handler, Claims Approver, Claims Manager, Admin). The page reloads
//                  on that role's home. Roles come from assignedRoles() in auth.js.
//   Sign out
// After a role change a small toast offers "Undo" for a few seconds.
//
// Props:
//   lob       – current workspace ("OD" | "TP")
//   onLogout  – sign-out handler from the shell

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ChevronRight, LogOut, Repeat, X } from "lucide-react";
import { useAuth, getRole, assignedRoles, AVAILABILITY, DEMO_MODE, LOB_LABEL } from "../../auth";

const TOAST_KEY = "smartclaims-role-toast";
const TOAST_MS = 6000;

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// ₹5,00,000 → "Up to ₹5 L"
function limitText(limit) {
  if (!limit) return "";
  return limit >= 100000 ? `Up to ₹${limit / 100000} L` : `Up to ₹${limit.toLocaleString("en-IN")}`;
}

function writeToast(t) {
  try {
    sessionStorage.setItem(TOAST_KEY, JSON.stringify({ ...t, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function readToast() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOAST_KEY) || "null");
    // only while it is still showing – it survives the page change that a role change causes
    return t && Date.now() - t.at < TOAST_MS ? t : null;
  } catch {
    return null;
  }
}

function clearToast() {
  try {
    sessionStorage.removeItem(TOAST_KEY);
  } catch {
    /* ignore */
  }
}

export default function ProfileMenu({ lob = "OD", onLogout }) {
  const { user, switchRole, setAvailability } = useAuth();
  const navigate = useNavigate();
  const role = getRole(user, lob);
  const roles = assignedRoles(user, lob);
  const status = AVAILABILITY.find((a) => a.key === user?.availability) || AVAILABILITY[0];

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("main"); // "main" | "status"
  const [toast, setToast] = useState(readToast);
  const wrapRef = useRef(null);

  function close() {
    setOpen(false);
    setView("main");
  }

  // Click outside closes; Esc goes back one step (status → main → closed)
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (view === "status") setView("main");
      else close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  // Toast hides itself after the rest of its 6 seconds
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => hideToast(), Math.max(0, TOAST_MS - (Date.now() - toast.at)));
    return () => window.clearTimeout(id);
  }, [toast]);

  function hideToast() {
    clearToast();
    setToast(null);
  }

  function selectRole(r, isUndo = false) {
    const from = role;
    const path = switchRole(lob, r.role);
    close();
    hideToast();
    if (!path) return;
    if (!isUndo) writeToast({ toLabel: r.roleLabel, fromRole: from?.role, fromLabel: from?.roleLabel });
    navigate(path, { replace: true });
    // if the page does not change, this menu stays mounted – show the toast here too
    if (!isUndo) setToast(readToast());
  }

  // ↑ / ↓ move between roles (radio-group behaviour)
  function onRolesKey(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...e.currentTarget.querySelectorAll("button[role=radio]")];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    items[e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0)].focus();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-100"
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#0B1F3A] text-xs font-semibold text-white">
          {initials(user?.name)}
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${status.dot}`} title={status.label} />
        </span>
        <span className="hidden whitespace-nowrap text-left leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-slate-800">{user?.name}</span>
          <span className="block text-[11px] text-slate-500">
            {role?.roleLabel} · {user?.branch}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[300px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-[0_16px_40px_rgba(11,31,58,0.16)]">
          {view === "main" ? (
            <>
              {/* Who */}
              <div className="flex items-center gap-3 px-4 pb-2.5 pt-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#0B1F3A] text-[13px] font-semibold text-white">
                  {initials(user?.name)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">{user?.name}</p>
                  <p className="truncate text-[11.5px] text-slate-500">
                    {user?.userId} · {user?.branch} · {LOB_LABEL[lob]}
                  </p>
                </div>
              </div>

              {/* Status */}
              <button
                type="button"
                onClick={() => setView("status")}
                className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-2.5 rounded-lg px-2 text-left hover:bg-slate-100"
              >
                <span className={`h-2.5 w-2.5 flex-none rounded-full ${status.dot}`} aria-hidden="true" />
                <span className="flex-1 text-[14px] font-semibold text-slate-800">{status.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>

              {/* Select role */}
              <div className="mt-1 border-t border-slate-100">
                <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Select role
                  {DEMO_MODE && !user?.roles?.[lob] && (
                    <span className="rounded bg-amber-100 px-1 py-px text-[9.5px] font-semibold normal-case tracking-normal text-amber-800">Demo · all roles</span>
                  )}
                </p>
                <div role="radiogroup" aria-label="Select role" onKeyDown={onRolesKey} className="max-h-[min(264px,calc(100vh-280px))] overflow-y-auto px-2 pb-2">
                  {roles.map((r) => {
                    const on = r.role === role?.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        onClick={() => selectRole(r)}
                        className={`flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                          on ? "bg-teal-50/70" : ""
                        }`}
                      >
                        <span
                          className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] ${on ? "border-teal-600" : "border-slate-400"}`}
                          aria-hidden="true"
                        >
                          {on && <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />}
                        </span>
                        <span className={`flex-1 truncate text-[14px] ${on ? "font-semibold text-[#0B1F3A]" : "font-medium text-slate-800"}`}>{r.roleLabel}</span>
                        {r.authorityLimit && <span className="flex-none text-[11px] text-slate-400">{limitText(r.authorityLimit)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onLogout?.();
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-11 items-center gap-1 border-b border-slate-100 px-1.5">
                <button
                  type="button"
                  onClick={() => setView("main")}
                  aria-label="Back"
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <p className="flex-1 text-[13px] font-semibold text-slate-800">Set status</p>
              </div>
              <ul className="p-2">
                {AVAILABILITY.map((a) => {
                  const on = a.key === status.key;
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setAvailability(a.key);
                          setView("main");
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100 ${on ? "bg-slate-50" : ""}`}
                      >
                        <span className={`h-2.5 w-2.5 flex-none rounded-full ${a.dot}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block text-[13.5px] font-semibold text-slate-800">{a.label}</span>
                          <span className="block text-[11.5px] text-slate-500">{a.note}</span>
                        </span>
                        {on && <Check className="h-4 w-4 flex-none text-teal-700" aria-label="Current status" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* After a role change: confirm, with Undo */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl bg-[#0B1F3A] py-2 pl-3 pr-2 text-[12.5px] text-white shadow-[0_12px_32px_rgba(11,31,58,0.35)]"
        >
          <Repeat className="h-4 w-4 flex-none text-teal-300" aria-hidden="true" />
          <span className="min-w-0">
            Now working as <b className="font-semibold">{toast.toLabel}</b>
          </span>
          {toast.fromRole && (
            <button
              type="button"
              onClick={() => {
                const back = roles.find((r) => r.role === toast.fromRole);
                if (back) selectRole(back, true);
              }}
              className="flex-none rounded-md px-2 py-1 font-semibold text-teal-300 hover:bg-white/10"
            >
              Undo · back to {toast.fromLabel}
            </button>
          )}
          <button type="button" onClick={hideToast} aria-label="Dismiss" className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}