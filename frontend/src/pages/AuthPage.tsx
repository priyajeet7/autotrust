import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const field =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-300">
          AutoTrust Motors
        </p>
        <div className="mt-4 rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-slate-900">
            {isRegister ? 'Create your account' : 'Sign in to AutoTrust'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRegister
              ? 'Browse inventory and purchase vehicles.'
              : 'Manage and browse dealership inventory.'}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setSubmitting(true);
              try {
                if (isRegister) await register(name, email, password);
                else await login(email, password);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Something went wrong');
                setSubmitting(false);
              }
            }}
          >
            {isRegister && (
              <label className="block text-sm font-medium text-slate-700">
                Name
                <input
                  className={field}
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                className={field}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  className={field}
                  type="password"
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  aria-describedby={isRegister ? 'password-hint' : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {isRegister && (
                <p id="password-hint" className="mt-1 text-xs text-slate-500">
                  At least 8 characters.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {isRegister ? 'Already have an account?' : 'New to AutoTrust?'}{' '}
            <button
              type="button"
              className="font-semibold text-indigo-600 hover:text-indigo-500"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError(null);
              }}
            >
              {isRegister ? 'Sign in instead' : 'Create an account'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
