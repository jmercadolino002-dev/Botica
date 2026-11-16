import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AlertsView } from './components/AlertsView';
import { InventoryView } from './components/InventoryView';
import { LoginScreen } from './components/LoginScreen';
import { OverviewView } from './components/OverviewView';
import { PosView } from './components/PosView';
import { QueueAndClientsView } from './components/QueueAndClientsView';
import { ReceiptModal } from './components/ReceiptModal';
import { SalesView } from './components/SalesView';
import { SecurityAuditView } from './components/SecurityAuditView';
import { Sidebar, type NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { auth } from './lib/firebase';
import {
  computeAlertsFromProducts,
  computeDashboardSummary,
  ensureUserAndWorkspace,
  subscribeWorkspace,
} from './lib/pharmacyService';
import type {
  AuditLog,
  Customer,
  Product,
  QueueTicket,
  RestockOrder,
  Sale,
  UserProfile,
  UserRole,
} from './shared/types';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<UserRole>('admin');
  const [authChecking, setAuthChecking] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  useEffect(() => {
    let unsubWorkspace: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setPharmacyId(null);
        setProducts([]);
        setCustomers([]);
        setQueue([]);
        setSales([]);
        setRestockOrders([]);
        setAuditLogs([]);
        setAuthChecking(false);
        return;
      }

      setAuthChecking(true);
      setWorkspaceError(null);
      try {
        const { profile, pharmacyId: resolvedId } = await ensureUserAndWorkspace(firebaseUser);
        setUser(profile);
        setEffectiveRole(profile.role);
        setPharmacyId(resolvedId);
        setLoadingData(true);

        const isBootstrapAdmin =
          firebaseUser.email === 'jmercadolino002@gmail.com' && firebaseUser.emailVerified;

        unsubWorkspace = subscribeWorkspace(resolvedId, firebaseUser.uid, isBootstrapAdmin, {
          onProducts: (list) => {
            setProducts(list);
            setLoadingData(false);
          },
          onCustomers: setCustomers,
          onQueue: setQueue,
          onSales: setSales,
          onRestockOrders: setRestockOrders,
          onAuditLogs: setAuditLogs,
        });
      } catch (err) {
        setWorkspaceError(
          err instanceof Error ? err.message : 'No se pudo inicializar el espacio en Firestore.',
        );
      } finally {
        setAuthChecking(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubWorkspace) unsubWorkspace();
    };
  }, []);

  const alerts = useMemo(() => computeAlertsFromProducts(products), [products]);
  const dashboard = useMemo(
    () => computeDashboardSummary(products, sales, queue),
    [products, sales, queue],
  );

  async function handleLogout() {
    await signOut(auth);
    setActiveTicket(null);
  }

  function handleAttendInPos(ticket: QueueTicket) {
    setActiveTicket(ticket);
    setActiveSection('pos');
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-600">Conectando con Firebase...</p>
      </div>
    );
  }

  if (!user || !pharmacyId) {
    return <LoginScreen />;
  }

  const activeQueueCount = queue.filter((q) => q.status !== 'Atendido').length;
  const displayUser: UserProfile = {
    ...user,
    role: effectiveRole,
    title: effectiveRole === 'admin' ? user.title : 'Técnico en Farmacia',
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        alertCount={alerts.length}
        queueCount={activeQueueCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={displayUser}
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickAction={() => setActiveSection(activeSection === 'pos' ? 'alerts' : 'pos')}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {workspaceError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {workspaceError}
            </div>
          )}

          {activeSection === 'overview' && (
            <OverviewView
              summary={dashboard}
              loading={loadingData && products.length === 0}
              onNavigate={setActiveSection}
              onSelectSale={setSelectedReceipt}
            />
          )}

          {activeSection === 'pos' && (
            <PosView
              pharmacyId={pharmacyId}
              user={displayUser}
              products={products}
              customers={customers}
              activeTicket={activeTicket}
              onClearActiveTicket={() => setActiveTicket(null)}
              onSaleCompleted={(sale) => setSelectedReceipt(sale)}
            />
          )}

          {activeSection === 'queue' && (
            <QueueAndClientsView
              pharmacyId={pharmacyId}
              user={displayUser}
              queue={queue}
              customers={customers}
              onAttendInPos={handleAttendInPos}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView
              pharmacyId={pharmacyId}
              user={displayUser}
              products={products}
              userRole={effectiveRole}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsView
              pharmacyId={pharmacyId}
              user={displayUser}
              products={products}
              alerts={alerts}
              restockOrders={restockOrders}
            />
          )}

          {activeSection === 'sales' && (
            <SalesView
              pharmacyId={pharmacyId}
              user={displayUser}
              sales={sales}
              userRole={effectiveRole}
              onSelectSale={setSelectedReceipt}
            />
          )}

          {activeSection === 'security' && (
            <SecurityAuditView
              user={displayUser}
              effectiveRole={effectiveRole}
              onChangePreviewRole={setEffectiveRole}
              auditLogs={auditLogs}
              onSwitchUser={handleLogout}
            />
          )}
        </main>
      </div>

      <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
}
