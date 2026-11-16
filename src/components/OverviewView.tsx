import { ArrowRight, FileText, PackageCheck } from 'lucide-react';
import { formatCurrency, formatTime } from '../lib/format';
import type { DashboardSummary, Sale } from '../shared/types';
import type { NavSection } from './Sidebar';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigate: (section: NavSection) => void;
  onSelectSale: (sale: Sale) => void;
}

export function OverviewView({
  summary,
  loading,
  onNavigate,
  onSelectSale,
}: OverviewViewProps) {
  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white p-5 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 rounded-xl border border-slate-200 bg-white lg:col-span-7 animate-pulse" />
          <div className="h-80 rounded-xl border border-slate-200 bg-white lg:col-span-5 animate-pulse" />
        </div>
      </div>
    );
  }

  const maxHourly = Math.max(...summary.hourlySales.map((h) => h.total), 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Ventas registradas hoy</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(summary.todayRevenue)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Ticket promedio: {formatCurrency(summary.averageTicket)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Comprobantes emitidos</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.todaySalesCount}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">Boletas y facturas electrónicas</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Alertas de reposición</p>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              summary.alertCounts.outOfStock > 0
                ? 'text-red-600'
                : summary.alertCounts.total > 0
                  ? 'text-amber-600'
                  : 'text-emerald-600'
            }`}
          >
            {summary.alertCounts.total}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {summary.alertCounts.outOfStock} agotados · {summary.alertCounts.lowStock} stock bajo ·{' '}
            {summary.alertCounts.expiringSoon} por vencer
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Espera promedio en cola</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.averageWaitMinutes} min
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {summary.activeQueueCount} clientes activos en mostrador
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Flujo de Ventas por Tramo Horario</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Facturación acumulada en tiempo real durante la jornada
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              Ver registro completo
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-6 flex h-44 items-end gap-3 px-1">
            {summary.hourlySales.map((bucket) => {
              const heightPct = Math.max(6, Math.round((bucket.total / maxHourly) * 100));
              return (
                <div key={bucket.hour} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {bucket.total > 0 ? formatCurrency(bucket.total) : '—'}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        bucket.total > 0 ? 'bg-teal-600' : 'bg-slate-100'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${bucket.hour}: ${formatCurrency(bucket.total)} (${bucket.count} ventas)`}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">{bucket.hour}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-700">Productos de mayor rotación</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {summary.topProducts.map((item) => (
                <div key={item.productId} className="flex items-center justify-between py-2 text-xs">
                  <span className="font-medium text-slate-900 truncate pr-4">{item.name}</span>
                  <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
                    <span className="text-slate-500">{item.unitsSold} u.</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Alertas Prioritarias de Reposición</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Productos por debajo del stock mínimo o próximos a vencer
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              Gestionar
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {summary.priorityAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PackageCheck className="h-8 w-8 text-emerald-600" />
              <p className="mt-3 text-sm font-medium text-slate-900">Inventario en niveles óptimos</p>
              <p className="mt-1 text-xs text-slate-500">
                No hay productos agotados ni próximos a vencer.
              </p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {summary.priorityAlerts.map((alert) => {
                const statusTextClass =
                  alert.severity === 'Agotado'
                    ? 'text-red-600'
                    : alert.severity === 'Stock Bajo'
                      ? 'text-amber-600'
                      : 'text-amber-700';

                return (
                  <div key={alert.productId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{alert.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                        <span className="font-mono">{alert.sku}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{alert.location}</span>
                        <span aria-hidden="true"> · </span>
                        <span className={`font-semibold ${statusTextClass}`}>{alert.severity}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                        {alert.stock} / {alert.minStock} u.
                      </p>
                      {alert.suggestedQty > 0 && (
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                          Reponer +{alert.suggestedQty}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Últimas Ventas Registradas</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Haz clic en un comprobante para visualizar o imprimir el detalle
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Ir a Punto de Venta
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-6 py-3 font-medium">Comprobante</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Operador</th>
                <th className="px-4 py-3 font-medium">Medio de Pago</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                    {sale.receiptNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 tabular-nums">
                    {formatTime(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{sale.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">{sale.sellerName}</td>
                  <td className="px-4 py-3 text-slate-600">{sale.paymentMethod}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {sale.status === 'Anulada' ? (
                      <span className="text-red-600">Anulada</span>
                    ) : (
                      formatCurrency(sale.total)
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectSale(sale)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
