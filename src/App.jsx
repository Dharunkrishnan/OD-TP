// src/App.jsx
// Smart Claims – routes and route protection.
//
// /login          – common login for OD, TP and dual-access users (public only)
// /od/dashboard   – OD home (role-based: ODHome picks the dashboard per OD role)
// /od/worklist    – OD My Work Queue (?tab=due|breach|risk|docs|nbnr)
// /od/intimation  – OD Claim Intimation (FNOL) – intimation + registration
// /od/claims/:id  – OD Claim 360 (id = claim no with "/" → "-", e.g. OD-CHN-26-004512)
// /tp/dashboard   – TP home
// /no-access      – logged-in user with no OD/TP access assigned
// *               – anything else → user's home (or login)

import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { AuthProvider, useAuth, hasAccess, resolveDashboardPath } from "./auth";
import Login from "./pages/Login";
import ODHome from "./pages/od/ODHome";
import ODWorkQueue from "./pages/od/ODWorkQueue";
import ODClaim360 from "./pages/od/ODClaim360";
import ODIntimation from "./pages/od/ODIntimation";
import TPDashboard from "./pages/TPDashboard";

/* ---------------- Route guards ---------------- */

// Must be logged in
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Must have access to this LOB (OD / TP). Logged-in users without access
// see a message instead of being thrown back to login (rule R6).
function RequirePermission({ permission, children }) {
  const { user } = useAuth();
  if (!hasAccess(user, permission)) return <AccessDenied lob={permission} />;
  return children;
}

// Logged-in users should not see the login page again
function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={resolveDashboardPath(user)} replace />;
  return children;
}

/* ---------------- Simple message pages ---------------- */

function MessagePage({ title, text, action }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{text}</p>
        <div className="mt-6">{action}</div>
      </div>
    </div>
  );
}

function AccessDenied({ lob }) {
  const { user } = useAuth();
  return (
    <MessagePage
      title="Access not available"
      text={`Your account does not have ${lob === "TP" ? "Motor Third Party" : "Motor Own Damage"} access. Contact your Admin if you need it.`}
      action={
        <Link
          to={resolveDashboardPath(user)}
          className="inline-flex h-10 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Go to my workspace
        </Link>
      }
    />
  );
}

function NoAccess() {
  const { logout } = useAuth();
  return (
    <MessagePage
      title="No workspace assigned"
      text="Your account has no OD or TP access yet. Contact your Admin."
      action={
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      }
    />
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? resolveDashboardPath(user) : "/login"} replace />;
}

/* ---------------- App ---------------- */

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />

          <Route
            path="/od/dashboard"
            element={
              <RequireAuth>
                <RequirePermission permission="OD">
                  <ODHome />
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/od/worklist"
            element={
              <RequireAuth>
                <RequirePermission permission="OD">
                  <ODWorkQueue />
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/od/intimation"
            element={
              <RequireAuth>
                <RequirePermission permission="OD">
                  <ODIntimation />
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/od/claims/:id"
            element={
              <RequireAuth>
                <RequirePermission permission="OD">
                  <ODClaim360 />
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/tp/dashboard"
            element={
              <RequireAuth>
                <RequirePermission permission="TP">
                  <TPDashboard />
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/no-access"
            element={
              <RequireAuth>
                <NoAccess />
              </RequireAuth>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}