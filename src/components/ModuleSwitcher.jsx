import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const ModuleSwitcher = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const permissions = user?.permissions || [];
  const isOD = location.pathname.startsWith("/od");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6FFFB] text-[#005F56] shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 2.5 18.5 5v6.2c0 4.5-2.9 8.5-6.5 10.3-3.6-1.8-6.5-5.8-6.5-10.3V5L12 2.5Zm-1.1 6.1v5.8l4.6 2.4 1.1-1.8-3.4-1.8V8.6h-2.3Z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#005F56]">Smart Claims</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
          </div>
        </div>

        <nav className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
          {permissions.includes("od") && (
            <Link
              to="/od/dashboard"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${isOD ? "bg-[#005F56] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
            >
              OD Dashboard
            </Link>
          )}
          {permissions.includes("tp") && (
            <Link
              to="/tp/dashboard"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${!isOD ? "bg-[#005F56] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
            >
              TP Dashboard
            </Link>
          )}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Log out
        </button>
      </div>
    </header>
  );
};

export default ModuleSwitcher;

