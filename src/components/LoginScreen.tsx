import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Lock, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Cerraste la ventana de Google antes de completar el ingreso.');
      } else if (msg.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana emergente. Permite ventanas emergentes e intenta nuevamente.');
      } else {
        setError(msg);
      }
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
              Sincronización en tiempo real con Cloud Firestore, alertas automáticas de reposición y despacho rápido en mostrador desde cualquier dispositivo web.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Autenticación verificada con Google y reglas de seguridad Firestore</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-8">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <Lock className="h-3.5 w-3.5" />
            <span>Acceso seguro en la nube</span>
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Ingresar a Nova Salud</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Inicia sesión con tu cuenta de Google para acceder a tu espacio de trabajo farmacéutico con inventario, ventas y bitácora en tiempo real.
          </p>

          <div className="mt-8 space-y-4">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{loading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500">
            Al ingresar por primera vez, se crea automáticamente tu catálogo inicial de medicamentos, turnos y clientes en Firestore.
          </div>
        </div>
      </div>
    </div>
  );
}
