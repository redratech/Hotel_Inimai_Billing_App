import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UtensilsCrossed, ShoppingBag, Receipt, BarChart3, Menu as MenuIcon, X, LogOut, CalendarClock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "POS / Billing", icon: ShoppingBag },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/advance-orders", label: "Advance Orders", icon: CalendarClock },
  { to: "/bills", label: "Bill History", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useLocation().pathname;
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile topbar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 no-print">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -ml-2">
          <MenuIcon className="h-6 w-6" />
        </button>
        <div className="font-bold tracking-tight">Hotel Inimai</div>
        <div className="w-8" />
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 no-print",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: "var(--gradient-warm)", color: "oklch(0.2 0.05 35)" }}>
              HI
            </div>
            <div className="leading-tight">
              <div className="font-bold">Hotel Inimai</div>
              <div className="text-xs opacity-70">Billing System</div>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-4 text-xs text-sidebar-foreground/60 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sidebar-foreground/80">{user?.email ?? "Admin"}</div>
              <div>v1.0 · Powered by Redra Tech</div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden no-print"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}