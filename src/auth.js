// src/auth.js
// Smart Claims – mock authentication and access model (demo only).
//
// Access model: one login for everyone. Each user has an `access` map per LOB
// (line of business). The role and authority limit can differ between OD and TP.
//   OD only  -> OD workspace
//   TP only  -> TP workspace
//   OD + TP  -> last used workspace (Workspace selection screen comes in P00.2)
//
// Backward compatibility: `user.permissions` (["OD"], ["TP"], ["OD","TP"]) is kept
// so existing RequirePermission / ModuleSwitcher code keeps working.
//
// PRODUCTION NOTE: localStorage auth is for the demo only. Production must use
// SSO / OAuth2 with a server-side session and server-side role checks.

import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";

export const STORAGE_KEY = "smartclaims-user";
const AUDIT_KEY = "smartclaims-audit";

export const LOB = { OD: "OD", TP: "TP" };

export const LOB_HOME = {
  OD: "/od/dashboard",
  TP: "/tp/dashboard",
};

export const LOB_LABEL = {
  OD: "Motor Own Damage",
  TP: "Motor Third Party",
};

/* ------------------------------------------------------------------ */
/* Demo users – 6 logins (OD0150 = OD-only Claims Manager)            */
/* Password for all: Demo@123                                          */
/* User ID prefix = naming convention only. Access is decided by       */
/* the `access` map, never by the prefix.                              */
/* ------------------------------------------------------------------ */
export const DEMO_PASSWORD = "Demo@123";

// DEMO ONLY: shows "Switch profile" in the profile menu so one person can walk through
// every persona without signing out. Set to false (or remove) before UAT / production.
export const DEMO_MODE = true;

/* ------------------------------------------------------------------ */
/* Roles a user can work under (Select role in the profile menu)       */
/* A user keeps one identity and changes only the ACTIVE role.         */
/* Production: only the roles assigned to the user (user.roles[lob]).  */
/* Demo (DEMO_MODE): every role of the LOB, so each view can be shown. */
/* ------------------------------------------------------------------ */
export const ROLE_CATALOG = {
  OD: [
    { role: "CLAIMS_HANDLER", roleLabel: "Claims Handler", authorityLimit: null },
    { role: "CLAIMS_APPROVER", roleLabel: "Claims Approver", authorityLimit: 200000 },
    { role: "CLAIMS_MANAGER", roleLabel: "Claims Manager", authorityLimit: 500000 },
    { role: "ADMIN", roleLabel: "Admin User", authorityLimit: null },
  ],
  TP: [
    { role: "TP_CLAIMS_HANDLER", roleLabel: "TP Claims Handler", authorityLimit: null },
    { role: "CLAIMS_MANAGER", roleLabel: "Claims Manager", authorityLimit: 500000 },
    { role: "ADMIN", roleLabel: "Admin User", authorityLimit: null },
  ],
};

/** Roles this user may select in a LOB. */
export function assignedRoles(user, lob) {
  const all = ROLE_CATALOG[lob] || [];
  const own = user?.roles?.[lob];
  if (Array.isArray(own) && own.length) return all.filter((r) => own.includes(r.role));
  if (DEMO_MODE) return all;
  const current = user?.access?.[lob];
  return current ? all.filter((r) => r.role === current.role) : [];
}

const roleKey = (userId, lob) => `smartclaims-role-${userId}-${lob}`;

/* Availability – decides whether the user gets new claims from auto-allocation */
export const AVAILABILITY = [
  { key: "ONLINE", label: "Online", dot: "bg-green-500", note: "Available · new claims are assigned to you" },
  { key: "AWAY", label: "Away", dot: "bg-amber-400", note: "Short break · no new claims for now" },
  { key: "MEETING", label: "In a meeting", dot: "bg-red-500", note: "Busy · no new claims for now" },
  { key: "OFFLINE", label: "Offline", dot: "bg-slate-400", note: "Not working · no new claims" },
];
const availKey = (userId) => `smartclaims-availability-${userId}`;

export const DEMO_USERS = [
  {
    userId: "OD0123",
    name: "Karthik Subramanian",
    email: "karthik.s@abcgeneral.co.in",
    branch: "Chennai",
    access: {
      OD: { role: "CLAIMS_HANDLER", roleLabel: "Claims Handler", authorityLimit: null },
    },
  },
  {
    userId: "OD0150",
    name: "Priya Raghavan",
    email: "priya.raghavan@abcgeneral.co.in",
    branch: "Chennai",
    access: {
      OD: { role: "CLAIMS_MANAGER", roleLabel: "Claims Manager", authorityLimit: 500000 },
    },
  },
  {
    userId: "TP0228",
    name: "Arun Prakash",
    email: "arun.prakash@abcgeneral.co.in",
    branch: "Bengaluru",
    access: {
      TP: { role: "TP_CLAIMS_HANDLER", roleLabel: "TP Claims Handler", authorityLimit: null },
    },
  },
  {
    userId: "ODTP0019",
    name: "Senthil Kumar",
    email: "senthil.kumar@abcgeneral.co.in",
    branch: "Chennai",
    access: {
      OD: { role: "CLAIMS_MANAGER", roleLabel: "Claims Manager", authorityLimit: 500000 },
      TP: { role: "CLAIMS_MANAGER", roleLabel: "Claims Manager", authorityLimit: 500000 },
    },
  },
  {
    userId: "ODTP0027",
    name: "Anitha Joseph",
    email: "anitha.joseph@abcgeneral.co.in",
    branch: "Kochi",
    access: {
      OD: { role: "CLAIMS_APPROVER", roleLabel: "Claims Approver", authorityLimit: 200000 },
      TP: { role: "TP_CLAIMS_HANDLER", roleLabel: "TP Claims Handler", authorityLimit: null },
    },
  },
  {
    userId: "ODTP0041",
    name: "Ganesh Iyer",
    email: "ganesh.iyer@abcgeneral.co.in",
    branch: "Head Office",
    access: {
      OD: { role: "ADMIN", roleLabel: "Admin User", authorityLimit: null },
      TP: { role: "ADMIN", roleLabel: "Admin User", authorityLimit: null },
    },
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
export function getLobs(user) {
  if (!user) return [];
  if (user.access) return Object.keys(user.access).filter((k) => LOB[k]);
  return Array.isArray(user.permissions) ? user.permissions : [];
}

export function hasAccess(user, lob) {
  return getLobs(user).includes(lob);
}

export function isDualAccess(user) {
  return getLobs(user).length > 1;
}

export function getRole(user, lob) {
  return user?.access?.[lob] ?? null;
}

export function formatINR(amount) {
  if (amount == null) return "–";
  return "₹" + Number(amount).toLocaleString("en-IN");
}

/** Where to send the user right after login (or when they hit "/"). */
export function resolveDashboardPath(user) {
  const lobs = getLobs(user);
  if (lobs.length === 0) return "/no-access";
  const preferred = user?.lastWorkspace;
  if (preferred && lobs.includes(preferred)) return LOB_HOME[preferred];
  return LOB_HOME[lobs.includes("OD") ? "OD" : lobs[0]];
}

/**
 * Mock credential check. Accepts User ID (case-insensitive) or official email.
 * Returns a public user profile (no password) or null.
 * Replace with POST /auth/login when the backend is ready.
 */
export async function authenticate(identifier, password) {
  await new Promise((r) => setTimeout(r, 600)); // simulate network latency
  const id = String(identifier || "").trim().toLowerCase();
  const found = DEMO_USERS.find(
    (u) => u.userId.toLowerCase() === id || u.email.toLowerCase() === id
  );
  if (!found || password !== DEMO_PASSWORD) return null;
  return buildSessionUser(found);
}

function buildSessionUser(profile, lastWorkspace) {
  const lobs = Object.keys(profile.access || {});
  return {
    ...profile,
    permissions: lobs, // backward compatibility
    lastWorkspace: lastWorkspace && lobs.includes(lastWorkspace) ? lastWorkspace : lobs[0] ?? null,
    loginAt: new Date().toISOString(),
  };
}

function readLastWorkspace(userId) {
  try {
    return localStorage.getItem(`smartclaims-lastws-${userId}`) || undefined;
  } catch {
    return undefined;
  }
}

function writeLastWorkspace(userId, lob) {
  try {
    localStorage.setItem(`smartclaims-lastws-${userId}`, lob);
  } catch {
    /* ignore */
  }
}

/** Demo audit trail – kept in localStorage, last 200 entries. */
export function auditLog(event, details = {}) {
  const entry = { at: new Date().toISOString(), event, ...details };
  try {
    const list = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
    list.push(entry);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore */
  }
  if (import.meta.env?.DEV) console.info("[audit]", entry);
}

function readAvailability(userId) {
  try {
    const v = localStorage.getItem(availKey(userId));
    return AVAILABILITY.some((a) => a.key === v) ? v : "ONLINE";
  } catch {
    return "ONLINE";
  }
}

function isRemembered() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeUser(user, remember) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  /**
   * login(user, remember)                  – new signature (user from authenticate)
   * login(email, permissions, remember)    – old signature, still supported
   */
  const login = useCallback((arg1, arg2, arg3) => {
    let sessionUser;
    let remember;
    if (arg1 && typeof arg1 === "object") {
      sessionUser = { ...arg1, lastWorkspace: readLastWorkspace(arg1.userId) ?? arg1.lastWorkspace };
      if (!getLobs(sessionUser).includes(sessionUser.lastWorkspace)) {
        sessionUser.lastWorkspace = getLobs(sessionUser)[0] ?? null;
      }
      // the role last selected in each LOB (Select role) carries over to the next login
      sessionUser.access = { ...sessionUser.access };
      for (const lob of getLobs(sessionUser)) {
        try {
          const saved = localStorage.getItem(roleKey(sessionUser.userId, lob));
          const pick = saved && assignedRoles(sessionUser, lob).find((r) => r.role === saved);
          if (pick) sessionUser.access[lob] = { ...pick };
        } catch {
          /* ignore */
        }
      }
      sessionUser.availability = readAvailability(sessionUser.userId);
      remember = !!arg2;
    } else {
      const perms = Array.isArray(arg2) ? arg2 : [];
      sessionUser = {
        email: arg1,
        userId: arg1,
        name: arg1,
        access: Object.fromEntries(perms.map((p) => [p, { role: "USER", roleLabel: "User" }])),
        permissions: perms,
        lastWorkspace: perms[0] ?? null,
        loginAt: new Date().toISOString(),
      };
      remember = !!arg3;
    }
    storeUser(sessionUser, remember);
    setUser(sessionUser);
    auditLog("LOGIN_SUCCESS", { userId: sessionUser.userId, lobs: getLobs(sessionUser) });
    return sessionUser;
  }, []);

  const logout = useCallback(() => {
    if (user) auditLog("LOGOUT", { userId: user.userId });
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, [user]);

  /** Switch OD <-> TP without logging in again. Returns the new home path. */
  const switchWorkspace = useCallback(
    (lob) => {
      if (!user || !hasAccess(user, lob)) return null;
      const from = user.lastWorkspace;
      const next = { ...user, lastWorkspace: lob };
      const remember = (() => {
        try {
          return !!localStorage.getItem(STORAGE_KEY);
        } catch {
          return false;
        }
      })();
      storeUser(next, remember);
      writeLastWorkspace(user.userId, lob);
      setUser(next);
      if (from !== lob) auditLog("WORKSPACE_SWITCH", { userId: user.userId, from, to: lob });
      return LOB_HOME[lob];
    },
    [user]
  );

  /**
   * DEMO ONLY – switch to another demo profile without signing out.
   * Keeps the current workspace (OD / TP) when the new profile has it.
   * Returns the new home path, or null if the profile is unknown.
   */
  /** Change the active role in a LOB (same user). Returns the LOB home path, or null. */
  const switchRole = useCallback(
    (lob, role) => {
      if (!user || !hasAccess(user, lob)) return null;
      const pick = assignedRoles(user, lob).find((r) => r.role === role);
      const from = user.access?.[lob]?.role;
      if (!pick || from === role) return null;
      const next = { ...user, access: { ...user.access, [lob]: { ...pick } }, lastWorkspace: lob };
      storeUser(next, isRemembered());
      try {
        localStorage.setItem(roleKey(user.userId, lob), role);
      } catch {
        /* ignore */
      }
      writeLastWorkspace(user.userId, lob);
      setUser(next);
      auditLog("ROLE_SWITCH", { userId: user.userId, lob, from, to: role });
      return LOB_HOME[lob];
    },
    [user]
  );

  /** Online / Away / In a meeting / Offline */
  const setAvailability = useCallback(
    (key) => {
      if (!user || !AVAILABILITY.some((a) => a.key === key) || user.availability === key) return;
      const next = { ...user, availability: key };
      storeUser(next, isRemembered());
      try {
        localStorage.setItem(availKey(user.userId), key);
      } catch {
        /* ignore */
      }
      setUser(next);
      auditLog("AVAILABILITY_CHANGE", { userId: user.userId, from: user.availability, to: key });
    },
    [user]
  );

  const switchProfile = useCallback(
    (userId) => {
      if (!DEMO_MODE || !user) return null;
      const found = DEMO_USERS.find((u) => u.userId === userId);
      if (!found || found.userId === user.userId) return null;
      const keepLob = user.lastWorkspace;
      const next = buildSessionUser(found, Object.keys(found.access).includes(keepLob) ? keepLob : readLastWorkspace(found.userId));
      const remember = (() => {
        try {
          return !!localStorage.getItem(STORAGE_KEY);
        } catch {
          return false;
        }
      })();
      storeUser(next, remember);
      writeLastWorkspace(next.userId, next.lastWorkspace);
      setUser(next);
      auditLog("DEMO_PROFILE_SWITCH", { from: user.userId, to: next.userId });
      return resolveDashboardPath(next);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      activeLob: user?.lastWorkspace ?? null,
      login,
      logout,
      switchWorkspace,
      switchProfile,
      switchRole,
      setAvailability,
      hasAccess: (lob) => hasAccess(user, lob),
    }),
    [user, login, logout, switchWorkspace, switchProfile, switchRole, setAvailability]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}