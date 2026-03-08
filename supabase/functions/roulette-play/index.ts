import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get client IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !authUser) throw new Error("Invalid token");

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) throw new Error("User profile not found");

    const { action, session_id, item_id } = await req.json();

    // Validate session is running
    const { data: session } = await supabase
      .from("roulette_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("is_running", true)
      .single();
    if (!session) throw new Error("Sessão não está ativa");

    // Get current open item
    const { data: sessionItem } = await supabase
      .from("roulette_session_items")
      .select("*")
      .eq("session_id", session_id)
      .eq("item_id", item_id)
      .eq("is_open", true)
      .single();
    if (!sessionItem) throw new Error("Item não está aberto");

    // Check time
    const now = new Date();
    const endsAt = new Date(sessionItem.round_ends_at!);
    if (now >= endsAt) throw new Error("Tempo esgotado");

    // Check if user already played
    const { data: existingPlay } = await supabase
      .from("roulette_plays")
      .select("id")
      .eq("session_id", session_id)
      .eq("item_id", item_id)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (existingPlay) throw new Error("Você já jogou neste item");

    // Check if this IP already played this item
    if (clientIp !== "unknown") {
      const { data: ipPlay } = await supabase
        .from("roulette_plays")
        .select("id")
        .eq("session_id", session_id)
        .eq("item_id", item_id)
        .eq("ip_address", clientIp)
        .maybeSingle();
      if (ipPlay) throw new Error("Este dispositivo já votou neste item. Apenas um voto por conexão é permitido.");
    }

    if (action === "skip") {
      await supabase.from("roulette_plays").insert({
        session_id,
        item_id,
        user_id: profile.id,
        number: 0,
        ip_address: clientIp,
      });
      return new Response(JSON.stringify({ number: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "spin") {
      let number = 0;
      let attempts = 0;
      const maxAttempts = 50;

      while (attempts < maxAttempts) {
        number = Math.floor(Math.random() * 1000) + 1;
        const { error: insertError } = await supabase
          .from("roulette_numbers_used")
          .insert({
            session_id,
            item_id,
            number,
            user_id: profile.id,
          });

        if (!insertError) break;
        attempts++;
      }

      if (attempts >= maxAttempts) throw new Error("Não foi possível gerar um número único");

      await supabase.from("roulette_plays").insert({
        session_id,
        item_id,
        user_id: profile.id,
        number,
        ip_address: clientIp,
      });

      return new Response(JSON.stringify({ number }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
