// src/pages/od/ODHome.jsx
// Decides which OD dashboard to show based on the user's OD role.
// Route: /od/dashboard  →  <ODHome />
//
// Role dashboards are added here as we design them, one by one.

import { useAuth, getRole } from "../../auth";
import ODHandlerDashboard from "./ODHandlerDashboard";
import ODDashboard from "../ODDashboard"; // existing generic dashboard (fallback)

export default function ODHome() {
  const { user } = useAuth();
  const role = getRole(user, "OD")?.role;

  switch (role) {
    case "CLAIMS_HANDLER":
      return <ODHandlerDashboard />;
    // case "CLAIMS_APPROVER": return <ODApproverDashboard />;   // later
    // case "CLAIMS_MANAGER":  return <ODManagerDashboard />;    // later
    // case "ADMIN":           return <ODAdminHome />;           // later
    default:
      return <ODDashboard />;
  }
}