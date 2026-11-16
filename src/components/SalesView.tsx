import { useMemo, useState } from 'react';
import { Ban, Download, FileText, Search } from 'lucide-react';
import { api } from '../lib/api';
import { downloadCsv, formatCurrency, formatDateTime } from '../lib/format';
import type { PaymentMethod, Sale, UserRole } from '../shared/types';

interface SalesViewProps {
  sales: Sale[];
  userRole: UserRole;
  onSelectSale: (sale: Sale) => void;
  onRefresh: () => Promise<void>;
}

export function SalesView({ sales, userRole, onSelectSale, onRefresh }: SalesViewProps) {
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) return false;
      if (!q) return true;
      return (
        s.receiptNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.customerDocument.includes(q) ||
        s.sellerName.toLowerCase().includes(q)
      );
    });
  }, [sales, query, paymentFilter]);

  const completedTotal = filtered
    .filter((s) => s.status === 'Completada')
    .reduce((sum, s) => sum + s.total, 0);

  async function handleVoidSale() {
    if (!voidTarget) return;
    setError(null);
    try {
      await api.voidSale(voidTarget.id, voidReason || 'Anulación autorizada');
      setVoidTarget(null);
      setVoidReason('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular el comprobante.');
    }
  }

  function handleExportCsv() {
    downloadCsv(
      'novasalud-registro-ventas.csv',
      ['Comprobante', 'Tipo', 'Fecha', 'Cliente', 'Documento', 'Operador', 'Medio de Pago', 'Subtotal', 'IGV', 'Total', 'Estado'],
      filtered.map((s) => [
        s.receiptNumber,
        s.receiptType,
        formatDateTime(s.createdAt),
        s.customerName,
        s.customerDocument,
        s.sellerName,
        s.paymentMethod,
        s.subtotal.toFixed(2),
        s.igv.toFixed(2),
        s.total.toFixed(2),
        s.status,
      ]),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por comprobante, cliente, DNI/RUC o vendedor"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'Efectivo', 'Tarjeta', 'Yape / Plin'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentFilter(method)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  paymentFilter === method
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {method === 'all' ? 'Todos' : method}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Total recaudado (válido)</p>
            <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {formatCurrency(completedTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-6 py-3 font-medium">Comprobante</th>
                <th className="px-4 py-3 font-medium">Fecha y Hora</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Operador</th>
                <th className="px-4 py-3 font-medium">Ítems</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {sale.receiptNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                    {formatDateTime(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{sale.customerName}</p>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {sale.customerDocument}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{sale.sellerName}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                    {sale.items.reduce((s, i) => s + i.quantity, 0)} u.
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{sale.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(sale.total)}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold whitespace-nowrap ${
                      sale.status === 'Completada' ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {sale.status}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectSale(sale)}
                        className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver
                      </button>
                      {userRole === 'admin' && sale.status === 'Completada' && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setVoidTarget(sale);
                            setVoidReason('');
                          }}
                          className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-700"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Anular Comprobante {voidTarget.receiptNumber}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Esta acción anulará la venta por {formatCurrency(voidTarget.total)} y restituirá automáticamente las unidades al inventario.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700">Motivo de anulación</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ej. Error en digitación de comprobante"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidSale}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
