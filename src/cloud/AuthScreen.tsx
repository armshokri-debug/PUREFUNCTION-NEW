import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { PureFunctionLogo } from '../components/VisualAssets';
import { useSession } from './Session';

const input =
  'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-[#111827] placeholder:text-gray-400 focus:outline-none focus:border-[#111827]';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-dvh bg-[#F7F8FA] flex flex-col items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
    <div className="mb-8">
      <PureFunctionLogo />
    </div>
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 p-6 sm:p-7">
      {children}
    </div>
  </div>
);

type Who = 'coach' | 'client';

function initialWho(): { who: Who; joinEmail: string } {
  try {
    const q = new URLSearchParams(window.location.search);
    const join = q.get('join');
    if (join) return { who: 'client', joinEmail: join };
    if (q.has('coach')) return { who: 'coach', joinEmail: '' };
    const saved = localStorage.getItem('pf.signin.who');
    if (saved === 'coach' || saved === 'client') return { who: saved, joinEmail: '' };
  } catch {
    /* ignore */
  }
  return { who: 'client', joinEmail: '' };
}

/** Separate coach and client sign-in, like TrueCoach. Invite links (?join=email) open client set-up. */
export const AuthScreen: React.FC = () => {
  const { signIn, signUp, forgotPassword, notice } = useSession();
  const start = initialWho();
  const [who, setWho] = useState<Who>(start.who);
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'forgot'>(start.joinEmail ? 'sign-up' : 'sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(start.joinEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);
  const [sent, setSent] = useState(false);

  const pick = (w: Who) => {
    setWho(w);
    setMode('sign-in');
    setError(null);
    try {
      localStorage.setItem('pf.signin.who', w);
    } catch {
      /* ignore */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'sign-up' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    if (mode === 'forgot') {
      const err = await forgotPassword(email);
      setBusy(false);
      if (err) setError(err);
      else setSent(true);
      return;
    }
    const err = mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password, name);
    setBusy(false);
    if (err) {
      setError(
        who === 'client' && /isn’t on the list/.test(err)
          ? 'This email isn’t on your coach’s list. Use the exact email your coach invited (check the invite link), or ask them to correct it.'
          : who === 'coach' && /isn’t on the list/.test(err)
          ? 'This isn’t the coach email for this app. Clients: switch to “Client” above.'
          : err
      );
    }
  };

  const title = mode === 'forgot' ? 'Reset your password' :
    who === 'coach'
      ? mode === 'sign-in'
        ? 'Coach sign in'
        : 'Create coach account'
      : mode === 'sign-in'
      ? 'Client sign in'
      : 'Set up your account';
  const subtitle = mode === 'forgot' ? 'Enter your email and we’ll send you a link to choose a new password.' :
    who === 'coach'
      ? mode === 'sign-in'
        ? 'Manage clients, assessments and programs.'
        : 'Only the coach email for this app can create a coach account.'
      : mode === 'sign-in'
      ? 'See your workouts and log your training.'
      : 'Use the email your coach invited. Choose a password (8+ characters).';

  return (
    <Shell>
      {/* Coach / Client switch */}
      <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-6" role="tablist" aria-label="Sign in as">
        {(['client', 'coach'] as const).map((w) => (
          <button
            key={w}
            role="tab"
            aria-selected={who === w}
            onClick={() => pick(w)}
            className={`py-2.5 rounded-lg text-sm font-semibold cursor-pointer ${
              who === w ? 'bg-[#111827] text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            {w === 'client' ? 'I’m a client' : 'I’m the coach'}
          </button>
        ))}
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-[#111827] mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'sign-up' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            className={input}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          required
          className={input}
        />
        {mode !== 'forgot' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'sign-up' ? 'Password (8+ characters)' : 'Password'}
          aria-label="Password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          required
          className={input}
        />
        )}

        {mode === 'sign-in' && (
          <div className="text-right -mt-1">
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setSent(false);
              }}
              className="text-sm font-medium text-gray-500 hover:text-[#111827] cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
        )}

        {sent && mode === 'forgot' && (
          <div className="flex items-start gap-2 text-sm text-[#166534] bg-green-50 border border-green-100 rounded-xl px-3 py-2.5" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>If this email has an account, a reset link is on its way. Check your inbox (and spam).</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-60 text-white text-base font-semibold py-3.5 rounded-xl cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'forgot' ? (sent ? 'Send again' : 'Send reset link') : mode === 'sign-in' ? 'Sign in' : who === 'coach' ? 'Create coach account' : 'Create my account'}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-gray-500">
        {mode === 'forgot'
          ? 'Remembered it? '
          : mode === 'sign-in'
          ? who === 'client'
            ? 'First time here? '
            : 'No coach account yet? '
          : 'Already have an account? '}
        <button
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setSent(false);
          }}
          className="font-semibold text-[#111827] underline cursor-pointer"
        >
          {mode === 'sign-in' ? (who === 'client' ? 'Set up your account' : 'Create coach account') : 'Sign in'}
        </button>
      </div>
    </Shell>
  );
};

/** Shown after opening the emailed reset link. */
export const NewPasswordScreen: React.FC = () => {
  const { setNewPassword, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight text-[#111827] mb-1">Choose a new password</h1>
      <p className="text-sm text-gray-500 mb-6">At least 8 characters. You’ll stay signed in.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          const err = await setNewPassword(password);
          setBusy(false);
          if (err) setError(err);
        }}
        className="space-y-3"
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          aria-label="New password"
          autoComplete="new-password"
          required
          className={input}
        />
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1F2937] disabled:opacity-60 text-white text-base font-semibold py-3.5 rounded-xl cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save password
        </button>
      </form>
      <button onClick={() => void signOut()} className="w-full text-sm font-medium text-gray-500 py-2 mt-2 cursor-pointer">
        Cancel
      </button>
    </Shell>
  );
};

export const NoAccessScreen: React.FC = () => {
  const { email, refresh, signOut } = useSession();
  const [checking, setChecking] = useState(false);
  return (
    <Shell>
      <h1 className="text-xl font-bold text-[#111827] mb-2">Almost there</h1>
      <p className="text-sm text-gray-600 mb-5">
        You’re signed in as <b className="text-[#111827] break-all">{email}</b>, but your coach hasn’t added this
        email yet. Ask them to add it, then tap “Check again”.
      </p>
      <button
        onClick={async () => {
          setChecking(true);
          await refresh();
          setChecking(false);
        }}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#111827] text-white text-base font-semibold py-3.5 rounded-xl cursor-pointer mb-2"
      >
        {checking && <Loader2 className="w-4 h-4 animate-spin" />}
        Check again
      </button>
      <button onClick={() => void signOut()} className="w-full text-sm font-medium text-gray-500 py-2 cursor-pointer">
        Sign out
      </button>
    </Shell>
  );
};

export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="min-h-dvh bg-[#F7F8FA] flex flex-col items-center justify-center gap-4">
    <PureFunctionLogo />
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  </div>
);
