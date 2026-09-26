import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAnyRole, RequireAuth, RequireMedecin, RequireRole } from './components/Guards';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PathologiesPage } from './pages/PathologiesPage';
import { SchedulesPage } from './pages/SchedulesPage';
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
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />

        <Route
          path="/file"
          element={
            <RequireAnyRole roles={['ACCUEIL', 'GENERALISTE', 'ADMIN']}>
              <AppointmentsPage mode="general" />
            </RequireAnyRole>
          }
        />
        <Route
          path="/agenda"
          element={
            <RequireAnyRole roles={['SPECIALISTE']}>
              <AppointmentsPage mode="specialist" />
            </RequireAnyRole>
          }
        />
        <Route
          path="/consultations"
          element={
            <RequireAnyRole roles={['GENERALISTE', 'ADMIN']}>
              <ConsultationsPage />
            </RequireAnyRole>
          }
        />
        <Route
          path="/references"
          element={
            <RequireMedecin>
              <ReferralsPage />
            </RequireMedecin>
          }
        />
        <Route
          path="/catalogue"
          element={
            <RequireMedecin>
              <PathologiesPage />
            </RequireMedecin>
          }
        />
        <Route
          path="/calendriers"
          element={
            <RequireAnyRole roles={['SPECIALISTE', 'ADMIN']}>
              <SchedulesPage />
            </RequireAnyRole>
          }
        />
        <Route
          path="/facturation"
          element={
            <RequireAnyRole roles={['ACCUEIL', 'ADMIN']}>
              <InvoicesPage />
            </RequireAnyRole>
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
