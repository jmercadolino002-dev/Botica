import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, Search, ShoppingBag, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/format';
import type {
  Customer,
  PaymentMethod,
  Product,
  ProductCategory,
  QueueTicket,
  ReceiptType,
  Sale,
} from '../shared/types';

interface PosViewProps {
  products: Product[];
  customers: Customer[];
  activeTicket: QueueTicket | null;
  onClearActiveTicket: () => void;
  onSaleCompleted: (sale: Sale) => void;
  onCustomerCreated: (customer: Customer) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const CATEGORIES: ('Todos' | ProductCategory)[] = [
  'Todos',
  'Analgésicos',
  'Antibióticos',
  'Respiratorio',
  'Vitaminas',
  'Digestivo',
  'Dermocosmética',
  'Primeros Auxilios',
];

export function PosView({
  products,
  customers,
  activeTicket,
  onClearActiveTicket,
  onSaleCompleted,
  onCustomerCreated,
}: PosViewProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Todos' | ProductCategory>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [walkInName, setWalkInName] = useState('Cliente General');
  const [walkInDoc, setWalkInDoc] = useState('00000000');
  const [receiptType, setReceiptType] = useState<ReceiptType>('Boleta');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [prescriptionVerified, setPrescriptionVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick customer registration inline modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustDoc, setNewCustDoc] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAllergy, setNewCustAllergy] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTicket) {
      if (activeTicket.customerId) {
        setSelectedCustomerId(activeTicket.customerId);
      } else {
        setSelectedCustomerId('');
        setWalkInName(activeTicket.customerName);
        setWalkInDoc(activeTicket.documentNumber);
      }
    }
  }, [activeTicket]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'Todos' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.activeIngredient.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    });
  }, [products, query, category]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  function addToCart(product: Product) {
    setError(null);
    if (product.stock <= 0) {
      setError(`${product.name} está agotado. Genera una reposición desde Alertas.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock máximo disponible alcanzado para ${product.name} (${product.stock} u.).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setError(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const next = item.quantity + delta;
          if (next <= 0) return null;
          if (next > item.product.stock) {
            setError(`Solo quedan ${item.product.stock} unidades de ${item.product.name}.`);
            return item;
          }
          return { ...item, quantity: next };
        })
        .filter((x): x is CartItem => x !== null),
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  const grossTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0),
    [cart],
  );
  const numericDiscount = Math.max(0, Math.min(grossTotal, Number(discount) || 0));
  const total = Math.max(0, Math.round((grossTotal - numericDiscount) * 100) / 100);
  const subtotal = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - subtotal) * 100) / 100;
  const requiresRx = cart.some((item) => item.product.requiresPrescription);
  const parsedTendered = Number(amountTendered) || 0;
  const changeDue = paymentMethod === 'Efectivo' && parsedTendered > total ? parsedTendered - total : 0;

  async function handleCheckout() {
    setError(null);
    if (cart.length === 0) {
      setError('Agrega al menos un medicamento al comprobante.');
      return;
    }
    if (requiresRx && !prescriptionVerified) {
      setError('Verifica y marca la confirmación de receta médica antes de emitir la venta.');
      return;
    }
    if (paymentMethod === 'Efectivo' && amountTendered !== '' && parsedTendered < total) {
      setError('El monto recibido en efectivo es menor al total a pagar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createSale({
        receiptType,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName: selectedCustomer ? selectedCustomer.fullName : walkInName,
        customerDocument: selectedCustomer ? selectedCustomer.documentNumber : walkInDoc,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        discount: numericDiscount,
        paymentMethod,
        amountTendered:
          paymentMethod === 'Efectivo'
            ? amountTendered === ''
              ? total
              : parsedTendered
            : total,
        prescriptionVerified,
        queueTicketId: activeTicket?.id || null,
      });

      setCart([]);
      setDiscount('0');
      setAmountTendered('');
      setPrescriptionVerified(false);
      onClearActiveTicket();
      onSaleCompleted(res.sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickCreateCustomer() {
    if (!newCustName.trim() || !newCustDoc.trim()) return;
    try {
      const res = await api.createCustomer({
        documentType: newCustDoc.trim().length === 11 ? 'RUC' : 'DNI',
        documentNumber: newCustDoc.trim(),
        fullName: newCustName.trim(),
        phone: newCustPhone.trim(),
        allergies: newCustAllergy.trim() || 'Ninguna conocida',
      });
      onCustomerCreated(res.customer);
      setSelectedCustomerId(res.customer.id);
      setShowNewCustomer(false);
      setNewCustName('');
      setNewCustDoc('');
      setNewCustPhone('');
      setNewCustAllergy('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar al cliente.');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Catálogo rápido */}
      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    const firstAvailable = filteredProducts.find((p) => p.stock > 0);
                    if (firstAvailable) {
                      addToCart(firstAvailable);
                      setQuery('');
                    }
                  }
                }}
                placeholder="Buscar por nombre, principio activo, SKU o código de barras (presiona /)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  category === cat
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
            <span className="text-xs font-semibold text-slate-700">
              Catálogo disponible ({filteredProducts.length} productos)
            </span>
            <span className="text-[11px] text-slate-500">
              Enter agrega el primer resultado disponible
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-slate-900">Sin coincidencias en el catálogo</p>
              <p className="mt-1 text-xs text-slate-500">
                Prueba buscando por principio activo o cambia el filtro de categoría.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const outOfStock = product.stock <= 0;
                const lowStock = product.stock > 0 && product.stock <= product.minStock;
                const inCartQty = cart.find((c) => c.product.id === product.id)?.quantity || 0;

                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
                        {product.requiresPrescription && (
                          <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap shrink-0">
                            Req. Receta
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        <span>{product.activeIngredient}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{product.presentation}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{product.location}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatCurrency(product.salePrice)}
                        </p>
                        <p
                          className={`font-mono text-[11px] font-medium tabular-nums ${
                            outOfStock
                              ? 'text-red-600'
                              : lowStock
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                          }`}
                        >
                          {outOfStock ? 'Agotado' : `${product.stock} u. disp.`}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock || inCartQty >= product.stock}
                        onClick={() => addToCart(product)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {inCartQty > 0 ? `Agregar (${inCartQty})` : 'Agregar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel de cobro y atención */}
      <aside className="lg:col-span-5 xl:col-span-4">
        <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900">Ticket de Despacho</h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {cart.reduce((s, i) => s + i.quantity, 0)} ítems
            </span>
          </div>

          {activeTicket && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-teal-900 truncate">
                  Turno {activeTicket.ticketCode} · {activeTicket.customerName}
                </p>
                <p className="text-[11px] text-teal-700">{activeTicket.serviceType}</p>
              </div>
              <button
                type="button"
                onClick={onClearActiveTicket}
                className="rounded p-1 text-teal-700 hover:bg-teal-100"
                aria-label="Desvincular turno"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="pos-customer" className="text-xs font-medium text-slate-700">
                Cliente
              </label>
              <button
                type="button"
                onClick={() => setShowNewCustomer((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {showNewCustomer ? 'Cancelar' : 'Nuevo cliente'}
              </button>
            </div>

            {showNewCustomer ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Nombre completo o Razón Social"
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCustDoc}
                    onChange={(e) => setNewCustDoc(e.target.value)}
                    placeholder="DNI / RUC"
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <input
                  type="text"
                  value={newCustAllergy}
                  onChange={(e) => setNewCustAllergy(e.target.value)}
                  placeholder="Alergias conocidas (opcional)"
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleQuickCreateCustomer}
                  className="w-full rounded-md bg-teal-600 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  Guardar y seleccionar
                </button>
              </div>
            ) : (
              <>
                <select
                  id="pos-customer"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCustomerId(id);
                    const found = customers.find((c) => c.id === id);
                    if (found && found.documentType === 'RUC') {
                      setReceiptType('Factura');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  <option value="">Cliente General (Venta rápida sin ficha)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} · {c.documentType} {c.documentNumber}
                    </option>
                  ))}
                </select>
                {selectedCustomer && selectedCustomer.allergies && selectedCustomer.allergies !== 'Ninguna conocida' && selectedCustomer.allergies !== 'No aplica' && (
                  <p className="text-[11px] font-medium text-amber-700">
                    Alerta clínica: Alergia registrada a {selectedCustomer.allergies}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Carrito */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border-y border-slate-200 py-1">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Selecciona medicamentos del catálogo para iniciar la venta
              </p>
            ) : (
              cart.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{product.name}</p>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {formatCurrency(product.salePrice)} c/u
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(product.id, -1)}
                      className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(product.id, 1)}
                      className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(product.id)}
                      className="ml-1 rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label="Eliminar ítem"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {requiresRx && (
            <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={prescriptionVerified}
                onChange={(e) => setPrescriptionVerified(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 text-teal-600 focus:ring-teal-600"
              />
              <span>
                Confirmo verificación de <strong>receta médica vigente</strong> para medicamentos controlados o antibióticos.
              </span>
            </label>
          )}

          {/* Tipo de comprobante y pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-500">Comprobante</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {(['Boleta', 'Factura'] as ReceiptType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReceiptType(type)}
                    className={`rounded-md py-1 text-xs font-medium transition-colors ${
                      receiptType === type
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="pos-discount" className="block text-[11px] font-medium text-slate-500">
                Descuento (S/)
              </label>
              <input
                id="pos-discount"
                type="number"
                min="0"
                step="0.5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono tabular-nums focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-slate-500">Medio de pago</span>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(['Efectivo', 'Tarjeta', 'Yape / Plin'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    paymentMethod === method
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'Efectivo' && (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="pos-tendered" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Efectivo recibido:
              </label>
              <input
                id="pos-tendered"
                type="number"
                min="0"
                step="0.1"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-right font-mono text-xs tabular-nums focus:border-teal-600 focus:outline-none"
              />
            </div>
          )}

          {/* Totales */}
          <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Op. Gravada</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>IGV (18%)</span>
              <span className="font-mono tabular-nums">{formatCurrency(igv)}</span>
            </div>
            {changeDue > 0 && (
              <div className="flex justify-between font-medium text-teal-700">
                <span>Vuelto a entregar</span>
                <span className="font-mono tabular-nums">{formatCurrency(changeDue)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || cart.length === 0}
            onClick={handleCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            <Check className="h-4 w-4" />
            {submitting ? 'Procesando comprobante...' : 'Cobrar y Emitir Comprobante'}
          </button>
        </div>
      </aside>
    </div>
  );
}
