// src/pages/od/ODHome.jsx
// Decides which OD dashboard to show based on the user's ACTIVE OD role
// (the role chosen in the profile menu → Select role).
// Route: /od/dashboard  →  <ODHome />
//
// Role dashboards are added here as we design them, one by one.

import { useAuth, getRole } from "../../auth";
import ODHandlerDashboard from "./ODHandlerDashboard";
import ODManagerDashboard from "./ODManagerDashboard";
import ODRoleComingSoon from "./ODRoleComingSoon";
import ODDashboard from "../ODDashboard"; // existing generic dashboard (fallback when no role)

export default function ODHome() {
  const { user } = useAuth();
  const role = getRole(user, "OD")?.role;

  switch (role) {
    case "CLAIMS_HANDLER":
      return <ODHandlerDashboard />;
    case "CLAIMS_MANAGER":
      return <ODManagerDashboard />;
    // Own dashboards not designed yet – shown inside the OD layout so Select role stays available
    case "CLAIMS_APPROVER":
    case "ADMIN":
      return <ODRoleComingSoon />;
    default:
      return <ODDashboard />;
  }
}