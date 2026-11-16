import { useMemo, useState, type FormEvent } from 'react';
import { Download, Edit3, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import { daysUntil, downloadCsv, formatCurrency, formatDateShort } from '../lib/format';
import type { Product, ProductCategory, UserRole } from '../shared/types';

interface InventoryViewProps {
  products: Product[];
  userRole: UserRole;
  onRefresh: () => Promise<void>;
}

type StockFilter = 'all' | 'optimal' | 'low' | 'out' | 'expiring';

const CATEGORIES: ProductCategory[] = [
  'Analgésicos',
  'Antibióticos',
  'Respiratorio',
  'Vitaminas',
  'Digestivo',
  'Dermocosmética',
  'Primeros Auxilios',
];

export function InventoryView({ products, userRole, onRefresh }: InventoryViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('10');
  const [adjustMode, setAdjustMode] = useState<'add' | 'sub'>('add');
  const [adjustReason, setAdjustReason] = useState('');

  const [editTarget, setEditTarget] = useState<Partial<Product> | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const days = daysUntil(p.expiryDate);
      if (filter === 'out' && p.stock > 0) return false;
      if (filter === 'low' && (p.stock <= 0 || p.stock > p.minStock)) return false;
      if (filter === 'optimal' && p.stock <= p.minStock) return false;
      if (filter === 'expiring' && days > 60) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.activeIngredient.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    });
  }, [products, query, filter]);

  function openNewModal() {
    setError(null);
    setIsNewProduct(true);
    setEditTarget({
      sku: `MED-${String(products.length + 1).padStart(3, '0')}`,
      name: '',
      activeIngredient: '',
      laboratory: '',
      category: 'Analgésicos',
      presentation: 'Caja x 10 tabletas',
      batchNumber: 'LOT-26N01',
      expiryDate: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
      stock: 20,
      minStock: 10,
      optimalStock: 40,
      costPrice: 8,
      salePrice: 14,
      requiresPrescription: false,
      location: 'Estante A-04',
    });
  }

  function openEditModal(product: Product) {
    setError(null);
    setIsNewProduct(false);
    setEditTarget({ ...product });
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setError(null);
    setSaving(true);
    try {
      if (isNewProduct) {
        await api.createProduct(editTarget);
      } else if (editTarget.id) {
        await api.updateProduct(editTarget.id, editTarget);
      }
      setEditTarget(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar producto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustStock(e: FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    setError(null);
    const qty = Math.abs(Math.round(Number(adjustDelta)));
    if (!qty) return;
    const delta = adjustMode === 'add' ? qty : -qty;
    setSaving(true);
    try {
      await api.adjustStock(adjustTarget.id, delta, adjustReason);
      setAdjustTarget(null);
      setAdjustReason('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ajustar el stock.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      'novasalud-inventario.csv',
      ['SKU', 'Nombre', 'Principio Activo', 'Categoría', 'Ubicación', 'Lote', 'Vencimiento', 'Stock', 'Mínimo', 'Precio Venta'],
      filtered.map((p) => [
        p.sku,
        p.name,
        p.activeIngredient,
        p.category,
        p.location,
        p.batchNumber,
        p.expiryDate,
        p.stock,
        p.minStock,
        p.salePrice.toFixed(2),
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
              placeholder="Buscar medicamento, principio activo, SKU o lote"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
            {(
              [
                ['all', 'Todos'],
                ['optimal', 'Óptimo'],
                ['low', 'Stock Bajo'],
                ['out', 'Agotados'],
                ['expiring', 'Por Vencer'],
              ] as [StockFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {userRole !== 'admin' && (
        <p className="text-xs text-slate-500">
          Perfil Técnico en Farmacia: puedes consultar ubicaciones y registrar ajustes operativos de stock. La creación o edición de fichas maestras está reservada para la Química Farmacéutica.
        </p>
      )}

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
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Producto / Principio Activo</th>
                <th className="px-4 py-3 font-medium">Ubicación</th>
                <th className="px-4 py-3 font-medium">Lote y Vencimiento</th>
                <th className="px-4 py-3 font-medium text-right">Stock / Mín.</th>
                <th className="px-4 py-3 font-medium text-right">P. Venta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const days = daysUntil(p.expiryDate);
                const statusLabel =
                  p.stock <= 0
                    ? 'Agotado'
                    : p.stock <= p.minStock
                      ? 'Stock Bajo'
                      : days <= 60
                        ? 'Por Vencer'
                        : 'Disponible';

                const statusClass =
                  p.stock <= 0
                    ? 'text-red-600'
                    : p.stock <= p.minStock || days <= 60
                      ? 'text-amber-700'
                      : 'text-emerald-700';

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {p.activeIngredient} · {p.category}
                        {p.requiresPrescription ? ' · Req. Receta' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">{p.location}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      <span>{p.batchNumber}</span>
                      <span className="text-slate-400"> · </span>
                      <span className={days <= 60 ? 'font-semibold text-amber-700' : ''}>
                        {formatDateShort(p.expiryDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-bold text-slate-900">{p.stock}</span>
                      <span className="text-slate-400"> / {p.minStock}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(p.salePrice)}
                    </td>
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${statusClass}`}>
                      {statusLabel}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setAdjustTarget(p);
                            setAdjustMode('add');
                            setAdjustDelta('10');
                            setAdjustReason('');
                          }}
                          className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Ajustar
                        </button>
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajuste de Stock */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Ajuste de Stock · {adjustTarget.sku}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {adjustTarget.name} · Stock actual:{' '}
              <span className="font-mono font-semibold text-slate-900">{adjustTarget.stock} u.</span>
            </p>

            <form onSubmit={handleAdjustStock} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`rounded-md py-1.5 text-xs font-medium ${
                    adjustMode === 'add' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Entrada (+ Ingreso)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('sub')}
                  className={`rounded-md py-1.5 text-xs font-medium ${
                    adjustMode === 'sub' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Salida (- Merma/Venc.)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Cantidad de unidades</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Motivo obligatorio (registrado en auditoría)
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej. Reposición por factura F002-194 o conteo físico"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  {saving ? 'Guardando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Producto */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              {isNewProduct ? 'Registrar Nuevo Producto Farmacéutico' : `Editar Producto · ${editTarget.sku}`}
            </h3>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">SKU</label>
                  <input
                    required
                    disabled={!isNewProduct}
                    value={editTarget.sku || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, sku: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs disabled:bg-slate-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">Nombre comercial</label>
                  <input
                    required
                    value={editTarget.name || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Principio activo</label>
                  <input
                    required
                    value={editTarget.activeIngredient || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, activeIngredient: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Categoría</label>
                  <select
                    value={editTarget.category || 'Analgésicos'}
                    onChange={(e) =>
                      setEditTarget({ ...editTarget, category: e.target.value as ProductCategory })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Laboratorio</label>
                  <input
                    value={editTarget.laboratory || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, laboratory: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Presentación</label>
                  <input
                    value={editTarget.presentation || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, presentation: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Ubicación en anaquel</label>
                  <input
                    value={editTarget.location || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Stock actual</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editTarget.stock ?? 0}
                    onChange={(e) => setEditTarget({ ...editTarget, stock: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Stock mínimo</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editTarget.minStock ?? 10}
                    onChange={(e) => setEditTarget({ ...editTarget, minStock: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">P. Compra (S/)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={editTarget.costPrice ?? 5}
                    onChange={(e) => setEditTarget({ ...editTarget, costPrice: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">P. Venta (S/)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={editTarget.salePrice ?? 10}
                    onChange={(e) => setEditTarget({ ...editTarget, salePrice: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Lote</label>
                  <input
                    value={editTarget.batchNumber || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, batchNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={editTarget.expiryDate || ''}
                    onChange={(e) => setEditTarget({ ...editTarget, expiryDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editTarget.requiresPrescription)}
                  onChange={(e) =>
                    setEditTarget({ ...editTarget, requiresPrescription: e.target.checked })
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>Requiere presentación de receta médica en mostrador</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  {saving ? 'Guardando...' : 'Guardar Ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
