import {
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';

export type NavSection =
  | 'overview'
  | 'pos'
  | 'queue'
  | 'inventory'
  | 'alerts'
  | 'sales'
  | 'security';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  alertCount: number;
  queueCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Resumen Operativo', icon: LayoutDashboard },
  { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
  { id: 'queue', label: 'Atención en Cola', icon: Users },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'alerts', label: 'Alertas Reposición', icon: AlertTriangle },
  { id: 'sales', label: 'Registro de Ventas', icon: ClipboardList },
  { id: 'security', label: 'Seguridad y Auditoría', icon: ShieldCheck },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  alertCount,
  queueCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5V3z" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Nova Salud
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          const badgeValue =
            item.id === 'alerts' && alertCount > 0
              ? alertCount
              : item.id === 'queue' && queueCount > 0
                ? queueCount
                : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {badgeValue !== null && (
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    item.id === 'alerts' ? 'text-red-600' : 'text-teal-700'
                  }`}
                >
                  {badgeValue}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs font-medium text-slate-900">Sucursal Comercial Central</p>
        <p className="mt-0.5 text-xs text-slate-500">Botica Nova Salud S.A.C.</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={onCloseMobile} />
          <aside className="relative z-50 w-64 max-w-[80vw]">{navContent}</aside>
        </div>
      )}
    </>
  );
}
