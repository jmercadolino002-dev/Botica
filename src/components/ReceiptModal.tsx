import { Printer, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../lib/format';
import type { Sale } from '../shared/types';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-900">
            Comprobante Electrónico · {sale.receiptNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Cerrar comprobante"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div id="printable-receipt" className="p-6 text-slate-900">
          <div className="border-b border-dashed border-slate-300 pb-4 text-center">
            <p className="text-base font-bold tracking-tight text-slate-900">BOTICA NOVA SALUD S.A.C.</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">RUC 20609418275</p>
            <p className="mt-0.5 text-xs text-slate-500">Av. Comercial Central 482 · Zona Comercial</p>
            <p className="mt-2 font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {sale.receiptType.toUpperCase()} DE VENTA · {sale.receiptNumber}
            </p>
          </div>

          <div className="mt-4 space-y-1 border-b border-dashed border-slate-300 pb-4 text-xs text-slate-600">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Fecha y hora:</span>
              <span className="font-mono text-slate-900 tabular-nums">{formatDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-medium text-slate-900 text-right">{sale.customerName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Documento:</span>
              <span className="font-mono text-slate-900 tabular-nums">{sale.customerDocument}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Atendido por:</span>
              <span className="text-slate-900">{sale.sellerName}</span>
            </div>
            {sale.prescriptionVerified && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Control sanitario:</span>
                <span className="font-medium text-teal-700">Receta médica verificada</span>
              </div>
            )}
          </div>

          <div className="mt-4 border-b border-dashed border-slate-300 pb-4">
            <div className="mb-2 flex justify-between text-[11px] font-medium text-slate-500">
              <span>Producto / Cant.</span>
              <span>Importe</span>
            </div>
            <div className="space-y-2.5">
              {sale.items.map((item) => (
                <div key={item.productId} className="flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {item.quantity} x {formatCurrency(item.unitPrice)} · {item.sku}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono font-medium text-slate-900 tabular-nums">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Op. Gravada (Subtotal)</span>
              <span className="font-mono tabular-nums">{formatCurrency(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IGV (18%)</span>
              <span className="font-mono tabular-nums">{formatCurrency(sale.igv)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-teal-700">
                <span>Descuento aplicado</span>
                <span className="font-mono tabular-nums">- {formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Total a Pagar</span>
              <span className="font-mono tabular-nums">{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between pt-1 text-slate-500">
              <span>Medio de pago: {sale.paymentMethod}</span>
              <span className="font-mono tabular-nums">
                Pagado: {formatCurrency(sale.amountTendered)}
                {sale.changeDue > 0 ? ` · Vuelto: ${formatCurrency(sale.changeDue)}` : ''}
              </span>
            </div>
            {sale.status === 'Anulada' && (
              <p className="pt-2 text-center font-semibold text-red-600">
                COMPROBANTE ANULADO · {sale.voidReason}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir Comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
