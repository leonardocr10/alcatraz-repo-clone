import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type UserProfile = Tables<"users">;

interface AuthContextType {
  authUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (nickname: string, password: string, phone: string) => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", userId)
      .single();
    setProfile(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setAuthUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const makeEmail = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return `${digits}@phone.roleta.app`;
  };

  const signUp = async (nickname: string, password: string, phone: string, characterClass?: string) => {
    const fakeEmail = makeEmail(phone);
    const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert({
        auth_id: data.user.id,
        nickname,
        phone: phone.replace(/\D/g, ''),
        class: (characterClass || null) as any,
      });
      if (profileError) throw profileError;
      await fetchProfile(data.user.id);
    }
  };

  const signIn = async (phone: string, password: string) => {
    const fakeEmail = makeEmail(phone);
    const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
