CREATE TABLE public.clan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clan_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rules" ON public.clan_rules FOR SELECT USING (true);
CREATE POLICY "Admins can update rules" ON public.clan_rules FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert rules" ON public.clan_rules FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.clan_rules (content) VALUES ('📜 Regras do Clã

Para manter um ambiente saudável e o crescimento de todos os membros, pedimos que todos respeitem as regras abaixo:

🤝 Respeito entre os membros
Todos os integrantes devem manter respeito uns com os outros.
Discussões, ofensas ou atitudes tóxicas não serão toleradas.

🕊️ Clã Pacífico (até o nível 105)
Nosso clã tem postura pacífica até o nível 105, com foco total em upar e fortalecer os membros.
No entanto, caso sejamos atacados, é permitido revidar.

⚠️ Evitar conflitos desnecessários
Não iniciar confusões ou guerras com outros jogadores ou clãs.
Uma guerra neste momento pode prejudicar o progresso e o up de outros membros do clã.

💰 Prioridade de comércio dentro do clã
Sempre que possível, priorize vender ou trocar itens primeiro com membros do clã.
Caso ninguém tenha interesse, então negocie com jogadores de fora.');