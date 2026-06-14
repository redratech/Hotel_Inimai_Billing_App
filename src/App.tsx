import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import POSPage from "@/routes/index";
import Dashboard from "@/routes/dashboard";
import MenuPage from "@/routes/menu";
import BillsPage from "@/routes/bills";
import ReportsPage from "@/routes/reports";
import AuthPage from "@/routes/auth";
import AdvanceOrdersPage from "@/routes/advance-orders";
import AccountsPage from "@/routes/accounts";
import AccountHolderDetailPage from "@/routes/account-holder-detail";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  return <>{children}</>;
}

function ProtectedApp() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<POSPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/advance-orders" element={<AdvanceOrdersPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:holderSlug/:holderId" element={<AccountHolderDetailPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/*" element={<RequireAuth><ProtectedApp /></RequireAuth>} />
      </Routes>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}