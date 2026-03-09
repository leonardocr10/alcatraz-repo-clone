import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Clan = { id: string; name: string; created_at: string };

export function useClans() {
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClans = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clans")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    setClans((data as Clan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClans();
  }, []);

  return { clans, loading, refetch: fetchClans };
}
