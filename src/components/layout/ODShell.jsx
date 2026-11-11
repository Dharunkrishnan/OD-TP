// src/components/layout/ODShell.jsx
// Common layout for all Motor OD pages: left sidebar + top header + content area.
// Layout: sidebar and header never move. Only the content area scrolls.
// (Own scroll container, so it works regardless of global CSS in index.css.)
// Desktop: sidebar can be collapsed to icons only (remembered per browser).
// Mobile: sidebar opens as a drawer from the menu button.
//
// Props:
//   active    – key of the active menu item
//   title     – page title shown in the header
//   subtitle  – small line under the title (optional)
//   children  – page content
//   claimNav  – optional. When a claim is open, the sidebar shows the claim view instead
//               of the main menu: { claimNo, backTo, backLabel, steps: [{ label, status, state }] }
//               state = "done" | "active" | "hold" | "todo"
//               Optional extras (used by Claim Intimation):
//                 headLabel  – small caption above claimNo (default "Claim")
//                 stepsTitle – caption above the stepper (default "Claim lifecycle")
//                 onBack     – runs instead of navigating to backTo (e.g. to confirm leaving)
//                 step.onClick / step.disabled – makes a step clickable; step.selected – highlights it

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPopover from "../SearchPopover";
import NotificationsPopover from "../NotificationsPopover";
import { NOTIFICATIONS } from "../../data/notifications";
import { managerBadges, managerNotifications } from "../../data/odManagerData";
import { HANDLER_KPIS, DIARY } from "../../data/odHandlerMock";
import { claimSlug } from "../../data/odClaimDetail";
import { searchClaims, dueTodayClaims, searchPolicies, slaTone } from "../../data/searchIndex";
import {
  ShieldCheck,
  LayoutDashboard,
  ListChecks,
  FilePlus2,
  Inbox,
  CalendarClock,
  FileStack,
  LogOut,
  HelpCircle,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  Check,
  FileText,
  UsersRound,
  ClipboardCheck,
  AlertOctagon,
  BarChart3,
} from "lucide-react";
import { useAuth, getRole, isDualAccess } from "../../auth";
import ProfileMenu from "./ProfileMenu";

// Menu for OD Claims Handler. Other roles get their own menu later.
const HANDLER_MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/od/dashboard" },
  { key: "queue", label: "My Work Queue", icon: ListChecks, to: "/od/worklist", badge: HANDLER_KPIS.open },
  { key: "intimation", label: "Claim Intimation", icon: FilePlus2, to: "/od/intimation" },
  { key: "nbnr", label: "NBNR Bucket", icon: Inbox, to: "/od/nbnr", badge: HANDLER_KPIS.nbnr },
  { key: "diary", label: "Diary & Follow-ups", icon: CalendarClock, to: "/od/diary", badge: DIARY.filter((d) => !d.done).length },
  { key: "docs", label: "Docs Pending", icon: FileStack, to: "/od/documents", badge: HANDLER_KPIS.docsPending },
];

// Menu for OD Claims Manager (team supervision). Screens are added one by one.
const MANAGER_MENU = [
  { key: "dashboard", label: "Team Dashboard", icon: LayoutDashboard, to: "/od/dashboard" },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/od/approvals" },
  { key: "teamqueue", label: "Team Work Queue", icon: UsersRound, to: "/od/team-queue" },
  { key: "escalations", label: "Escalations", icon: AlertOctagon, to: "/od/escalations" },
  { key: "reports", label: "Reports", icon: BarChart3, to: "/od/reports" },
];

// Pages that exist so far. Add each new route here as it is built.
const BUILT_ROUTES = ["/od/dashboard", "/od/worklist", "/od/intimation", "/od/approvals", "/od/team-queue", "/od/escalations"];

const COLLAPSE_KEY = "smartclaims-sidebar-collapsed";
const CLAIM_COLLAPSE_KEY = "smartclaims-claimnav-collapsed-v2"; // claim / intimation view opens minimised (icons only) by default

// Default = collapsed (icons only, name on hover). The user can expand it;
// their choice is remembered in this browser.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Tooltip shown to the right of an icon when the sidebar is collapsed (desktop). */
function Tip({ show, children }) {
  if (!show) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block lg:group-hover:block"
    >
      {children}
    </span>
  );
}

export default function ODShell({ active = "dashboard", title, subtitle, children, onNavigateMissing, claimNav }) {
  const navigate = useNavigate();

  // Suggestions for the header search panel
  const globalSuggest = useCallback(
    (q) => {
      const claimItem = (r) => ({
        id: r.claimNo,
        icon: FileText,
        title: `${r.claimNo} · ${r.regNo}`,
        subtitle: `${r.insured} · ${r.stage}`,
        meta: r.sla.label,
        metaTone: slaTone(r.sla.status),
        onSelect: () => navigate(`/od/claims/${claimSlug(r.claimNo)}`),
      });
      if (!q) {
        return [
          { group: "Due today", items: dueTodayClaims().map(claimItem) },
          {
            group: "Quick actions",
            items: [{ id: "new-fnol", icon: FilePlus2, title: "New claim intimation", subtitle: "Register a new Motor OD claim", onSelect: () => navigate("/od/intimation") }],
          },
        ];
      }
      return [
        { group: "Claims", items: searchClaims(q).map(claimItem) },
        {
          group: "Policies – start an intimation",
          items: searchPolicies(q).map((p) => ({
            id: p.policyNo,
            icon: ShieldCheck,
            title: `${p.regNo} · ${p.insured}`,
            subtitle: `${p.policyNo} · ${p.vehicle}`,
            meta: p.status,
            metaTone: p.status === "In force" ? "teal" : "red",
            onSelect: () => navigate(`/od/intimation?q=${encodeURIComponent(p.regNo)}`),
          })),
        },
      ];
    },
    [navigate]
  );
  const { user, logout } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(readCollapsed);
  const [claimCollapsed, setClaimCollapsed] = useState(() => {
    try {
      return localStorage.getItem(CLAIM_COLLAPSE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // My Work Queue (desktop): the left nav cycles through three states –
  //   hidden  → (☰ in header)      → minimised (68 px icons)
  //   minimised → (Expand menu)    → maximised (240 px with names)
  //   maximised → (Collapse menu)  → hidden again
  // While hidden, resting the cursor on the left edge of the screen slides the icon bar
  // in OVER the queue (the table does not move) and it slides away when the cursor leaves.
  // Clicking the logo in the header pins the icon bar open (minimised).
  // It always starts hidden when the queue opens, so the queue gets the full width.
  // On mobile, ☰ opens the usual slide-in drawer.
  const isQueue = active === "queue" && !claimNav;
  const [queueNav, setQueueNav] = useState("hidden"); // "hidden" | "mini" | "full"
  const [peek, setPeek] = useState(false); // hidden nav shown temporarily on hover
  const navHidden = isQueue && queueNav === "hidden";
  const peeking = navHidden && peek;
  // No slide animation on the first paint, so the nav never sweeps across the page as it opens
  const [animReady, setAnimReady] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimReady(true)));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const peekTimer = useRef(0);

  function peekSoon(show, delay) {
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeek(show), delay);
  }
  useEffect(() => () => window.clearTimeout(peekTimer.current), []);

  // Main menu and claim view remember their own collapsed / expanded choice
  const collapsed = claimNav ? claimCollapsed : isQueue ? queueNav !== "full" : menuCollapsed;
  const role = getRole(user, "OD");
  const isManager = role?.role === "CLAIMS_MANAGER";
  // manager badges and bell are live: recount when a manager action is saved on this page
  const [, setMgrTick] = useState(0);
  useEffect(() => {
    if (!isManager) return undefined;
    const bump = () => setMgrTick((t) => t + 1);
    window.addEventListener("smartclaims:manager-data", bump);
    return () => window.removeEventListener("smartclaims:manager-data", bump);
  }, [isManager]);
  const mgrBadges = isManager ? managerBadges() : null;
  const menu = isManager ? MANAGER_MENU.map((m) => ({ ...m, badge: mgrBadges[m.key] || undefined })) : HANDLER_MENU;

  // Esc closes the slide-in menu
  useEffect(() => {
    if (!mobileNav) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNav(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNav]);

  // Collapse applies to desktop only; the mobile drawer always shows full labels
  const c = collapsed && !mobileNav;
  const hideWhenCollapsed = c ? "lg:hidden" : "";

  function toggleCollapsed() {
    if (isQueue) {
      window.clearTimeout(peekTimer.current);
      setPeek(false);
      setQueueNav(queueNav === "full" ? "hidden" : "full");
      return;
    }
    const next = !collapsed;
    (claimNav ? setClaimCollapsed : setMenuCollapsed)(next);
    try {
      localStorage.setItem(claimNav ? CLAIM_COLLAPSE_KEY : COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function go(item) {
    setMobileNav(false);
    if (item.key === active) return;
    // Pages not built yet: let the page show a message instead of a blank route
    if (!BUILT_ROUTES.includes(item.to) && onNavigateMissing) {
      onNavigateMissing(item.label);
      return;
    }
    navigate(item.to);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* ---------------- Sidebar ---------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-none flex-col bg-[#0B1F3A] text-slate-300 ${
          animReady ? "transition-[width,transform,box-shadow] duration-200 ease-out" : ""
        } ${
          mobileNav ? "translate-x-0" : "-translate-x-full"
        } ${
          navHidden
            ? // Queue, nav hidden: floats over the page; slides in on hover (peek)
              // it opens BELOW the header row (top 48 px), so it never covers the page title
              `lg:top-12 lg:w-[68px] ${peeking ? "lg:translate-x-0 lg:shadow-[8px_0_24px_-8px_rgba(15,23,42,0.45)]" : ""}`
            : `lg:static lg:h-full lg:translate-x-0 ${c ? "lg:w-[68px]" : ""}`
        }`}
        inert={navHidden && !mobileNav && !peeking ? true : undefined}
        onMouseEnter={navHidden ? () => peekSoon(true, 0) : undefined}
        onMouseLeave={
          navHidden
            ? (e) => {
                // Cursor pushed off the left edge of the window → keep the nav open
                if (!e.relatedTarget && e.clientX <= 2) return;
                peekSoon(false, 400);
              }
            : undefined
        }
      >
        <div
          className={`flex h-12 items-center justify-between gap-2 border-b border-white/10 ${c ? "px-4 lg:justify-center lg:px-0" : "px-4"} ${
            navHidden ? "lg:hidden" : "" /* the header already shows the logo on My Work Queue */
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-teal-500/15" title={c ? "Smart Claims · Motor Own Damage" : undefined}>
              <ShieldCheck className="h-5 w-5 text-teal-300" aria-hidden="true" />
            </span>
            <div className={`leading-tight ${hideWhenCollapsed}`}>
              <p className="text-[15px] font-bold text-white">Smart Claims</p>
              <p className="text-[11px] text-slate-400">Motor Own Damage</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNav(false)}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {claimNav ? (
          <nav className="min-h-0 flex-1 px-2 py-3" aria-label="Claim navigation">
            <button
              type="button"
              onClick={() => {
                setMobileNav(false);
                if (claimNav.onBack) claimNav.onBack();
                else navigate(claimNav.backTo || "/od/worklist");
              }}
              aria-label={c ? claimNav.backLabel || "Back to My Work Queue" : undefined}
              className={`group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white ${
                c ? "lg:justify-center lg:px-0" : ""
              }`}
            >
              <ArrowLeft className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
              <span className={`truncate ${hideWhenCollapsed}`}>{claimNav.backLabel || "Back to My Work Queue"}</span>
              <Tip show={c}>{claimNav.backLabel || "Back to My Work Queue"}</Tip>
            </button>

            <div className={`mx-1 mt-2 rounded-lg bg-white/5 px-3 py-2 ${hideWhenCollapsed}`}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{claimNav.headLabel || "Claim"}</p>
              <p className="truncate font-mono text-[13px] font-semibold text-white">{claimNav.claimNo}</p>
            </div>

            <p className={`mb-1 mt-4 px-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 ${hideWhenCollapsed}`}>
              {claimNav.stepsTitle || "Claim lifecycle"}
            </p>
            <ol className={`flex flex-col ${c ? "lg:mt-3 lg:items-center" : ""}`} aria-label={claimNav.stepsTitle || "Claim lifecycle"}>
              {claimNav.steps.map((st, i) => {
                const last = i === claimNav.steps.length - 1;
                const circle =
                  st.state === "done"
                    ? "bg-teal-500 text-[#0B1F3A]"
                    : st.state === "hold"
                    ? "bg-amber-400 text-[#0B1F3A] ring-4 ring-amber-400/25"
                    : st.state === "active"
                    ? "bg-teal-400 text-[#0B1F3A] ring-4 ring-teal-400/25"
                    : "border-2 border-slate-600 text-slate-400";
                const statusCls =
                  st.state === "done"
                    ? "text-teal-300"
                    : st.state === "hold"
                    ? "text-amber-300"
                    : st.state === "active"
                    ? "text-teal-200"
                    : "text-slate-500";
                const clickable = !!st.onClick && !st.disabled;
                const Row = st.onClick ? "button" : "div";
                return (
                  <li
                    key={st.label}
                    aria-current={st.selected ? "step" : st.state === "active" || st.state === "hold" ? "step" : undefined}
                    className="group relative"
                  >
                    <Row
                      {...(st.onClick
                        ? {
                            type: "button",
                            disabled: !clickable,
                            onClick: () => {
                              setMobileNav(false);
                              st.onClick();
                            },
                            "aria-label": c ? `${st.label}: ${st.status}` : undefined,
                          }
                        : {})}
                      // No box behind the row: the box also covered the connector line and looked shifted below the step.
                      // The step being viewed is marked on the circle itself (white ring) and on its label (expanded rail).
                      className={`group/step flex w-full gap-3 px-3 text-left focus-visible:outline-none ${c ? "lg:justify-center lg:px-0" : ""} ${
                        clickable ? "cursor-pointer" : "cursor-default"
                      } ${st.disabled ? "cursor-not-allowed" : ""}`}
                    >
                    <span className="relative flex flex-col items-center">
                      <span
                        className={`relative z-10 grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-bold transition ${circle} ${
                          st.selected
                            ? "outline outline-2 outline-offset-[3px] outline-white"
                            : clickable
                            ? "group-hover/step:outline group-hover/step:outline-2 group-hover/step:outline-offset-[3px] group-hover/step:outline-white/40 group-focus-visible/step:outline group-focus-visible/step:outline-2 group-focus-visible/step:outline-offset-[3px] group-focus-visible/step:outline-white/70"
                            : ""
                        }`}
                        aria-label={c ? `${st.label}: ${st.status}` : undefined}
                      >
                        {st.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                      </span>
                      {!last && (
                        <span
                          className={`w-0.5 flex-1 ${c ? "min-h-4" : "min-h-5"} ${st.state === "done" ? "bg-teal-500" : "bg-slate-600"}`}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span
                      className={`-mt-0.5 mb-2.5 min-w-0 flex-1 self-start rounded-md px-2 py-0.5 leading-tight ${hideWhenCollapsed} ${
                        st.selected ? "bg-white/10" : clickable ? "group-hover/step:bg-white/5" : ""
                      }`}
                    >
                      <span
                        className={`block text-[13px] font-semibold ${
                          st.state === "todo" ? "text-slate-400" : "text-white"
                        }`}
                      >
                        {st.label}
                      </span>
                      <span className={`block text-[11.5px] ${statusCls}`}>{st.status}</span>
                    </span>
                    </Row>
                    <Tip show={c}>
                      {st.label} · {st.status}
                    </Tip>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : (
        <nav className="min-h-0 flex-1 px-2 py-3" aria-label="OD menu">
          <ul className="flex flex-col gap-0.5">
            {menu.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => go(item)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={c ? `${item.label}${item.badge != null ? `, ${item.badge}` : ""}` : undefined}
                    className={`group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                      c ? "lg:justify-center lg:px-0" : ""
                    } ${
                      isActive
                        ? "bg-teal-500/15 font-semibold text-white"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="relative flex-none">
                      <Icon className={`h-[18px] w-[18px] ${isActive ? "text-teal-300" : ""}`} aria-hidden="true" />
                      {c && item.badge != null && (
                        <span className="absolute -right-2.5 -top-2 hidden min-w-[18px] rounded-full bg-teal-500 px-1 text-center text-[10px] font-bold leading-[16px] text-[#0B1F3A] lg:block">
                          {item.badge}
                        </span>
                      )}
                    </span>
                    <span className={`flex-1 truncate ${hideWhenCollapsed}`}>{item.label}</span>
                    {item.badge != null && (
                      <span className={`rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-200 ${hideWhenCollapsed}`}>
                        {item.badge}
                      </span>
                    )}
                    <Tip show={c}>{item.label}</Tip>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        )}

        <div className="border-t border-white/10 px-2 py-3">
          {[
            { label: "Help & SOPs", Icon: HelpCircle, onClick: undefined },
            { label: "Sign out", Icon: LogOut, onClick: handleLogout },
          ].map(({ label, Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={c ? label : undefined}
              className={`group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white ${
                c ? "lg:justify-center lg:px-0" : ""
              }`}
            >
              <Icon className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
              <span className={hideWhenCollapsed}>{label}</span>
              <Tip show={c}>{label}</Tip>
            </button>
          ))}

          {/* Collapse / expand – desktop only. On My Work Queue, Collapse hides the nav entirely. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            className={`group relative mt-1 hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white lg:flex ${
              c ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            )}
            <span className={hideWhenCollapsed}>Collapse menu</span>
            <Tip show={c}>Expand menu</Tip>
          </button>
        </div>
      </aside>
      {navHidden && !peeking && (
        // Invisible hot zone on the left edge: resting the cursor here slides the nav in
        <div
          aria-hidden="true"
          className="fixed bottom-0 left-0 top-12 z-30 hidden w-4 lg:block"
          onMouseEnter={() => peekSoon(true, 120)}
          onMouseLeave={() => peekSoon(false, 0)}
        />
      )}
      {mobileNav && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      {/* ---------------- Main column ---------------- */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-12 flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-5">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="grid h-9 w-9 flex-none place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {navHidden && (
            // Desktop, queue: our logo sits where the menu icon was; clicking it pins the icon bar open.
            // The 68 px slot lines up with the nav; while the nav slides in, the slot turns navy so
            // logo + nav read as one sidebar (the page title is never covered).
            <span
              className={`-my-px -ml-5 hidden w-[68px] flex-none place-items-center self-stretch lg:grid ${
                peeking ? "bg-[#0B1F3A]" : ""
              }`}
              onMouseEnter={peeking ? () => peekSoon(true, 0) : undefined}
              onMouseLeave={peeking ? () => peekSoon(false, 400) : undefined}
            >
              <button
                type="button"
                onClick={() => {
                  window.clearTimeout(peekTimer.current);
                  setPeek(false);
                  setQueueNav("mini");
                }}
                aria-label="Show menu"
                title="Smart Claims · show menu"
                className={`grid h-9 w-9 place-items-center rounded-lg hover:ring-2 hover:ring-teal-400/60 ${
                  peeking ? "bg-teal-500/15" : "bg-[#0B1F3A]"
                }`}
              >
                <ShieldCheck className="h-5 w-5 text-teal-300" aria-hidden="true" />
              </button>
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[#0B1F3A]">{title}</h1>
            {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Global search – icon only; opens a panel with suggestions */}
            <SearchPopover
              label="Search claims and policies"
              placeholder="Claim no, vehicle no, policy no or insured name"
              suggest={globalSuggest}
            />
            {isDualAccess(user) && (
              <span className="hidden rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 sm:inline">
                OD workspace
              </span>
            )}
            {isManager ? (
              <NotificationsPopover
                items={managerNotifications()}
                onNavigate={(to) => navigate(to)}
                viewAllLabel="Open Escalations"
                onViewAll={() => navigate("/od/escalations")}
              />
            ) : (
              <NotificationsPopover
                items={NOTIFICATIONS}
                onOpenClaim={(no) => navigate(`/od/claims/${claimSlug(no)}`)}
                onViewAll={() => {
                  if (window.location.pathname === "/od/worklist") window.dispatchEvent(new Event("smartclaims:open-alerts"));
                  else navigate("/od/worklist?alerts=1");
                }}
              />
            )}

            <ProfileMenu lob="OD" onLogout={handleLogout} />
          </div>
        </header>

        {/* relative: hidden inputs / tooltips inside pages are positioned against this scroll area,
            never against the browser page – otherwise the whole page could scroll and show a blank area */}
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">{children}</main>
      </div>
    </div>
  );
}