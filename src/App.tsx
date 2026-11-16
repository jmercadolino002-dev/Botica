import { useCallback, useEffect, useState } from 'react';
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
import { api, getStoredToken, wasExplicitlyLoggedOut } from './lib/api';
import type {
  AuditLog,
  Customer,
  DashboardSummary,
  InventoryAlert,
  Product,
  QueueTicket,
  RestockOrder,
  Sale,
  UserProfile,
} from './shared/types';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashRes, prodRes, custRes, queueRes, salesRes, alertsRes, auditRes] =
        await Promise.all([
          api.getDashboard(),
          api.getProducts(),
          api.getCustomers(),
          api.getQueue(),
          api.getSales(),
          api.getAlerts(),
          api.getAuditLogs(),
        ]);

      setDashboard(dashRes);
      setProducts(prodRes.products);
      setCustomers(custRes.customers);
      setQueue(queueRes.queue);
      setSales(salesRes.sales);
      setAlerts(alertsRes.alerts);
      setRestockOrders(alertsRes.restockOrders);
      setAuditLogs(auditRes.auditLogs);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrapAuth() {
      try {
        if (getStoredToken()) {
          const me = await api.me();
          if (!cancelled) setUser(me.user);
          return;
        }
        if (!wasExplicitlyLoggedOut()) {
          const demo = await api.demoInit('admin');
          if (!cancelled) setUser(demo.user);
        }
      } catch {
        if (!wasExplicitlyLoggedOut()) {
          try {
            const demo = await api.demoInit('admin');
            if (!cancelled) setUser(demo.user);
          } catch {
            // Fall through to LoginScreen
          }
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }
    bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      refreshWorkspace();
    }
  }, [user, refreshWorkspace]);

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setActiveTicket(null);
  }

  function handleAttendInPos(ticket: QueueTicket) {
    setActiveTicket(ticket);
    setActiveSection('pos');
  }

  async function handleSaleCompleted(sale: Sale) {
    setSelectedReceipt(sale);
    await refreshWorkspace();
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-600">Iniciando sistema Nova Salud...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onAuthenticated={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  const activeQueueCount = queue.filter((q) => q.status !== 'Atendido').length;

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
          user={user}
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickAction={() => setActiveSection(activeSection === 'pos' ? 'alerts' : 'pos')}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewView
              summary={dashboard}
              loading={loadingData && !dashboard}
              onNavigate={setActiveSection}
              onSelectSale={setSelectedReceipt}
            />
          )}

          {activeSection === 'pos' && (
            <PosView
              products={products}
              customers={customers}
              activeTicket={activeTicket}
              onClearActiveTicket={() => setActiveTicket(null)}
              onSaleCompleted={handleSaleCompleted}
              onCustomerCreated={(customer) => setCustomers((prev) => [customer, ...prev])}
            />
          )}

          {activeSection === 'queue' && (
            <QueueAndClientsView
              queue={queue}
              customers={customers}
              onRefresh={refreshWorkspace}
              onAttendInPos={handleAttendInPos}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView
              products={products}
              userRole={user.role}
              onRefresh={refreshWorkspace}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsView
              alerts={alerts}
              restockOrders={restockOrders}
              onRefresh={refreshWorkspace}
            />
          )}

          {activeSection === 'sales' && (
            <SalesView
              sales={sales}
              userRole={user.role}
              onSelectSale={setSelectedReceipt}
              onRefresh={refreshWorkspace}
            />
          )}

          {activeSection === 'security' && (
            <SecurityAuditView
              user={user}
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
