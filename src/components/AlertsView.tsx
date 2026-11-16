import { useState, type FormEvent } from 'react';
import { CheckCircle2, PackagePlus, Truck } from 'lucide-react';
import { formatCurrency, formatDateShort, formatDateTime } from '../lib/format';
import { pharmacyService } from '../lib/pharmacyService';
import type { InventoryAlert, Product, RestockOrder, UserProfile } from '../shared/types';

interface AlertsViewProps {
  pharmacyId: string;
  user: UserProfile;
  products: Product[];
  alerts: InventoryAlert[];
  restockOrders: RestockOrder[];
}

const SUPPLIERS = [
  'Droguería Química Suiza S.A.',
  'Perufarma Distribuciones S.A.',
  'Alfaro Salud S.A.C.',
];

export function AlertsView({
  pharmacyId,
  user,
  products,
  alerts,
  restockOrders,
}: AlertsViewProps) {
  const [selectedIds, setSelectedIds] = useState<Record<string, number>>({});
  const [supplier, setSupplier] = useState(SUPPLIERS[0]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [receiveTarget, setReceiveTarget] = useState<RestockOrder | null>(null);
  const [batchNumber, setBatchNumber] = useState('LOT-26R91');
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 540 * 86400_000).toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);

  const stockAlerts = alerts.filter((a) => a.severity === 'Agotado' || a.severity === 'Stock Bajo');
  const expiryAlerts = alerts.filter((a) => a.severity === 'Por Vencer');
  const pendingOrders = restockOrders.filter((o) => o.status === 'Pendiente');

  function toggleAlertItem(alert: InventoryAlert) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (next[alert.productId] !== undefined) {
        delete next[alert.productId];
      } else {
        next[alert.productId] = alert.suggestedQty || 20;
      }
      return next;
    });
  }

  function selectAllLowStock() {
    const next: Record<string, number> = {};
    for (const a of stockAlerts) {
      next[a.productId] = a.suggestedQty || 20;
    }
    setSelectedIds(next);
  }

  async function handleCreateRestockOrder(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const items = Object.entries(selectedIds).map(([productId, requestedQty]) => ({
      productId,
      requestedQty,
    }));
    if (items.length === 0) {
      setError('Selecciona al menos un producto con bajo stock para generar la orden.');
      return;
    }

    setSubmittingOrder(true);
    try {
      await pharmacyService.createRestockOrder(pharmacyId, user, supplier, items, products);
      setSelectedIds({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la orden de reposición.');
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handleConfirmReceive(e: FormEvent) {
    e.preventDefault();
    if (!receiveTarget) return;
    setError(null);
    try {
      await pharmacyService.receiveRestockOrder(
        pharmacyId,
        user,
        receiveTarget.id,
        batchNumber,
        expiryDate,
      );
      setReceiveTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar recepción.');
    }
  }

  const selectedList = Object.entries(selectedIds);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Productos agotados</p>
          <p className="mt-2 font-mono text-2xl font-bold text-red-600 tabular-nums">
            {alerts.filter((a) => a.severity === 'Agotado').length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Stock igual a 0 unidades</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Stock bajo mínimo</p>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-600 tabular-nums">
            {alerts.filter((a) => a.severity === 'Stock Bajo').length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Requieren reposición pronta</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Próximos a vencer</p>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {expiryAlerts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Vencimiento dentro de 60 días</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Órdenes en tránsito</p>
          <p className="mt-2 font-mono text-2xl font-bold text-teal-700 tabular-nums">
            {pendingOrders.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Pendientes de ingreso a almacén</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Alertas Automáticas de Reposición y Vencimiento
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Selecciona los productos para armar una orden de compra directa al proveedor
              </p>
            </div>
            {stockAlerts.length > 0 && (
              <button
                type="button"
                onClick={selectAllLowStock}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Seleccionar todos ({stockAlerts.length})
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-900">Sin alertas activas</p>
              <p className="mt-1 text-xs text-slate-500">
                Todos los medicamentos están por encima del umbral mínimo y con vigencia segura.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-5 py-3 font-medium">Reponer</th>
                    <th className="px-4 py-3 font-medium">Medicamento</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Stock / Mín.</th>
                    <th className="px-4 py-3 font-medium text-right">Cant. Sugerida</th>
                    <th className="px-5 py-3 font-medium text-right">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.map((alert) => {
                    const checked = selectedIds[alert.productId] !== undefined;
                    const severityColor =
                      alert.severity === 'Agotado'
                        ? 'text-red-600'
                        : alert.severity === 'Stock Bajo'
                          ? 'text-amber-600'
                          : 'text-amber-700';

                    return (
                      <tr key={alert.productId} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          {alert.severity !== 'Por Vencer' ? (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAlertItem(alert)}
                              aria-label={`Seleccionar ${alert.name}`}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{alert.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {alert.sku} · {alert.location}
                          </p>
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${severityColor}`}>
                          {alert.severity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-bold text-slate-900">{alert.stock}</span>
                          <span className="text-slate-400"> / {alert.minStock} u.</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {checked ? (
                            <input
                              type="number"
                              min="1"
                              value={selectedIds[alert.productId]}
                              onChange={(e) =>
                                setSelectedIds((prev) => ({
                                  ...prev,
                                  [alert.productId]: Math.max(1, Number(e.target.value)),
                                }))
                              }
                              className="w-16 rounded border border-teal-500 px-2 py-1 text-right font-mono text-xs"
                            />
                          ) : alert.suggestedQty > 0 ? (
                            <span className="text-slate-700">+{alert.suggestedQty} u.</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateShort(alert.expiryDate)} ({alert.daysToExpiry}d)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">Nueva Orden de Reposición</h2>
          </div>

          <form onSubmit={handleCreateRestockOrder} className="mt-4 space-y-4">
            <div>
              <label htmlFor="restock-supplier" className="block text-xs font-medium text-slate-700">
                Droguería / Proveedor
              </label>
              <select
                id="restock-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-teal-600 focus:outline-none"
              >
                {SUPPLIERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Productos seleccionados:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {selectedList.length}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between text-slate-600">
                <span>Unidades totales a pedir:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {selectedList.reduce((s, [, qty]) => s + qty, 0)} u.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingOrder || selectedList.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              <PackagePlus className="h-4 w-4" />
              {submittingOrder ? 'Generando orden...' : 'Emitir Orden de Reposición'}
            </button>
          </form>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Órdenes de Reposición a Droguería</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Confirma el ingreso de mercadería recibida para actualizar automáticamente el stock y lote
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-6 py-3 font-medium">Orden</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium">Emitida</th>
                <th className="px-4 py-3 font-medium text-right">Costo Est.</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {restockOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {order.orderCode}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{order.supplier}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.items.map((i) => `${i.productName} (+${i.requestedQty})`).join(', ')}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(order.totalEstimatedCost)}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold whitespace-nowrap ${
                      order.status === 'Recibida' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {order.status}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {order.status === 'Pendiente' ? (
                      <button
                        type="button"
                        onClick={() => setReceiveTarget(order)}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        Confirmar Ingreso
                      </button>
                    ) : (
                      <span className="text-slate-400">Ingresada por {order.receivedBy}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {receiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Confirmar Ingreso · {receiveTarget.orderCode}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Al confirmar, se sumarán automáticamente las unidades al inventario central.
            </p>
            <form onSubmit={handleConfirmReceive} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Lote de ingreso</label>
                <input
                  required
                  minLength={2}
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Nueva fecha de vencimiento</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReceiveTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  Ingresar a Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
