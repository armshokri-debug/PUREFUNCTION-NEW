import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isCloud, supabase, supabaseUrl } from './supabase';

export interface Profile {
  id: string;
  role: 'coach' | 'client';
  displayName: string;
  clientId: string | null;
  email: string;
}

export type SessionStatus =
  | 'local' // no cloud configured: demo mode on this device
  | 'loading'
  | 'signed-out'
  | 'no-access' // signed in, but not the coach and not on a client list
  | 'reset' // opened a password-reset link: choose a new password
  | 'ready';

interface SessionValue {
  status: SessionStatus;
  profile: Profile | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** One-time message for the sign-in screen (e.g. expired reset link). */
  notice: string | null;
  /** Emails a reset link. Returns an error message or null. */
  forgotPassword: (email: string) => Promise<string | null>;
  /** After opening a reset link: saves the new password and continues into the app. */
  setNewPassword: (password: string) => Promise<string | null>;
  /** Re-checks access, e.g. after the coach adds this email. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email or password is not correct.';
  if (/email not confirmed/i.test(message)) return 'This account isn’t confirmed yet.';
  if (/network|fetch/i.test(message)) return 'No connection. Check your internet and try again.';
  return message;
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SessionStatus>(isCloud ? 'loading' : 'local');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetPending = React.useRef(new URLSearchParams(window.location.search).has('reset'));

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase) return;
    if (!s) {
      setProfile(null);
      setStatus('signed-out');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, client_id')
      .eq('id', s.user.id)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
      setStatus('no-access');
      return;
    }
    const next: Profile = {
      id: data.id,
      role: data.role,
      displayName: data.display_name,
      clientId: data.client_id,
      email: s.user.email ?? ''
    };
    // Supabase announces SIGNED_IN again every time the tab/app comes back into view. Keep the
    // same object when nothing changed, so the app does not reload all its data and reset the page.
    setProfile((prev) =>
      prev &&
      prev.id === next.id &&
      prev.role === next.role &&
      prev.displayName === next.displayName &&
      prev.clientId === next.clientId &&
      prev.email === next.email
        ? prev
        : next
    );
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const resetToken = new URLSearchParams(window.location.search).get('reset');
    const start = async () => {
      if (resetToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset');
        window.history.replaceState(null, '', url.toString());
        const { data, error } = await supabase!.auth.verifyOtp({ type: 'recovery', token_hash: resetToken });
        if (!active) return;
        if (!error && data.session) {
          setSession(data.session);
          setStatus('reset');
          return;
        }
        resetPending.current = false;
        setNotice('That reset link has expired or was already used. Send a new one below.');
      }
      const { data } = await supabase!.auth.getSession();
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session);
    };
    void start();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT' || ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && !resetPending.current)) {
        // defer: Supabase recommends not awaiting other calls inside this callback
        window.setTimeout(() => void loadProfile(s), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Cloud is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuthError(error.message) : null;
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) return 'Cloud is not configured.';
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return body.error ?? 'Could not create the account. Try again.';
    } catch {
      return 'No connection. Check your internet and try again.';
    }
    return signIn(email, password);
  };

  const forgotPassword = async (email: string) => {
    if (!supabase) return 'Cloud is not configured.';
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return res.ok ? null : body.error ?? 'Could not send the email. Try again.';
    } catch {
      return 'No connection. Check your internet and try again.';
    }
  };

  const setNewPassword = async (password: string) => {
    if (!supabase) return 'Cloud is not configured.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) return friendlyAuthError(error.message);
    resetPending.current = false;
    const { data: s } = await supabase.auth.getSession();
    void data;
    await loadProfile(s.session);
    return null;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setStatus('signed-out');
  };

  return (
    <SessionContext.Provider
      value={{
        status,
        profile,
        email: session?.user.email ?? null,
        signIn,
        signUp,
        signOut,
        notice,
        forgotPassword,
        setNewPassword,
        refresh: () => loadProfile(session)
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
