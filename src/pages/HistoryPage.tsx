import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollText, RefreshCw, Package, TrendingUp, Calendar, User, MapPin, Crown, Search, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ItemDetail {
  nick: string;
  map: string;
  boss: string | null;
  source: string;
  time: string;
}

interface ItemCount {
  name: string;
  count: number;
  details: ItemDetail[];
}

interface DayData {
  date: string;
  total: number;
  items: ItemCount[];
}

interface HistoryData {
  today: DayData;
  yesterday: DayData;
  scrapedAt: string;
  pagesScraped: number;
}

function filterDay(day: DayData, nickFilter: string | null, mapFilter: string | null, itemFilter: string | null): DayData {
  if (!nickFilter && !mapFilter && !itemFilter) return day;

  const items: ItemCount[] = [];
  let total = 0;

  for (const item of day.items) {
    if (itemFilter && item.name !== itemFilter) continue;
    const filtered = item.details.filter((d) => {
      if (nickFilter && !d.nick.toLowerCase().includes(nickFilter.toLowerCase())) return false;
      if (mapFilter && d.map !== mapFilter) return false;
      return true;
    });
    if (filtered.length > 0) {
      items.push({ name: item.name, count: filtered.length, details: filtered });
      total += filtered.length;
    }
  }

  items.sort((a, b) => b.count - a.count);
  return { date: day.date, total, items };
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [yesterdayOpen, setYesterdayOpen] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ItemCount | null>(null);
  const [nickFilter, setNickFilter] = useState<string | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [mapFilter, setMapFilter] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = useCallback(async (showToast = false) => {
    try {
      const { data: result, error } = await supabase.functions.invoke("scrape-history");
      if (error) throw error;
      const r = result as any;
      const normalize = (day: any) => ({
        ...day,
        items: (day?.items || []).map((item: any) => ({
          ...item,
          details: item.details || [],
        })),
      });
      setData({
        today: normalize(r?.today),
        yesterday: normalize(r?.yesterday),
        scrapedAt: r?.scrapedAt || new Date().toISOString(),
        pagesScraped: r?.pagesScraped || 0,
      });
      if (showToast) toast.success("Histórico atualizado!");
    } catch (err: any) {
      console.error("Error fetching history:", err);
      if (showToast) toast.error(err.message || "Erro ao buscar histórico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => fetchHistory(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Extract unique nicks and maps from all data
  const { allNicks, allMaps } = useMemo(() => {
    if (!data) return { allNicks: [] as string[], allMaps: [] as string[] };
    const nicks = new Set<string>();
    const maps = new Set<string>();
    const collectFromDay = (day: DayData) => {
      for (const item of day.items) {
        for (const d of item.details) {
          nicks.add(d.nick);
          maps.add(d.map);
        }
      }
    };
    collectFromDay(data.today);
    collectFromDay(data.yesterday);
    return {
      allNicks: [...nicks].sort((a, b) => a.localeCompare(b)),
      allMaps: [...maps].sort((a, b) => a.localeCompare(b)),
    };
  }, [data]);

  const filteredToday = useMemo(() => data ? filterDay(data.today, nickFilter, mapFilter) : null, [data, nickFilter, mapFilter]);
  const filteredYesterday = useMemo(() => data ? filterDay(data.yesterday, nickFilter, mapFilter) : null, [data, nickFilter, mapFilter]);

  const hasActiveFilter = !!nickFilter || !!mapFilter;

  const formatScrapedAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const renderDaySection = (
    day: DayData,
    label: string,
    open: boolean,
    setOpen: (v: boolean) => void,
    icon: React.ReactNode
  ) => (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 border-b border-border/40 flex items-center justify-between hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-2">
              {icon}
              <div className="text-left">
                <span className="font-display text-sm font-extrabold uppercase tracking-wider block">{label}</span>
                <span className="text-[10px] text-muted-foreground font-body">{day.date}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-extrabold text-primary tabular-nums">{day.total}</span>
              <span className="text-[10px] text-muted-foreground">drops</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {day.items.length > 0 ? (
            <div className="divide-y divide-border/10">
              {day.items.map((item, i) => (
                <button
                  key={item.name}
                  onClick={() => setSelectedItem(item)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-display font-bold text-muted-foreground w-5 text-right tabular-nums shrink-0">
                      {i + 1}
                    </span>
                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-display font-bold text-foreground truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-display font-extrabold text-primary tabular-nums">{item.count}</span>
                    {day.total > 0 && (
                      <span className="text-[10px] text-muted-foreground font-body tabular-nums w-10 text-right">
                        {((item.count / day.total) * 100).toFixed(0)}%
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground font-body">Nenhum drop registrado</p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Histórico</h2>
            <p className="text-xs text-muted-foreground font-body">
              Drops do servidor
              {data && ` • Atualizado às ${formatScrapedAt(data.scrapedAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-display font-bold px-3 py-1.5 rounded-xl transition-colors ${
              hasActiveFilter
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilter && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                {(nickFilter ? 1 : 0) + (mapFilter ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => { setLoading(true); fetchHistory(true); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-display font-bold text-primary px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && data && (
        <div className="glass-card p-3 space-y-3">
          {hasActiveFilter && (
            <button
              onClick={() => { setNickFilter(null); setMapFilter(null); }}
              className="text-[10px] font-display font-bold text-destructive flex items-center gap-1 hover:underline"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}

          {/* Nick filter */}
          <div>
            <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" /> Jogador
            </p>
            <div className="flex flex-wrap gap-1">
              {allNicks.map((nick) => (
                <button
                  key={nick}
                  onClick={() => setNickFilter(nickFilter === nick ? null : nick)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-display font-bold transition-colors ${
                    nickFilter === nick
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/50 text-muted-foreground border border-border/20 hover:bg-secondary/80"
                  }`}
                >
                  {nick}
                </button>
              ))}
            </div>
          </div>

          {/* Map filter */}
          <div>
            <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Mapa
            </p>
            <div className="flex flex-wrap gap-1">
              {allMaps.map((map) => (
                <button
                  key={map}
                  onClick={() => setMapFilter(mapFilter === map ? null : map)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-display font-bold transition-colors ${
                    mapFilter === map
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/50 text-muted-foreground border border-border/20 hover:bg-secondary/80"
                  }`}
                >
                  {map}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active filter badges */}
      {hasActiveFilter && !showFilters && (
        <div className="flex flex-wrap gap-1.5">
          {nickFilter && (
            <button onClick={() => setNickFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/15 text-primary text-[10px] font-display font-bold border border-primary/20">
              <User className="w-3 h-3" /> {nickFilter} <X className="w-3 h-3" />
            </button>
          )}
          {mapFilter && (
            <button onClick={() => setMapFilter(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/15 text-primary text-[10px] font-display font-bold border border-primary/20">
              <MapPin className="w-3 h-3" /> {mapFilter} <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground font-body">Buscando histórico do servidor...</p>
        </div>
      ) : data && filteredToday && filteredYesterday ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass-card p-3 text-center">
              <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Hoje</p>
              <p className="text-2xl font-display font-extrabold text-primary tabular-nums mt-1">{filteredToday.total}</p>
              <p className="text-[10px] text-muted-foreground">{filteredToday.items.length} itens</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Ontem</p>
              <p className="text-2xl font-display font-extrabold text-gold tabular-nums mt-1">{filteredYesterday.total}</p>
              <p className="text-[10px] text-muted-foreground">{filteredYesterday.items.length} itens</p>
            </div>
          </div>

          {/* Today */}
          {renderDaySection(filteredToday, "Hoje", todayOpen, setTodayOpen, <TrendingUp className="w-4 h-4 text-primary" />)}

          {/* Yesterday */}
          {renderDaySection(filteredYesterday, "Ontem", yesterdayOpen, setYesterdayOpen, <Calendar className="w-4 h-4 text-gold" />)}

          <p className="text-center text-[10px] text-muted-foreground font-body">
            Atualiza automaticamente a cada 5 minutos
          </p>
        </>
      ) : (
        <div className="glass-card p-10 text-center">
          <p className="text-muted-foreground font-body text-sm">Erro ao carregar histórico</p>
        </div>
      )}

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-extrabold uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {selectedItem?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedItem?.count} drop{selectedItem && selectedItem.count > 1 ? "s" : ""} registrado{selectedItem && selectedItem.count > 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6 divide-y divide-border/10">
            {selectedItem?.details.map((d, i) => (
              <div key={i} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-display font-bold text-foreground">{d.nick}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-body tabular-nums">{d.time}</span>
                </div>
                <div className="flex items-center gap-2 pl-5.5">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-body">{d.map}</span>
                </div>
                {d.boss && (
                  <div className="flex items-center gap-2 pl-5.5">
                    <Crown className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] text-primary font-display font-bold">{d.boss}</span>
                  </div>
                )}
                {d.source === 'Boss' && !d.boss && (
                  <div className="flex items-center gap-2 pl-5.5">
                    <Crown className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] text-primary font-body">Boss drop</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
