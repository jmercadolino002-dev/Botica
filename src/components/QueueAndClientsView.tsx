import { useState, type FormEvent } from 'react';
import { ArrowRight, Clock, Plus, Search, UserPlus } from 'lucide-react';
import { formatCurrency, minutesSince } from '../lib/format';
import { pharmacyService } from '../lib/pharmacyService';
import type { Customer, QueueServiceType, QueueTicket, UserProfile } from '../shared/types';

interface QueueAndClientsViewProps {
  pharmacyId: string;
  user: UserProfile;
  queue: QueueTicket[];
  customers: Customer[];
  onAttendInPos: (ticket: QueueTicket) => void;
}

export function QueueAndClientsView({
  pharmacyId,
  user,
  queue,
  customers,
  onAttendInPos,
}: QueueAndClientsViewProps) {
  const [customerName, setCustomerName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [serviceType, setServiceType] = useState<QueueServiceType>('Atención Rápida');
  const [priority, setPriority] = useState<'Normal' | 'Preferencial'>('Normal');
  const [submittingTurn, setSubmittingTurn] = useState(false);

  const [clientQuery, setClientQuery] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClient, setNewClient] = useState({
    documentType: 'DNI' as 'DNI' | 'RUC' | 'CE',
    documentNumber: '',
    fullName: '',
    phone: '',
    email: '',
    allergies: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const activeQueue = queue.filter((q) => q.status !== 'Atendido');
  const completedToday = queue.filter((q) => q.status === 'Atendido');

  const filteredCustomers = customers.filter((c) => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.documentNumber.includes(q) ||
      c.phone.includes(q)
    );
  });

  async function handleCreateTurn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittingTurn(true);
    try {
      const matched = customers.find((c) => c.documentNumber === documentNumber.trim());
      await pharmacyService.createQueueTicket(pharmacyId, user, {
        customerId: matched?.id || null,
        customerName: matched ? matched.fullName : customerName,
        documentNumber: documentNumber || 'Sin documento',
        serviceType,
        priority,
      });
      setCustomerName('');
      setDocumentNumber('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el turno.');
    } finally {
      setSubmittingTurn(false);
    }
  }

  async function handleAttend(ticket: QueueTicket) {
    if (ticket.status === 'En espera') {
      await pharmacyService.updateQueueStatus(pharmacyId, user, ticket.id, 'En atención');
    }
    onAttendInPos(ticket);
  }

  async function handleMarkDone(ticketId: string) {
    await pharmacyService.updateQueueStatus(pharmacyId, user, ticketId, 'Atendido');
  }

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await pharmacyService.createCustomer(pharmacyId, user, newClient);
      setShowClientModal(false);
      setNewClient({
        documentType: 'DNI',
        documentNumber: '',
        fullName: '',
        phone: '',
        email: '',
        allergies: '',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar cliente.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
          <h2 className="text-sm font-semibold text-slate-900">Registrar Turno en Mostrador</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ordena el flujo de llegada para reducir tiempos de espera
          </p>

          <form onSubmit={handleCreateTurn} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="turn-doc" className="block text-xs font-medium text-slate-700">
                DNI / RUC (opcional)
              </label>
              <input
                id="turn-doc"
                type="text"
                value={documentNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setDocumentNumber(val);
                  const found = customers.find((c) => c.documentNumber === val.trim());
                  if (found) setCustomerName(found.fullName);
                }}
                placeholder="Ej. 45821904"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="turn-name" className="block text-xs font-medium text-slate-700">
                Nombre del cliente
              </label>
              <input
                id="turn-name"
                type="text"
                required
                minLength={2}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre y apellido"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="turn-service" className="block text-xs font-medium text-slate-700">
                Tipo de atención
              </label>
              <select
                id="turn-service"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as QueueServiceType)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-teal-600 focus:outline-none"
              >
                <option value="Atención Rápida">Atención Rápida (Venta directa)</option>
                <option value="Receta Médica">Despacho con Receta Médica</option>
                <option value="Consulta Farmacéutica">Consulta Farmacéutica</option>
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700">Prioridad</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {(['Normal', 'Preferencial'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      priority === p
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingTurn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {submittingTurn ? 'Generando turno...' : 'Asignar Turno'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cola de Atención en Tiempo Real ({activeQueue.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Atendidos hoy: <span className="font-mono font-medium tabular-nums">{completedToday.length}</span>
              </p>
            </div>
          </div>

          {activeQueue.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-slate-900">Sin clientes en espera</p>
              <p className="mt-1 text-xs text-slate-500">
                Registra un turno en el panel izquierdo cuando ingrese un cliente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeQueue.map((ticket) => {
                const waitMins = minutesSince(ticket.createdAt);
                const isServing = ticket.status === 'En atención';
                return (
                  <div
                    key={ticket.id}
                    className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums pt-0.5 shrink-0">
                        {ticket.ticketCode}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {ticket.customerName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span>{ticket.serviceType}</span>
                          <span aria-hidden="true"> · </span>
                          <span className={ticket.priority === 'Preferencial' ? 'font-semibold text-amber-700' : ''}>
                            {ticket.priority}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className={isServing ? 'font-semibold text-teal-700' : 'text-slate-600'}>
                            {ticket.status}
                          </span>
                          {ticket.assignedUserName && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{ticket.assignedUserName}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {waitMins} min
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAttend(ticket)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
                      >
                        Atender en POS
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkDone(ticket.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Finalizar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Directorio Clínico de Clientes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Historial de visitas, alergias registradas y facturación frecuente
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Buscar DNI o nombre"
                className="rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowClientModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Registrar Cliente
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-6 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Nombre / Razón Social</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Alergias / Notas</th>
                <th className="px-4 py-3 font-medium text-right">Visitas</th>
                <th className="px-6 py-3 font-medium text-right">Consumo Acum.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-slate-700 tabular-nums">
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.fullName}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span
                      className={
                        c.allergies && c.allergies !== 'Ninguna conocida' && c.allergies !== 'No aplica'
                          ? 'font-medium text-amber-700'
                          : 'text-slate-500'
                      }
                    >
                      {c.allergies || 'Ninguna'}
                    </span>
                    {c.notes ? ` · ${c.notes}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.visitsCount}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(c.totalSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Cliente</h3>
            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Tipo</label>
                  <select
                    value={newClient.documentType}
                    onChange={(e) =>
                      setNewClient({ ...newClient, documentType: e.target.value as 'DNI' | 'RUC' | 'CE' })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs bg-white"
                  >
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="CE">CE</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700">Número</label>
                  <input
                    required
                    minLength={5}
                    value={newClient.documentNumber}
                    onChange={(e) => setNewClient({ ...newClient, documentNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Nombre completo / Razón social</label>
                <input
                  required
                  minLength={2}
                  value={newClient.fullName}
                  onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Teléfono</label>
                  <input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Alergias</label>
                  <input
                    value={newClient.allergies}
                    onChange={(e) => setNewClient({ ...newClient, allergies: e.target.value })}
                    placeholder="Ninguna conocida"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Observaciones clínicas</label>
                <input
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
