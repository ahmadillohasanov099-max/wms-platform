import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/app-layout";
import { PageLoader } from "./components/ui/spinner";
import type { UserRole } from "./types";
import { useAuthStore } from "./store/auth.store";
import { getDefaultRouteForRole } from "./lib/utils";

// Route Lazy Loading for maximal bundle optimization and instant page transitions
const LoginPage = lazy(() => import("./pages/auth/login-page"));
const DashboardPage = lazy(() => import("./pages/dashboard/dashboard-page"));
const InventoryPage = lazy(() => import("./pages/inventory/inventory-page"));
const WriteOffPage = lazy(() => import("./pages/inventory/write-off-page"));
const DepartmentsPage = lazy(() => import("./pages/departments/departments-page"));
const UsersPage = lazy(() => import("./pages/users/users-page"));
const UserDetailPage = lazy(() => import("./pages/users/user-detail-page"));
const OperationsPage = lazy(() => import("./pages/operations/operations-page"));
const HistoryPage = lazy(() => import("./pages/history/history-page"));
const AssignedAssetsPage = lazy(() => import("./pages/assigned-assets/assigned-assets-page"));
const StatsPage = lazy(() => import("./pages/stats/stats-page"));
const ProfileInfoPage = lazy(() => import("./pages/profile/profile-info-page"));
const ProfileDepartmentPage = lazy(() => import("./pages/profile/profile-department-page"));
const ProfileAssetsPage = lazy(() => import("./pages/profile/profile-assets-page"));
const ProfileSecurityPage = lazy(() => import("./pages/profile/profile-security-page"));
const RequestsPage = lazy(() => import("./pages/requests/requests-page"));
const AuditLogsPage = lazy(() => import("./pages/audit/audit-logs-page"));
const AuditLogDetailPage = lazy(() => import("./pages/audit/audit-log-detail-page"));
const OrganizationsPage = lazy(() => import("./pages/organizations/organizations-page"));
const OrganizationDetailPage = lazy(() => import("./pages/organizations/organization-detail-page"));
const SupplyRequestsPage = lazy(() => import("./pages/departments/supply-requests-page"));
const AssetScanPage = lazy(() => import("./pages/public/asset-scan-page"));

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
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    return (
      <Navigate
        to={getDefaultRouteForRole(user?.role)}
        replace
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  const ALL_MANAGERS: UserRole[] = [
    "SUPER_ADMIN",
    "RAHBAR",
    "VAZIRLIK_OMBORCHI",
    "ORG_ADMIN",
    "ORG_OMBORCHI",
  ];

  const WAREHOUSE_MANAGERS: UserRole[] = [
    "SUPER_ADMIN",
    "VAZIRLIK_OMBORCHI",
    "ORG_ADMIN",
    "ORG_OMBORCHI",
  ];

  const ALL_ROLES: UserRole[] = [
    "SUPER_ADMIN",
    "RAHBAR",
    "VAZIRLIK_OMBORCHI",
    "ORG_ADMIN",
    "ORG_OMBORCHI",
    "KADR",
    "XODIM",
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
          path="/scan/:inventoryNumber"
          element={<AssetScanPage />}
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
            element={
              <RequireRole roles={['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'XODIM']}>
                <RequestsPage />
              </RequireRole>
            }
          />

          <Route
            path="/deletion-requests"
            element={
              <RequireRole roles={['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'XODIM']}>
                <RequestsPage />
              </RequireRole>
            }
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
              <RequireRole roles={['SUPER_ADMIN', 'RAHBAR']}>
                <OrganizationsPage />
              </RequireRole>
            }
          />

          <Route
            path="/organizations/:id"
            element={
              <RequireRole roles={['SUPER_ADMIN', 'RAHBAR']}>
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
              <RequireRole roles={WAREHOUSE_MANAGERS}>
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
              <RequireRole roles={WAREHOUSE_MANAGERS}>
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
              <RequireRole roles={[...ALL_MANAGERS, "KADR"]}>
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
              <RequireRole roles={ALL_ROLES}>
                <ProfileInfoPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/department"
            element={
              <RequireRole roles={ALL_ROLES}>
                <ProfileDepartmentPage />
              </RequireRole>
            }
          />
          <Route
            path="/supply-requests"
            element={
              <RequireRole roles={ALL_ROLES}>
                <SupplyRequestsPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/assets"
            element={
              <RequireRole roles={ALL_ROLES}>
                <ProfileAssetsPage />
              </RequireRole>
            }
          />
          <Route
            path="/profile/activity"
            element={<Navigate to="/profile/assets" replace />}
          />
          <Route
            path="/profile/security"
            element={
              <RequireRole roles={ALL_ROLES}>
                <ProfileSecurityPage />
              </RequireRole>
            }
          />

          <Route
            path="/"
            element={
              <Navigate
                to={getDefaultRouteForRole(useAuthStore.getState().user?.role)}
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
