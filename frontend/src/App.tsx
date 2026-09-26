import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './components/Guards';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/file" element={<AppointmentsPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/facturation" element={<InvoicesPage />} />
        <Route
          path="/consultations"
          element={
            <RequireRole min="SOIGNANT">
              <ConsultationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/rapports"
          element={
            <RequireRole min="ADMIN">
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="/utilisateurs"
          element={
            <RequireRole min="ADMIN">
              <UsersPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
