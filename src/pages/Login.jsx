// src/pages/Login.jsx
// Smart Claims – P00 Login (common login for OD, TP and dual-access users)
// Uses src/auth.js: authenticate(), useAuth().login(user, remember), resolveDashboardPath(user)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAuth,
  authenticate,
  resolveDashboardPath,
  getLobs,
  formatINR,
  DEMO_USERS,
  DEMO_PASSWORD,
} from "../auth";
import {
  ShieldCheck,
  LayoutGrid,
  UserCheck,
  ClipboardCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  Loader2,
  ChevronDown,
  KeyRound,
  Info,
} from "lucide-react";

const MAX_ATTEMPTS = 3;

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "OD and TP workspaces",
    text: "Separate queues, KPIs and lifecycles for each line of business.",
  },
  {
    icon: UserCheck,
    title: "Role and authority based access",
    text: "Screens and approval limits follow your role, branch and LOB.",
  },
  {
    icon: ClipboardCheck,
    title: "Audit ready",
    text: "Every action is time-stamped against the user and the claim.",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [locked, setLocked] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  const userIdError =
    submitted && !userId.trim()
      ? "Enter your User ID or official email."
      : "";
  const passwordError =
    submitted && !password ? "Enter your password." : "";

  const handleCaps = (e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setFormError("");
    setNoAccess(false);
    if (locked || !userId.trim() || !password) return;

    setLoading(true);
    try {
      const user = await authenticate(userId.trim(), password);
      if (!user) throw new Error("invalid");
      if (getLobs(user).length === 0) {
        setNoAccess(true);
        return;
      }
      const sessionUser = login(user, remember);
      navigate(resolveDashboardPath(sessionUser), { replace: true });
    } catch {
      const left = attemptsLeft - 1;
      setAttemptsLeft(left);
      if (left <= 0) {
        setLocked(true);
        setFormError("");
      } else {
        setFormError(
          `User ID / email or password is incorrect. ${left} attempt${left === 1 ? "" : "s"} left before the account is locked.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(email) {
    setUserId(email);
    setPassword(DEMO_PASSWORD);
    setFormError("");
  }

  const inputBase =
    "h-11 w-full rounded-lg border bg-white px-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:ring-4";
  const inputOk = "border-slate-300 focus:border-teal-700 focus:ring-teal-700/15";
  const inputErr = "border-red-600 focus:border-red-600 focus:ring-red-600/15";

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* ---------------- Brand panel ---------------- */}
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-[#0B1F3A] px-6 py-6 text-slate-200 sm:px-12 lg:w-[46%] lg:px-14 lg:py-10">
        {/* subtle grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/15">
            <ShieldCheck className="h-6 w-6 text-teal-300" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-xl font-bold text-white">Smart Claims</p>
            <p className="text-xs text-slate-400">Motor Claims Management</p>
          </div>
        </div>

        <div className="relative hidden max-w-lg flex-col gap-6 lg:flex">
          <h1 className="text-[34px] font-semibold leading-tight text-white xl:text-[40px]">
            Motor claims, from intimation to closure.
          </h1>
          <p className="text-base leading-relaxed text-slate-300">
            One workspace for Own Damage and Third Party claims: intimation, survey, assessment,
            approval, settlement and recovery.
          </p>
          <ul className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-teal-500/15">
                  <Icon className="h-5 w-5 text-teal-300" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="text-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden flex-wrap justify-between gap-2 text-xs text-slate-500 lg:flex">
          <span>[INSURER NAME] · Powered by Owlsure IT</span>
          <span>Version 0.1.0</span>
        </div>
      </aside>

      {/* ---------------- Form panel ---------------- */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:overflow-hidden lg:py-4">
        <div className="w-full max-w-[420px]">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(11,31,58,0.08)] sm:p-8"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[#0B1F3A]">Sign in</h2>

                {/* Demo accounts – development builds only */}
                {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true") && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDemoOpen((v) => !v)}
                      aria-expanded={demoOpen}
                      aria-haspopup="listbox"
                      className="flex h-8 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Demo accounts
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${demoOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {demoOpen && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(11,31,58,0.18)]">
                        <p className="px-2 pb-1.5 pt-1 text-xs text-slate-500">
                          Dev only · click to fill · password{" "}
                          <span className="font-mono text-slate-700">{DEMO_PASSWORD}</span>
                        </p>
                        <ul className="flex flex-col gap-0.5">
                          {DEMO_USERS.map((u) => {
                            const lobs = Object.keys(u.access);
                            const roles = lobs
                              .map((l) => {
                                const r = u.access[l];
                                const lim = r.authorityLimit ? ` (${formatINR(r.authorityLimit)})` : "";
                                return lobs.length > 1 ? `${l}: ${r.roleLabel}${lim}` : `${r.roleLabel}${lim}`;
                              })
                              .join(" · ");
                            return (
                              <li key={u.userId}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    fillDemo(u.userId);
                                    setDemoOpen(false);
                                  }}
                                  className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[13px] font-medium text-slate-800">
                                      {u.userId}
                                    </span>
                                    <span className="flex gap-1">
                                      {lobs.map((l) => (
                                        <span
                                          key={l}
                                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                            l === "OD" ? "bg-teal-50 text-teal-800" : "bg-indigo-50 text-indigo-800"
                                          }`}
                                        >
                                          {l}
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {u.name} · {roles}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500">
                One login for Motor OD and TP. Your workspace opens based on your access.
              </p>
            </div>

            {/* Locked state */}
            {locked && (
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <Lock className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Account temporarily locked</p>
                  <p>
                    Too many failed attempts. Try again after 15 minutes, or reset your password.
                  </p>
                </div>
              </div>
            )}

            {/* Valid user, no LOB assigned */}
            {noAccess && (
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
              >
                <Info className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
                <div>
                  <p className="font-semibold">No workspace assigned</p>
                  <p>Your account has no OD or TP access yet. Contact your Admin.</p>
                </div>
              </div>
            )}

            {/* Credential error */}
            {formError && !locked && (
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Employee ID / email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="userId" className="text-sm font-medium text-slate-700">
                User ID or official email
              </label>
              <input
                id="userId"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="e.g. OD0123 or name@abcgeneral.co.in"
                value={userId}
                disabled={locked}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setFormError("");
                }}
                aria-invalid={!!userIdError}
                aria-describedby={userIdError ? "userId-error" : undefined}
                className={`${inputBase} ${userIdError ? inputErr : inputOk} disabled:bg-slate-100`}
              />
              {userIdError && (
                <p id="userId-error" className="text-[13px] text-red-700">
                  {userIdError}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <a
                  href="#forgot-password"
                  className="text-[13px] font-medium text-teal-700 hover:text-teal-900 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  disabled={locked}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError("");
                  }}
                  onKeyUp={handleCaps}
                  onKeyDown={handleCaps}
                  onBlur={() => setCapsOn(false)}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  className={`${inputBase} pr-12 ${passwordError ? inputErr : inputOk} disabled:bg-slate-100`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-0.5 top-0.5 grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" className="text-[13px] text-red-700">
                  {passwordError}
                </p>
              )}
              {capsOn && !passwordError && (
                <p className="text-[13px] text-amber-800">Caps Lock is on.</p>
              )}
            </div>

            {/* Remember */}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-[18px] w-[18px] accent-teal-700"
              />
              Keep me signed in on this device for 8 hours
            </label>

            {/* Primary action */}
            <button
              type="submit"
              disabled={loading || locked}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 text-base font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="flex items-center gap-3 text-[13px] text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white text-[15px] font-semibold text-[#0B1F3A] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <KeyRound className="h-[18px] w-[18px]" aria-hidden="true" />
              Sign in with company SSO
            </button>

            {/* Security notice + help */}
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-[12.5px] leading-snug text-slate-500">
              <p className="flex gap-2">
                <ShieldCheck className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
                Authorised users only. Sign-ins and claim actions are logged with user, time and IP
                address.
              </p>
              <a href="#help" className="self-center text-[13px] text-teal-700 hover:text-teal-900 hover:underline">
                Need help signing in?
              </a>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
}