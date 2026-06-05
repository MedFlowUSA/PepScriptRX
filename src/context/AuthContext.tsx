import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getAuthCallbackUrl, supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User; profile: Profile | null }>;
  signUpPatient: (args: { email: string; password: string; fullName: string; phone: string }) => Promise<{ user: User | null; profile: Profile | null; sessionActive: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id);
      }
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id);
      }
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string): Promise<Profile | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    const nextProfile = data as Profile | null;
    setProfile(nextProfile);
    setLoading(false);
    return nextProfile;
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed. Please try again.');
    const signedInProfile = await fetchProfile(data.user.id);
    return { user: data.user, profile: signedInProfile };
  }

  async function signUpPatient(args: { email: string; password: string; fullName: string; phone: string }) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({
      email: args.email,
      password: args.password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: {
          full_name: args.fullName,
          phone: args.phone,
          role: 'patient',
        },
      },
    });
    if (error) throw error;
    const sessionActive = Boolean(data.session);
    let signedUpProfile: Profile | null = null;
    if (data.user && sessionActive) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        signedUpProfile = await fetchProfile(data.user.id);
        if (signedUpProfile) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
    return { user: data.user, profile: signedUpProfile, sessionActive };
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (!supabase || !user) return;
    await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUpPatient, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
