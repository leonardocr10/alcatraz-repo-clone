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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    // Check admin role
    const { data: hasRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasRole) throw new Error("Not authorized");

    const body = await req.json();
    const { phones, message } = body as { phones: { phone: string; nickname: string }[]; message: string };

    if (!phones || phones.length === 0) throw new Error("No phones provided");
    if (!message || !message.trim()) throw new Error("No message provided");

    // Get WhatsApp config
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.is_enabled || !config.api_url) {
      throw new Error("WhatsApp não configurado ou desabilitado");
    }

    // Build headers
    const apiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (Array.isArray(config.headers)) {
      for (const h of config.headers as any[]) {
        if (h.key && h.value) apiHeaders[h.key] = h.value;
      }
    }

    const isGroupMode = !config.body_template.includes("{{number}}");

    const sendText = async (phone: string, text: string) => {
      let bodyStr: string;
      try {
        const templateClean = config.body_template
          .replace(/\{\{text\}\}/g, "__TEXT_PLACEHOLDER__")
          .replace(/\{\{number\}\}/g, "__NUMBER_PLACEHOLDER__");
        const parsed = JSON.parse(templateClean);

        const replacePlaceholders = (obj: any): any => {
          if (typeof obj === "string") {
            return obj.replace(/__TEXT_PLACEHOLDER__/g, text).replace(/__NUMBER_PLACEHOLDER__/g, phone);
          }
          if (Array.isArray(obj)) return obj.map(replacePlaceholders);
          if (obj && typeof obj === "object") {
            const result: any = {};
            for (const [k, v] of Object.entries(obj)) {
              result[k] = replacePlaceholders(v);
            }
            return result;
          }
          return obj;
        };

        bodyStr = JSON.stringify(replacePlaceholders(parsed));
      } catch {
        const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
        bodyStr = config.body_template.replace(/\{\{number\}\}/g, phone).replace(/\{\{text\}\}/g, escapedText);
      }

      const resp = await fetch(config.api_url, {
        method: "POST",
        headers: apiHeaders,
        body: bodyStr,
      });
      return resp;
    };

    let sentCount = 0;
    const errors: string[] = [];

    if (isGroupMode) {
      try {
        const resp = await sendText("group", message);
        if (resp.ok) sentCount++;
        else {
          const errText = await resp.text();
          errors.push(`Group send failed: ${resp.status} ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        errors.push(`Group error: ${e.message}`);
      }
    } else {
      for (const { phone, nickname } of phones) {
        const digits = phone.replace(/\D/g, "");
        const number = digits.startsWith("55") ? digits : `55${digits}`;
        try {
          const resp = await sendText(number, message);
          if (resp.ok) {
            sentCount++;
            console.log(`✓ Sent to ${nickname}`);
          } else {
            const errText = await resp.text();
            errors.push(`Failed for ${nickname}: ${resp.status}`);
            console.log(`✗ Failed for ${nickname}: ${resp.status} ${errText.substring(0, 100)}`);
          }
        } catch (e: any) {
          errors.push(`Error for ${nickname}: ${e.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, total: phones.length, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Send message error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
