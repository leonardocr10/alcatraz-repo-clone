import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://skytale-tools.vercel.app/assets/items";

// Category definitions: [name, slot, sort_order]
const CATEGORIES: [string, string, number][] = [
  ["Espadas", "arma_1m", 1],
  ["Machados", "arma_1m", 2],
  ["Martelos", "arma_1m", 3],
  ["Garras", "arma_1m", 4],
  ["Foices", "arma_1m", 5],
  ["Varinhas", "arma_1m", 6],
  ["Arcos", "arma_2m", 1],
  ["Lanças", "arma_2m", 2],
  ["Escudos", "escudo", 1],
  ["Orbitais", "escudo", 2],
  ["Armaduras", "armadura", 1],
  ["Roupões", "armadura", 2],
  ["Botas", "bota", 1],
  ["Luvas", "luva", 1],
  ["Braceletes", "bracelete", 1],
  ["Anéis", "anel_1", 1],
  ["Colares", "colar", 1],
];

// Items: [name, category_name, image_filename, slot_override?]
const ITEMS: [string, string, string, string?][] = [
  // === ESPADAS ===
  ["Slayer", "Espadas", "espadas/slayer.png"],
  ["Highlander", "Espadas", "espadas/highlander.png"],
  ["Espada Atroz", "Espadas", "espadas/espada_atroz.png"],
  ["Espada Dark", "Espadas", "espadas/espada_dark.png"],
  ["Espada Wyvern", "Espadas", "espadas/espada_wyvern80d.png"],
  ["Espada Titan", "Espadas", "espadas/espada_titan80c.png"],
  ["Espada das Trevas", "Espadas", "espadas/espada_das_trevas.png"],
  ["Espada Real", "Espadas", "espadas/espada_real.png"],
  ["Espada Gigante", "Espadas", "espadas/espada_gigante.png"],
  ["Espada Angelical", "Espadas", "espadas/espada_angelical.png"],
  ["Espada Sangrenta", "Espadas", "espadas/espada_sangrenta.png"],
  ["Espada Encantada", "Espadas", "espadas/espada_encantada.png"],
  ["Espada Infernal", "Espadas", "espadas/espada_infernal.png"],
  ["Espada Demoníaca", "Espadas", "espadas/espada_demoniaca.png"],
  ["Espada Antiga", "Espadas", "espadas/espada_antiga.png"],

  // === MACHADOS ===
  ["Machado de Guerra", "Machados", "machados/machado_de_guerra.png"],
  ["Machado Bárbaro", "Machados", "machados/machado_barbaro.png"],
  ["Machado Pesado", "Machados", "machados/machado_pesado.png"],
  ["Machado de Batalha", "Machados", "machados/machado_de_batalha.png"],
  ["Machado Gigante", "Machados", "machados/machado_gigante.png"],
  ["Machado Sangrento", "Machados", "machados/machado_sangrento.png"],
  ["Machado Titan", "Machados", "machados/machado_titan.png"],
  ["Machado Wyvern", "Machados", "machados/machado_wyvern.png"],
  ["Machado Infernal", "Machados", "machados/machado_infernal.png"],
  ["Machado Encantado", "Machados", "machados/machado_encantado.png"],

  // === MARTELOS ===
  ["Martelo de Guerra", "Martelos", "martelos/martelo_de_guerra.png"],
  ["Martelo Pesado", "Martelos", "martelos/martelo_pesado.png"],
  ["Martelo Gigante", "Martelos", "martelos/martelo_gigante.png"],
  ["Martelo Titan", "Martelos", "martelos/martelo_titan.png"],
  ["Martelo Sangrento", "Martelos", "martelos/martelo_sangrento.png"],

  // === GARRAS ===
  ["Garra Afiada", "Garras", "garras/garra_afiada.png"],
  ["Garra Demoníaca", "Garras", "garras/garra_demoniaca.png"],
  ["Garra Gigante", "Garras", "garras/garra_gigante.png"],
  ["Garra Sangrenta", "Garras", "garras/garra_sangrenta.png"],
  ["Garra Titan", "Garras", "garras/garra_titan.png"],
  ["Garra Wyvern", "Garras", "garras/garra_wyvern.png"],
  ["Garra Infernal", "Garras", "garras/garra_infernal.png"],
  ["Garra Encantada", "Garras", "garras/garra_encantada.png"],

  // === FOICES ===
  ["Foice da Morte", "Foices", "foices/foice_da_morte.png"],
  ["Foice Sombria", "Foices", "foices/foice_sombria.png"],
  ["Foice Gigante", "Foices", "foices/foice_gigante.png"],
  ["Foice Titan", "Foices", "foices/foice_titan.png"],
  ["Foice Sangrenta", "Foices", "foices/foice_sangrenta.png"],

  // === VARINHAS ===
  ["Varinha Mística", "Varinhas", "varinhas/varinha_mistica.png"],
  ["Varinha Arcana", "Varinhas", "varinhas/varinha_arcana.png"],
  ["Varinha Sagrada", "Varinhas", "varinhas/varinha_sagrada.png"],
  ["Varinha Titan", "Varinhas", "varinhas/varinha_titan.png"],
  ["Varinha Sangrenta", "Varinhas", "varinhas/varinha_sangrenta.png"],
  ["Varinha Encantada", "Varinhas", "varinhas/varinha_encantada.png"],
  ["Varinha Infernal", "Varinhas", "varinhas/varinha_infernal.png"],

  // === ARCOS ===
  ["Arco Longo", "Arcos", "arcos/arco_longo.png"],
  ["Arco Composto", "Arcos", "arcos/arco_composto.png"],
  ["Arco Élfico", "Arcos", "arcos/arco_elfico.png"],
  ["Arco Gigante", "Arcos", "arcos/arco_gigante.png"],
  ["Arco Titan", "Arcos", "arcos/arco_titan.png"],
  ["Arco Sangrento", "Arcos", "arcos/arco_sangrento.png"],
  ["Arco Wyvern", "Arcos", "arcos/arco_wyvern.png"],
  ["Arco Encantado", "Arcos", "arcos/arco_encantado.png"],
  ["Arco Infernal", "Arcos", "arcos/arco_infernal.png"],

  // === LANÇAS ===
  ["Lança de Combate", "Lanças", "lancas/lanca_de_combate.png"],
  ["Lança Pesada", "Lanças", "lancas/lanca_pesada.png"],
  ["Lança Gigante", "Lanças", "lancas/lanca_gigante.png"],
  ["Lança Titan", "Lanças", "lancas/lanca_titan.png"],
  ["Lança Sangrenta", "Lanças", "lancas/lanca_sangrenta.png"],

  // === ESCUDOS ===
  ["Escudo de Madeira", "Escudos", "escudos/escudo_de_madeira.png"],
  ["Escudo Kite", "Escudos", "escudos/escudo_kite.png"],
  ["Escudo Tower", "Escudos", "escudos/escudo_tower.png"],
  ["Scutum", "Escudos", "escudos/scutum.png"],
  ["Escudo do Chefe", "Escudos", "escudos/escudo_chefe.png"],
  ["Escudo Galatia", "Escudos", "escudos/escudo_galatia.png"],
  ["Escudo Alado", "Escudos", "escudos/escudo_alado.png"],
  ["Escudo Grande", "Escudos", "escudos/escudo_grande.png"],
  ["Escudo Espelho", "Escudos", "escudos/escudo_espelho.png"],
  ["Escudo Griffin", "Escudos", "escudos/escudo_griffin.png"],
  ["Escudo Exótico", "Escudos", "escudos/escudo_exotico.png"],
  ["Escudo Glacial", "Escudos", "escudos/escudo_glacial.png"],
  ["Escudo Simbólico", "Escudos", "escudos/escudo_simbolico.png"],
  ["Escudo Titan", "Escudos", "escudos/escudo_titan.png"],
  ["Escudo Místico", "Escudos", "escudos/escudo_mistico.png"],

  // === ORBITAIS ===
  ["Orbital Sagrado", "Orbitais", "orbitais/orbital_sagrado.png"],
  ["Orbital Sombrio", "Orbitais", "orbitais/orbital_sombrio.png"],
  ["Orbital Arcano", "Orbitais", "orbitais/orbital_arcano.png"],

  // === ARMADURAS ===
  ["Traje de Batalha", "Armaduras", "armaduras/traje_de_batalha.png"],
  ["Armadura de Couro", "Armaduras", "armaduras/armadura_de_couro.png"],
  ["Brigandine", "Armaduras", "armaduras/brigandine.png"],
  ["Armadura de Placas", "Armaduras", "armaduras/armadura_de_placas.png"],
  ["Armadura Pesada", "Armaduras", "armaduras/armadura_pesada.png"],
  ["Armadura de Batalha", "Armaduras", "armaduras/armadura_de_batalha.png"],
  ["Armadura Gigante", "Armaduras", "armaduras/armadura_gigante.png"],
  ["Armadura Titan", "Armaduras", "armaduras/armadura_titan.png"],
  ["Armadura Sangrenta", "Armaduras", "armaduras/armadura_sangrenta.png"],
  ["Armadura Real", "Armaduras", "armaduras/armadura_real.png"],
  ["Armadura Wyvern", "Armaduras", "armaduras/armadura_wyvern.png"],
  ["Armadura Encantada", "Armaduras", "armaduras/armadura_encantada.png"],
  ["Armadura Infernal", "Armaduras", "armaduras/armadura_infernal.png"],
  ["Armadura Demoníaca", "Armaduras", "armaduras/armadura_demoniaca80b.png"],
  ["Armadura Angelical", "Armaduras", "armaduras/armadura_angelical.png"],
  ["Armadura Antiga", "Armaduras", "armaduras/armadura_antiga.png"],
  ["Armadura Glacial", "Armaduras", "armaduras/armadura_glacial.png"],
  ["Armadura Mística", "Armaduras", "armaduras/armadura_mistica.png"],
  ["Armadura Sagrada", "Armaduras", "armaduras/armadura_sagrada.png"],

  // === ROUPÕES ===
  ["Roupão Sagrado", "Roupões", "roupoes/roupao_sagrado.png"],
  ["Roupão Arcano", "Roupões", "roupoes/roupao_arcano.png"],
  ["Roupão Místico", "Roupões", "roupoes/roupao_mistico.png"],

  // === BOTAS ===
  ["Botas Espinhosas", "Botas", "botas/botas_espinhosas.png"],
  ["Botas Grandes", "Botas", "botas/botas_grandes.png"],
  ["Botas Aladas", "Botas", "botas/botas_aladas.png"],
  ["Botas Titan", "Botas", "botas/botas_titan.png"],
  ["Botas Santas", "Botas", "botas/botas_santas.png"],
  ["Botas Wyvern", "Botas", "botas/botas_wyvern.png"],
  ["Botas Encantadas", "Botas", "botas/botas_encantadas.png"],
  ["Botas Reais", "Botas", "botas/botas_reais.png"],
  ["Botas Infernais", "Botas", "botas/botas_infernais.png"],
  ["Botas Monstruosas", "Botas", "botas/botas_monstruosas.png"],

  // === LUVAS ===
  ["Luvas Gigantes", "Luvas", "luvas/luvas_gigantes.png"],
  ["Luvas Titan", "Luvas", "luvas/luvas_titan.png"],
  ["Luvas Grandes", "Luvas", "luvas/luvas_grandes.png"],
  ["Luvas de Dragão", "Luvas", "luvas/luvas_de_dragao.png"],
  ["Luvas Santas", "Luvas", "luvas/luvas_santas.png"],
  ["Luvas de Demônio", "Luvas", "luvas/luvas_de_demonio.png"],
  ["Luvas Angelicais", "Luvas", "luvas/luvas_angelicais.png"],
  ["Luvas Antigas", "Luvas", "luvas/luvas_antigas.png"],
  ["Luvas Infernais", "Luvas", "luvas/luvas_infernais.png"],

  // === BRACELETES ===
  ["Bracelete da Justiça", "Braceletes", "braceletes/bracelete_da_justica.png"],
  ["Bracelete Sagrado", "Braceletes", "braceletes/bracelete_sagrado.png"],
  ["Bracelete Sombrio", "Braceletes", "braceletes/bracelete_sombrio.png"],
  ["Bracelete Místico", "Braceletes", "braceletes/bracelete_mistico.png"],
  ["Bracelete Arcano", "Braceletes", "braceletes/bracelete_arcano.png"],
  ["Bracelete Inferno", "Braceletes", "braceletes/bracelete_inferno.png"],
  ["Bracelete Celestial", "Braceletes", "braceletes/bracelete_celestial.png"],

  // === ANÉIS ===
  ["Anel Selado 1", "Anéis", "aneis/anel_selado_1.png"],
  ["Anel Selado 2", "Anéis", "aneis/anel_selado_2.png"],
  ["Anel Místico 1", "Anéis", "aneis/anel_mistico_1.png"],
  ["Anel Místico 2", "Anéis", "aneis/anel_mistico_2.png"],
  ["Anel Místico 3", "Anéis", "aneis/anel_mistico_3.png"],
  ["Anel Místico 4", "Anéis", "aneis/anel_mistico_4.png"],
  ["Anel do Valhalla", "Anéis", "aneis/anel_do_valhalla.png"],
  ["Anel do Trovão", "Anéis", "aneis/anel_do_trovao.png"],

  // === COLARES ===
  ["Colar Selado 1", "Colares", "colares/colar_selado_1.png"],
  ["Colar Selado 2", "Colares", "colares/colar_selado_2.png"],
  ["Colar Místico", "Colares", "colares/colar_mistico.png"],
  ["Colar Sagrado", "Colares", "colares/colar_sagrado.png"],
  ["Colar do Dragão", "Colares", "colares/colar_do_dragao.png"],
  ["Colar Arcano", "Colares", "colares/colar_arcano.png"],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Validate token using getClaims
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: hasAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Insert categories
    const categoryMap = new Map<string, string>();
    for (const [name, slot, sort_order] of CATEGORIES) {
      const { data, error } = await supabase
        .from("equipment_categories")
        .upsert({ name, slot, sort_order }, { onConflict: "name" })
        .select("id")
        .single();

      if (error) {
        // Try insert
        const { data: d2, error: e2 } = await supabase
          .from("equipment_categories")
          .insert({ name, slot, sort_order })
          .select("id")
          .single();
        if (e2) {
          // Already exists, fetch it
          const { data: d3 } = await supabase
            .from("equipment_categories")
            .select("id")
            .eq("name", name)
            .single();
          if (d3) categoryMap.set(name, d3.id);
        } else if (d2) {
          categoryMap.set(name, d2.id);
        }
      } else if (data) {
        categoryMap.set(name, data.id);
      }
    }

    // 2. Insert items
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [name, categoryName, imageFile, slotOverride] of ITEMS) {
      const categoryId = categoryMap.get(categoryName);
      if (!categoryId) {
        errors.push(`Category not found: ${categoryName}`);
        continue;
      }

      // Determine slot from category
      const catDef = CATEGORIES.find(c => c[0] === categoryName);
      const slot = slotOverride || (catDef ? catDef[1] : "arma_1m");

      const imageUrl = `${BASE}/${imageFile}`;

      // Check if already exists
      const { data: existing } = await supabase
        .from("equipment_items")
        .select("id")
        .eq("name", name)
        .eq("category_id", categoryId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("equipment_items")
        .insert({
          name,
          image_url: imageUrl,
          category_id: categoryId,
          slot,
        });

      if (error) {
        errors.push(`Failed to insert ${name}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categories: categoryMap.size,
        inserted,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
