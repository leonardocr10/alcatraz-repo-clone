import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse request body for force mode or specific boss
    let force = false;
    let forceBossId: string | null = null;
    let forceAll = false;
    try {
      const body = await req.json();
      force = body.force === true;
      forceBossId = body.boss_id || null;
      forceAll = body.all === true;
    } catch { /* no body = cron call */ }

    // Get WhatsApp config
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.is_enabled || !config.api_url) {
      return new Response(JSON.stringify({ message: "WhatsApp not configured or disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current time in Brazil (UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
    const currentHour = brazilTime.getHours();
    const currentMinute = brazilTime.getMinutes();
    const today = brazilTime.toISOString().split("T")[0];

    console.log(`Current Brazil time: ${currentHour}:${currentMinute.toString().padStart(2, "0")} | force=${force} forceBossId=${forceBossId} forceAll=${forceAll}`);

    // Get all boss schedules with boss info
    const { data: schedules } = await supabase
      .from("boss_schedules")
      .select("*, bosses(name, map_level, image_url, map_image_url, description)")
      .order("spawn_time");

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No schedules found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which schedules to notify
    const toNotifyBefore: typeof schedules = []; // pre-spawn alerts
    const toNotifySpawn: typeof schedules = [];  // exact spawn alerts

    if (force && forceBossId) {
      // Force mode: send for specific boss (next upcoming schedule)
      const bossScheds = schedules.filter((s) => s.boss_id === forceBossId);
      if (bossScheds.length > 0) {
        // Find the next upcoming schedule for this boss
        const currentMins = currentHour * 60 + currentMinute;
        let closest = bossScheds[0];
        let closestDiff = Infinity;
        for (const s of bossScheds) {
          const [h, m] = s.spawn_time.split(":").map(Number);
          let diff = h * 60 + m - currentMins;
          if (diff < 0) diff += 24 * 60;
          if (diff < closestDiff) { closestDiff = diff; closest = s; }
        }
        toNotifyBefore.push(closest);
      }
    } else if (force && forceAll) {
      // Force all: send for all bosses (next upcoming schedule per boss)
      const bossIds = [...new Set(schedules.map((s) => s.boss_id))];
      const currentMins = currentHour * 60 + currentMinute;
      for (const bossId of bossIds) {
        const bossScheds = schedules.filter((s) => s.boss_id === bossId);
        let closest = bossScheds[0];
        let closestDiff = Infinity;
        for (const s of bossScheds) {
          const [h, m] = s.spawn_time.split(":").map(Number);
          let diff = h * 60 + m - currentMins;
          if (diff < 0) diff += 24 * 60;
          if (diff < closestDiff) { closestDiff = diff; closest = s; }
        }
        toNotifyBefore.push(closest);
      }
    } else {
      // Normal cron mode: check timing
      for (const schedule of schedules) {
        const [spawnH, spawnM] = schedule.spawn_time.split(":").map(Number);
        const notifyMinsBefore = schedule.notify_minutes_before || 10;

        // Check PRE-SPAWN notification time
        let notifyTotalMins = spawnH * 60 + spawnM - notifyMinsBefore;
        if (notifyTotalMins < 0) notifyTotalMins += 24 * 60;
        const notifyH = Math.floor(notifyTotalMins / 60) % 24;
        const notifyM = notifyTotalMins % 60;

        if (notifyH === currentHour && notifyM === currentMinute) {
          const notifKey = `pre-${schedule.id}-${today}-${spawnH}:${spawnM}`;
          const { data: existing } = await supabase
            .from("boss_notification_log")
            .select("id")
            .eq("notification_key", notifKey)
            .maybeSingle();
          if (!existing) {
            toNotifyBefore.push(schedule);
          }
        }

        // Check EXACT SPAWN notification time
        if (spawnH === currentHour && spawnM === currentMinute) {
          const notifKey = `spawn-${schedule.id}-${today}-${spawnH}:${spawnM}`;
          const { data: existing } = await supabase
            .from("boss_notification_log")
            .select("id")
            .eq("notification_key", notifKey)
            .maybeSingle();
          if (!existing) {
            toNotifySpawn.push(schedule);
          }
        }
      }
    }

    if (toNotifyBefore.length === 0 && toNotifySpawn.length === 0) {
      return new Response(JSON.stringify({ message: "No notifications due now" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get users with phone numbers who haven't opted out
    const { data: users } = await supabase
      .from("users")
      .select("id, nickname, phone, whatsapp_optout")
      .not("phone", "is", null)
      .neq("phone", "");

    const eligibleUsers = (users || []).filter((u: any) => !u.whatsapp_optout && u.phone);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Build headers for WhatsApp API
    const apiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (Array.isArray(config.headers)) {
      for (const h of config.headers) {
        if (h.key && h.value) apiHeaders[h.key] = h.value;
      }
    }

    // Helper: send text message
    const sendText = async (phone: string, text: string) => {
      let body = config.body_template;
      body = body.replace(/\{\{number\}\}/g, phone);
      body = body.replace(/\{\{text\}\}/g, text);
      const resp = await fetch(config.api_url, {
        method: "POST",
        headers: apiHeaders,
        body: body,
      });
      return resp;
    };

    // Helper: send image message (try multiple endpoints)
    const sendImage = async (phone: string, imageUrl: string, caption: string) => {
      // Try /sendImage endpoint
      const baseUrl = config.api_url.replace(/\/sendText$/, "").replace(/\/send-message$/, "").replace(/\/sendMessage$/, "");
      
      const imageEndpoints = [
        { url: `${baseUrl}/sendImage`, body: JSON.stringify({ number: phone, image: imageUrl, caption }) },
        { url: `${baseUrl}/sendFile`, body: JSON.stringify({ number: phone, url: imageUrl, caption, fileName: "map.jpg" }) },
      ];

      for (const ep of imageEndpoints) {
        try {
          const resp = await fetch(ep.url, {
            method: "POST",
            headers: apiHeaders,
            body: ep.body,
          });
          if (resp.ok) return resp;
          await resp.text(); // consume body
        } catch { /* try next */ }
      }
      return null;
    };

    // Process PRE-SPAWN notifications
    for (const schedule of toNotifyBefore) {
      const boss = (schedule as any).bosses;
      const bossName = boss?.name || "Boss";
      const mapLevel = boss?.map_level || "";
      const mapImageUrl = boss?.map_image_url || "";
      const spawnTime = schedule.spawn_time.substring(0, 5);
      const minutesBefore = schedule.notify_minutes_before;

      let messageText = `⚔️ *Boss Alert - Painel AZ!*\n\n🐉 Boss: *${bossName}*`;
      if (mapLevel) messageText += `\n📍 Local: *${mapLevel}*`;
      messageText += `\n⏰ Spawna em *${minutesBefore} minutos* (${spawnTime})`;
      messageText += `\n\n⚔️ Prepare-se guerreiro!`;
      if (mapImageUrl) messageText += `\n\n🗺️ Mapa: ${mapImageUrl}`;

      for (const user of eligibleUsers) {
        try {
          const resp = await sendText(user.phone, messageText);
          if (resp.ok) {
            sentCount++;
            // Try to send map image separately
            if (mapImageUrl) {
              await sendImage(user.phone, mapImageUrl, `🗺️ ${bossName} - ${mapLevel}`);
            }
          } else {
            const errText = await resp.text();
            errors.push(`Failed for ${user.nickname}: ${resp.status} ${errText}`);
          }
        } catch (e: any) {
          errors.push(`Error for ${user.nickname}: ${e.message}`);
        }
      }

      // Log notification (skip log in force/test mode)
      if (!force) {
        const [sH, sM] = schedule.spawn_time.split(":").map(Number);
        const notifKey = `pre-${schedule.id}-${today}-${sH}:${sM}`;
        await supabase.from("boss_notification_log").insert({
          boss_id: schedule.boss_id,
          schedule_id: schedule.id,
          notification_key: notifKey,
        });
      }
    }

    // Process SPAWN notifications (boss just spawned!)
    for (const schedule of toNotifySpawn) {
      const boss = (schedule as any).bosses;
      const bossName = boss?.name || "Boss";
      const mapLevel = boss?.map_level || "";
      const mapImageUrl = boss?.map_image_url || "";
      const spawnTime = schedule.spawn_time.substring(0, 5);

      let messageText = `🔥 *BOSS NASCEU! - Painel AZ!*\n\n🐉 Boss: *${bossName}*`;
      if (mapLevel) messageText += `\n📍 Local: *${mapLevel}*`;
      messageText += `\n⏰ Horário: *${spawnTime}*`;
      messageText += `\n\n🔥 CORRE GUERREIRO! O boss está vivo!`;
      if (mapImageUrl) messageText += `\n\n🗺️ Mapa: ${mapImageUrl}`;

      for (const user of eligibleUsers) {
        try {
          const resp = await sendText(user.phone, messageText);
          if (resp.ok) {
            sentCount++;
            if (mapImageUrl) {
              await sendImage(user.phone, mapImageUrl, `🔥 ${bossName} NASCEU! - ${mapLevel}`);
            }
          } else {
            const errText = await resp.text();
            errors.push(`Spawn failed for ${user.nickname}: ${resp.status} ${errText}`);
          }
        } catch (e: any) {
          errors.push(`Spawn error for ${user.nickname}: ${e.message}`);
        }
      }

      // Log spawn notification
      const [sH, sM] = schedule.spawn_time.split(":").map(Number);
      const notifKey = `spawn-${schedule.id}-${today}-${sH}:${sM}`;
      await supabase.from("boss_notification_log").insert({
        boss_id: schedule.boss_id,
        schedule_id: schedule.id,
        notification_key: notifKey,
      });
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sentCount} notifications (${toNotifyBefore.length} pre-spawn, ${toNotifySpawn.length} spawn)`,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Boss notify error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
