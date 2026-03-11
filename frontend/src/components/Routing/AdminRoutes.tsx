// src/components/routing/AdminRoute.tsx
// Drop-in replacement for any route that should only be accessible to admins.
//
// Usage in createBrowserRouter:
//   { path: "/admin/pockets", element: <AdminRoute><AdminPocketDashboard /></AdminRoute> }
//
// What it does:
//   1. While auth is loading     → shows nothing (UserProvider already blocks render, but belt-and-braces)
//   2. Not logged in             → redirects to /login
//   3. Logged in but not admin   → renders a 403 page (does NOT redirect — prevents
//                                  leaking that the route exists to non-admin users)
//   4. Logged in and admin       → renders children
//
// IMPORTANT: This is a UI-only guard. Real security lives in your backend
// isAdmin middleware. A determined user could bypass this client-side check.
// That's fine — they'd just see a 403 from the API. Never skip the backend guard.

import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../../context/user";
import { ShieldX, Home } from "lucide-react";

interface AdminRouteProps {
  children: React.ReactNode;
  /**
   * Where to redirect unauthenticated users.
   * Defaults to /login with a `next` param so they land back here after login.
   */
  loginPath?: string;
}

// ── 403 page shown to authenticated non-admin users ───────────────────────────
function ForbiddenPage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh",
      background: "#0b0b0b", fontFamily: "'DM Sans', system-ui, sans-serif",
      gap: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ShieldX size={28} color="#ef4444" />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#fff", fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>
          Access Denied
        </p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
          You don't have permission to view this page.
        </p>
      </div>
      <a href="/" style={{
        display: "flex", alignItems: "center", gap: 6,
        marginTop: 8, padding: "9px 20px", borderRadius: 8,
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700,
        textDecoration: "none",
      }}>
        <Home size={13} /> Back to home
      </a>
    </div>
  );
}

// ── Guard component ────────────────────────────────────────────────────────────
const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  loginPath,
}) => {
  const { user, loading, isAdmin } = useUser();

  // UserProvider already suspends render until loading is false,
  // but guard here too for safety if AdminRoute is used outside UserProvider.
  if (loading) return null;

  // Not authenticated → redirect to login, preserve intended destination
  if (!user) {
    const next    = encodeURIComponent(window.location.pathname + window.location.search);
    const target  = loginPath ?? `/login?next=${next}`;
    return <Navigate to={target} replace />;
  }

  // Authenticated but wrong role → hard 403, no redirect
  if (!isAdmin) return <ForbiddenPage />;

  // All good
  return <>{children}</>;
};

export default AdminRoute;