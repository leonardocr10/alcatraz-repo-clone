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

    const now = new Date().toISOString();

    // Find open items that have expired
    const { data: expiredItems } = await supabase
      .from("roulette_session_items")
      .select("*")
      .eq("is_open", true)
      .lte("round_ends_at", now);

    if (!expiredItems || expiredItems.length === 0) {
      return new Response(JSON.stringify({ message: "No expired rounds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const item of expiredItems) {
      const sessionId = item.session_id;

      // Find winner
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
        await supabase
          .from("roulette_sessions")
          .update({ is_running: false, ended_at: now })
          .eq("id", sessionId);
      }
    }

    return new Response(JSON.stringify({ success: true, closed: expiredItems.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
