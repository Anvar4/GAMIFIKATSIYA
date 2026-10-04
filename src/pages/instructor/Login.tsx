import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Logo, SpaceBackground, Spinner } from '../../components/ui/Basics';
import { useInstructorAuth } from '../../context/InstructorAuth';
import { errorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../hooks/useUi';

export default function Login() {
  useDocumentTitle('Oʻqituvchi kirishi');
  const auth = useInstructorAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/teacher';

  if (!auth.loading && auth.session && auth.isInstructor) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <SpaceBackground image="arena" dim={0.6} />
      <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-8" aria-labelledby="login-title">
        <Logo size="lg" />
        <h1 id="login-title" className="mt-8 font-display text-2xl font-bold">
          Oʻqituvchi kirishi
        </h1>
        <p className="mt-1 text-sm text-arena-muted">Oʻyinni boshqarish uchun oʻqituvchi hisobingiz bilan kiring.</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Parol
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {(error || (auth.session && !auth.isInstructor && !auth.loading)) && (
          <p className="mt-4 rounded-xl border border-arena-red/40 bg-arena-red/10 px-3 py-2 text-sm text-arena-red" role="alert">
            {error ?? 'Bu hisobga oʻqituvchi roli berilmagan.'}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg mt-6 w-full" disabled={busy}>
          {busy ? <Spinner /> : <LogIn className="h-5 w-5" />}
          Kirish
        </button>
        <a href="/" className="mt-4 block text-center text-sm text-arena-muted hover:text-arena-cyan">
          ← Bosh sahifa
        </a>
      </form>
    </main>
  );
}
