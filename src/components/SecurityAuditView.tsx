import { useMemo, useState } from 'react';
import { Download, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { getStaffAvatar } from '../lib/avatars';
import { downloadCsv, formatDateTime } from '../lib/format';
import type { AuditLog, UserProfile } from '../shared/types';

interface SecurityAuditViewProps {
  user: UserProfile;
  auditLogs: AuditLog[];
  onSwitchUser: () => void;
}

export function SecurityAuditView({ user, auditLogs, onSwitchUser }: SecurityAuditViewProps) {
  const [filterAction, setFilterAction] = useState<'all' | 'sales' | 'inventory' | 'auth'>('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filterAction === 'sales') return log.action.startsWith('SALE');
      if (filterAction === 'inventory') {
        return (
          log.action.startsWith('PRODUCT') ||
          log.action.startsWith('STOCK') ||
          log.action.startsWith('RESTOCK')
        );
      }
      if (filterAction === 'auth') return log.action.startsWith('AUTH');
      return true;
    });
  }, [auditLogs, filterAction]);

  function handleExportAudit() {
    downloadCsv(
      'novasalud-auditoria.csv',
      ['Fecha y Hora', 'Usuario', 'Rol', 'Evento', 'Detalle'],
      filteredLogs.map((l) => [
        formatDateTime(l.timestamp),
        l.userName,
        l.userRole === 'admin' ? 'Química Farmacéutica' : 'Técnico en Farmacia',
        l.action,
        l.detail,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900">Sesión Activa y Seguridad</h2>
            </div>
            <button
              type="button"
              onClick={onSwitchUser}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Cambiar Operador
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <img
              src={getStaffAvatar(user.role)}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full object-cover border border-slate-200"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-600">
                {user.title} · <span className="font-mono">{user.cmpOrCode}</span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Cifrado de contraseñas</span>
              <span className="font-mono font-medium text-slate-900">scrypt + salt único</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Integridad de sesión</span>
              <span className="font-mono font-medium text-slate-900">Token HMAC-SHA256</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Control de acceso</span>
              <span className="font-medium text-teal-700">
                {user.role === 'admin' ? 'Acceso Total (Admin)' : 'Operador de Mostrador'}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Lock className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">Matriz de Permisos por Rol (RBAC)</h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 font-medium">Operación del Sistema</th>
                  <th className="py-2 font-medium text-center">Química Farmacéutica</th>
                  <th className="py-2 font-medium text-center">Técnico en Farmacia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 text-slate-900">Punto de venta, cola y registro de clientes</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-900">Ajustes de inventario y órdenes de reposición</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-900">Crear o editar fichas de medicamentos</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                  <td className="py-2.5 text-center font-medium text-slate-400">Restringido</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-900">Anular comprobantes emitidos y restituir stock</td>
                  <td className="py-2.5 text-center font-medium text-emerald-700">Permitido</td>
                  <td className="py-2.5 text-center font-medium text-slate-400">Restringido</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Bitácora de Auditoría de Datos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Registro inmutable de movimientos de stock, ventas, ingresos y accesos
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['all', 'Todos'],
                  ['sales', 'Ventas'],
                  ['inventory', 'Inventario'],
                  ['auth', 'Accesos'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterAction(key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filterAction === key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportAudit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-6 py-3 font-medium">Fecha y Hora</th>
                <th className="px-4 py-3 font-medium">Operador</th>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-6 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-slate-900">{log.userName}</span>
                    <span className="text-slate-400"> · </span>
                    <span className="text-slate-500">
                      {log.userRole === 'admin' ? 'Admin' : 'Vendedor'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] font-medium text-teal-700 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-6 py-3 text-slate-700">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
