// src/components/layout/ODShell.jsx
// Common layout for all Motor OD pages: left sidebar + top header + content area.
// Layout: sidebar and header never move. Only the content area scrolls.
// (Own scroll container, so it works regardless of global CSS in index.css.)
// Desktop default = HIDDEN: the sidebar is hidden entirely and the page uses the full width.
//   Move the mouse to the left edge → a slim icons-only bar slides in (names show on hover);
//   click ☰ in the header for the full panel with names;
//   it hides again when the mouse leaves. "Pin menu" keeps it open beside the page;
//   "Collapse menu" hides it entirely again. The choice is remembered per browser.
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
//                 step.onClick / step.disabled – makes a step clickable

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPopover from "../SearchPopover";
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
  Bell,
  ChevronDown,
  LogOut,
  HelpCircle,
  Menu,
  X,
  PanelLeftClose,
  Pin,
  ArrowLeft,
  Check,
  FileText,
} from "lucide-react";
import { useAuth, getRole, isDualAccess } from "../../auth";

// Menu for OD Claims Handler. Other roles get their own menu later.
const HANDLER_MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/od/dashboard" },
  { key: "queue", label: "My Work Queue", icon: ListChecks, to: "/od/worklist", badge: 46 },
  { key: "intimation", label: "Claim Intimation", icon: FilePlus2, to: "/od/intimation" },
  { key: "nbnr", label: "NBNR Bucket", icon: Inbox, to: "/od/nbnr", badge: 3 },
  { key: "diary", label: "Diary & Follow-ups", icon: CalendarClock, to: "/od/diary", badge: 4 },
  { key: "docs", label: "Docs Pending", icon: FileStack, to: "/od/documents", badge: 11 },
];

// Pages that exist so far. Add each new route here as it is built.
const BUILT_ROUTES = ["/od/dashboard", "/od/worklist", "/od/intimation"];

const MODE_KEY = "smartclaims-sidebar-mode"; // "auto" (default) | "pinned"

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

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  // Auto-hide sidebar (desktop)
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) === "pinned" ? "pinned" : "auto";
    } catch {
      return "auto";
    }
  });
  const auto = mode === "auto";
  const [peek, setPeek] = useState(false); // false | "hover" | "click"
  // Keep the full (labelled) layout until a slide-out has finished, so it never shrinks on screen
  const [fullLayout, setFullLayout] = useState(false);
  const layoutTimer = useRef(0);
  const closeTimer = useRef(0);
  const asideRef = useRef(null);
  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(layoutTimer.current);
    },
    []
  );
  function holdFullLayout() {
    window.clearTimeout(layoutTimer.current);
    setFullLayout(true);
    layoutTimer.current = window.setTimeout(() => setFullLayout(false), 320);
  }
  function openPeek() {
    window.clearTimeout(closeTimer.current);
    setPeek((v) => v || "hover");
  }
  function openFull() {
    window.clearTimeout(layoutTimer.current);
    setFullLayout(true);
    setPeek("click");
  }
  function closePeek() {
    if (peek === "click" || fullLayout) holdFullLayout();
    setPeek(false);
  }
  function setSidebarMode(next) {
    setMode(next);
    setPeek(false);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }
  // Esc closes an open sidebar
  useEffect(() => {
    if (!peek) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (peek === "click") holdFullLayout();
      setPeek(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);
  // Hover-open: follow the cursor itself (mouseleave is unreliable when the panel slides in
  // under a cursor that is standing still). Cursor clearly right of the panel → close.
  useEffect(() => {
    if (peek !== "hover") return undefined;
    const onMove = (e) => {
      const right = asideRef.current?.getBoundingClientRect().right ?? 0;
      if (e.clientX > right + 12) {
        if (!closeTimer.current) closeTimer.current = window.setTimeout(() => {
          closeTimer.current = 0;
          setPeek(false);
        }, 180);
      } else if (closeTimer.current) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = 0;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(closeTimer.current);
      closeTimer.current = 0;
    };
  }, [peek]);
  const sidebarOpen = mobileNav || peek; // slid in (auto mode / mobile)
  const role = getRole(user, "OD");

  // Collapse applies to desktop only; the mobile drawer always shows full labels
  // Hover on the left edge → slim icons-only bar (names as tooltips). ☰ / pinned / mobile → full labels.
  // Auto mode keeps the slim (icons-only) layout while hidden, so a hover only SLIDES it in –
  // the width never changes on screen (that caused the "wide then shrink" jump). ☰ opens full.
  const c = auto && !fullLayout && peek !== "click" && !mobileNav;
  const hideWhenCollapsed = c ? "lg:hidden" : "";

  // "Collapse menu" always hides the sidebar entirely
  function toggleCollapsed() {
    if (auto) closePeek();
    else {
      holdFullLayout(); // pinned (full) → slide out at full width, then switch to slim
      setSidebarMode("auto");
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
      {/* Auto-hide: thin strip on the left edge – hovering it slides the sidebar in */}
      {auto && !sidebarOpen && (
        <div
          onMouseEnter={openPeek}
          aria-hidden="true"
          className="fixed inset-y-0 left-0 z-30 hidden w-2.5 lg:block"
          title="Menu"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-[#0B1F3A]/80" />
        </div>
      )}
      <aside
        ref={asideRef}
        onMouseEnter={auto ? openPeek : undefined}
        inert={auto && !sidebarOpen ? true : undefined}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-none flex-col bg-[#0B1F3A] text-slate-300 shadow-2xl transition-transform duration-300 will-change-transform motion-reduce:transition-none ${
          auto ? "" : "lg:static lg:h-full lg:translate-x-0"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${c ? "lg:w-[68px]" : ""}`}
      >
        <div className={`flex h-12 items-center justify-between gap-2 border-b border-white/10 ${c ? "px-4 lg:justify-center lg:px-0" : "px-4"}`}>
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
                    aria-current={st.state === "active" || st.state === "hold" ? "step" : undefined}
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
                      className={`flex w-full gap-3 rounded-md px-3 text-left ${c ? "lg:justify-center lg:px-0" : ""} ${
                        clickable ? "cursor-pointer hover:bg-white/5" : "cursor-default"
                      }`}
                    >
                    <span className="relative flex flex-col items-center">
                      <span
                        className={`relative z-10 grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-bold ${circle}`}
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
                    <span className={`min-w-0 pb-3 pt-0.5 leading-tight ${hideWhenCollapsed}`}>
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
            {HANDLER_MENU.map((item) => {
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

          {/* Pin – desktop only, while the sidebar is in hidden (auto) mode */}
          {auto && (
          <button
            type="button"
            onClick={() => setSidebarMode("pinned")}
            aria-label="Pin menu"
            className={`group relative mt-1 hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white lg:flex ${
              c ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <Pin className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            <span className={hideWhenCollapsed}>Pin menu</span>
            <Tip show={c}>Pin menu</Tip>
          </button>
          )}

          {/* Collapse – hides the sidebar entirely */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse menu"
            className={`group relative mt-1 hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white lg:flex ${
              c ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <PanelLeftClose className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
            <span className={hideWhenCollapsed}>Collapse menu</span>
            <Tip show={c}>Collapse menu</Tip>
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}
      {/* Opened with ☰: click outside to close (hover-open closes when the mouse leaves) */}
      {peek === "click" && (
        <button type="button" aria-label="Close menu" tabIndex={-1} onClick={closePeek} className="fixed inset-0 z-30 hidden cursor-default bg-slate-900/20 lg:block" />
      )}

      {/* ---------------- Main column ---------------- */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-12 flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-5">
          <button
            type="button"
            onClick={() => (window.innerWidth >= 1024 ? openFull() : setMobileNav(true))}
            className={`grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 ${auto ? "" : "lg:hidden"}`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

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
            <button
              type="button"
              aria-label="Notifications, 4 unread"
              className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="flex h-10 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-100"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0B1F3A] text-xs font-semibold text-white">
                  {initials(user?.name)}
                </span>
                <span className="hidden whitespace-nowrap text-left leading-tight sm:block">
                  <span className="block text-[13px] font-semibold text-slate-800">{user?.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {role?.roleLabel} · {user?.branch}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-[0_16px_40px_rgba(11,31,58,0.16)]">
                  <div className="px-2 py-2">
                    <p className="font-semibold text-slate-800">{user?.name}</p>
                    <p className="text-xs text-slate-500">
                      {user?.userId} · {user?.email}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 px-2 py-2 text-xs">
                    <dt className="text-slate-500">LOB</dt>
                    <dd className="text-slate-800">Motor OD</dd>
                    <dt className="text-slate-500">Role</dt>
                    <dd className="text-slate-800">{role?.roleLabel}</dd>
                    <dt className="text-slate-500">Branch</dt>
                    <dd className="text-slate-800">{user?.branch}</dd>
                  </dl>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* relative: hidden inputs / tooltips inside pages are positioned against this scroll area,
            never against the browser page – otherwise the whole page could scroll and show a blank area */}
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">{children}</main>
      </div>
    </div>
  );
}