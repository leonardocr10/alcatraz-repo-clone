
SELECT cron.schedule(
  'scrape-history-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pmofvoekrrskgurydtnp.supabase.co/functions/v1/scrape-history',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtb2Z2b2VrcnJza2d1cnlkdG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDk0NTMsImV4cCI6MjA4ODQ4NTQ1M30.a8SB38ryN9X06nhIFgSSDCLGYpB-vzD7eyZ8Z9PBV4I"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
