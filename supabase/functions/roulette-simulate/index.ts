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

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !authUser) throw new Error("Invalid token");

    const { data: adminCheck } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", authUser.id)
      .single();
    if (!adminCheck || adminCheck.role !== "admin") throw new Error("Não autorizado");

    const { session_id, num_players = 5 } = await req.json();
    if (!session_id) throw new Error("session_id obrigatório");

    const playerCount = Math.min(Math.max(num_players, 2), 20);

    // Create fake users
    const fakeNames = [
      "DragonSlayer", "ShadowKnight", "IronMage", "DarkPaladin", "StormArcher",
      "FireWizard", "IceQueen", "ThunderLord", "BloodHunter", "NightBlade",
      "CrystalSage", "DeathReaper", "HolyPriest", "WolfRider", "PhoenixKing",
      "GhostAssassin", "StarWarrior", "DemonLord", "AngelGuard", "SkullCrusher",
    ];

    const fakeUserIds: string[] = [];

    for (let i = 0; i < playerCount; i++) {
      const nickname = fakeNames[i % fakeNames.length] + (i >= fakeNames.length ? `_${i}` : "");
      const phone = `SIM${String(i).padStart(6, "0")}`;

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existing) {
        fakeUserIds.push(existing.id);
      } else {
        const { data: newUser, error: insertErr } = await supabase
          .from("users")
          .insert({ nickname, phone, role: "user" })
          .select("id")
          .single();
        if (insertErr) throw new Error(`Erro criando usuário: ${insertErr.message}`);
        fakeUserIds.push(newUser.id);
      }
    }

    // Get ALL session items
    const { data: allItems } = await supabase
      .from("roulette_session_items")
      .select("*")
      .eq("session_id", session_id)
      .order("order_index", { ascending: true });

    if (!allItems || allItems.length === 0) throw new Error("Sessão sem itens");

    let totalPlays = 0;
    let itemsProcessed = 0;

    // Start session if not running
    const { data: sess } = await supabase
      .from("roulette_sessions")
      .select("*")
      .eq("id", session_id)
      .single();
    if (!sess) throw new Error("Sessão não encontrada");

    // Process each item sequentially
    for (const item of allItems) {
      // Skip already closed items
      if (item.closed_at) continue;

      const now = new Date();

      // If session not running or this item not open, open it
      if (!item.is_open) {
        const endsAt = new Date(now.getTime() + item.round_duration_seconds * 1000);

        await supabase
          .from("roulette_sessions")
          .update({ is_running: true, started_at: sess.started_at || now.toISOString(), current_item_index: item.order_index, ended_at: null })
          .eq("id", session_id);

        await supabase
          .from("roulette_session_items")
          .update({
            is_open: true,
            round_started_at: now.toISOString(),
            round_ends_at: endsAt.toISOString(),
          })
          .eq("id", item.id);
      }

      // Insert plays for fake users on this item
      const usedNumbers = new Set<number>();
      let playCount = 0;

      for (const userId of fakeUserIds) {
        // Check if already played this item
        const { data: existing } = await supabase
          .from("roulette_plays")
          .select("id")
          .eq("session_id", session_id)
          .eq("item_id", item.item_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (existing) continue;

        const skip = Math.random() < 0.15;
        let number = 0;

        if (!skip) {
          let attempts = 0;
          do {
            number = Math.floor(Math.random() * 1000) + 1;
            attempts++;
          } while (usedNumbers.has(number) && attempts < 100);
          usedNumbers.add(number);

          await supabase.from("roulette_numbers_used").insert({
            session_id,
            item_id: item.item_id,
            number,
            user_id: userId,
          });
        }

        await supabase.from("roulette_plays").insert({
          session_id,
          item_id: item.item_id,
          user_id: userId,
          number,
        });
        playCount++;
      }

      // Determine winner (highest number)
      const { data: plays } = await supabase
        .from("roulette_plays")
        .select("*")
        .eq("session_id", session_id)
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
          session_id,
          item_id: item.item_id,
          user_id: winnerUserId,
          number: winnerNumber,
        });
      }

      // Close this item
      const closeTime = new Date().toISOString();
      await supabase
        .from("roulette_session_items")
        .update({
          is_open: false,
          closed_at: closeTime,
          winner_user_id: winnerUserId,
          winner_number: winnerNumber,
        })
        .eq("id", item.id);

      totalPlays += playCount;
      itemsProcessed++;
    }

    // End session after all items processed
    await supabase
      .from("roulette_sessions")
      .update({ is_running: false, ended_at: new Date().toISOString() })
      .eq("id", session_id);

    return new Response(JSON.stringify({ 
      success: true, 
      players: totalPlays, 
      items: itemsProcessed,
      message: `${totalPlays} jogadas simuladas em ${itemsProcessed} itens.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
