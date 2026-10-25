import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';

function Screen() {
  const { state, logout } = useAuth();

  if (state.status === 'loading') {
    return <p className="p-10 text-center text-slate-500">Loading…</p>;
  }
  if (state.status === 'signedOut') return <AuthPage />;
  return <Dashboard token={state.token} user={state.user} onLogout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Screen />
    </AuthProvider>
  );
}
