import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/app-layout";
import { PageLoader } from "./components/ui/spinner";
import type { UserRole } from "./types";
import { useAuthStore } from "./store/auth.store";

import LoginPage from "./pages/auth/login-page";
import DashboardPage from "./pages/dashboard/dashboard-page";
import InventoryPage from "./pages/inventory/inventory-page";
import WriteOffPage from "./pages/inventory/write-off-page";
import DepartmentsPage from "./pages/departments/departments-page";
import UsersPage from "./pages/users/users-page";
import UserDetailPage from "./pages/users/user-detail-page";
import OperationsPage from "./pages/operations/operations-page";
import HistoryPage from "./pages/history/history-page";
import AssignedAssetsPage from "./pages/assigned-assets/assigned-assets-page";
import StatsPage from "./pages/stats/stats-page";
import ProfileInfoPage from "./pages/profile/profile-info-page";
import ProfileDepartmentPage from "./pages/profile/profile-department-page";
import ProfileAssetsPage from "./pages/profile/profile-assets-page";
import ProfileActivityPage from "./pages/profile/profile-activity-page";
import ProfileSecurityPage from "./pages/profile/profile-security-page";
import RequestsPage from "./pages/requests/requests-page";
import AuditLogsPage from "./pages/audit/audit-logs-page";
import AuditLogDetailPage from "./pages/audit/audit-log-detail-page";
import OrganizationsPage from "./pages/organizations/organizations-page";
import OrganizationDetailPage from "./pages/organizations/organization-detail-page";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: UserRole[];
}) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    return (
      <Navigate
        to={user?.role === "XODIM" ? "/profile" : "/dashboard"}
        replace
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  const ALL_MANAGERS: UserRole[] = [
    "SUPER_ADMIN",
    "VAZIRLIK_OMBORCHI",
    "ORG_ADMIN",
    "ORG_OMBORCHI",
    "ADMIN",
    "OMBORCHI",
  ];

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route
            path="/dashboard"
            element={
              <RequireRole roles={ALL_MANAGERS}>
                <DashboardPage />
              </RequireRole>
            }
          />

          <Route
            path="/requests"
            element={<RequestsPage />}
          />

          <Route
            path="/deletion-requests"
            element={<RequestsPage />}
          />

          <Route
            path="/audit-logs"
            element={
              <RequireRole roles={['SUPER_ADMIN']}>
                <AuditLogsPage />
              </RequireRole>
            }
          />

          <Route
            path="/audit-logs/:id"
            element={
              <RequireRole roles={['SUPER_ADMIN']}>
                <AuditLogDetailPage />
              </RequireRole>
            }
          />

          <Route
            path="/organizations"
            element={
              <RequireRole roles={['SUPER_ADMIN']}>
                <OrganizationsPage />
              </RequireRole>
            }
          />

          <Route
            path="/organizations/:id"
            element={
              <RequireRole roles={['SUPER_ADMIN']}>
                <OrganizationDetailPage />
              </RequireRole>
            }
          />

          <Route
            path="/inventory"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <InventoryPage />
              </RequireRole>
            }
          />

          <Route
            path="/inventory/write-off"
            element={
              <RequireRole roles={ALL_MANAGERS}>
                <WriteOffPage />
              </RequireRole>
            }
          />

          <Route
            path="/products"
            element={<Navigate to="/inventory" replace />}
          />

          <Route
            path="/departments"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <DepartmentsPage />
              </RequireRole>
            }
          />
          <Route
            path="/departments/:id"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <DepartmentsPage />
              </RequireRole>
            }
          />
          <Route
            path="/departments/:id/users/:userId"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <DepartmentsPage />
              </RequireRole>
            }
          />

          <Route
            path="/users"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <UsersPage />
              </RequireRole>
            }
          />
          <Route
            path="/users/:userId"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <UserDetailPage />
              </RequireRole>
            }
          />

          <Route
            path="/operations"
            element={
              <RequireRole roles={ALL_MANAGERS}>
                <OperationsPage />
              </RequireRole>
            }
          />

          <Route
            path="/history"
            element={
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
                <HistoryPage />
              </RequireRole>
            }
          />

          <Route
            path="/assigned-assets"
            element={
              <RequireRole roles={["SUPER_ADMIN", "ORG_ADMIN", "ADMIN", "KADR"]}>
                <AssignedAssetsPage />
              </RequireRole>
            }
          />

          <Route
            path="/stats"
            element={
              <RequireRole roles={ALL_MANAGERS}>
                <StatsPage />
              </RequireRole>
            }
          />

          <Route
            path="/profile"
            element={<Navigate to="/profile/info" replace />}
          />
          <Route
            path="/profile/info"
            element={
              <RequireRole roles={["XODIM"]}>
                <ProfileInfoPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/department"
            element={
              <RequireRole roles={["XODIM"]}>
                <ProfileDepartmentPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/assets"
            element={
              <RequireRole roles={["XODIM"]}>
                <ProfileAssetsPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/activity"
            element={
              <RequireRole roles={["XODIM"]}>
                <ProfileActivityPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/security"
            element={
              <RequireRole roles={["XODIM"]}>
                <ProfileSecurityPage />
              </RequireRole>
            }
          />

          <Route
            path="/"
            element={
              <Navigate
                to={
                  useAuthStore.getState().user?.role === "XODIM"
                    ? "/profile"
                    : "/dashboard"
                }
                replace
              />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
