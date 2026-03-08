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

    console.log(`Current Brazil time: ${currentHour}:${currentMinute.toString().padStart(2, "0")}`);

    // Get all boss schedules with boss info
    const { data: schedules } = await supabase
      .from("boss_schedules")
      .select("*, bosses(name)")
      .order("spawn_time");

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No schedules found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find schedules that need notification NOW
    const toNotify: typeof schedules = [];
    const today = brazilTime.toISOString().split("T")[0];

    for (const schedule of schedules) {
      const [spawnH, spawnM] = schedule.spawn_time.split(":").map(Number);
      const notifyMinsBefore = schedule.notify_minutes_before || 10;

      // Calculate notification time
      let notifyTotalMins = spawnH * 60 + spawnM - notifyMinsBefore;
      if (notifyTotalMins < 0) notifyTotalMins += 24 * 60;
      const notifyH = Math.floor(notifyTotalMins / 60) % 24;
      const notifyM = notifyTotalMins % 60;

      if (notifyH === currentHour && notifyM === currentMinute) {
        // Check if already sent today for this schedule
        const notifKey = `${schedule.id}-${today}-${spawnH}:${spawnM}`;
        const { data: existing } = await supabase
          .from("boss_notification_log")
          .select("id")
          .eq("notification_key", notifKey)
          .maybeSingle();

        if (!existing) {
          toNotify.push(schedule);
        }
      }
    }

    if (toNotify.length === 0) {
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

    for (const schedule of toNotify) {
      const bossName = (schedule as any).bosses?.name || "Boss";
      const spawnTime = schedule.spawn_time.substring(0, 5);
      const minutesBefore = schedule.notify_minutes_before;

      const messageText = `⚔️ *Boss Alert - Painel AZ!*\n\n🐉 Boss: *${bossName}*\n⏰ Spawna em ${minutesBefore} minutos (${spawnTime})\n\n⚔️ Prepare-se guerreiro!`;

      for (const user of eligibleUsers) {
        try {
          // Replace template variables
          let body = config.body_template;
          body = body.replace(/\{\{number\}\}/g, user.phone);
          body = body.replace(/\{\{text\}\}/g, messageText);

          const resp = await fetch(config.api_url, {
            method: "POST",
            headers: apiHeaders,
            body: body,
          });

          if (resp.ok) {
            sentCount++;
          } else {
            const errText = await resp.text();
            errors.push(`Failed for ${user.nickname}: ${resp.status} ${errText}`);
          }
        } catch (e: any) {
          errors.push(`Error for ${user.nickname}: ${e.message}`);
        }
      }

      // Log notification
      const today2 = brazilTime.toISOString().split("T")[0];
      const [sH, sM] = schedule.spawn_time.split(":").map(Number);
      const notifKey = `${schedule.id}-${today2}-${sH}:${sM}`;
      await supabase.from("boss_notification_log").insert({
        boss_id: schedule.boss_id,
        schedule_id: schedule.id,
        notification_key: notifKey,
      });
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sentCount} notifications for ${toNotify.length} boss(es)`,
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
