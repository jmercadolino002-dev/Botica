import { LogOut, Menu, Plus } from 'lucide-react';
import { getStaffAvatar } from '../lib/avatars';
import type { UserProfile } from '../shared/types';
import type { NavSection } from './Sidebar';

interface TopBarProps {
  user: UserProfile;
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onQuickAction: () => void;
  onLogout: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Resumen Operativo',
  pos: 'Punto de Venta Rápido',
  queue: 'Atención en Cola y Clientes',
  inventory: 'Inventario Centralizado',
  alerts: 'Alertas de Reposición',
  sales: 'Registro de Ventas',
  security: 'Seguridad y Auditoría',
};

export function TopBar({
  user,
  activeSection,
  onOpenMobileMenu,
  onQuickAction,
  onLogout,
}: TopBarProps) {
  const primaryLabel = activeSection === 'pos' ? 'Ver Alertas' : 'Nueva Venta';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-400 whitespace-nowrap">Botica Nova Salud</span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
          <h1 className="font-semibold text-slate-900 truncate">{SECTION_TITLES[activeSection]}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden md:flex items-center gap-2.5 pr-2 border-r border-slate-200">
          <img
            src={getStaffAvatar(user.role)}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover border border-slate-200 bg-slate-100"
          />
          <div className="text-left leading-tight">
            <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">{user.name}</p>
            <p className="text-[11px] text-slate-500 whitespace-nowrap">{user.title}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Cambiar operador o cerrar sesión"
            className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onQuickAction}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
        >
          {activeSection !== 'pos' && <Plus className="h-3.5 w-3.5" />}
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}
