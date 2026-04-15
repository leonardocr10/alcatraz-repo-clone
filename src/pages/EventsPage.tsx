import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClans } from "@/hooks/useClans";
import { Calendar, Users, Plus, CheckCircle2, XCircle, Image as ImageIcon, Loader2, Clock, Trash2, MessageCircle, Copy, Megaphone, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerCharModal } from "@/components/PlayerCharModal";

type ClassSummaryPlayer = {
  name: string;
  className: string;
  imageUrl: string | null;
};

type ClassSummaryItem = {
  className: string;
  imageUrl: string | null;
  players: ClassSummaryPlayer[];
};

export default function EventsPage() {
  const { isAdmin, isLeader, profile } = useAuth();
  const { clans } = useClans();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateAnnouncementModal, setShowCreateAnnouncementModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [showClassSummaryModal, setShowClassSummaryModal] = useState(false);
  const [showAnnouncementReadsModal, setShowAnnouncementReadsModal] = useState(false);
  
  // Create form
  const [title, setTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementClan, setAnnouncementClan] = useState("");
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [announcementReads, setAnnouncementReads] = useState<any[]>([]);
  const [announcementPending, setAnnouncementPending] = useState<any[]>([]);
  const [loadingAnnouncementReads, setLoadingAnnouncementReads] = useState(false);

  // Attendees
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendeesStatusFilter, setAttendeesStatusFilter] = useState<"all" | "confirmed" | "declined">("all");
  const [attendeesSearch, setAttendeesSearch] = useState("");
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [loadingClassSummary, setLoadingClassSummary] = useState(false);
  const [sendingPendingReminder, setSendingPendingReminder] = useState(false);
  const [sendingConfirmedCall, setSendingConfirmedCall] = useState(false);
  const [classSummary, setClassSummary] = useState<ClassSummaryItem[]>([]);
  const [selectedClassSummary, setSelectedClassSummary] = useState<string | null>(null);
  const attendeesRequestRef = useRef(0);
  const myPresenceRequestRef = useRef(0);
  const classSummaryRequestRef = useRef(0);

  // My Presence Modal State
  const [showMyPresenceModal, setShowMyPresenceModal] = useState(false);
  const [myPresence, setMyPresence] = useState<any | null>(null);
  const [myReason, setMyReason] = useState("");
  const [isChangingToNo, setIsChangingToNo] = useState(false);
  
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{id: string, name: string} | null>(null);
  const canManageEvents = isAdmin || isLeader;
  const canManageAnnouncements = isAdmin || isLeader;

  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPresenceTime = (presence: any) => {
    const raw = presence?.updated_at || presence?.created_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(ts) ? 0 : ts;
  };

  const getPresenceKey = (presence: any) => {
    return presence?.user_id || presence?.users?.id || presence?.users?.nickname || null;
  };

  const dedupePresences = (presenceList: any[]) => {
    const uniqueMap = new Map<string, any>();

    (presenceList || []).forEach((presence, index) => {
      const key = getPresenceKey(presence) || `__no_user__${presence?.id || presence?.created_at || index}`;

      const previous = uniqueMap.get(key);
      if (!previous || getPresenceTime(presence) >= getPresenceTime(previous)) {
        uniqueMap.set(key, presence);
      }
    });

    return Array.from(uniqueMap.values());
  };

  const handleUpdatePresence = async (status: 'confirmed' | 'declined') => {
    if (status === 'declined' && !myReason.trim()) {
      toast.error("Por favor, informe a justificativa.");
      return;
    }
    try {
      const payload = {
        event_id: selectedEvent.id,
        user_id: profile!.id,
        status,
        reason: status === 'declined' ? myReason.trim() : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from("event_presences")
        .upsert(payload, { onConflict: "event_id,user_id" });
      if (error) throw error;
      
      toast.success("Presença atualizada com sucesso!");
      setShowMyPresenceModal(false);
      // Optional: Refresh local view
      if (showAttendeesModal) viewAttendees(selectedEvent);
    } catch(err: any){
      toast.error("Erro ao atualizar presença: " + err.message);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          creator:created_by (id, clan),
          event_presences(id, status, user_id)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      const today = getLocalDateString();
      const expiredActiveIds = (data || [])
        .filter((ev: any) => Boolean(ev.is_active) && Boolean(ev.event_date) && ev.event_date < today)
        .map((ev: any) => ev.id);

      if (isAdmin && expiredActiveIds.length > 0) {
        const { error: closeError } = await supabase
          .from("events")
          .update({ is_active: false })
          .in("id", expiredActiveIds);

        if (closeError) {
          console.warn("Erro ao encerrar eventos expirados automaticamente:", closeError);
        }
      }

      const normalizedEvents = (data || []).map((ev: any) => ({
        ...ev,
        // Treat past-date events as closed in UI even if remote flag lags.
        is_active: Boolean(ev.is_active) && !(Boolean(ev.event_date) && ev.event_date < today),
        event_presences: dedupePresences(ev.event_presences || []),
      }));
      const scopedEvents = isAdmin
        ? normalizedEvents
        : normalizedEvents.filter((ev: any) => ev?.creator?.clan && ev.creator.clan === profile?.clan);
      setEvents(scopedEvents);
    } catch (err: any) {
      toast.error("Erro ao buscar eventos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Both admins and normal users can see the events list, but admins can manage
    fetchEvents();
  }, [profile?.clan, isAdmin]);

  useEffect(() => {
    if (!announcementClan) {
      if (profile?.clan) setAnnouncementClan(profile.clan);
      else if (clans[0]?.name) setAnnouncementClan(clans[0].name);
    }
  }, [announcementClan, profile?.clan, clans]);

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      let query = (supabase as any)
        .from("clan_announcements")
        .select("id, clan, title, content, is_active, require_ack, created_at, created_by, creator:created_by (nickname)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isAdmin && profile?.clan) {
        query = query.eq("clan", profile.clan);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      toast.error("Erro ao buscar comunicados: " + err.message);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [profile?.clan, isAdmin]);

  const createAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const clanTarget = isLeader ? profile?.clan : announcementClan;
    if (!canManageAnnouncements || !profile?.id) return;
    if (!clanTarget) {
      toast.error("Selecione um clã para o comunicado.");
      return;
    }
    if (!announcementTitle.trim() || !announcementContent.trim()) {
      toast.error("Preencha título e conteúdo.");
      return;
    }

    setCreatingAnnouncement(true);
    try {
      const { error } = await (supabase as any).from("clan_announcements").insert({
        clan: clanTarget,
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        is_active: true,
        require_ack: true,
        created_by: profile.id,
      });
      if (error) throw error;

      toast.success("Comunicado criado! Será exibido no login até darem ciência.");
      setShowCreateAnnouncementModal(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      await fetchAnnouncements();
    } catch (err: any) {
      toast.error("Erro ao criar comunicado: " + err.message);
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const viewAnnouncementReads = async (announcement: any) => {
    setSelectedAnnouncement(announcement);
    setShowAnnouncementReadsModal(true);
    setLoadingAnnouncementReads(true);
    setAnnouncementReads([]);
    setAnnouncementPending([]);

    try {
      const [
        { data: reads, error: readsError },
        { data: clanUsers, error: clanUsersError },
      ] = await Promise.all([
        (supabase as any)
          .from("clan_announcement_reads")
          .select("announcement_id, user_id, read_at, users:user_id (id, nickname, class)")
          .eq("announcement_id", announcement.id)
          .order("read_at", { ascending: false }),
        (supabase as any)
          .from("users")
          .select("id, nickname, class")
          .eq("approved", true)
          .eq("clan", announcement.clan)
          .order("nickname", { ascending: true }),
      ]);

      if (readsError) throw readsError;
      if (clanUsersError) throw clanUsersError;

      const readsList = reads || [];
      const readSet = new Set(readsList.map((item: any) => item.user_id));
      const pendingList = (clanUsers || []).filter((u: any) => !readSet.has(u.id));

      setAnnouncementReads(readsList);
      setAnnouncementPending(pendingList);
    } catch (err: any) {
      toast.error("Erro ao buscar ciência do comunicado: " + err.message);
      setShowAnnouncementReadsModal(false);
    } finally {
      setLoadingAnnouncementReads(false);
    }
  };

  const handleDeleteAnnouncement = async (announcement: any) => {
    if (!canManageAnnouncements) return;

    try {
      let query = (supabase as any)
        .from("clan_announcements")
        .update({ is_active: false })
        .eq("id", announcement.id);

      if (!isAdmin && profile?.clan) {
        query = query.eq("clan", profile.clan);
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Comunicado removido.");
      setAnnouncements((prev) => prev.filter((item) => item.id !== announcement.id));
      if (selectedAnnouncement?.id === announcement.id) {
        setShowAnnouncementReadsModal(false);
      }
    } catch (err: any) {
      toast.error("Erro ao remover comunicado: " + (err?.message || "tente novamente."));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      let finalPhotoUrl = photoUrl.trim() || null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `${profile.id}/${safeName}`;
        const { error: uploadError } = await supabase.storage.from("event_images").upload(path, photoFile, {
          upsert: true,
          contentType: photoFile.type || undefined,
        });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("event_images").getPublicUrl(path);
        finalPhotoUrl = data.publicUrl;
      }

      const payload = {
        title,
        photo_url: finalPhotoUrl,
        event_date: eventDate,
        event_time: eventTime || null,
        is_active: isActive,
        created_by: profile.id
      };
      const { error } = await supabase.from("events").insert([payload]);
      if (error) throw error;
      
      toast.success("Evento criado com sucesso!");
      setShowCreateModal(false);
      
      // Reset
      setTitle("");
      setPhotoUrl("");
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setEventDate("");
      setEventTime("");
      setIsActive(true);

      fetchEvents();
    } catch (err: any) {
      toast.error("Erro ao criar evento: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!canManageEvents) return;
    try {
      const { error } = await supabase.from("events").update({ is_active: !currentStatus }).eq("id", id);
      if (error) throw error;
      toast.success(currentStatus ? "Evento inativado!" : "Evento ativado!");
      fetchEvents();
    } catch (err: any) {
      toast.error("Erro ao atualizar evento: " + err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Certeza que deseja excluir este evento? Todas as presenças confirmadas serão apagadas permanentemente!")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Evento excluído!");
      fetchEvents();
      if (selectedEvent?.id === id) {
          setShowAttendeesModal(false);
      }
    } catch (err: any) {
      toast.error("Erro ao excluir evento: " + err.message);
    }
  };

  const handleClearPresences = async (eventId: string) => {
    if (!window.confirm("Certeza que deseja remover TODAS as presenças deste evento? A lista ficará vazia.")) return;
    try {
      const { error } = await supabase.from("event_presences").delete().eq("event_id", eventId);
      if (error) throw error;
      toast.success("Lista de presenças limpa!");
      fetchEvents();
      setAttendees([]); // Update modal UI immediately
    } catch (err: any) {
      toast.error("Erro ao limpar presenças: " + err.message);
    }
  };

  const viewAttendees = async (event: any, statusFilter: "all" | "confirmed" | "declined" = "all") => {
    const eventId = event.id;
    const requestId = ++attendeesRequestRef.current;
    setSelectedEvent(event);
    setShowAttendeesModal(true);
    setAttendeesStatusFilter(statusFilter);
    setAttendeesSearch("");
    setLoadingAttendees(true);
    setAttendees([]); // Clear previous attendees immediately
    try {
      // Fetch event presences and join with users to get nickname, class
      const { data, error } = await supabase
        .from("event_presences")
        .select(`
          user_id,
          status,
          reason,
          created_at,
          updated_at,
          users:user_id (id, nickname, class, avatar_url)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      
      const atts = dedupePresences(data || []);
      
      // Fetch levels from alcatraz_members by matching nickname
      const nicknames = atts.map((d: any) => d.users?.nickname).filter(Boolean);
      if (nicknames.length > 0) {
        const { data: members } = await supabase
          .from("alcatraz_members" as any)
          .select("name, level")
          .in("name", nicknames);
          
        if (members) {
          const levelMap = new Map((members as any[]).map(m => [m.name, m.level]));
          atts.forEach((d: any) => {
             if (d.users) d.users.level = levelMap.get(d.users.nickname) || null;
          });
        }
      }

      const classes = [...new Set(atts.map((d: any) => d.users?.class).filter(Boolean))];
      if (classes.length > 0) {
        const { data: classImages } = await supabase
          .from("character_classes")
          .select("name, image_url")
          .in("name", classes as any[]);

        if (classImages) {
          const classImageMap = new Map(classImages.map((item) => [item.name, item.image_url]));
          atts.forEach((d: any) => {
            if (d.users?.class && !d.users?.avatar_url) {
              d.users.class_image_url = classImageMap.get(d.users.class) || null;
            }
          });
        }
      }
      
      if (requestId !== attendeesRequestRef.current) return;
      setAttendees(atts);
    } catch (err: any) {
      toast.error("Erro ao buscar participantes: " + err.message);
    } finally {
      if (requestId !== attendeesRequestRef.current) return;
      setLoadingAttendees(false);
    }
  };

  const filteredAttendees = attendees.filter((att) => {
    if (attendeesStatusFilter !== "all" && att.status !== attendeesStatusFilter) {
      return false;
    }

    const query = attendeesSearch.trim().toLowerCase();
    if (!query) return true;

    const nickname = (att.users?.nickname || "").toLowerCase();
    const className = (att.users?.class || "").toLowerCase();
    const reason = (att.reason || "").toLowerCase();
    return nickname.includes(query) || className.includes(query) || reason.includes(query);
  });

  const attendeesFilterLabel = attendeesStatusFilter === "confirmed"
    ? "Confirmados"
    : attendeesStatusFilter === "declined"
      ? "Não vão"
      : "Lista de Presenças";

  const openMyPresence = async (ev: any) => {
     const eventId = ev.id;
     const requestId = ++myPresenceRequestRef.current;
     setSelectedEvent(ev);
     setShowMyPresenceModal(true);
     setShowAttendeesModal(false); // close attendees list if opened from there
     setLoadingAttendees(true);
     setIsChangingToNo(false);
     setMyPresence(null); // Clear previous data
     setMyReason(""); // Clear previous reason
     try {
       const { data } = await supabase
         .from("event_presences")
         .select("*")
         .eq("event_id", eventId)
         .eq("user_id", profile?.id)
         .order("updated_at", { ascending: false })
         .limit(1)
         .maybeSingle();
       if (requestId !== myPresenceRequestRef.current) return;
       setMyPresence(data || null);
       setMyReason(data?.reason || "");
     } catch {
       //
     } finally {
       if (requestId !== myPresenceRequestRef.current) return;
       setLoadingAttendees(false);
     }
  };

  const openClassSummary = async (event: any) => {
    const eventId = event.id;
    const requestId = ++classSummaryRequestRef.current;
    setSelectedEvent(event);
    setShowClassSummaryModal(true);
    setLoadingClassSummary(true);
    setSelectedClassSummary(null);
    setClassSummary([]); // Clear previous class summary

    try {
      const { data, error } = await supabase
        .from("event_presences")
        .select(`
          user_id,
          status,
          users:user_id (id, nickname, class)
        `)
        .eq("event_id", eventId);

      if (error) throw error;

      const confirmed = dedupePresences(data || []).filter((item: any) => item.status === "confirmed");
      const classNames = [...new Set(confirmed.map((item: any) => item.users?.class).filter(Boolean))];
      const { data: classImages, error: classImagesError } = await supabase
        .from("character_classes")
        .select("name, image_url")
        .in("name", classNames as any[]);

      if (classImagesError) throw classImagesError;

      const classImageMap = new Map((classImages || []).map((item) => [item.name, item.image_url]));
      const grouped = new Map<string, ClassSummaryPlayer[]>();

      confirmed.forEach((item: any) => {
        const className = item.users?.class || "Sem Classe";
        const playerName = item.users?.nickname;
        if (!playerName) return;
        const players = grouped.get(className) || [];
        players.push({
          name: playerName,
          className,
          imageUrl: classImageMap.get(className as any) || null,
        });
        grouped.set(className, players);
      });

      const summaryWithoutAll = Array.from(grouped.entries())
        .map(([className, players]) => ({
          className,
          imageUrl: classImageMap.get(className as any) || null,
          players: players.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        }))
        .sort((a, b) => b.players.length - a.players.length || a.className.localeCompare(b.className, "pt-BR"));

      const allPlayers = summaryWithoutAll.flatMap((item) => item.players)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      const summary = [
        {
          className: "Todos",
          imageUrl: null,
          players: allPlayers,
        },
        ...summaryWithoutAll,
      ];

      if (requestId !== classSummaryRequestRef.current) return;
      setClassSummary(summary);
      if (summary.length > 0) {
        setSelectedClassSummary(summary[0].className);
      }
    } catch (err: any) {
      toast.error("Erro ao buscar presenças por classe: " + err.message);
      setShowClassSummaryModal(false);
    } finally {
      if (requestId !== classSummaryRequestRef.current) return;
      setLoadingClassSummary(false);
    }
  };

  const handleShareWhatsApp = async (event: any) => {
    try {
      const [{ data: presences, error: presencesError }, { data: users, error: usersError }] = await Promise.all([
        supabase
          .from("event_presences")
          .select(`
            status,
            users:user_id (id, nickname, class)
          `)
          .eq("event_id", event.id),
        supabase
          .from("users")
          .select("id, nickname, class")
          .eq("approved", true)
          .order("nickname", { ascending: true }),
      ]);

      if (presencesError) throw presencesError;
      if (usersError) throw usersError;

      const presenceList = dedupePresences(presences || []);
      const approvedUsers = users || [];

      const confirmedCount = presenceList.filter((item: any) => item.status === "confirmed").length;
      const declinedCount = presenceList.filter((item: any) => item.status === "declined").length;
      const respondedIds = new Set(
        presenceList
          .map((item: any) => item.users?.id)
          .filter(Boolean)
      );

      const pendingUsers = approvedUsers.filter((user: any) => !respondedIds.has(user.id));

      const pendingLines = pendingUsers.length > 0
        ? pendingUsers.map((user: any) => `- ${user.nickname} (${user.class || "Sem Classe"})`).join("\n")
        : "Todos já responderam.";

      const message = [
        `*Presenças do evento:* ${event.title}`,
        `*Data:* ${format(new Date(event.event_date + "T00:00:00"), "dd/MM/yyyy")}${event.event_time ? ` às ${event.event_time.slice(0, 5)}` : ""}`,
        "",
        `*Confirmados:* ${confirmedCount}`,
        `*Não vão:* ${declinedCount}`,
        `*Ainda não confirmaram:* ${pendingUsers.length}`,
        "",
        "*Pendentes:*",
        pendingLines,
      ].join("\n");

      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erro ao preparar compartilhamento no WhatsApp");
    }
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyConfirmedChars = async () => {
    const confirmedCharsRaw = attendees
      .filter((att: any) => att.status === "confirmed" && att.users?.nickname)
      .map((att: any) => ({
        nickname: att.users.nickname,
        className: att.users.class || "Sem Classe",
      }));

    const uniqueConfirmedChars = Array.from(
      new Map(
        confirmedCharsRaw.map((player: { nickname: string; className: string }) => [
          `${player.className.trim().toLowerCase()}::${player.nickname.trim().toLowerCase()}`,
          player,
        ])
      ).values()
    )
      .sort((a: { nickname: string }, b: { nickname: string }) => a.nickname.localeCompare(b.nickname, "pt-BR"));

    if (uniqueConfirmedChars.length === 0) {
      toast.error("Nenhum char confirmado para copiar.");
      return;
    }

    const eventDateLabel = selectedEvent?.event_date
      ? format(new Date(selectedEvent.event_date + "T00:00:00"), "dd/MM/yyyy")
      : "Data não informada";
    const eventTimeLabel = selectedEvent?.event_time
      ? ` às ${selectedEvent.event_time.slice(0, 5)}`
      : "";

    const numberedList = uniqueConfirmedChars
      .map((player: { nickname: string; className: string }, index: number) => `${index + 1}. ${player.className} - ${player.nickname}`)
      .join("\n");

    const copyContent = [
      "Confirmados",
      `Evento: ${selectedEvent?.title || "Não informado"}`,
      `Data: ${eventDateLabel}${eventTimeLabel}`,
      "",
      numberedList,
    ].join("\n");

    try {
      await copyTextToClipboard(copyContent);
      toast.success(`${uniqueConfirmedChars.length} chars confirmados copiados.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao copiar chars confirmados.");
    }
  };

  const handleSendPendingReminder = async (event: any) => {
    setSendingPendingReminder(true);
    try {
      const eventClan = event?.creator?.clan || profile?.clan || null;
      const [
        { data: presences, error: presencesError },
        { data: users, error: usersError },
        { data: whatsConfig, error: whatsConfigError },
      ] = await Promise.all([
        supabase
          .from("event_presences")
          .select("user_id")
          .eq("event_id", event.id),
        supabase
          .from("users")
          .select("id, nickname, phone, whatsapp_optout")
          .eq("approved", true)
          .eq("clan", eventClan),
        supabase
          .from("whatsapp_config")
          .select("allow_user_optout")
          .limit(1)
          .maybeSingle(),
      ]);

      if (presencesError) throw presencesError;
      if (usersError) throw usersError;
      if (whatsConfigError) throw whatsConfigError;

      const respondedIds = new Set((presences || []).map((item: any) => item.user_id).filter(Boolean));
      const allowOptout = Boolean(whatsConfig?.allow_user_optout);

      const pendingUsers = (users || []).filter((user: any) => !respondedIds.has(user.id));
      const recipients = pendingUsers
        .filter((user: any) => {
          const digits = user.phone?.replace(/\D/g, "") || "";
          if (digits.length < 10) return false;
          if (allowOptout && user.whatsapp_optout) return false;
          return true;
        })
        .map((user: any) => ({
          phone: user.phone,
          nickname: user.nickname,
        }));

      if (recipients.length === 0) {
        toast.error("Nenhum pendente com telefone válido para envio.");
        return;
      }

      const message = [
        `Olá! Você ainda não confirmou sua presença no evento ${event.title}.`,
        "Entre no app e confirme se vai participar.",
        typeof window !== "undefined" ? window.location.origin : "Clan Panel",
      ].join("\n");

      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          phones: recipients,
          message,
          clan: eventClan,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const skippedCount = pendingUsers.length - recipients.length;
      toast.success(`Lembrete enviado para ${data.sent}/${data.total} pendentes${skippedCount > 0 ? ` • ${skippedCount} pulados` : ""}!`);
      if (data?.errors?.length) {
        console.warn("Pending reminder errors:", data.errors);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar lembrete para pendentes");
    } finally {
      setSendingPendingReminder(false);
    }
  };

  const handleSendConfirmedDiscordCall = async (event: any) => {
    setSendingConfirmedCall(true);
    try {
      const eventClan = event?.creator?.clan || profile?.clan || null;
      const [
        { data: presences, error: presencesError },
        { data: whatsConfig, error: whatsConfigError },
        { data: clanDiscord, error: clanDiscordError },
      ] = await Promise.all([
        supabase
          .from("event_presences")
          .select(`
            user_id,
            status,
            users:user_id (phone, nickname, whatsapp_optout)
          `)
          .eq("event_id", event.id),
        supabase
          .from("whatsapp_config")
          .select("allow_user_optout")
          .limit(1)
          .maybeSingle(),
        eventClan
          ? (supabase as any).from("clan_discord_links").select("discord_link").eq("clan", eventClan).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (presencesError) throw presencesError;
      if (whatsConfigError) throw whatsConfigError;
      if (clanDiscordError) throw clanDiscordError;

      const allowOptout = Boolean(whatsConfig?.allow_user_optout);
      const discordInvite = clanDiscord?.discord_link || "https://discord.gg/YRhAa4mG";
      const confirmedPresences = dedupePresences(presences || []).filter((item: any) => item.status === "confirmed");

      const recipients = confirmedPresences
        .filter((item: any) => {
          const digits = item.users?.phone?.replace(/\D/g, "") || "";
          if (digits.length < 10) return false;
          if (allowOptout && item.users?.whatsapp_optout) return false;
          return true;
        })
        .map((item: any) => ({
          phone: item.users.phone,
          nickname: item.users.nickname,
        }));

      if (recipients.length === 0) {
        toast.error("Nenhum confirmado com telefone válido para envio.");
        return;
      }

      const message = [
        `BC confirmado: ${event.title}`,
        "Quem confirmou precisa logar no Discord:",
        discordInvite,
        "e logar no PT e ficar em richatem no mestre do clã.",
      ].join("\n");

      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          phones: recipients,
          message,
          clan: eventClan,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const skippedCount = confirmedPresences.length - recipients.length;
      toast.success(`Aviso enviado para ${data.sent}/${data.total} confirmados${skippedCount > 0 ? ` • ${skippedCount} pulados` : ""}!`);
      if (data?.errors?.length) {
        console.warn("Confirmed BC call errors:", data.errors);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar aviso para confirmados");
    } finally {
      setSendingConfirmedCall(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-extrabold uppercase tracking-widest text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Eventos
          </h2>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            Acompanhe os próximos eventos do clã
          </p>
        </div>
        
        {canManageEvents && (
            <div className="flex gap-2">
              <button
                  onClick={() => setShowCreateAnnouncementModal(true)}
                  title="Novo Comunicado"
                  aria-label="Novo Comunicado"
                  className="btn-secondary flex items-center justify-center text-xs p-2.5 min-w-10 h-10"
              >
                  <Megaphone className="w-4 h-4" />
              </button>
              <button 
                  onClick={() => setShowCreateModal(true)}
                  title="Novo Evento"
                  aria-label="Novo Evento"
                  className="btn-primary flex items-center justify-center text-xs p-2.5 min-w-10 h-10"
              >
                  <Plus className="w-4 h-4" />
              </button>
            </div>
        )}
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <p className="font-display text-sm font-extrabold uppercase tracking-wider">Comunicados</p>
        </div>
        {loadingAnnouncements ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body">Nenhum comunicado ativo.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border/30 bg-secondary/20 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm truncate">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.clan} • {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {canManageAnnouncements && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => viewAnnouncementReads(item)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Ciência
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(item)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        title="Remover comunicado"
                        aria-label="Remover comunicado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs whitespace-pre-wrap text-foreground/90 line-clamp-3">{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 glass-card">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground font-body">Carregando eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 glass-card">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-body">Nenhum evento registrado.</p>
          </div>
        ) : (
          events.map(ev => {
            const today = getLocalDateString();
            const isPastEvent = Boolean(ev.event_date) && ev.event_date < today;
            return (
            <div key={ev.id} className="glass-card overflow-hidden hover:border-primary/30 transition-colors">
              {ev.photo_url && (
                <div className="w-full h-32 relative">
                  <img src={ev.photo_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
                  {!ev.is_active && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-xs px-2 py-1 rounded text-muted-foreground font-bold">
                        Encerrado
                    </div>
                  )}
                </div>
              )}
              
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-3">
                        <h3 className="font-display font-bold text-lg leading-tight truncate">{ev.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1.5">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(ev.event_date + "T00:00:00"), "dd/MM/yyyy")}
                            </span>
                            {ev.event_time && (
                                <span className="flex items-center gap-1">
                                    • <Clock className="w-3.5 h-3.5" />
                                    {ev.event_time.slice(0, 5)}
                                </span>
                            )}
                        </div>
                    </div>
                    {ev.event_presences && (
                      <div className="flex items-center gap-2 shrink-0">
                         <button
                           onClick={() => viewAttendees(ev, "confirmed")}
                           className="flex flex-col items-center justify-center bg-primary/10 rounded-xl px-3 py-1.5 border border-primary/20 hover:bg-primary/15 transition-colors"
                         >
                            <div className="flex items-center gap-1.5 text-primary font-display font-extrabold text-sm">
                              <Users className="w-4 h-4" />
                              {ev.event_presences.filter((p: any) => p.status === 'confirmed').length}
                            </div>
                            <span className="text-[9px] text-primary/70 uppercase font-bold tracking-widest mt-0.5">Confirmados</span>
                         </button>
                         <button
                           onClick={() => viewAttendees(ev, "declined")}
                           className="flex flex-col items-center justify-center bg-red-500/10 rounded-xl px-3 py-1.5 border border-red-500/20 hover:bg-red-500/15 transition-colors"
                         >
                            <div className="flex items-center gap-1.5 text-red-500 font-display font-extrabold text-sm">
                              <XCircle className="w-4 h-4" />
                              {ev.event_presences.filter((p: any) => p.status === 'declined').length}
                            </div>
                            <span className="text-[9px] text-red-500/70 uppercase font-bold tracking-widest mt-0.5">Não vão</span>
                         </button>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                    {canManageEvents && (
                        <button 
                          onClick={() => handleToggleActive(ev.id, ev.is_active)}
                          disabled={isPastEvent}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ev.is_active ? 'border-primary/50 text-primary hover:bg-primary/10' : 'border-border text-muted-foreground hover:bg-white/5'}`}
                        >
                            {isPastEvent ? 'Encerrado' : ev.is_active ? 'Ativo' : 'Ativar'}
                        </button>
                    )}
                      <button
                        onClick={() => openClassSummary(ev)}
                        className="text-xs px-3 py-1.5 rounded-xl font-bold border border-border/50 text-foreground hover:bg-white/5 transition-colors"
                      >
                        Por Classe
                      </button>
                    {ev.is_active && (() => {
                       const myPresenceObj = ev.event_presences?.find((p: any) => p.user_id === profile?.id);
                       
                       if (!myPresenceObj) {
                          return (
                             <div className="flex gap-1.5 shrink-0 ml-auto items-center">
                                <button 
                                   onClick={async () => {
                                     try {
                                         const { error } = await supabase
                                           .from("event_presences")
                                           .upsert(
                                             {
                                               event_id: ev.id,
                                               user_id: profile!.id,
                                               status: 'confirmed',
                                               reason: null,
                                               updated_at: new Date().toISOString(),
                                             },
                                             { onConflict: "event_id,user_id" }
                                           );
                                       if (error) throw error;
                                       toast.success("Presença Confirmada!");
                                       fetchEvents();
                                     } catch (err: any) {
                                       toast.error("Erro ao confirmar: " + err.message);
                                     }
                                   }}
                                   className="py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors bg-primary hover:bg-primary/90 text-primary-foreground border border-transparent"
                                >
                                   <CheckCircle2 className="w-3.5 h-3.5" /> VOU
                                </button>
                                <button 
                                   onClick={() => {
                                     setSelectedEvent(ev);
                                     setShowMyPresenceModal(true);
                                     setIsChangingToNo(true);
                                     setMyPresence(null);
                                     setMyReason("");
                                   }}
                                   className="py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors bg-transparent text-red-500 border border-red-500/20 hover:bg-red-500/10"
                                >
                                   <XCircle className="w-3.5 h-3.5" /> FALTAR
                                </button>
                             </div>
                          );
                       } else {
                          return (
                             <button 
                                 onClick={() => openMyPresence(ev)}
                                 className={`py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold ml-auto rounded-xl transition-all border ${myPresenceObj.status === 'confirmed' ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-transparent' : 'bg-transparent text-red-500 border-red-500/20 hover:bg-red-500/10'}`}
                             >
                                 {myPresenceObj.status === 'confirmed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                 {myPresenceObj.status === 'confirmed' ? "Confirmado" : "Ausente"}
                             </button>
                          );
                       }
                    })()}
                    
                    <button 
                        onClick={() => viewAttendees(ev)}
                        className={`py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors shrink-0 bg-secondary/30 hover:bg-secondary/50 border border-border/50 ${!ev.is_active || ev.event_presences?.find((p: any) => p.user_id === profile?.id) ? '' : 'ml-2'}`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Ver Presenças
                    </button>
                </div>
              </div>
            </div>
          )})
        )}
      </div>

      {/* CREATE EVENT MODAL */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Novo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título do Evento</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: GvG vs Clã Inimigo" className="input-modern" />
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</label>
                    <input required type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="input-modern" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hora</label>
                    <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="input-modern" />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">URL da Foto (Opcional)</label>
                <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." className="input-modern pl-9" />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Enviar Foto (Opcional)</label>
                <label className="w-full rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors px-3 py-2.5 text-xs font-bold text-muted-foreground cursor-pointer flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {photoFile ? "Trocar Imagem" : "Selecionar do Celular/Computador"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPhotoFile(file);
                      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                      setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                </label>
                {photoPreviewUrl && (
                  <div className="rounded-xl border border-border/30 bg-secondary/20 p-2">
                    <img src={photoPreviewUrl} alt="Prévia do evento" className="w-full max-h-44 object-cover rounded-lg" />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Se enviar foto, ela terá prioridade sobre a URL.</p>
             </div>
             <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-border/50 bg-background/50 accent-primary" />
                <label htmlFor="isActive" className="text-sm font-body cursor-pointer">Requerer confirmação de presença (Ativo)</label>
             </div>
             
             <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1 py-2 text-sm">Cancelar</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1 py-2 text-sm">
                    {creating ? "Criando..." : "Salvar Evento"}
                </button>
             </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateAnnouncementModal} onOpenChange={setShowCreateAnnouncementModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Comunicado</DialogTitle>
          </DialogHeader>
          <form onSubmit={createAnnouncement} className="space-y-3">
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clã</label>
                <div className="flex flex-wrap gap-1.5">
                  {clans.map((clan) => (
                    <button
                      key={clan.id}
                      type="button"
                      onClick={() => setAnnouncementClan(clan.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        announcementClan === clan.name
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      {clan.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Clã do comunicado: <span className="text-primary font-bold">{profile?.clan || "—"}</span>
              </p>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título</span>
              <input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                className="input-modern"
                placeholder="Ex: Convocação de Guerra"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comunicado</span>
              <textarea
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                className="input-modern min-h-[130px] resize-none"
                placeholder="Mensagem para todo o clã..."
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowCreateAnnouncementModal(false)} className="btn-secondary flex-1 text-sm py-2.5">
                Cancelar
              </button>
              <button type="submit" disabled={creatingAnnouncement} className="btn-primary flex-1 text-sm py-2.5">
                {creatingAnnouncement ? "Salvando..." : "Publicar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAnnouncementReadsModal} onOpenChange={setShowAnnouncementReadsModal}>
        <DialogContent className="max-w-md sm:max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Ciência do Comunicado</DialogTitle>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="rounded-xl border border-border/30 bg-secondary/20 p-3 mb-3">
              <p className="font-display font-bold text-sm">{selectedAnnouncement.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{selectedAnnouncement.clan}</p>
            </div>
          )}
          {loadingAnnouncementReads ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Leram ({announcementReads.length})</p>
                {announcementReads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ninguém confirmou leitura ainda.</p>
                ) : announcementReads.map((item: any) => (
                  <div key={item.user_id} className="rounded-xl border border-border/30 bg-secondary/20 px-3 py-2">
                    <p className="text-sm font-bold">{item.users?.nickname || "Usuário"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.users?.class || "Sem classe"} • {new Date(item.read_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gold">Pendentes ({announcementPending.length})</p>
                {announcementPending.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todos deram ciência.</p>
                ) : announcementPending.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-border/30 bg-secondary/20 px-3 py-2">
                    <p className="text-sm font-bold">{item.nickname}</p>
                    <p className="text-[11px] text-muted-foreground">{item.class || "Sem classe"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MY PRESENCE MODAL */}
      <Dialog open={showMyPresenceModal} onOpenChange={setShowMyPresenceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Minha Presença: {selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAttendees ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
               <>
                 {myPresence && !isChangingToNo ? (
                   <div className="text-center space-y-3 p-4 glass-card">
                      {myPresence.status === 'confirmed' ? (
                        <>
                          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                          <p className="font-display font-bold text-lg">Você confirmou presença!</p>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                          <p className="font-display font-bold text-lg">Falta justificada.</p>
                          <p className="text-sm text-muted-foreground italic">"{myPresence.reason}"</p>
                        </>
                      )}
                      
                      <div className="mt-4 pt-4 border-t border-border/30 flex flex-col gap-2">
                          {myPresence.status === 'declined' && (
                             <button 
                               onClick={() => handleUpdatePresence('confirmed')}
                               className="btn-primary py-2 text-sm"
                             >
                               Mudar para "Vou Participar"
                             </button>
                          )}
                          {myPresence.status === 'confirmed' && (
                             <button 
                               onClick={() => setIsChangingToNo(true)}
                               className="btn-secondary py-2 text-sm hover:!bg-destructive/20 hover:!text-destructive border border-transparent hover:border-destructive/30"
                             >
                               Não poderei ir (Justificar)
                             </button>
                          )}
                      </div>
                   </div>
                 ) : (
                    <div className="space-y-3 p-2">
                       {(!myPresence || isChangingToNo) && (
                          <>
                             <p className="text-sm font-bold text-foreground">Por que você não poderá ir?</p>
                             <textarea 
                                value={myReason} 
                                onChange={e => setMyReason(e.target.value)} 
                                placeholder="Descreva sua justificativa..."
                                className="input-modern min-h-[100px] w-full resize-none"
                             />
                             <div className="flex gap-2 mt-4">
                               <button onClick={() => { setIsChangingToNo(false); if(!myPresence) setShowMyPresenceModal(false); }} className="btn-secondary flex-1 py-2 text-sm">Voltar</button>
                               <button 
                                 onClick={() => handleUpdatePresence('declined')}
                                 className="btn-primary !bg-destructive !text-destructive-foreground hover:!bg-destructive/90 flex-1 py-2 text-sm"
                               >
                                 Salvar Justificativa
                               </button>
                             </div>
                             
                             {!isChangingToNo && !myPresence && (
                               <div className="pt-4 border-t border-border/30 mt-4">
                                  <button onClick={() => handleUpdatePresence('confirmed')} className="btn-primary w-full py-2 text-sm">
                                     Mudei de ideia, Vou Participar!
                                  </button>
                               </div>
                             )}
                          </>
                       )}
                    </div>
                 )}
               </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClassSummaryModal} onOpenChange={setShowClassSummaryModal}>
        <DialogContent className="max-w-md sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Presenças por Classe: {selectedEvent?.title}</DialogTitle>
          </DialogHeader>

          {loadingClassSummary ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : classSummary.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground font-body">Nenhuma presença confirmada para agrupar.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[240px,1fr]">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {classSummary.map((item) => (
                  <button
                    key={item.className}
                    onClick={() => setSelectedClassSummary(item.className)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${selectedClassSummary === item.className ? 'border-primary/40 bg-primary/10' : 'border-border/40 bg-secondary/20 hover:bg-secondary/40'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.className} className="w-6 h-6 rounded-md object-cover border border-border/30 shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="font-display font-bold text-sm truncate">{item.className}</span>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">{item.players.length}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-border/30 bg-background/40 p-4 max-h-[50vh] overflow-y-auto">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">
                  {selectedClassSummary ? `Nomes de ${selectedClassSummary}` : 'Selecione uma classe'}
                </p>
                <div className="space-y-2">
                  {(classSummary.find((item) => item.className === selectedClassSummary)?.players || []).map((player) => (
                    <div key={`${player.className}-${player.name}`} className="rounded-xl bg-secondary/20 border border-border/20 px-3 py-2 text-sm font-medium text-foreground flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {player.imageUrl ? (
                          <img src={player.imageUrl} alt={player.className} className="w-6 h-6 rounded-md object-cover border border-border/30 shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-secondary/40 flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{player.name}</span>
                      </div>
                      {selectedClassSummary === "Todos" && (
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">{player.className}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ATTENDEES MODAL */}
      <Dialog open={showAttendeesModal} onOpenChange={setShowAttendeesModal}>
        <DialogContent className="max-w-md sm:max-w-xl h-[80vh] flex flex-col p-0">
          <div className="p-4 border-b border-border/30 shrink-0 flex items-start justify-between">
             <div>
                 <DialogTitle className="font-display text-lg">{selectedEvent?.title}</DialogTitle>
               <p className="text-xs text-muted-foreground font-body mt-1">{attendeesFilterLabel}</p>
             </div>
             {selectedEvent && (
               <div className="flex flex-wrap gap-2 justify-end">
                 <button
                  onClick={handleCopyConfirmedChars}
                  className="px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 text-[11px] font-bold flex items-center gap-1.5"
                  title="Copiar chars confirmados"
                 >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                 </button>
                 <button
                  onClick={() => handleShareWhatsApp(selectedEvent)}
                  className="px-2.5 py-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors border border-green-500/20 text-[11px] font-bold flex items-center gap-1.5"
                  title="Compartilhar no WhatsApp"
                 >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                 </button>
                 {canManageEvents && (
                   <button
                    onClick={() => handleSendConfirmedDiscordCall(selectedEvent)}
                    disabled={sendingConfirmedCall}
                    className="px-2.5 py-1.5 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 rounded-lg transition-colors border border-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold flex items-center gap-1.5"
                    title="Enviar aviso aos confirmados"
                   >
                    {sendingConfirmedCall ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    Avisar Confirmados
                   </button>
                 )}
                 {canManageEvents && (
                   <button
                    onClick={() => handleSendPendingReminder(selectedEvent)}
                    disabled={sendingPendingReminder}
                    className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold flex items-center gap-1.5"
                    title="Enviar lembrete aos pendentes"
                   >
                    {sendingPendingReminder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    Lembrar Pendentes
                   </button>
                 )}
                 {canManageEvents && (
                   <button
                      onClick={() => handleClearPresences(selectedEvent.id)}
                      className="px-2.5 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-lg transition-colors border border-orange-500/20 text-[11px] font-bold flex items-center gap-1.5"
                      title="Limpar lista de presenças"
                   >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpar Lista
                   </button>
                 )}
                 {canManageEvents && (
                   <button
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="px-2.5 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors border border-destructive/20 text-[11px] font-bold flex items-center gap-1.5"
                      title="Excluir evento"
                   >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Evento
                   </button>
                 )}
               </div>
             )}
          </div>
          <div className="px-4 py-3 border-b border-border/20 space-y-2">
            <input
              value={attendeesSearch}
              onChange={(e) => setAttendeesSearch(e.target.value)}
              placeholder="Buscar por nome, classe ou justificativa..."
              className="input-modern h-9 text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAttendeesStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  attendeesStatusFilter === "all"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                Todos ({attendees.length})
              </button>
              <button
                onClick={() => setAttendeesStatusFilter("confirmed")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  attendeesStatusFilter === "confirmed"
                    ? "border-green-500/40 bg-green-500/15 text-green-500"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                Vai ({attendees.filter((a) => a.status === "confirmed").length})
              </button>
              <button
                onClick={() => setAttendeesStatusFilter("declined")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  attendeesStatusFilter === "declined"
                    ? "border-red-500/40 bg-red-500/15 text-red-500"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                Não Vai ({attendees.filter((a) => a.status === "declined").length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {loadingAttendees ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
             ) : filteredAttendees.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground font-body">
                      {attendeesStatusFilter === "all" ? "Ninguém respondeu ainda." : `Nenhum jogador em ${attendeesFilterLabel.toLowerCase()}.`}
                    </p>
                </div>
             ) : (
                filteredAttendees.map((att, i) => (
                    <div key={i} className="glass-card p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                         {att.users?.avatar_url || att.users?.class_image_url ? (
                           <img src={att.users.avatar_url || att.users.class_image_url} alt={att.users?.nickname || "Personagem"} className="w-8 h-8 rounded-lg object-cover" />
                               ) : (
                                   <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center font-bold text-xs uppercase">
                                     {att.users?.nickname?.substring(0,2) || "??"}
                                   </div>
                               )}
                               <div 
                                    className="cursor-pointer group flex flex-col justify-center"
                                    onClick={() => {
                                        if (att.users?.id && att.users?.nickname) {
                                            setSelectedPlayerForModal({ id: att.users.id, name: att.users.nickname });
                                        }
                                    }}
                               >
                                   <p className="font-bold font-display text-sm leading-none group-hover:text-primary transition-colors">{att.users?.nickname || "Usuário Desconhecido"}</p>
                                   <p className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary/70 transition-colors">
                                      {att.users?.class || "Sem Classe"}
                                      {att.users?.level ? ` • Lvl ${att.users.level}` : ""}
                                   </p>
                               </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                                {att.status === 'confirmed' ? (
                                    <span className="bg-green-500/20 text-green-500 text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Vai
                                    </span>
                                ) : (
                                    <span className="bg-red-500/20 text-red-500 text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Faltará
                                    </span>
                                )}
                                <span className="text-[9px] text-muted-foreground/60 font-sans mt-0.5">
                                   {format(new Date(att.updated_at || att.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </span>
                            </div>
                        </div>
                        
                        {att.status === 'declined' && att.reason && (
                            <div className="mt-1 bg-background/50 rounded-lg p-2 text-xs italic text-muted-foreground border border-border/20">
                                "{att.reason}"
                            </div>
                        )}
                        {(att.users?.id === profile?.id || canManageEvents) && (
                            <div className="mt-1 pt-2 border-t border-border/20 flex justify-end">
                                <button
                                    onClick={() => openMyPresence(selectedEvent)}
                                    className="text-[10px] uppercase font-bold text-primary hover:text-primary/80 transition-colors py-1 px-2 hover:bg-primary/10 rounded"
                                >
                                    {att.users?.id === profile?.id ? "Mudar Minha Presença" : "Mudar Presença"}
                                </button>
                            </div>
                        )}
                    </div>
                ))
             )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlayerForModal && (
        <PlayerCharModal
          playerId={selectedPlayerForModal.id}
          playerName={selectedPlayerForModal.name}
          onClose={() => setSelectedPlayerForModal(null)}
        />
      )}
    </div>
  );
}
