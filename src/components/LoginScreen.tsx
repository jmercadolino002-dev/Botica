import { useState, type FormEvent } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { getStaffAvatar } from '../lib/avatars';
import type { UserProfile, UserRole } from '../shared/types';

interface LoginScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState('admin@novasalud.pe');
  const [password, setPassword] = useState('NovaAdmin2026!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRole(role: UserRole) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.demoInit(role);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-2">
        <div className="flex flex-col justify-between bg-slate-900 p-8 text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5V3z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight">Botica Nova Salud</span>
            </div>
            <h2 className="mt-8 text-2xl font-bold leading-snug text-balance">
              Gestión centralizada de inventario, ventas y atención farmacéutica
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Control de stock en tiempo real, alertas automáticas de reposición y despacho rápido en mostrador con trazabilidad segura por operador.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Sesión firmada con control de acceso por rol (CQFP / Técnico)</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <Lock className="h-3.5 w-3.5" />
            <span>Acceso seguro al sistema</span>
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Iniciar sesión de operador</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa tus credenciales o selecciona un perfil autorizado de prueba.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">
                Correo institucional
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                placeholder="operador@novasalud.pe"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Verificando credenciales...' : 'Ingresar al Sistema'}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium text-slate-500">Acceso rápido por perfil</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickRole('admin')}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left hover:border-teal-600 hover:bg-white transition-colors"
              >
                <img
                  src={getStaffAvatar('admin')}
                  alt="Dra. Rosa Mamani"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">Dra. Rosa Mamani</p>
                  <p className="text-[11px] text-slate-500 truncate">Admin · Química</p>
                </div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickRole('seller')}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left hover:border-teal-600 hover:bg-white transition-colors"
              >
                <img
                  src={getStaffAvatar('seller')}
                  alt="Carlos Mendoza"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">Carlos Mendoza</p>
                  <p className="text-[11px] text-slate-500 truncate">Vendedor · Técnico</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
