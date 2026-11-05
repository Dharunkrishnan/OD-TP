// src/pages/od/ODRoleComingSoon.jsx
// Home page for OD roles whose own dashboard is not designed yet (Claims Approver, Admin).
// Shown inside the normal OD layout, so the profile menu (Select role) is always there
// and the user can move back to a built role at any time.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, ArrowRight } from "lucide-react";
import ODShell from "../../components/layout/ODShell";
import { useAuth, getRole, formatINR } from "../../auth";

// What each role's workspace will hold – from the OD requirement catalogue
const PLANNED = {
  CLAIMS_APPROVER: [
    "Approvals inbox – claims sent for approval within my authority limit",
    "Approve, query back to the handler, or reject with a reason",
    "Refer above my limit to the Claims Manager",
    "Approval history and approval TAT",
  ],
  ADMIN: [
    "Users, roles and branch mapping",
    "Authority matrix – approval limits by role and loss type",
    "SLA and TAT targets by stage",
    "Masters – garages, surveyors, document checklist",
    "Audit log viewer",
  ],
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function ODRoleComingSoon() {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const role = getRole(user, "OD");
  const [toast, setToast] = useState("");
  const firstName = (user?.name || "").split(" ")[0];
  const planned = PLANNED[role?.role] || [];

  function goTo(roleKey) {
    const path = switchRole("OD", roleKey);
    if (path) navigate(path, { replace: true });
  }

  return (
    <ODShell
      active="dashboard"
      title={`${greeting()}, ${firstName}`}
      subtitle={`${role?.roleLabel} workspace`}
      onNavigateMissing={(label) => {
        setToast(`${label} comes in a later build step.`);
        window.setTimeout(() => setToast(""), 2500);
      }}
    >
      <div className="mx-auto mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-amber-50">
            <Hourglass className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#0B1F3A]">{role?.roleLabel} workspace is not built yet</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              You are working as <b className="font-semibold text-slate-700">{role?.roleLabel}</b>
              {role?.authorityLimit ? ` · approval authority up to ${formatINR(role.authorityLimit)}` : ""}. This page will show:
            </p>
          </div>
        </div>
        {planned.length > 0 && (
          <ul className="mt-4 space-y-1.5 pl-[52px] text-[13px] text-slate-700">
            {planned.map((t) => (
              <li key={t} className="list-disc">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 pl-[52px]">
          <button
            type="button"
            onClick={() => goTo("CLAIMS_HANDLER")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 text-[13px] font-semibold text-white hover:bg-[#13305a]"
          >
            Work as Claims Handler <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo("CLAIMS_MANAGER")}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Work as Claims Manager
          </button>
        </div>
        <p className="mt-3 pl-[52px] text-[11.5px] text-slate-400">You can also change role any time from your name at the top right → Select role.</p>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0B1F3A] px-3 py-2 text-[12.5px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </ODShell>
  );
}