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
/* Demo users – 5 logins                                               */
/* Password for all: Demo@123                                          */
/* User ID prefix = naming convention only. Access is decided by       */
/* the `access` map, never by the prefix.                              */
/* ------------------------------------------------------------------ */
export const DEMO_PASSWORD = "Demo@123";

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

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      activeLob: user?.lastWorkspace ?? null,
      login,
      logout,
      switchWorkspace,
      hasAccess: (lob) => hasAccess(user, lob),
    }),
    [user, login, logout, switchWorkspace]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}