import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  auth_id: string | null;
  nickname: string;
  role: "admin" | "user";
  class: string | null;
  phone: string | null;
  email: string | null;
};

type AuthContextValue = {
  session: Session | null;
  authUser: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(authUserId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, auth_id, nickname, role, class, phone, email")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    const profileData = await loadProfile(authUser.id);
    setProfile(profileData);
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setAuthUser(data.session?.user ?? null);

      if (data.session?.user) {
        try {
          const profileData = await loadProfile(data.session.user.id);
          if (mounted) setProfile(profileData);
        } catch {
          if (mounted) setProfile(null);
        }
      }

      if (mounted) setLoading(false);
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        try {
          const profileData = await loadProfile(nextSession.user.id);
          setProfile(profileData);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      session,
      authUser,
      profile,
      isAdmin: profile?.role === "admin",
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, authUser, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
