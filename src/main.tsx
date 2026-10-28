import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SWRConfig } from "swr";
import { AuthProvider, useAuth } from "./auth/session";
import Login from "./auth/login";
import Layout, { RoleGate } from "./components/layout";
import { ErrorBoundary, Loading } from "./components/ui";
import PwaStatus from "./components/pwa-status";
import { captureInstallPrompt, registerServiceWorker } from "./lib/pwa";
import "./styles.css";
captureInstallPrompt();
registerServiceWorker();
const Dashboard = lazy(() => import("./features/dashboard"));
const ClinicalHome = lazy(() => import("./features/clinical-home"));
const NewReport = lazy(() => import("./features/new-report"));
const Reports = lazy(() => import("./features/reports"));
const Staff = lazy(() => import("./features/staff"));
const Audit = lazy(() => import("./features/audit"));
const Status = lazy(() => import("./features/status"));
const Password = lazy(() => import("./auth/password"));
const Account = lazy(() => import("./auth/account"));
function Home() {
  const { user } = useAuth();
  return user?.role === "SUPER_ADMIN" ? <Dashboard /> : <ClinicalHome />;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SWRConfig
        value={{
          provider: () => new Map(),
          shouldRetryOnError: false,
          revalidateOnFocus: false,
          dedupingInterval: 2000,
        }}
      >
        <PwaStatus />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="reports" element={<Reports />} />
                  <Route
                    path="new-report"
                    element={
                      <RoleGate admin={false}>
                        <NewReport />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="staff"
                    element={
                      <RoleGate admin>
                        <Staff />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <RoleGate admin>
                        <Audit />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="status"
                    element={
                      <RoleGate admin>
                        <Status />
                      </RoleGate>
                    }
                  />
                  <Route path="password" element={<Password />} />
                  <Route path="account" element={<Account />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </SWRConfig>
    </ErrorBoundary>
  </StrictMode>,
);
