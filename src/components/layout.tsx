import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  ScanLine,
  Users,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Activity,
  ChevronDown,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../auth/session";
import { Brand, ErrorNotice, Loading } from "./ui";
import { roleLabels } from "../lib/types";
export default function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<unknown>();
  const [leaving, setLeaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);
  // Hide the bottom navigation while the on-screen keyboard is open, so it never covers inputs or submit buttons.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const open = window.innerHeight - viewport.height > 150;
      document.documentElement.classList.toggle("keyboard-open", open);
    };
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [profileOpen]);
  if (loading) return <Loading label="Restoring your secure session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== "/password")
    return <Navigate to="/password" replace />;
  const admin = user.role === "SUPER_ADMIN";
  const navigation = [
    {
      path: "/",
      title: admin ? "Overview" : "My workspace",
      icon: LayoutDashboard,
    },
    ...(!admin
      ? [{ path: "/new-report", title: "New patient check", icon: ScanLine }]
      : []),
    {
      path: "/reports",
      title: admin ? "Reports" : "My reports",
      icon: ClipboardList,
    },
    ...(admin
      ? [
          { path: "/staff", title: "Staff accounts", icon: Users },
          { path: "/audit", title: "Audit trail", icon: ScrollText },
          { path: "/status", title: "System status", icon: Activity },
        ]
      : []),
  ];
  // Mobile bottom navigation: the primary destinations of each role (the drawer keeps everything else).
  const bottomNav = admin
    ? [
        { path: "/", title: "Overview", icon: LayoutDashboard },
        { path: "/reports", title: "Reports", icon: ClipboardList },
        { path: "/staff", title: "Staff", icon: Users },
        { path: "/audit", title: "Audit", icon: ScrollText },
      ]
    : [
        { path: "/", title: "Dashboard", icon: LayoutDashboard },
        { path: "/new-report", title: "Scan Patient", icon: ScanLine },
        { path: "/reports", title: "My Reports", icon: ClipboardList },
        { path: "/account", title: "Account", icon: UserCircle },
      ];
  // Single sign-out routine (existing server-side invalidation via useAuth().logout), used by the sidebar and the menu.
  const signOut = async () => {
    setLeaving(true);
    setError(undefined);
    try {
      await logout();
    } catch (e) {
      setError(e);
    } finally {
      setLeaving(false);
    }
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">STAFF WORKSPACE</div>
        <nav aria-label="Main navigation">
          {!user.mustChangePassword &&
            navigation.map(({ path, title, icon: Icon }) => (
              <NavLink
                end={path === "/"}
                to={path}
                key={path}
                onClick={() => setMenu(false)}
              >
                <Icon size={19} />
                {title}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <ShieldCheck size={21} />
            <strong>Patient privacy first</strong>
            <p>Access only the information needed for your role.</p>
          </div>
          <NavLink
            to="/password"
            className="settings-link"
            onClick={() => setMenu(false)}
          >
            <Settings size={18} />
            Account security
          </NavLink>
          <button
            className="logout"
            disabled={leaving}
            onClick={() => void signOut()}
          >
            <LogOut size={18} />
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="topbar-title">
              Patient Non-Compliance Monitoring
            </span>
          </div>
          <div className="profile-menu-wrap" ref={profileRef}>
            <button
              type="button"
              className="profile"
              ref={profileTrigger}
              aria-expanded={profileOpen}
              aria-controls="profile-menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="avatar">
                {user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="profile-text">
                <strong>{user.fullName}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
              <ChevronDown
                size={15}
                className="profile-caret"
                aria-hidden="true"
              />
            </button>
            {profileOpen && (
              <div className="profile-menu" id="profile-menu">
                {!user.mustChangePassword && (
                  <Link to="/account" onClick={() => setProfileOpen(false)}>
                    <Settings size={16} />
                    Account Settings
                  </Link>
                )}
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => {
                    setProfileOpen(false);
                    void signOut();
                  }}
                >
                  <LogOut size={16} />
                  {leaving ? "Signing out…" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className="page-content">
          <ErrorNotice error={error} />
          <Outlet />
        </main>
        {!user.mustChangePassword && (
          <nav className="bottom-nav" aria-label="Primary">
            {bottomNav.map(({ path, title, icon: Icon }) => (
              <NavLink end={path === "/"} to={path} key={path}>
                <Icon size={22} aria-hidden="true" />
                <span>{title}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <footer className="app-footer">
          <span>ChildLife Foundation · Clinical operations</span>
          <span>
            <ShieldCheck size={13} /> Confidential staff workspace
          </span>
        </footer>
      </div>
    </div>
  );
}
export function RoleGate({
  admin,
  children,
}: {
  admin: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return (user?.role === "SUPER_ADMIN") === admin ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}
