import { Routes, Route, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import RouteGuard from './components/RouteGuard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import VisitDetail from './pages/VisitDetail';
import AddVisit from './pages/AddVisit';
import Cohort from './pages/Cohort';
import Settings from './pages/Settings';
import Home from './pages/Home';
import RegisterPatient from './pages/RegisterPatient';
import AppointmentsPage from './pages/AppointmentsPage';
import AppointmentForm from './pages/AppointmentForm';
import AppointmentDetail from './pages/AppointmentDetail';
import Reports from './pages/Reports';
import PharmacyQueue from './pages/PharmacyQueue';
import DispenseDetail from './pages/DispenseDetail';
import PharmacyInventory from './pages/PharmacyInventory';
import AddDrug from './pages/AddDrug';
import VisitBilling from './pages/VisitBilling';
import PosList from './pages/PosList';
import BillingWorkspace from './pages/BillingWorkspace';
import SettingsServices from './pages/SettingsServices';
import ProblemList from './pages/ProblemList';
import LabOrdersPage from './pages/LabOrders';
import LabOrderDetailPage from './pages/LabOrderDetail';
import './styles/App.css';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import TenantPicker from './components/TenantPicker';

function TenantOverlays() {
  const location = useLocation();
  const { activeTenant, tenants, isLoading } = useTenant();

  const isLoginRoute = location.pathname === '/login';
  const showLoading = isLoading && !isLoginRoute;
  const showTenantPicker = !isLoginRoute && !isLoading && tenants.length > 1 && !activeTenant;
  const showNoTenants = !isLoginRoute && !isLoading && tenants.length === 0 && !activeTenant;

  return (
    <>
      {showLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70">
          <div className="rounded-xl bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-lg">
            Loading clinics...
          </div>
        </div>
      )}
      {showTenantPicker && <TenantPicker />}
      {showNoTenants && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-6 text-center">
          <div className="max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">No clinics available</h2>
            <p className="mt-3 text-sm text-slate-500">
              Your account does not have any clinic memberships yet. Please contact your administrator to request access.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/patients"
          element={
            <RouteGuard>
              <Patients />
            </RouteGuard>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <RouteGuard>
              <PatientDetail />
            </RouteGuard>
          }
        />
        <Route
          path="/patients/:patientId/problems"
          element={
            <RouteGuard allowedRoles={['Doctor', 'Nurse', 'ITAdmin']}>
              <ProblemList />
            </RouteGuard>
          }
        />
        <Route
          path="/appointments"
          element={
            <RouteGuard allowedRoles={['Doctor', 'AdminAssistant']}>
              <AppointmentsPage />
            </RouteGuard>
          }
        />
        <Route
          path="/appointments/new"
          element={
            <RouteGuard allowedRoles={['AdminAssistant']}>
              <AppointmentForm />
            </RouteGuard>
          }
        />
        <Route
          path="/appointments/:id"
          element={
            <RouteGuard allowedRoles={['Doctor', 'AdminAssistant']}>
              <AppointmentDetail />
            </RouteGuard>
          }
        />
        <Route
          path="/patients/:id/visits/new"
          element={
            <RouteGuard>
              <AddVisit />
            </RouteGuard>
          }
        />
        <Route
          path="/"
          element={
            <RouteGuard>
              <Home />
            </RouteGuard>
          }
        />
        <Route
          path="/register"
          element={
            <RouteGuard allowedRoles={['AdminAssistant', 'ITAdmin']}>
              <RegisterPatient />
            </RouteGuard>
          }
        />
        <Route
          path="/visits/:id"
          element={
            <RouteGuard>
              <VisitDetail />
            </RouteGuard>
          }
        />
        <Route
          path="/cohort"
          element={
            <RouteGuard>
              <Cohort />
            </RouteGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <RouteGuard>
              <Reports />
            </RouteGuard>
          }
        />
        <Route
          path="/lab-orders"
          element={
            <RouteGuard allowedRoles={['Doctor', 'LabTech', 'ITAdmin']}>
              <LabOrdersPage />
            </RouteGuard>
          }
        />
        <Route
          path="/lab-orders/:labOrderId"
          element={
            <RouteGuard allowedRoles={['Doctor', 'LabTech', 'ITAdmin']}>
              <LabOrderDetailPage />
            </RouteGuard>
          }
        />
        <Route
          path="/pharmacy/queue"
          element={
            <RouteGuard allowedRoles={['Pharmacist', 'PharmacyTech', 'InventoryManager', 'ITAdmin']}>
              <PharmacyQueue />
            </RouteGuard>
          }
        />
        <Route
          path="/pharmacy/inventory"
          element={
            <RouteGuard allowedRoles={['InventoryManager', 'ITAdmin']}>
              <PharmacyInventory />
            </RouteGuard>
          }
        />
        <Route
          path="/pharmacy/drugs/new"
          element={
            <RouteGuard allowedRoles={['InventoryManager', 'ITAdmin']}>
              <AddDrug />
            </RouteGuard>
          }
        />
        <Route
          path="/billing/workspace"
          element={
            <RouteGuard allowedRoles={['Cashier', 'ITAdmin', 'Doctor', 'Pharmacist']}>
              <BillingWorkspace />
            </RouteGuard>
          }
        />
        <Route
          path="/billing/visit/:visitId"
          element={
            <RouteGuard allowedRoles={['Cashier', 'ITAdmin', 'Doctor', 'Pharmacist']}>
              <VisitBilling />
            </RouteGuard>
          }
        />
        <Route
          path="/billing/pos"
          element={
            <RouteGuard allowedRoles={['Cashier', 'ITAdmin']}>
              <PosList />
            </RouteGuard>
          }
        />
        <Route
          path="/pharmacy/dispense/:prescriptionId"
          element={
            <RouteGuard allowedRoles={['Pharmacist', 'PharmacyTech']}>
              <DispenseDetail />
            </RouteGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <RouteGuard allowedRoles={['ITAdmin']}>
              <Settings />
            </RouteGuard>
          }
        />
        <Route
          path="/settings/services"
          element={
            <RouteGuard allowedRoles={['ITAdmin']}>
              <SettingsServices />
            </RouteGuard>
          }
        />
      </Routes>
      <TenantOverlays />
    </>
  );
}

function App() {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  );
}

export default App;
