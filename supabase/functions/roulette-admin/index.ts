import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (!authUser) throw new Error("Invalid token");

    // Check admin
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile || profile.role !== "admin") throw new Error("Acesso negado");

    const { action, session_id } = await req.json();

    if (action === "start") {
      // Get session items
      const { data: sessionItems } = await supabase
        .from("roulette_session_items")
        .select("*")
        .eq("session_id", session_id)
        .order("order_index", { ascending: true });

      if (!sessionItems || sessionItems.length === 0) throw new Error("Sessão sem itens");

      const firstItem = sessionItems[0];
      const now = new Date();
      const endsAt = new Date(now.getTime() + firstItem.round_duration_seconds * 1000);

      // Update session
      await supabase
        .from("roulette_sessions")
        .update({
          is_running: true,
          started_at: now.toISOString(),
          current_item_index: 0,
          ended_at: null,
        })
        .eq("id", session_id);

      // Open first item
      await supabase
        .from("roulette_session_items")
        .update({
          is_open: true,
          round_started_at: now.toISOString(),
          round_ends_at: endsAt.toISOString(),
        })
        .eq("id", firstItem.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "close-round") {
      await closeExpiredRounds(supabase);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear-history") {
      // Delete in correct order due to foreign keys
      await supabase.from("roulette_winners").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_plays").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_numbers_used").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_session_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(JSON.stringify({ success: true, message: "Histórico limpo" }), {
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

async function closeExpiredRounds(supabase: any) {
  const now = new Date().toISOString();

  // Find open items that have expired
  const { data: expiredItems } = await supabase
    .from("roulette_session_items")
    .select("*, roulette_sessions!inner(id, is_running, current_item_index)")
    .eq("is_open", true)
    .lte("round_ends_at", now);

  if (!expiredItems || expiredItems.length === 0) return;

  for (const item of expiredItems) {
    const sessionId = item.session_id;

    // Find winner (highest number > 0)
    const { data: plays } = await supabase
      .from("roulette_plays")
      .select("*")
      .eq("session_id", sessionId)
      .eq("item_id", item.item_id)
      .gt("number", 0)
      .order("number", { ascending: false })
      .limit(1);

    let winnerUserId = null;
    let winnerNumber = null;

    if (plays && plays.length > 0) {
      winnerUserId = plays[0].user_id;
      winnerNumber = plays[0].number;

      // Insert winner
      await supabase.from("roulette_winners").insert({
        session_id: sessionId,
        item_id: item.item_id,
        user_id: winnerUserId,
        number: winnerNumber,
      });
    }

    // Close item
    await supabase
      .from("roulette_session_items")
      .update({
        is_open: false,
        closed_at: now,
        winner_user_id: winnerUserId,
        winner_number: winnerNumber,
      })
      .eq("id", item.id);

    // Advance to next item
    const nextIndex = item.order_index + 1;
    const { data: nextItem } = await supabase
      .from("roulette_session_items")
      .select("*")
      .eq("session_id", sessionId)
      .eq("order_index", nextIndex)
      .maybeSingle();

    if (nextItem) {
      const nextNow = new Date();
      const nextEndsAt = new Date(nextNow.getTime() + nextItem.round_duration_seconds * 1000);

      await supabase
        .from("roulette_sessions")
        .update({ current_item_index: nextIndex })
        .eq("id", sessionId);

      await supabase
        .from("roulette_session_items")
        .update({
          is_open: true,
          round_started_at: nextNow.toISOString(),
          round_ends_at: nextEndsAt.toISOString(),
        })
        .eq("id", nextItem.id);
    } else {
      // No more items, end session
      await supabase
        .from("roulette_sessions")
        .update({
          is_running: false,
          ended_at: now,
        })
        .eq("id", sessionId);
    }
  }
}
