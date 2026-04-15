-- Ensure WhatsApp body template uses dynamic destination placeholder.
UPDATE public.whatsapp_config
SET body_template = '{"text":"{{text}}","number":"{{number}}","options":{"delay":100,"createChat":true},"session":"testeleo"}'
WHERE id IS NOT NULL;
