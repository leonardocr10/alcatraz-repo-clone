import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type UserProfile = Tables<"users">;

interface AuthContextType {
  authUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (nickname: string, password: string, phone: string, characterClass?: string) => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    console.log("[Auth] Fetching profile for:", userId);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[Auth] Profile fetch error:", error);
      return;
    }
    console.log("[Auth] Profile loaded:", data?.nickname, data?.class);
    setProfile(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    let sessionRestored = false;

    // First, restore session from storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      sessionRestored = true;
      console.log("[Auth] Session restored:", !!session?.user);
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Then listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        console.log("[Auth] Event:", event, "User:", !!session?.user);

        // Skip INITIAL_SESSION if getSession already handled it
        if (event === "INITIAL_SESSION" && sessionRestored) return;

        setAuthUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            if (mounted) fetchProfile(session.user.id);
          }, 100);
        } else {
          setProfile(null);
        }
        if (event !== "INITIAL_SESSION") {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

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
        isApproved: profile?.approved ?? false,
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
